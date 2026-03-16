const fs = require('fs');
const path = require('path');

// Mock global classes that are available in Cloudflare Workers environment
class Response {
  constructor(body, init = {}) {
    this.body = body;
    this.status = init.status || 200;
    this.headers = new Map();

    if (init.headers) {
      if (init.headers instanceof Map) {
        init.headers.forEach((v, k) => this.headers.set(k, v));
      } else {
        Object.entries(init.headers).forEach(([k, v]) => this.headers.set(k, v));
      }
    }
  }
  clone() {
    return new Response(this.body, {
      status: this.status,
      headers: new Map(this.headers)
    });
  }
}

class URL {
  constructor(url) {
    const parsed = new (require('url').URL)(url);
    this.href = parsed.href;
    this.origin = parsed.origin;
    this.hostname = parsed.hostname;
  }
}

global.Response = Response;
global.URL = URL;
global.caches = {
  default: {
    match: async () => null,
    put: async () => {}
  }
};
global.fetch = async () => ({
  ok: true,
  text: async () => "domain,count\nexample.com,1\ntest.com,2"
});

async function runTest() {
  // Use dynamic import to load the ESM module
  const modulePath = path.join(__dirname, '../functions/api/domains.js');
  const { onRequest } = await import('file://' + modulePath);

  const tests = [
    {
      name: "Same origin should be allowed",
      origin: "https://my-site.com",
      url: "https://my-site.com/api/domains",
      expected: "https://my-site.com"
    },
    {
      name: "Localhost should be allowed",
      origin: "http://localhost:8788",
      url: "https://my-site.com/api/domains",
      expected: "http://localhost:8788"
    },
    {
      name: "pages.dev should be allowed",
      origin: "https://preview.pages.dev",
      url: "https://my-site.com/api/domains",
      expected: "https://preview.pages.dev"
    },
    {
      name: "Malicious site should NOT be allowed",
      origin: "https://malicious.com",
      url: "https://my-site.com/api/domains",
      expected: undefined
    },
    {
      name: "No origin should NOT have the header",
      origin: null,
      url: "https://my-site.com/api/domains",
      expected: undefined
    }
  ];

  let passed = 0;
  for (const t of tests) {
    const context = {
      request: {
        url: t.url,
        headers: {
          get: (name) => name.toLowerCase() === 'origin' ? t.origin : null
        }
      },
      waitUntil: () => {}
    };

    const res = await onRequest(context);
    const corsHeader = res.headers.get("Access-Control-Allow-Origin");

    if (corsHeader === t.expected) {
      console.log(`✅ PASS: ${t.name}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${t.name}. Expected: ${t.expected}, Got: ${corsHeader}`);
    }
  }

  console.log(`\nTests passed: ${passed}/${tests.length}`);
  if (passed !== tests.length) {
    process.exit(1);
  }
}

runTest().catch(err => {
  console.error(err);
  process.exit(1);
});
