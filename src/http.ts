import { createServer as createNodeServer } from "node:http";
import { pathToFileURL } from "node:url";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./server.js";

export function createHttpServer(host = "127.0.0.1") {
  const httpServer = createNodeServer(async (req, res) => {
    // Validate the authority before routing, including on /health.
    const address = httpServer.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const hostname = host.includes(":") ? `[${host}]` : host;
    const allowedHosts = ["127.0.0.1", "localhost", "[::1]", hostname]
      .filter((value) => value !== "0.0.0.0" && value !== "[::]")
      .map((value) => `${value}:${port}`);
    if (!req.headers.host || !allowedHosts.includes(req.headers.host) ||
        (req.headers.origin !== undefined && req.headers.origin !== `http://${req.headers.host}`)) {
      res.writeHead(403).end("Forbidden Host or Origin");
      return;
    }

    const path = req.url?.split("?")[0];
    if (path === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" }).end('{"status":"ok"}');
      return;
    }
    if (path !== "/mcp") {
      res.writeHead(404).end("Not found");
      return;
    }
    // Stateless mode has no persistent SSE stream or session to delete.
    if (req.method !== "POST") {
      res.writeHead(405, { Allow: "POST" }).end("Method not allowed");
      return;
    }

    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    // Closing the McpServer also closes its transport. Attach before handling
    // the request so even a fast response or disconnected client is cleaned up.
    res.on("close", () => { void server.close().catch(console.error); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("MCP request failed:", error);
      if (!res.headersSent) res.writeHead(500).end("Internal server error");
      else res.end();
    }
  });
  return httpServer;
}

// Importing this module in tests does not open a port.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const host = process.env.HOST ?? "127.0.0.1";
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("PORT must be an integer from 0 to 65535");
  }
  const server = createHttpServer(host);
  server.on("error", (error) => {
    console.error("HTTP server failed:", error);
    process.exitCode = 1;
  });
  server.listen(port, host, () => {
    const address = server.address();
    const boundPort = typeof address === "object" && address ? address.port : port;
    console.error(`MCP HTTP server listening on ${host}:${boundPort}`);
  });
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => server.close());
  }
}
