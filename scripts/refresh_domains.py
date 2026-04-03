#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import json
import subprocess
import sys
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
from urllib.parse import urlparse
from urllib.request import Request, urlopen


HN_CSV_URL = "https://raw.githubusercontent.com/mtlynch/hn-popularity-contest-data/master/data/domains-meta.csv"
BEARBLOG_FEED_URL = "https://bearblog.dev/discover/feed/?newest=True"
DEFAULT_USER_AGENT = "Mozilla/5.0 (compatible; anyblog-refresh/1.0)"
DEFAULT_TIMEOUT = 20
DEFAULT_HEALTHCHECK_WORKERS = 25


@dataclass
class BearEntry:
    domain: str
    link: str
    title: str
    published_at: str | None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Refresh anyblog domains from the HN dataset and Bear Blog newest feed."
    )
    parser.add_argument("--domains-json", default="domains.json")
    parser.add_argument("--bear-state-json", default="bearblog-state.json")
    parser.add_argument("--hn-csv-url", default=HN_CSV_URL)
    parser.add_argument("--bear-feed-url", default=BEARBLOG_FEED_URL)
    parser.add_argument("--github-output", default="")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT)
    parser.add_argument("--healthcheck-workers", type=int, default=DEFAULT_HEALTHCHECK_WORKERS)
    return parser.parse_args()


def fetch_text(url: str, timeout: int) -> str:
    request = Request(url, headers={"User-Agent": DEFAULT_USER_AGENT})
    with urlopen(request, timeout=timeout) as response:
        encoding = response.headers.get_content_charset() or "utf-8"
        return response.read().decode(encoding, errors="replace")


def normalize_domain(candidate: str) -> str | None:
    value = candidate.strip().lower()
    if not value:
        return None

    if "://" in value:
        value = urlparse(value).netloc or urlparse(value).path

    if "/" in value:
        value = value.split("/", 1)[0]

    if ":" in value:
        value = value.split(":", 1)[0]

    value = value.rstrip(".")
    if value.startswith("www."):
        value = value[4:]

    if not value or "." not in value:
        return None

    return value


def fetch_hn_domains(url: str, timeout: int) -> set[str]:
    csv_text = fetch_text(url, timeout)
    reader = csv.DictReader(csv_text.splitlines())

    if not reader.fieldnames or "domain" not in reader.fieldnames:
        raise ValueError("HN CSV is missing the expected 'domain' column")

    domains = {
        normalized
        for row in reader
        if (normalized := normalize_domain(row.get("domain", "")))
    }

    if not domains:
        raise ValueError("HN CSV produced an empty domain set")

    return domains


def _find_text(element: ET.Element, tag_names: Iterable[str]) -> str:
    for child in element:
        local_name = child.tag.split("}", 1)[-1]
        if local_name in tag_names:
            text = (child.text or "").strip()
            if text:
                return text
            href = (child.attrib.get("href") or "").strip()
            if href:
                return href
    return ""


def parse_bear_feed(xml_text: str) -> list[BearEntry]:
    root = ET.fromstring(xml_text)
    entries: list[BearEntry] = []

    for element in root.iter():
        local_name = element.tag.split("}", 1)[-1]
        if local_name not in {"item", "entry"}:
            continue

        link = _find_text(element, {"link"})
        domain = normalize_domain(link)
        if not domain:
            continue

        title = _find_text(element, {"title"}) or link
        published_at = _find_text(element, {"pubDate", "published", "updated"}) or None
        entries.append(BearEntry(domain=domain, link=link, title=title, published_at=published_at))

    if not entries:
        raise ValueError("Bear Blog feed produced no valid items")

    deduped: dict[str, BearEntry] = {}
    for entry in entries:
        deduped[entry.domain] = entry

    return list(deduped.values())


