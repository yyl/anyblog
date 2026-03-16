import { parseDomains } from "./domains.js";
import assert from "node:assert";
import test from "node:test";

test("parseDomains validates domains correctly", () => {
  const csvData = `domain,count
example.com,10
valid-domain.org,5
sub.domain.co.uk,3
invalid_domain,1
domain with space.com,1
javascript:alert(1),1
test@example.com,1
.starting.dot,1
ending.dot.,1
-starting.dash,1
ending.dash-,1
a.b,1
`;

  const expected = ["example.com", "valid-domain.org", "sub.domain.co.uk"];
  const result = parseDomains(csvData);

  assert.deepStrictEqual(result, expected);
});

test("parseDomains handles empty lines and malformed CSV", () => {
  const csvData = `domain,count


another.com,2
`;
  const expected = ["another.com"];
  const result = parseDomains(csvData);
  assert.deepStrictEqual(result, expected);
});
