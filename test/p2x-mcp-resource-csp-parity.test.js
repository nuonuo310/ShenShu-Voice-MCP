import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("OAuth UI permits only existing fixed HTTPS tone origin while public UI retains its list",async()=>{
 const pub=await readFile(new URL("../server.js",import.meta.url),"utf8");
 const auth=await readFile(new URL("../src/staging-authenticated-mcp.js",import.meta.url),"utf8");
 assert.match(pub,/resourceDomains:\s*\["https:\/\/raw\.githubusercontent\.com",\s*"https:\/\/shenshu-voice-mcp\.onrender\.com"\]/);
 assert.match(auth,/resourceDomains:\s*\["https:\/\/shenshu-voice-mcp\.onrender\.com"\]/);
 assert.match(pub,/connectDomains:\s*\[\]/);
 assert.match(auth,/connectDomains:\s*\[\]/);
 assert.match(auth,/PRIVATE_FIXTURE_UI_URI="ui:\/\/shenshu\/private-fixture-bubble-v2\.html"/);
});
