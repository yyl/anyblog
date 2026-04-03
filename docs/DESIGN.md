# Anyblog Design

## Overview

Anyblog is a static Cloudflare Pages site that sends visitors to a random blog from a generated domain list.

The frontend reads `domains.json` directly from the deployed site. A GitHub Action refreshes the source data, health-checks candidate domains, and commits updated artifacts back into the repository.

## How The System Works

### Frontend

- `index.html` is a static HTML/CSS/JS page.
- On load, it fetches `domains.json`.
- Clicking the main button picks a random hostname and redirects to `https://<domain>`.
- The footer also fetches `source-counts.json` to show the latest fetched count for each upstream source.

### Refresh Pipeline

- `.github/workflows/refresh-domains.yml` runs on a weekly cron and can also be triggered manually.
- The workflow runs `python3 scripts/refresh_domains.py`.
- The script:
  - fetches the Hacker News Popularity Contest CSV,
  - fetches Bear Blog's newest discovery RSS feed,
  - normalizes domains from both sources through the same parsing path,
  - updates `bearblog-state.json` with Bear Blog discovery metadata,
  - updates `source-counts.json` with the latest per-source counts,
  - runs parallel `curl` HEAD checks against the merged candidate set,
  - writes the surviving domains to `domains.json`.
- The workflow stages the generated artifacts and commits only if something changed.

## Source Data

### Current Sources

- Hacker News Popularity Contest
- Bear Blog newest discovery feed

### Normalization

Both sources use the same domain normalization logic in `scripts/refresh_domains.py` so deduping works consistently.

The normalizer:

- lowercases,
- extracts the hostname from full URLs,
- strips path and port,
- removes a trailing `.`,
- removes a leading `www.`.

## File Structure

### User-Facing Files

- `index.html`: static UI
- `domains.json`: merged list of active blog hostnames
- `source-counts.json`: latest fetched count for each upstream source

### Refresh And Source State

- `.github/workflows/refresh-domains.yml`: scheduled refresh workflow
- `scripts/refresh_domains.py`: source ingestion and health-check script
- `bearblog-state.json`: persisted Bear Blog discovery state

### Documentation

- `README.md`: short user-facing overview
- `docs/DESIGN.md`: technical design and maintenance notes
- `docs/TODO.md`: follow-up work

## Local Development

The site is static, so any simple HTTP server works:

```bash
python3 -m http.server 8788
```

Then open `http://localhost:8788`.

## Running A Refresh Locally

To run the same refresh flow used in GitHub Actions:

```bash
python3 scripts/refresh_domains.py
```

That command rewrites:

- `domains.json`
- `bearblog-state.json`
- `source-counts.json`

## Deployment

- Cloudflare Pages deploys automatically on push to `main`.
- Manual deploy:

```bash
npx wrangler pages deploy .
```
