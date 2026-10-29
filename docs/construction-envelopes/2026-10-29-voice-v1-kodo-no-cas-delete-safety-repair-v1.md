# 沈述总控｜Kodo 真实条件删除不合格后的最小修复｜连续施工包 v1
日期：2026-10-29。执行：DeepSeek；总控：沈述。

**裁决：REAL_KODO_CONDITIONAL_DELETE_BLOCKED。不得再调用真实七牛测试接口；不准删除本地一次性锁或重跑。Voice V1 仍 2/9、paid OFF。**

## 1. 真实证据与现状（不能捏造成因）

- 真实用户在本机 Windows PowerShell、Node24.19.0 执行了唯一的 `scripts/kodo-qualify-once.mjs`；桶 `shenshu-voice-v1-sg-20261029` 为新加坡私有空间，受限子用户 `shenshu-voice-kodo-sg`；IAM 仅限该 bucket 的 GET/HEAD/LIST/PUT/DELETE；合成 WAV 和随机加密密钥，不含任何真人声音。
- **步骤 1–4 PASS：** encrypted PUT A、prefix LIST+HEAD A、PUT B 覆盖后 ETag 不同、另一 synthetic principal GET 无法取得音频。
- **步骤 5 STOP：** 对同一 key 的最新 B，旧 ETag_A 的 `DeleteObject(IfMatch:ETag_A)` **被当作成功**，而非预期的 `412 Precondition Failed`，脚本立即返回 `QUALIFICATION_STOP: stale_etag_delete_was_accepted_stop_now`。尚未验证 B 此时是否仍在；不能声称一定被删除，也不能声称绝对是七牛忽略 Header，尚有 SDK 序列化/传输差异可能。该风险已足以不合格。
- 停止前脚本逻辑共 7 个 S3 commands（2 PUT, 2 HEAD, 1 LIST, 1 GET, 1 DELETE）；未继续 GET B/新 ETag DELETE/最终 GET；无新上传或清理。保留一次性锁，禁止再次真实请求，无需人工清理。存在合成残留时由先前已生效的 Kodo 生命周期策略 `ShenShuVoiceAudioExpiry`（prefix `shenshu/voice-v1/private-audio/`、1 天）做兜底物理删除。具体调度非精确 24h。
- 测试没有访问真实 D1、Render、MiniMax、Call、真实04模型；线上 staging 仍为先前已验收的 paid OFF 版。
- AWS S3 文档明确不匹配 ETag 应 412；七牛 Kodo S3 兼容表列出 DELETE Object 但没有特别证明该条件约束。**证据是「当前环境与当前 SDK 的条件删除不足以受信」，而不是断言所有七牛客户端都不支持。**
- 参考：`https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-deletes.html`; `https://developer.qiniu.com/kodo/4087/compatible-s3-api`; `https://developer.qiniu.com/kodo/8609/dev-life-cycle-management`。七牛官方说明：同名覆盖上传的新对象会重新赋予当前生命周期规则。不能将此推成精确时间物理删。

## 2. 这一包唯一目标：删除风险源，不扩大 V1

**改为「固定 owner 单一加密对象 key、PUT 覆盖最新、读取时严格 TTL 拒绝、物理删除仅由已生效 Bucket 生命周期做最终兜底」的后端。取消程序主动 DELETE；不要引入另一套数据库、S3 条件写、分布式锁或新 PR。**

