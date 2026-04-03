# Random Blog Website

A Cloudflare Pages website that randomly selects a personal blog from the Hacker News community dataset.

A weekly GitHub Action fetches the latest blog list from the [crowd-sourced dataset](https://github.com/mtlynch/hn-popularity-contest-data), parses valid domains, and commits a static `domains.json` file. The frontend loads this static file directly from the CDN — no edge functions or runtime fetching required.

## Architecture
- **Frontend**: Vanilla HTML/CSS/JS. Loads `domains.json` from the CDN on page load.
- **Data Pipeline**: GitHub Action (weekly cron) fetches CSV → parses → commits `domains.json`.
- **Hosting**: Cloudflare Pages (static site, no functions).

## Local Development & Testing

The site is purely static, so any simple HTTP server works:

```bash
# Python (built-in, no install needed)
python3 -m http.server 8788
```

Then open `http://localhost:8788` in your browser.

## Refreshing the Domain List

The domain list is refreshed automatically every Monday at 8:00 AM UTC via GitHub Actions. You can also trigger it manually:

1. Go to **Actions** → **Refresh Domain List** → **Run workflow**.
2. If the list has changed, a new commit will be pushed and Cloudflare Pages will auto-deploy.

To refresh locally:
```bash
curl -fsSL "https://raw.githubusercontent.com/mtlynch/hn-popularity-contest-data/master/data/domains-meta.csv" \
  | tail -n +2 | cut -d',' -f1 \
  | grep -E '^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]$' \
  | sort | jq -R -s 'split("\n") | map(select(length > 0))' > domains.json
```

## Deployment

Deploys automatically via Cloudflare Pages on push to `main`. Manual deploy:

```bash
npx wrangler pages deploy .
```
