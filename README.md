# Random Blog Website

A Cloudflare Pages website that randomly selects a personal blog from the Hacker News community dataset.

It uses a Cloudflare Pages Function (`functions/api/domains.js`) as an edge proxy to fetch the raw CSV from GitHub and cache it using the Cache API. The frontend (`index.html`) is static and loads instantly.

## Architecture
- **Frontend**: Vanilla HTML/CSS/JS (Instant load, background data fetch).
- **Backend Proxy**: Cloudflare Pages Function at `/api/domains`.
- **Cache**: Cloudflare Cache API (1-hour TTL, zero config required).

## Local Development & Testing

To test this locally (including the Pages Function), you will use `wrangler`, Cloudflare's CLI tool.

### Prerequisites
Make sure you have Node.js and `npm` installed.

### Running Locally

1. Open your terminal in this repository's directory.
2. Start the local development server:
   ```bash
   npx wrangler pages dev . --port 8788
   ```
3. Open `http://localhost:8788` in your browser.
4. You should see "Loading blogs..." briefly, followed by "713 blogs loaded".
5. Click the "Take me somewhere" button to navigate to a random blog.

*Note: The first request might take a second as it fetches the CSV from GitHub. Subsequent reloads within the hour will hit the edge cache and load in < 50ms.*

## Deployment

To deploy this straight to Cloudflare infrastructure:

```bash
npx wrangler pages deploy .
```
