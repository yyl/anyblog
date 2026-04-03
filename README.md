# Random Blog Website

A Cloudflare Pages website that randomly selects a personal blog from the Hacker News community dataset.

A weekly GitHub Action fetches the latest blog list from the [crowd-sourced dataset](https://github.com/mtlynch/hn-popularity-contest-data), parses valid domains, and commits a static `domains.json` file. The frontend loads this static file directly from the CDN — no edge functions or runtime fetching required.

## Architecture
- **Frontend**: Vanilla HTML/CSS/JS. Loads `domains.json` from the CDN on page load.
- **Data Pipeline**: GitHub Action (weekly cron) fetches CSV → runs parallel HEAD checks → parses → commits `domains.json` of active websites.
- **Hosting**: Cloudflare Pages (static site, no functions).

## Local Development & Testing

The site is purely static, so any simple HTTP server works:

```bash
# Python (built-in, no install needed)
python3 -m http.server 8788
```

Then open `http://localhost:8788` in your browser.

## Refreshing the Domain List

The domain list is refreshed automatically every Monday at 8:00 AM UTC via GitHub Actions. It will verify each domain via a HEAD request, and only keep reachable domains. You can also trigger it manually:

1. Go to **Actions** → **Refresh Domain List** → **Run workflow**.
2. If the list has changed, a new commit will be pushed and Cloudflare Pages will auto-deploy. The automated commit message will record the number of domains that survived the health check versus those that were removed (e.g., `chore: refresh domain list (679 survived, 24 removed)`).

To perform a refresh matching the GitHub Action locally, run the script within `.github/workflows/refresh-domains.yml`.

## Deployment

Deploys automatically via Cloudflare Pages on push to `main`. Manual deploy:

```bash
npx wrangler pages deploy .
```
