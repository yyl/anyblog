const CSV_URL =
  "https://raw.githubusercontent.com/mtlynch/hn-popularity-contest-data/master/data/domains-meta.csv";

const CACHE_KEY = "https://randomblog-cache/api/domains";
const CACHE_TTL = 60 * 60; // 1 hour in seconds

/**
 * Parse the CSV and extract the first column (domain).
 * Assumes the first column does not contain commas or quotes.
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

export async function onRequest(context) {
  const cache = caches.default;

  // Try to serve from cache
  const cachedResponse = await cache.match(CACHE_KEY);
  if (cachedResponse) {
    return cachedResponse;
  }

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

    const response = new Response(JSON.stringify({ domains }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${CACHE_TTL}`,
        "Access-Control-Allow-Origin": "*",
      },
    });

    // Store in the Cloudflare cache (non-blocking)
    context.waitUntil(cache.put(CACHE_KEY, response.clone()));

    return response;
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Failed to fetch CSV from GitHub" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}
