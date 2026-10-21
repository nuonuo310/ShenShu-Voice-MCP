import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { makeStagingMcpServer } from "../src/staging-authenticated-mcp.js";
import { PROPOSED_GENERATED_HOST_TOOL_NAME } from "../src/generated-host-delivery-candidate.js";

const OAUTH_UI_URI = "ui://shenshu/private-fixture-bubble-v2.html";
const V6_UI_MARKER = "v6-host-smoke-20261021";

async function withStagingClient(enabled, fn) {
  const server = makeStagingMcpServer({
    verifiedSubject: "verified_subject_123",
    privateFixtureEnabled: enabled,
  });
  const client = new Client({ name: "host-smoke-v6-audit", version: "0.1.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  try {
    await Promise.all([server.connect(a), client.connect(b)]);
    return await fn(client);
  } finally {
    await client.close();
    await server.close();
  }
}

test("OAuth staging resource exposes the exact v6 build marker and protected probe", async () => {
  await withStagingClient(true, async (client) => {
    const names = (await client.listTools()).tools.map((tool) => tool.name);
    assert.ok(names.includes(PROPOSED_GENERATED_HOST_TOOL_NAME));

    const resource = await client.readResource({ uri: OAUTH_UI_URI });
    const html = resource.contents[0].text;
    assert.equal(resource.contents[0].uri, OAUTH_UI_URI);
    assert.ok(html.includes(V6_UI_MARKER));
    assert.ok(html.includes('id="oauth-ui-build"'));
    assert.ok(html.includes('id="bridge-generated-probe"'));
    assert.ok(html.includes('id="bridge-generated-result"'));
    assert.ok(html.includes('name:"probe_oauth_generated_delivery"'));
    assert.ok(html.includes("const isOAuthBubble=true;"));

    const publicHtml = await readFile(new URL("../ui/mcp-bubble.html", import.meta.url), "utf8");
    assert.equal(publicHtml.includes(V6_UI_MARKER), false);
    assert.equal(publicHtml.includes("const isOAuthBubble=true;"), false);
    assert.match(publicHtml, /id="bridge-generated-probe" type="button" hidden/);
  });
});

test("v6 marker and protected resource stay absent when the fixture flag is off", async () => {
  await withStagingClient(false, async (client) => {
    const names = (await client.listTools()).tools.map((tool) => tool.name);
    assert.equal(names.includes(PROPOSED_GENERATED_HOST_TOOL_NAME), false);
    assert.equal((await client.listResources()).resources.length, 0);
  });
});

test("repository source has no automated deployment configuration", async () => {
  const root = await readdir(new URL("../", import.meta.url));
  for (const name of [
    "render.yaml",
    "render.yml",
    "Dockerfile",
    "Procfile",
    "fly.toml",
    "wrangler.toml",
    "vercel.json",
    "netlify.toml",
  ]) {
    assert.equal(root.includes(name), false, name + " must not silently deploy this branch");
  }
  const workflows = (await readdir(new URL("../.github/workflows", import.meta.url))).sort();
  assert.deepEqual(workflows, ["ci.yml", "d1-readonly-preflight.yml"]);
  const ci = await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
  assert.doesNotMatch(ci, /\bdeploy\b|render|vercel|netlify/i);
});
