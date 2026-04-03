# Random Blog Website

A Cloudflare Pages website that randomly selects a personal blog from a merged source list built from the Hacker News community dataset and Bear Blog's discovery feed.

A weekly GitHub Action fetches the latest blog list from the [crowd-sourced dataset](https://github.com/mtlynch/hn-popularity-contest-data), pulls Bear Blog's newest discovery feed, health-checks the merged set, and commits a static `domains.json` file plus a lightweight `bearblog-state.json` tracker. The frontend loads `domains.json` directly from the CDN — no edge functions or runtime fetching required.

## Architecture
- **Frontend**: Vanilla HTML/CSS/JS. Loads `domains.json` from the CDN on page load.
- **Discovery UI**: The footer keeps a short "What is this?" explainer and a separate "Sources" toggle that lists the current upstream datasets.
- **Data Pipeline**: GitHub Action (weekly cron) runs `scripts/refresh_domains.py`, which fetches the HN CSV, ingests Bear Blog's newest RSS feed, updates `bearblog-state.json`, runs parallel HEAD checks, and commits `domains.json` of active websites.
- **Source State**: `bearblog-state.json` remembers every Bear Blog domain discovered so far, along with first-seen and latest-post metadata, without requiring a database.
- **Hosting**: Cloudflare Pages (static site, no functions).

## Local Development & Testing

The site is purely static, so any simple HTTP server works:

```bash
# Python (built-in, no install needed)
python3 -m http.server 8788
```

Then open `http://localhost:8788` in your browser.

## Refreshing the Domain List

The domain list is refreshed automatically every Monday at 8:00 AM UTC via GitHub Actions. The refresh script will:

- Fetch the latest HN domain CSV.
- Fetch Bear Blog's newest discovery feed at `https://bearblog.dev/discover/feed/?newest=True`.
- Add newly discovered Bear Blog hostnames into `bearblog-state.json`.
- Health-check the merged candidate list and only keep reachable domains in `domains.json`.

You can also trigger it manually:

1. Go to **Actions** → **Refresh Domain List** → **Run workflow**.
2. If the tracked sources change, a new commit will be pushed and Cloudflare Pages will auto-deploy. The automated commit message records the active domain count, newly discovered Bear Blog domains, and removed domains (for example, `chore: refresh domain list (701 active, 4 Bear Blog new, 18 removed)`).

To perform a refresh matching the GitHub Action locally, run:

```bash
python3 scripts/refresh_domains.py
```

This command rewrites both `domains.json` and `bearblog-state.json`.

## Deployment

Deploys automatically via Cloudflare Pages on push to `main`. Manual deploy:

```bash
npx wrangler pages deploy .
```
