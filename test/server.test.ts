import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";

test("SDK client discovers and uses tools and resources in memory", async (t) => {
  const server = createServer();
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  t.after(async () => { await client.close(); await server.close(); });
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((tool) => tool.name).sort(), ["add", "word_stats"]);
  assert.ok(tools.find((tool) => tool.name === "word_stats")?.outputSchema);
  const sum = await client.callTool({ name: "add", arguments: { a: 2, b: 3 } });
  assert.deepEqual(sum.content, [{ type: "text", text: "5" }]);

  const stats = await client.callTool({
    name: "word_stats", arguments: { text: "Hello hello world!", top: 1 },
  });
  const expected = {
    wordCount: 3,
    characterCount: 18,
    topWords: [{ word: "hello", count: 2 }],
  };
  assert.deepEqual(stats.structuredContent, expected);
  assert.deepEqual(stats.content, [{ type: "text", text: JSON.stringify(expected, null, 2) }]);
  const defaults = await client.callTool({ name: "word_stats", arguments: { text: "" } });
  assert.deepEqual(defaults.structuredContent, { wordCount: 0, characterCount: 0, topWords: [] });

  const { resources } = await client.listResources();
  assert.equal(resources[0]?.uri, "info://server");
  assert.equal(resources[0]?.mimeType, "application/json");
  const { contents } = await client.readResource({ uri: "info://server" });
  assert.equal(contents[0]?.mimeType, "application/json");
  assert.ok(contents[0] && "text" in contents[0]);
  const info = JSON.parse(contents[0].text);
  assert.equal(info.name, "mcp-server-template");
  assert.equal(info.version, client.getServerVersion()?.version);
  assert.deepEqual(info.tools, ["add", "word_stats"]);

  for (const args of [{ text: "hello", top: 0 }, { text: "hello", top: 1.5 }, { text: 42 }]) {
    const invalid = await client.callTool({ name: "word_stats", arguments: args });
    assert.equal(invalid.isError, true);
  }
  const invalidAdd = await client.callTool({ name: "add", arguments: { a: "2", b: 3 } });
  assert.equal(invalidAdd.isError, true);
});