def load_bear_state(path: Path) -> dict:
    if not path.exists():
        return {
            "version": 1,
            "feed_url": BEARBLOG_FEED_URL,
            "last_refreshed_at": None,
            "domains": {},
        }

    with path.open() as handle:
        state = json.load(handle)

    if not isinstance(state, dict):
        raise ValueError(f"{path} must contain a JSON object")

    state.setdefault("version", 1)
    state.setdefault("feed_url", BEARBLOG_FEED_URL)
    state.setdefault("last_refreshed_at", None)
    state.setdefault("domains", {})
    return state


def update_bear_state(state: dict, feed_url: str, entries: list[BearEntry], refreshed_at: str) -> int:
    domains = state.setdefault("domains", {})
    new_domains = 0

    for entry in entries:
        record = domains.get(entry.domain)
        if record is None:
            new_domains += 1
            record = {"first_seen_at": refreshed_at}

        record.update(
            {
                "last_seen_at": refreshed_at,
                "latest_post_url": entry.link,
                "latest_post_title": entry.title,
            }
        )
        if entry.published_at:
            record["latest_post_published_at"] = entry.published_at
        domains[entry.domain] = record

    state["version"] = 1
    state["feed_url"] = feed_url
    state["last_refreshed_at"] = refreshed_at
    return new_domains


def write_json(path: Path, payload: object) -> None:
    with path.open("w") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True)
        handle.write("\n")


def curl_healthcheck(domain: str, timeout: int) -> bool:
    command = [
        "curl",
        "--silent",
        "--output",
        "/dev/null",
        "--head",
        "--location",
        "--connect-timeout",
        "5",
        "--max-time",
        str(timeout),
        "--user-agent",
        DEFAULT_USER_AGENT,
        "--write-out",
        "%{http_code}",
        f"https://{domain}",
    ]
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    return result.returncode == 0


def healthcheck_domains(domains: Iterable[str], timeout: int, workers: int) -> tuple[list[str], list[str]]:
    alive: list[str] = []
    failed: list[str] = []

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(curl_healthcheck, domain, timeout): domain for domain in domains}
        for future in as_completed(futures):
            domain = futures[future]
            try:
                is_alive = future.result()
            except Exception:
                is_alive = False

            if is_alive:
                alive.append(domain)
            else:
                failed.append(domain)

    alive.sort()
    failed.sort()
    return alive, failed


def write_github_output(path: str, values: dict[str, str | int]) -> None:
    if not path:
        return

    with open(path, "a") as handle:
        for key, value in values.items():
            handle.write(f"{key}={value}\n")


def main() -> int:
    args = parse_args()
    domains_path = Path(args.domains_json)
    bear_state_path = Path(args.bear_state_json)

    existing_domains: set[str] = set()
    if domains_path.exists():
        with domains_path.open() as handle:
            existing_domains = set(json.load(handle))

    refreshed_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    hn_domains = fetch_hn_domains(args.hn_csv_url, args.timeout)
    bear_state = load_bear_state(bear_state_path)
    bear_feed_xml = fetch_text(args.bear_feed_url, args.timeout)
    bear_entries = parse_bear_feed(bear_feed_xml)
    new_bear_domains = update_bear_state(bear_state, args.bear_feed_url, bear_entries, refreshed_at)

    bear_domains = set(bear_state["domains"].keys())
    candidates = sorted(hn_domains | bear_domains)
    alive_domains, failed_domains = healthcheck_domains(
        candidates, timeout=args.timeout, workers=args.healthcheck_workers
    )

    removed_domains = len(existing_domains - set(alive_domains))

    write_json(domains_path, alive_domains)
    write_json(bear_state_path, bear_state)

    print(f"HN domains: {len(hn_domains)}")
    print(f"Bear Blog domains tracked: {len(bear_domains)} (+{new_bear_domains} new this run)")
    print(f"Active domains written: {len(alive_domains)}")
    print(f"Failed health checks: {len(failed_domains)}")

    write_github_output(
        args.github_output,
        {
            "active_domains": len(alive_domains),
            "bearblog_new_domains": new_bear_domains,
            "bearblog_tracked_domains": len(bear_domains),
            "removed_domains": removed_domains,
        },
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"refresh failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
