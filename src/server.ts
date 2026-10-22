import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { add } from "./tools/add.js";
import { wordStats } from "./tools/word-stats.js";

// This relative path works from both src/ and dist/.
const { name, version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { name: string; version: string };

export function createServer(): McpServer {
  const server = new McpServer({ name, version });

  server.registerTool(
    "add",
    {
      description: "Add two numbers.",
      inputSchema: { a: z.number(), b: z.number() },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ a, b }) => ({ content: [{ type: "text", text: String(add(a, b)) }] }),
  );

  server.registerTool(
    "word_stats",
    {
      description: "Count words and Unicode characters, and rank words by frequency (case-insensitive).",
      inputSchema: {
        text: z.string().max(100_000).describe("Text to analyze (up to 100,000 UTF-16 code units)."),
        top: z.number().int().min(1).max(20).default(5).describe("Number of top words to return."),
      },
      outputSchema: {
        wordCount: z.number().int().nonnegative(),
        characterCount: z.number().int().nonnegative(),
        topWords: z.array(z.object({ word: z.string(), count: z.number().int().positive() })),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ text, top }) => {
      const result = wordStats(text, top);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: { ...result },
      };
    },
  );

  server.registerResource(
    "server-info",
    "info://server",
    { description: "Server identity and available tools.", mimeType: "application/json" },
    (uri) => ({
      contents: [{
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify({ name, version, tools: ["add", "word_stats"] }, null, 2),
      }],
    }),
  );

  return server;
}
