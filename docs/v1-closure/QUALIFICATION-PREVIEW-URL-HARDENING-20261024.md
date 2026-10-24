# Qualification Worker explicit Version URL disable — 2026-10-24

## Decision

Cloudflare dashboard screenshot supplied by the operator shows Production Worker URL **off**, Preview Version URL **off**, and no custom domains/routes for `shenshu-voice-v1-qualification-20261024`. This is operator-observed, not an independent Cloudflare API read. Preview deployments are not separately inventoried.

Add `"preview_urls": false` to `wrangler.qualification.json`, immediately after `"workers_dev": false`. No other manifest fields change. This makes future Wrangler deployments explicitly request Version URL disable rather than relying on prior settings. It does not by itself prove that every Preview/Deployment URL is absent.

## Exact isolation and release boundary

Cloudflare account: `5a1af7ea0ef8f8aea6365306d775a894`; qualification D1 UUID: `234913cd-8901-4607-8147-31c4a4317111`. The deployed dormant Worker version is `2320fd44-294c-4789-91bd-c20694254eca`. **This repository change has not been deployed.** Do not run `wrangler deploy`, modify routes, configure HMAC, or invoke the Worker/D1 without a separate explicit approval. Old D1 and other Asteria Workers remain forbidden.

Before a later deploy, verify the branch/HEAD and manifest exact contents, rerun Wrangler dry-run, review any Cloudflare preview settings, and require separate authorization. Preserve the current deployed version as rollback reference. A deployment may change cloud state even if no route is active.

## V1

Strict 2/9; B1–B4 remain open. No real D1 transaction, provider, MiniMax or private delivery proof is added by this change.
