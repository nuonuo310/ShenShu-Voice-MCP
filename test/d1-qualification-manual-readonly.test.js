import test from "node:test";
import assert from "node:assert/strict";
import {runManualD1ReadOnlyPreflight} from "../src/d1-qualification-manual-readonly.js";
const env={CF_D1_ACCOUNT_ID:"a".repeat(32),CF_D1_DATABASE_ID:"123e4567-e89b-42d3-a456-426614174000",CF_D1_API_TOKEN:"fake_test_token_123456789012345"};
test("disabled by default and never calls HTTP",async()=>{let n=0;await assert.rejects(runManualD1ReadOnlyPreflight({env,fetchImpl:async()=>{n++}}),/preflight_disabled/);assert.equal(n,0)});
test("manual entry rejects missing Cloudflare config before HTTP",async()=>{let n=0;await assert.rejects(runManualD1ReadOnlyPreflight({env:{SHENSHU_D1_READONLY_PREFLIGHT:"1"},fetchImpl:async()=>{n++}}),/d1_not_configured/);assert.equal(n,0)});
