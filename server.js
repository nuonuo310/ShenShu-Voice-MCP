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
import { makeInlineToneFixture } from "./src/inline-fixture.js";
import { handleProtectedResourceShell } from "./src/protected-resource-shell.js";
import { handlePrivateWebPlayer } from "./src/private-web-player.js";
import { createD1AdmissionDryRun } from "./src/d1-admission-dry-run.js";
import { resolveProtectedResourceIdentity } from "./src/protected-resource-identity.js";
import { createCloudflareD1Http } from "./src/cloudflare-d1-http.js";
import { composeV1P2StagingRuntime } from "./src/v1-p2-staging-runtime.js";

const MCP_PATH = "/mcp";
const TONE_PATH = "/test-tone.wav";
const PUBLIC_TONE_URL = "https://shenshu-voice-mcp.onrender.com/test-tone.wav";
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
                resourceDomains: ["https://raw.githubusercontent.com", "https://shenshu-voice-mcp.onrender.com"],
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


  registerAppTool(
    server,
    "preview_inline_audio",
    {
      title: "Test inline WAV audio delivery",
      description: "Plays a 0.7-second synthetic 440 Hz test tone, not a voice. No MiniMax, no credits, no personal data or secrets.",
      inputSchema: {},
      outputSchema: {
        record: z.object({
          id: z.string(),
          title: z.string(),
          text: z.string(),
          durationSeconds: z.number(),
          voiceLabel: z.string(),
          generated: z.literal(false),
          source: z.literal("tone-fixture"),
          audioMimeType: z.literal("audio/wav"),
          audioBase64: z.string(),
        }),
      },
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async () => {
      const fixture = makeInlineToneFixture();
      return {
        content: [{ type: "text", text: "A 0.7-second synthetic tone for transport testing only. Not ShenShu's voice; no MiniMax call." }],
        structuredContent: {
          record: {
            id: "inline_tone_001",
            title: "音频传输测试 · 提示音",
            text: "这是模拟提示音，不是沈述的声音。",
            ...fixture,
            voiceLabel: "测试音频",
            generated: false,
            source: "tone-fixture",
          },
        },
      };
    },
  );

  registerAppTool(server,"preview_hosted_tone",{
    title:"Test HTTPS WAV playback",
    description:"A fixed 0.7-second non-voice test tone served over HTTPS, without MiniMax or billing.",
    inputSchema:{},
    outputSchema:{record:z.object({
      id:z.string(),title:z.string(),text:z.string(),
      audioUrl:z.string().url(),durationSeconds:z.number(),
      voiceLabel:z.string(),generated:z.literal(false),source:z.literal("hosted-tone")
    })},
    _meta:{ui:{resourceUri:RESOURCE_URI}}
  },async()=>({
    content:[{type:"text",text:"HTTPS 0.7-second test tone only. Not ShenShu speech. No MiniMax credits."}],
    structuredContent:{record:{
      id:"hosted_tone_001",title:"HTTPS 音频测试",text:"这是 HTTPS 测试提示音，不是沈述语音。",
      audioUrl:PUBLIC_TONE_URL,durationSeconds:0.7,
      voiceLabel:"测试音频",generated:false,source:"hosted-tone"
    }}
  }));

  return server;
}