- 最小修改 `src/p2-kodo-private-audio-backend.js`：保持 `putLatest` 原有加密对象/HMAC owner key、单次无重试 PUT、大小限制和安全 HTTPS。保持 `getLatest` 原有 AES-GCM/AAD/owner/metadata/WAV 校验；在 **expiresAt <= now** 时只返回 `null`，**绝不调用 `DeleteObject`**，避免查询过期对象时删除刚覆盖的新语音。
- `deleteExpired` 依现有 `p2-private-result-store.js` 注入合同可被读路径调用，但必须**不执行任何 DELETE/物理对象修改**，返回准确的 `{deleted:0,...}`，明确 `physicalRemoval: 'bucket_lifecycle_only'` 或等价非秘密说明；不能谎称已经清理了 N 个对象。无需每次读音频都额外 LIST/HEAD（避免流量与性能回归）。如确需局部修改 private-result-store，限定为正确处理「生命周期管理的后端」，保持其他 backend 的现有行为和公开 API。
- 删除任何仍可达的条件 DELETE 辅助函数；`@aws-sdk/client-s3` SDK 仍用于 PUT/GET。以后部署凭据的最小权限**必须移除 `DeleteObject`，只保留 Kodo 生命周期自行过期清理**。本包不修改七牛 IAM（仍由用户之后亲自做），先留上线硬门禁。
- 不改 TTL 的含义：客户端 owner 可读 60–300 秒（配置上限不超 900）；物理保留 1 天生命周期规则按官方调度完成，期间密文可能仍存在，不可冒称几分钟内物理销毁。随机加密密钥一旦遗失，已有密文不再可解。
- 若判断固定 owner 同名 PUT 覆盖下仍有无法靠现有「最多一份结果」和有界请求解决的真实一致性问题，必须报 **TOTAL CONTROL DECISION REQUIRED** 并提供最小代码证据；不能在本包擅自引入 D1 附加表/全新权限状态机。

## 3. 必须修改的测试与验收

- 将 `test/v1-p2-kodo-private-audio-backend.test.js` 的 fake S3 **CAS 删除**测试改成**明确不发 DELETE** 的负例，构造「读取过期旧对象与同步/并发 PUT 新对象交错」并证明新对象仍保留、最新音频可 owner-only 读回；任何 expired read、`deleteExpired`、getLatest session 都不得调用 `DeleteObjectCommand`。
- 覆盖错误 owner、错密钥、被篡改的密文/元数据、JWT/session、短 TTL、latest-one、重启、PUT timeout/no retry、认证失败、无明文、没有 URL 泄露、没有 List/HEAD 意外增加、D1/公开 MOCK/当前生产 staging paid confirm 404 不回归。
- 测试范围只能离线 Node24 fake S3+真实本地 HTTP、没有任何外网请求、真实 AK/SK 注入/读取或 CI 实际 Kodo 调用；不要在 CI 运行已一次性消耗的 `scripts/kodo-qualify-once.mjs`，该工具归档为**禁止重跑**的人工资格入口。
- Node24 全量 `node --test` 0 fail/skip；`node test/smoke-server.mjs`、必要 syntax/diff PASS。只在已有 Draft PR #146 同分支 commit/push，正常 PR CI PASS，无 merge、无 deploy、无新 PR。保守 Voice V1 仍 2/9。
- 一页收口文档明确：REAL conditional delete **BLOCKED**，但**app no longer relies on it**；用户必须在首次 Kodo 上线前将子用户 IAM 策略 `ShenShuVoiceKodoPrivateAudio` 中「删除资源」权限取消；正式上线仍需要独立 exact SHA/凭据/云端启用/paid D1 门禁和明确一次 MiniMax04 授权，不能用离线 PASS 冒充完成。

## 4. 停机与最终回执

**STOP 条件**：要求更多 Kodo 真实 API 测试、尝试删除残留对象、修改账号策略/密钥、改 cloud/env、触碰真实 D1/Render/Call、付费模型、生产或冻结九门禁，全部停止并交总控，不要执行。

交付最多 8 行：`COMPLETE/BLOCKED/TOTAL CONTROL DECISION REQUIRED`；没有程序主动 DELETE 的源码/测试证据；本地全量/CI；只用 Draft PR #146 exact SHA；云端/真实 Kodo/付费操作 0；下一个最小用户动作「IAM 取消删除资源」及唯一下一门禁。**不要再开大包，更不准让糯糯重跑危险测试。**
