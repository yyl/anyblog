const CSV_URL =
  "https://raw.githubusercontent.com/mtlynch/hn-popularity-contest-data/master/data/domains-meta.csv";

const CACHE_KEY = "https://randomblog-cache/api/domains";
const CACHE_TTL = 60 * 60; // 1 hour in seconds

/**
 * Parse the CSV and extract the first column (domain).
 * Handles quoted fields properly.
 */
function parseDomains(csvText) {
  const lines = csvText.split("\n");
  const domains = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // The domain is always the first column and never contains commas or quotes
    const commaIndex = line.indexOf(",");
    const domain = commaIndex === -1 ? line : line.substring(0, commaIndex);

    if (domain) {
      domains.push(domain);
    }
  }

  return domains;
}

function isAllowedOrigin(origin, requestUrl) {
  if (!origin) return false;

  try {
    const originUrl = new URL(origin);
    const hostUrl = new URL(requestUrl);

    // Allow same origin
    if (originUrl.origin === hostUrl.origin) return true;

    // Allow localhost for development
    if (
      originUrl.hostname === "localhost" ||
      originUrl.hostname === "127.0.0.1"
    ) {
      return true;
    }

    // Allow Cloudflare Pages preview domains
    if (originUrl.hostname.endsWith(".pages.dev")) return true;
  } catch (err) {
    return false;
  }

  return false;
}

export async function onRequest(context) {
  const { request } = context;
  const origin = request.headers.get("Origin");
  const cache = caches.default;

  // Try to serve from cache
  let response = await cache.match(CACHE_KEY);

  if (!response) {
    // Cache miss — fetch from GitHub
    try {
      const res = await fetch(CSV_URL, {
        headers: { "User-Agent": "randomblog-cloudflare-pages-function" },
      });

      if (!res.ok) {
        return new Response(
          JSON.stringify({ error: `GitHub returned ${res.status}` }),
          { status: 502, headers: { "Content-Type": "application/json" } }
        );
      }

      const csvText = await res.text();
      const domains = parseDomains(csvText);

      response = new Response(JSON.stringify({ domains }), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `public, max-age=${CACHE_TTL}`,
        },
      });

      // Store in the Cloudflare cache (non-blocking)
      context.waitUntil(cache.put(CACHE_KEY, response.clone()));
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch CSV from GitHub" }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // Create a new response to set CORS headers dynamically
  const newResponse = new Response(response.body, response);
  newResponse.headers.set("Vary", "Origin");

  if (isAllowedOrigin(origin, request.url)) {
    newResponse.headers.set("Access-Control-Allow-Origin", origin);
  }

  return newResponse;
}