export function createShenShuHttpServer({
  env = process.env,
  fetchImpl = globalThis.fetch,
  nonbillableClosure = null,
  protectedResourceJwksCache = undefined,
  protectedResourceIdentityVerifier = null,
} = {}) {
  if (nonbillableClosure !== null &&
      (!nonbillableClosure ||
       typeof nonbillableClosure.broker?.initiate !== "function" ||
       typeof nonbillableClosure.broker?.status !== "function" ||
       typeof nonbillableClosure.pendingHandler?.handle !== "function")) {
    throw new Error("nonbillable_closure_invalid");
  }
  // Trusted server-side injection only. The MCP/player bridge also requires an
  // explicit staging flag, the exact staging resource identity and the existing
  // player guard. No query, form, header or tool argument can enable it.
  // This process still requires a trusted server-side closure injection. The
  // separate staging sealed-composition candidate needs an explicit secret,
  // D1 configuration and 005 schema preflight; a boolean flag alone can never
  // fall back to plaintext or an in-memory store.
  const identity = resolveProtectedResourceIdentity(env);
  const activeClosure = nonbillableClosure !== null &&
    env.SHENSHU_NONBILLABLE_PLAYER_ENABLED === "1" &&
    env.SHENSHU_PLAYER_ENABLED === "1" &&
    identity.ok === true && identity.staging === true
    ? nonbillableClosure
    : null;

  return createHttpServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400).end("missing_url");
    return;
  }
  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

  // Read-only owner view for the nonbillable proposal bridge. It never renders
  // a confirmation form and never imports a paid handler.
  if (activeClosure &&
      await activeClosure.pendingHandler.handle(req, res, url)) return;

  // Standalone staging player. Disabled by default and never mounted in production mode.
  if (await handlePrivateWebPlayer(req, res, url, { env, fetchImpl })) return;

  // Staging auth resource: denies ALL paid calls, never creates an MCP session.
  if (await handleProtectedResourceShell(req, res, url.pathname, {
    env,
    proposalBroker: activeClosure?.broker ?? null,
    jwksCache: protectedResourceJwksCache,
    identityVerifier: protectedResourceIdentityVerifier,
  })) return;

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

  if (req.method === "GET" && url.pathname === TONE_PATH) {
    const tone = Buffer.from(makeInlineToneFixture().audioBase64,"base64");
    res.writeHead(200,{
      "Content-Type":"audio/wav",
      "Content-Length":String(tone.length),
      "Cache-Control":"public, max-age=60",
      "Access-Control-Allow-Origin":"*",
      "X-Content-Type-Options":"nosniff",
      "Accept-Ranges":"none"
    });
    res.end(tone);
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
}

/**
 * Normal runtime entry. Tests and the deploy process both use this exact
 * composition so a manually injected closure cannot mask a startup path that
 * would always stay null. Only nonsecret booleans and a coarse code leave here.
 */
export async function createShenShuRuntimeServer({
  env = process.env,
  fetchImpl = globalThis.fetch,
  createD1Client = createCloudflareD1Http,
} = {}) {
  const composed = await composeV1P2StagingRuntime({
    env,
    fetchImpl,
    createD1Client,
  });
  const server = createShenShuHttpServer({
    env,
    fetchImpl,
    nonbillableClosure: composed.nonbillableClosure,
    protectedResourceJwksCache: composed.jwksCache,
    protectedResourceIdentityVerifier: composed.identityVerifier,
  });
  return Object.freeze({
    server,
    sealedProposalEnabled: composed.sealedProposalEnabled === true,
    sealedStartupCode: composed.code,
    staticTestJwks: composed.staticTestJwks === true,
  });
}

export const httpServer = createShenShuHttpServer();

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 8787);
  const runtime = await createShenShuRuntimeServer({ env: process.env }).catch(() => ({
    // A startup composition failure still serves P1 only; there is no
    // plaintext D1 or in-memory proposal fallback.
    server: createShenShuHttpServer({ env: process.env }),
    sealedProposalEnabled: false,
    sealedStartupCode: "startup_exception",
    staticTestJwks: false,
  }));
  runtime.server.listen(port, () => {
    console.log(`ShenShu Voice MCP P1-MOCK listening on http://localhost:${port}${MCP_PATH}`);
    // Diagnostic emits booleans only: no credential values, OAuth subjects or network calls.
    const env = process.env;
    const dryRunEnabled = env.SHENSHU_D1_ADMISSION_DRY_RUN_ENABLED === "1";
    const dryRunRegistered = typeof createD1AdmissionDryRun({env}) === "function";
    console.log("shenshu_d1_registration " + JSON.stringify({
      oauth_stage_enabled: env.SHENSHU_AUTH_MCP_ENABLED === "1",
      dry_run_flag_enabled: dryRunEnabled,
      d1_config_accepted: dryRunRegistered,
      d1_tool_registered: env.SHENSHU_AUTH_MCP_ENABLED === "1" && dryRunRegistered,
      paid_voice_enabled: false
    }));
    console.log("shenshu_staging_sealed_startup " + JSON.stringify({
      sealed_proposal_enabled: runtime.sealedProposalEnabled,
      sealed_startup_code: runtime.sealedStartupCode,
      static_test_jwks: runtime.staticTestJwks,
      paid_voice_enabled: false
    }));
  });
}
