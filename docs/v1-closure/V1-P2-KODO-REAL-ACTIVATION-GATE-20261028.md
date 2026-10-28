# Kodo private audio: real activation gate

Status: **NOT EXECUTED. Requires explicit total-control/user authorization.**

## One-time setup

1. Select or create exactly one Qiniu Kodo **Singapore** private bucket. Record its real S3 bucket name and confirm no public ACL, no public CDN domain, and no 30-day test domain is used.
2. Grant one restricted credential only for bucket/prefix `shenshu/voice-v1/private-audio/`: `PutObject`, `GetObject`, `HeadObject`, bounded `ListObjectsV2`, and `DeleteObject`. No bucket administration, ACL, policy, billing or other-prefix access.
3. Put the access key, secret and a fresh random 32-byte backend key only in the staging secret store. Do not send them in chat, source, fixture, logs or CI. The backend key must not be reused as the 005 proposal-text key.
4. Review current Qiniu standard-storage allowance, HTTPS request charges and Kodo origin-to-Render egress. Do not describe Kodo as free: source egress may be billed. Set a per-object maximum of 2 MiB, access TTL of 60-300 seconds, at most three calls per principal/day, and a manual kill switch that removes the injected client/config.
5. Verify the bucket lifecycle minimum with Qiniu. Access TTL is enforced by this code; physical retention must use the shortest approved lifecycle plus the bounded `deleteExpired` worker. If lifecycle cannot meet the chosen retention, record that gap instead of claiming physical deletion.

## One bounded qualification

1. Deploy an exact approved SHA to staging only, with auto-deploy still off and the paid confirm route still closed.
2. Run one synthetic, non-voice object cycle through the injected backend: one PUT, one owner GET, one cross-owner refusal, one HEAD/expiry check and one conditional `If-Match` DELETE. Verify the storage honors the precondition before relying on physical cleanup; if it does not, stop rather than allow an unconditional delete that could erase a newer write. Cap the object at 2 MiB and the run at one attempt with no retry loop.
3. Verify no object URL, presigned URL, AK/SK, principal, WAV plaintext or Authorization header appears in Render logs, MCP output or browser responses.
4. Roll back by disabling the Kodo composition, removing the secrets, deleting the synthetic prefix object and rechecking the live nonbillable staging SHA/health. Do not deploy `/player/confirm` or call MiniMax in this gate.

## Decision requested

Authorize or decline this single private-bucket activation and its cost cap. A real 04 voice smoke remains a separate later decision.
