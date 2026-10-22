import assert from "node:assert/strict";
import { once } from "node:events";
import { request } from "node:http";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createHttpServer } from "../src/http.js";

test("real HTTP transport works without sessions and rejects unsafe requests", { timeout: 10_000 }, async (t) => {
  const server = createHttpServer();
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  const health = await fetch(`${base}/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: "ok" });
  for (const method of ["GET", "DELETE", "PUT"]) {
    const response = await fetch(`${base}/mcp`, { method });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "POST");
    await response.text();
  }
  const unknown = await fetch(`${base}/missing`);
  assert.equal(unknown.status, 404);
  await unknown.text();
  const unsafeHeaders: Record<string, string>[] = [
    { Host: "attacker.example" }, { Origin: "https://attacker.example" },
  ];
  for (const headers of unsafeHeaders) {
    // node:http preserves a custom Host header; fetch can replace it.
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const req = request(`${base}/mcp`, { method: "POST", headers }, (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode));
      });
      req.on("error", reject);
      req.end();
    });
    assert.equal(status, 403);
  }
  const malformed = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: "{",
  });
  assert.equal(malformed.status, 400);
  await malformed.text();

  // Separate clients share the endpoint, but never a transport or session.
  await Promise.all([1, 2].map(async (n) => {
    const client = new Client({ name: `http-test-${n}`, version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp`));
    try {
      await client.connect(transport);
      assert.equal(transport.sessionId, undefined);
      assert.equal((await client.listTools()).tools.length, 2);
      const sum = await client.callTool({ name: "add", arguments: { a: n, b: 10 } });
      assert.deepEqual(sum.content, [{ type: "text", text: String(n + 10) }]);
      const stats = await client.callTool({ name: "word_stats", arguments: { text: "one one two" } });
      assert.deepEqual(stats.structuredContent, {
        wordCount: 3, characterCount: 11,
        topWords: [{ word: "one", count: 2 }, { word: "two", count: 1 }],
      });
      assert.equal((await client.listResources()).resources[0]?.uri, "info://server");
      assert.equal((await client.readResource({ uri: "info://server" })).contents.length, 1);
    } finally {
      await client.close();
    }
  }));
});
