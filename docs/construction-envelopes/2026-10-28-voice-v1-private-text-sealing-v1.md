# 沈述总控裁决｜Voice V1 提案原文私有密封（2026-10-28）— 连续施工包 v1

**AUTHORITY:** 沈述，Voice V1 总控。**EXECUTOR:** DeepSeek。按 `nuonuo310/Shenshu-Continuity/rules/CONTINUOUS_CONSTRUCTION.md` 连续施工。唯一权威施工包路径：`docs/construction-envelopes/2026-10-28-voice-v1-private-text-sealing-v1.md`。

## 裁决 / DONE LINE

**批准最小应用层 private-at-rest 密封设计和离线实现，不批准任何真实密钥配置、云端迁移、云端查询/写入或部署。** 当前 Cloudflare D1 已有提供商托管的磁盘 at-rest 加密，但 D1 SQL 查询仍可读取明文；我们的私人文本还需由独立的**服务端应用密钥**加密，才能避免 004 的 `text` 字段直接暴露原文。应用层加密不等于端到端加密：合法服务器进程和掌握密钥的运营方仍能解密。

只收敛一个 blocker：让现有非计费 MCP → 独立播放器只读提案闭环在准备上线时，**不向真实 D1 持久化任何明文提案内容或可直接字典猜测的公开文本哈希**，且兼容现有 `004` 原子 claim/trigger 和 800 UTF-8 字节文本合同。其余 V1 九门禁不变，仍保守 2/9；本包不是 staging 上线或付费 smoke。

## Opening Gate（先验证）

- 唯一仓库：`nuonuo310/ShenShu-Voice-MCP`；唯一 PR：**Draft #146**；目标 branch `codex/voice-v1-p2-d1-confirm-qualification-20261028`；固定 base `docs/voice-v1-p2-d1-confirm-qualification-20261027` @ `8c3ede3e3f3e2ef4d8387436019d3dd3d2a4a22d`。
- 开包前真实代码 HEAD `81885fba25c7c65452375946a15759973cbf817d`，GitHub CI run `40729577727` **332/332 PASS，0 skip**。本文件提交后 HEAD 会前进：以**包含本施工包文件的最新 PR #146 HEAD**作为本次开工 authority，严禁从旧本地 SHA 覆盖新文件。
- 先读本包、`docs/v1-closure/V1-CLOSURE-PLAN.md`、上轮回执 `docs/v1-closure/V1-P2-NONBILLABLE-MCP-PLAYER-CLOSURE-20261028.md`、`004` migration、`src/d1-p2-confirmation-operation-store.js`、`src/v1-p2-operation-contract.js`、`src/v1-p2-nonbillable-proposal-broker.js`、`src/v1-p2-readonly-player-pending.js`、`src/v1-p2-nonbillable-player-closure.js`、`src/cloudflare-d1-http.js`、当前完整测试。打开干净隔离工作区；不丢弃他人本地未提交修改。
- 唯一已获先前 D1 资格的目标（**本包不可访问**）：`shenshu-voice-v1-qualification-20261024` UUID `234913cd-8901-4607-8147-31c4a4317111`。旧 `shenshu-voice-budget-test` UUID `c39a6895-7028-4f59-a100-1455b92c96c1` 绝对不可触碰，包括 SELECT。
- 先前真实 D1 只证明 004 schema、单次 claim、1 reservation/consumed grant、顺序 replay 0 写入；**不等于**真实应用/并发/付费合格。

如 authority/base/分支漂移、关键代码不符，STOP → `TOTAL CONTROL DECISION REQUIRED`；不得重建或降级现有身份与账单合同。

## 已定方案（不可改为无加密/另购云服务）

**V1 采用 Node 服务端 AES-256-GCM 随机 96-bit nonce + 128-bit tag；密钥由未来经独立批准的 Render staging secret/env 注入，32 字节随机主密钥，服务端使用 HKDF 派生相互独立的 AEAD 和 HMAC 子密钥。** 本轮只用本地 synthetic test key；不得创建/读取/复制任何真实密钥。密钥绝不出现在数据库、GitHub、MCP 结果、表单、音频 URL 或日志中。缺密钥或错误配置统一 fail closed。不要替用户创造新收费的 KMS/R2/Qiniu 服务。

**005 只做最小兼容性扩展**：在已存在的 `paid_voice_confirmation_operations` 增加可空 `sealed_text` TEXT 列（如必要附加最小版本/密钥 ID 字段，但不改 004 trigger / 原有约束）。已有 `text` TEXT NOT NULL CHECK(length 1..800) 仍保留，用固定、无原文的短标记如 `sealed:v1` 填入，而非明文。真正密文采用版本化的 authenticated envelope 存入 `sealed_text`；该列无 800 字符限制，以允许**完整 800 UTF-8 字节原文**通过 AES-GCM/编码扩张。**禁止**为了把密文塞进旧 `text` 列而缩小 800-byte V1 合同。现有 004 合成测试记录不得覆写、删除、重加密或迁移；新的密封模式读取未密封行一律 fail closed，不能返回旧行明文。005 只在本地 SQLite fixture 执行；不要 remote apply。

