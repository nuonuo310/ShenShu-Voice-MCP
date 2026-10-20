import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {makeInlineToneFixture} from "../src/inline-fixture.js";

// Static regression: the same fixture generator feeds private inline and public HTTPS test routes.
test("same WAV generator underlies private and hosted diagnostic paths",async()=>{
 const stage=await readFile(new URL("../src/staging-authenticated-mcp.js",import.meta.url),"utf8");
 const server=await readFile(new URL("../server.js",import.meta.url),"utf8");
 const ui=await readFile(new URL("../ui/mcp-bubble.html",import.meta.url),"utf8");
 const fixture=makeInlineToneFixture();
 const bytes=Buffer.from(fixture.audioBase64,"base64");
 assert.equal(bytes.subarray(0,4).toString(),"RIFF");
 assert.equal(bytes.subarray(8,12).toString(),"WAVE");
 assert.match(stage,/makeInlineToneFixture\(\)\.audioBase64/);
 assert.match(server,/Buffer\.from\(makeInlineToneFixture\(\)\.audioBase64,"base64"\)/);
 assert.match(ui,/next\.source==="private-fixture"/);
 assert.match(ui,/next\.source==="hosted-tone"/);
 assert.match(ui,/data:audio\/wav;base64,/);
 assert.match(ui,/test-tone\.wav/);
});
