# TypeScript MCP server template

A small, forkable [Model Context Protocol](https://modelcontextprotocol.io/) server using the official `@modelcontextprotocol/sdk` 1.x, Zod, strict TypeScript, ESM and Node.js 20+. No API keys or external services required. MIT licensed.

It exposes two tools and one resource:

| Capability | Input | Result |
| --- | --- | --- |
| `add` tool | `{ "a": 2, "b": 3 }` | Text: `5` |
| `word_stats` tool | `{ "text": "Hello hello world!", "top": 1 }` | Word count, character count and ranked words, as JSON text and schema-validated `structuredContent` |
| `info://server` resource | Resource URI | JSON with package name, version and tool names |

`word_stats` defaults to five top words (range 1–20). Words are runs of Unicode letters/numbers, normalized to NFC and lowercased; punctuation separates words. Ties sort by word using JavaScript string order, without locale-dependent collation. Character count measures Unicode code points in the original text, including spaces and punctuation; it is not a grapheme count. Input is limited to 100,000 UTF-16 code units.

## Quick start

```sh
git clone https://github.com/buildfound/mcp-server-template.git
cd mcp-server-template
npm install
npm run typecheck
npm run build
npm test
npm run inspect
```

The Inspector opens a UI for listing tools, calling them and reading resources. Try `word_stats` with `{"text":"Hello hello world!","top":1}`. It returns:

```json
{
  "wordCount": 3,
  "characterCount": 18,
  "topWords": [{ "word": "hello", "count": 2 }]
}
```

After the first install, use `npm ci` for installs from `package-lock.json`.

## Project layout

```text
src/
  server.ts             createServer(): tools, schemas and resource
  stdio.ts              Executable stdio entrypoint
  http.ts               HTTP factory and entrypoint
  tools/
    add.ts              Pure addition function
    word-stats.ts       Pure text analysis function
test/
  tools.test.ts         Unit tests
  server.test.ts        SDK Client + InMemoryTransport integration
  http.test.ts          Real HTTP endpoint + SDK clients
```

`tsc` compiles only `src/` into `dist/`. Typechecking includes tests too. The package `bin` points at `dist/stdio.js`, which preserves the Node shebang. Server identity comes from `package.json`; keep that file next to `dist/` when copying the build.

## Add your own tool

Put business logic in a pure function under `src/tools/`, then import and register it inside `createServer()` in `src/server.ts`. For example:

```ts
// src/tools/greet.ts
export function greet(name: string): string {
  return `Hello, ${name}!`;
}

// src/server.ts (z and server already exist here)
// Add this import at the top:
import { greet } from "./tools/greet.js";

// Add this registration inside createServer():
server.registerTool(
  "greet",
  {
    description: "Greet someone by name.",
    inputSchema: { name: z.string().min(1).max(100) },
  },
  ({ name }) => ({ content: [{ type: "text", text: greet(name) }] }),
);
```

The SDK validates arguments against the Zod schema. Follow `word_stats` for an `outputSchema` and `structuredContent`; keep a text representation for clients that display text results. Update the tool list in `info://server`, add tests, and rebuild before restarting your client. See the [SDK v1 server guide](https://ts.sdk.modelcontextprotocol.io/server) for other capabilities.

## Transports and scripts

### Stdio

```sh
npm start       # Runs node dist/stdio.js; build first
npm run dev    # Watches src/stdio.ts with tsx
```

Use stdio when a local MCP client launches the server as a child process. Running it in a terminal waits for MCP messages; it is not an interactive CLI. Stdout carries protocol messages only. Send diagnostics to stderr with `console.error`.

### Streamable HTTP

```sh
npm run build
npm run start:http
curl http://127.0.0.1:3000/health
# {"status":"ok"}
```

The endpoint is `http://127.0.0.1:3000/mcp`. Configure `HOST` and `PORT` in the process environment; defaults are `127.0.0.1` and `3000`. For example, in a POSIX shell:

```sh
HOST=127.0.0.1 PORT=3001 npm run start:http
npx tsx watch src/http.ts
```

HTTP uses **stateless mode**: every POST gets a fresh `McpServer` and `StreamableHTTPServerTransport`, with JSON responses and no session ID. There is no persistent server-to-client stream, session storage or resumability. `GET /mcp` and `DELETE /mcp` return `405 Method Not Allowed`, as there is no stream or session to manage. `GET /health` returns JSON. Use HTTP for a separately running process or as a starting point for a secured network service.

| Script | Purpose |
| --- | --- |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run typecheck` | Check source and test types without emitting |
| `npm test` | Run unit, in-memory integration and real HTTP tests |
| `npm run inspect` | Build and launch MCP Inspector against stdio |

## Connect a client

Build first. Replace `/absolute/path/mcp-server-template` below with your checkout's absolute path. If a GUI client cannot find `node`, use the absolute path to your Node executable too. On Windows, use escaped paths such as `C:\\path\\mcp-server-template\\dist\\stdio.js` in JSON.

### Claude Desktop

Open Settings → Developer → Edit Config and merge this into `claude_desktop_config.json`, preserving any existing servers. Quit and reopen the app after saving. See the [local server setup guide](https://modelcontextprotocol.io/docs/develop/connect-local-servers).

```json
{
  "mcpServers": {
    "template": {
      "command": "node",
      "args": ["/absolute/path/mcp-server-template/dist/stdio.js"]
    }
  }
}
```

### Claude Code

Choose one transport. The HTTP command requires the HTTP server to be running separately. These follow the [Claude Code MCP commands](https://code.claude.com/docs/en/mcp).

```sh
claude mcp add --transport stdio template -- node /absolute/path/mcp-server-template/dist/stdio.js
claude mcp add --transport http template-http http://127.0.0.1:3000/mcp
claude mcp list
```

Use `/mcp` inside Claude Code to check the connection.

### Cursor

Add this to `.cursor/mcp.json` in your project, or merge it into `~/.cursor/mcp.json` for a global setup. See [Cursor's MCP configuration](https://cursor.com/docs/mcp).

```json
{
  "mcpServers": {
    "template": {
      "command": "node",
      "args": ["/absolute/path/mcp-server-template/dist/stdio.js"]
    }
  }
}
```

### VS Code

For the VS Code configuration format, create `.vscode/mcp.json` with the following. Use **MCP: List Servers** to start it. See the [VS Code MCP configuration reference](https://code.visualstudio.com/docs/agents/reference/mcp-configuration).

```json
{
  "servers": {
    "template": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/mcp-server-template/dist/stdio.js"]
    }
  }
}
```

For a separately running HTTP server, replace the entry with `{"type":"http","url":"http://127.0.0.1:3000/mcp"}`.

### MCP Inspector

`npm run inspect` builds and starts the [official Inspector](https://github.com/modelcontextprotocol/inspector) with the stdio entrypoint. To inspect HTTP, run `npm run start:http` in one terminal and `npx @modelcontextprotocol/inspector` in another, choose **Streamable HTTP**, and enter `http://127.0.0.1:3000/mcp`.

## Testing

Unit tests exercise pure logic, including Unicode, empty input and ranking ties. The in-memory test uses an SDK `Client` to initialize, list tools/resources, call both tools, read `info://server` and check schema rejection. The HTTP test binds an ephemeral port and connects two independent SDK clients; it also checks health, unsupported methods, malformed JSON and Host/Origin rejection. No external services are needed.

## Security and forking

- HTTP binds to loopback by default and has no authentication. Add authentication, authorization, TLS, request limits and deployment-specific validation before exposing it beyond your machine.
- Host validation helps prevent DNS rebinding: accepted authorities are `127.0.0.1`, `localhost`, `[::1]` and the configured `HOST`, each with the bound port. Wildcard bind addresses (`0.0.0.0`, `::`) are excluded from this allowlist. If you bind a wildcard address, only loopback authorities work until you explicitly extend validation for your deployment.
- Requests with an `Origin` must match `http://` plus the validated Host exactly. Cross-origin requests are rejected; CORS is not enabled. Configure an explicit trusted host/origin policy when adding a reverse proxy, TLS or browser access. Host/Origin checks are not authentication.
- Example tools are offline and read-only. Treat new tools as code running with the server process's permissions. Validate inputs, bound work, protect secrets and avoid logging sensitive tool data. `.env` is ignored but is not automatically loaded.

Fork the repository, rename the package and bin in `package.json`, update descriptions and resource metadata, and replace the example tools. Run `npm install` to refresh lockfile metadata after renaming, then typecheck, build and test. Keep the MIT copyright and license notice.

Built by [BuildFound](https://buildfound.com), a founder-led AI product studio.

## License

[MIT](LICENSE) © 2026 Fekri Darkaoui.