`text_digest` 当前是裸 SHA-256 文本摘要，短句可被离线猜测；**新密封记录数据库中必须保存 keyed HMAC-SHA256 binding，而不能暴露原始公开 SHA-256**。为最小化修改：在应用态继续用现有 `textDigest(plainText)` 的语义合同；存入 D1 前用 HKDF-derived HMAC key 对 canonical digest+上下文做确定性 HMAC，SQL claim 也将同一个入参 digest 转换成同样的 HMAC 后匹配；数据库中不保留可公开比较的明文摘要。更改仅在 sealed D1 adapter 的存取/claim 映射层，**不改变** broker 的 owner-identity、operation ID、状态、额度权限或 004 原子 trigger。解密后在服务端校验原文 SHA-256 digest 与文本字节数/元数据、AAD 和持久化 HMAC 一致，失败统一关闭，不回退明文。

AAD 必须不可歧义地绑定 `principal`, `handle`, `operation_id`, `origin`, `text_bytes`, `expires_at` 与版本/用途；使用不重复随机 nonce，拒绝损坏 tag/错误 key/metadata 置换/跨 principal 解封。不能只加密文字却忽略 DB 查询返回的原文验证；不要把加解密后的文案写入日志/异常。固定 key ID（如 `v1`）足够 V1，不在本轮建复杂轮换服务；丢失 key 的密文必须不可读且不自动重新生成/调用 provider。

**生命周期**：提案 5 分钟有效（现有 TTL）。过期不得在页面显示或允许 claim；不为 V1 增加新的历史档案和搜索；如能以局部安全清理机制封存/清理过期密文，需保留原子领取和不确定账单证据，不得删除已领取账单凭据或重置配额。若当前数据库现有记录无法在不影响证据的前提下安全清理，将其标注为独立后续数据保留决策，不得清空真实 D1。

## 连续施工授权

在范围内自行实现、测试、修复、再测试、推送、等 CI，**不要每修一行就找糯糯搬消息**：

1. 新增 `db/d1/005_...sql` 的**additive** migration，只引入所需密封列，不重建/删除 004；同时给出适用于本地验证的 schema preflight/STOP，不制作可误运行于真实 D1 的 destructive rollback。
2. 实现一份极小可单测的密封 codec，包含 AEAD authenticated encryption、HMAC digest binding、版本/用途隔离、密钥与 nonce 校验、安全异常；集成到现有 operation D1 adapter 的 `createPending/get/listPending/claim`。确保同样的 operationStore 同时供 protected MCP 和 signed player 读取；不要开平行 canonical state。
3. 现有 protected MCP 的非计费 facade 和只读 `/player/pending`、生产 MOCK、签名 Auth0 principal、private WAV 原样保留。**严禁开启** `/player/confirm`、添加 model-accessible paid tool、MiniMax synthesize、quota/grant 写入或真实音频。
4. 构建可信的 staging-only server-side sealed adapter composition **候选**，默认关闭，不在 env 只有布尔旗标时自动退回明文或内存 Map；若未取得合格 secret/D1 权限，保留 503/404 fail closed。不得接触实际凭据。保持代码局部且无新不必要依赖（Node 原生 crypto 优先）。
5. Node24 local `node:sqlite` 与真实 HTTP MCP→signed player readonly 集成测试：unicode/最大 800 UTF-8 字节原文可正常往返；原始 D1 `text` 列**只有固定无密内容**；`sealed_text` ciphertext envelope，数据库无 plaintext，数据库 `text_digest` 不是裸 SHA-256；错误/缺失/替换密钥、篡改 ciphertext/tag/AAD/metadata、错误 owner、过期、000/004 兼容、重复/重启、安全失败。原有 004 原子 trigger 模拟、P1 login/audio、公开 MOCK 不回归，provider/paid writes 一律 0。
6. 完整 `node --test`（Node24，**0 skipped**）、`node test/smoke-server.mjs`、`git diff --check` 及必要 syntax 检查。普通错误在包内自修、再验证。
7. **只能** commit/push 到现有 Draft PR #146，等待 normal pull_request GitHub CI success；不得新 PR、merge、改 base、部署或其他仓库改动。仅追加简短 nonsecret 交付证据；绝不输出密钥或用户文本。

## 严格 STOP / 边界

- **绝对不授权**：Cloudflare/D1/Worker API 或真实 SQL（包含 SELECT）、Render/生产/staging 部署或配置写入、Auth0 配置、Qiniu/Kodo/R2、任何新密钥创建或读取、付费语音/MiniMax/ElevenLabs、真实用户私人提案上云、真实 provider smoke、真实账单重试/退款、GitHub 合并与其他仓库操作。
- 若确实必须更改 `004` 既有 trigger / claim 原子性、身份 principal、官方 OAuth 资源、V1 完成线；无法兼容现有 SQL 约束；确需真实权限/凭据；或多轮修复无信息增量，进入 `TOTAL CONTROL DECISION REQUIRED`，不得偷偷放松边界。
- 普通语法、测试、局部实现失败不 STOP，继续修复到目标满足。
- 本包 **COMPLETE** 的唯一含义：005 + sealed text/D1 adapter 在 Node24 可运行且全量 CI 通过、MCP→只读播放器离线闭环无明文/无费用/无付费确认、完整现有 V1 合同不回归；依旧**未部署、未验证云端真实密封与音频**。

## 交回给沈述的精简回执

最多 8–10 行：`COMPLETE/BLOCKED/TOTAL CONTROL DECISION REQUIRED`、真正实现的密封能力、明文泄漏负例、800 字节往返、付费不可达、Node24 pass/fail/skip 和 GitHub CI run、PR #146 新 HEAD、云端是否修改（必须 NO）、**下一步仅需的真实 staging secret + 005 migration + deploy 人工授权**。不要提供长流水账或制造新工作量。

**结束。**
