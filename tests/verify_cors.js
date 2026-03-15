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
    const match = url.match(/^(https?:\/\/)?([^\/]+)(\/.*)?$/);
    this.href = url;
    this.origin = (match[1] || '') + match[2];
    this.hostname = match[2].split(':')[0];
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

// Load the function code
let code = fs.readFileSync(path.join(__dirname, '../functions/api/domains.js'), 'utf8');

// Remove exports for evaluation
code = code.replace(/export /g, '');

// Create a sandbox for the code
const sandbox = {
  console,
  global,
  Response,
  URL,
  caches,
  fetch,
  module: { exports: {} }
};

// Evaluate the code
const script = `
  ${code}
  module.exports = { onRequest };
`;

try {
  const fn = new Function('module', 'Response', 'URL', 'caches', 'fetch', script);
  fn(sandbox.module, Response, URL, caches, fetch);
} catch (e) {
  console.error("Failed to evaluate script:", e);
  process.exit(1);
}

const { onRequest } = sandbox.module.exports;

async function runTest() {
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
