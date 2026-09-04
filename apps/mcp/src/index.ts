import { randomUUID } from "node:crypto";
import express, { type Request, type Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  getOAuthProtectedResourceMetadataUrl,
  mcpAuthRouter,
} from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { config } from "./config.js";
import { oauthProvider } from "./auth/provider.js";
import { loginRouter } from "./auth/login-page.js";
import { registerTools } from "./tools/index.js";
import { startJanitor } from "./ingest/janitor.js";

interface Session {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
  userId: string;
}
const sessions = new Map<string, Session>();

export function createApp() {
  const app = express();

  // OAuth 2.1: metadata + /authorize + /token + /register (DCR). Mount ở root.
  app.use(
    mcpAuthRouter({
      provider: oauthProvider,
      issuerUrl: new URL(config.baseUrl),
      resourceServerUrl: new URL(`${config.baseUrl}/mcp`),
      resourceName: "Vingo study-kit",
    }),
  );

  // Login page dán pairing code (GET/POST /login).
  app.use(loginRouter);

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true, sessions: sessions.size });
  });

  const bearer = requireBearerAuth({
    verifier: oauthProvider,
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(new URL(`${config.baseUrl}/mcp`)),
  });

  // POST /mcp: khởi tạo session mới (initialize) hoặc chuyển tiếp vào session sẵn có.
  app.post("/mcp", bearer, express.json({ limit: "4mb" }), async (req: Request, res: Response) => {
    try {
      const sid = req.header("mcp-session-id");
      const existing = sid ? sessions.get(sid) : undefined;
      if (existing) {
        await existing.transport.handleRequest(req, res, req.body);
        return;
      }

      if (!isInitializeRequest(req.body)) {
        res.status(400).json({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Chưa có session hợp lệ — gửi initialize trước." },
          id: null,
        });
        return;
      }

      const userId = req.auth?.extra?.userId as string | undefined;
      if (!userId) {
        res.status(401).json({ jsonrpc: "2.0", error: { code: -32001, message: "Không xác định user." }, id: null });
        return;
      }

      const server = new McpServer({ name: "study-kit-mcp", version: "0.1.0" });
      registerTools(server, userId);
      let transport!: StreamableHTTPServerTransport;
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          sessions.set(id, { server, transport, userId });
        },
      });
      transport.onclose = () => {
        if (transport.sessionId) sessions.delete(transport.sessionId);
      };
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (e) {
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: e instanceof Error ? e.message : "Internal error" },
          id: null,
        });
      }
    }
  });

  // GET (SSE)/DELETE /mcp: theo session sẵn có.
  const bySession = async (req: Request, res: Response) => {
    const sid = req.header("mcp-session-id");
    const session = sid ? sessions.get(sid) : undefined;
    if (!session) {
      res.status(404).send("Unknown or expired session");
      return;
    }
    await session.transport.handleRequest(req, res);
  };
  app.get("/mcp", bearer, bySession);
  app.delete("/mcp", bearer, bySession);

  return app;
}

// Chạy server khi start trực tiếp; bỏ qua khi import trong test (vitest set VITEST).
if (!process.env.VITEST) {
  createApp().listen(config.port, () => {
    console.log(`study-kit-mcp: ${config.baseUrl}/mcp  (web ${config.webUrl})`);
  });
  startJanitor();
}
