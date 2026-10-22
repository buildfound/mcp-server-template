#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

try {
  await createServer().connect(new StdioServerTransport());
} catch (error) {
  console.error("Failed to start MCP server:", error);
  process.exitCode = 1;
}
