import { createServer as createHttpServer } from "node:http";
import { readFileSync } from "node:fs";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { checkText } from "./src/contract.js";

const MCP_PATH = "/mcp";
const RESOURCE_URI = "ui://shenshu/voice-bubble-v1.html";
const FIXTURE_AUDIO_URL =
  "https://raw.githubusercontent.com/nuonuo310/ShenShu-Voice/main/public/audio/first-english.mp3";
const bubbleHtml = readFileSync(new URL("./ui/mcp-bubble.html", import.meta.url), "utf8");

const inputSchema = {
  text: z.string().min(1).max(800),
};

const outputSchema = {
  record: z.object({
    id: z.string(),
    title: z.string(),
    text: z.string(),
    audioUrl: z.string().url(),
    durationSeconds: z.number().positive().max(60),
    voiceLabel: z.string(),
    generated: z.boolean(),
    source: z.literal("fixture"),
  }),
};

export function createShenShuServer() {
  const server = new McpServer({
    name: "shenshu-voice-mcp",
    version: "0.2.0",
  });

  registerAppResource(
    server,
    "shenshu-voice-bubble",
    RESOURCE_URI,
    {},
    async () => ({
      contents: [
        {
          uri: RESOURCE_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: bubbleHtml,
          _meta: {
            ui: {
              prefersBorder: false,
              csp: {
                connectDomains: [],
                resourceDomains: ["https://raw.githubusercontent.com"],
              },
            },
          },
        },
      ],
    }),
  );

  registerAppTool(
    server,
    "preview_shenshu_voice",
    {
      title: "Preview ShenShu voice bubble",
      description:
        "Renders the ShenShu chat voice bubble with a fixed, non-generated audio fixture. This tool never calls MiniMax and never spends credits.",
      inputSchema,
      outputSchema,
      _meta: {
        ui: { resourceUri: RESOURCE_URI },
      },
    },
    async ({ text }) => {
      const safeText = checkText(text);
      const record = {
        id: "fixture_voice_001",
        title: "沈述 · 语音留言",
        text: safeText,
        audioUrl: FIXTURE_AUDIO_URL,
        durationSeconds: 10.056,
        voiceLabel: "沈述",
        generated: false,
        source: "fixture",
      };
      return {
        content: [
          {
            type: "text",
            text:
              "Preview only: this is the existing English fixture, not newly generated speech and no MiniMax credits were used.",
          },
        ],
        structuredContent: { record },
      };
    },
  );

  return server;
}

const port = Number(process.env.PORT ?? 8787);

export const httpServer = createHttpServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400).end("missing_url");
    return;
  }
  const url = new URL(req.url, \`http://\${req.headers.host ?? "localhost"}\`);

  if (req.method === "OPTIONS" && url.pathname === MCP_PATH) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, mcp-session-id",
      "Access-Control-Expose-Headers": "Mcp-Session-Id",
    });
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/") {
    res
      .writeHead(200, { "content-type": "text/plain; charset=utf-8" })
      .end("ShenShu Voice MCP P1-MOCK");
    return;
  }

  const allowed = new Set(["POST", "GET", "DELETE"]);
  if (url.pathname === MCP_PATH && req.method && allowed.has(req.method)) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

    const server = createShenShuServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on("close", () => {
      transport.close();
      server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch {
      if (!res.headersSent) res.writeHead(500).end("internal_error");
    }
    return;
  }

  res.writeHead(404).end("not_found");
});

if (process.env.NODE_ENV !== "test") {
  httpServer.listen(port, () => {
    console.log(\`ShenShu Voice MCP P1-MOCK listening on http://localhost:\${port}\${MCP_PATH}\`);
  });
}
