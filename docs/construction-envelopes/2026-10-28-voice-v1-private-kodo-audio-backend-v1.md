# 沈述总控｜Voice V1 私有 WAV 持久存储：七牛 Kodo S3 兼容适配器｜连续施工包 v1

日期：2026-10-28。**总控：沈述；执行：DeepSeek。**
唯一权威文档（本仓库相对路径）：`docs/construction-envelopes/2026-10-28-voice-v1-private-kodo-audio-backend-v1.md`。
遵守 `nuonuo310/Shenshu-Continuity/rules/CONTINUOUS_CONSTRUCTION.md`：普通实现、测试失败自行连续修复，边界问题才 STOP。

## 0. 一句话 DONE LINE

沿用 **已验证的 Voice P2 确认 → one-claim → fake WAV → 私有结果** 离线链，将最后的「只有内存测试后端」换成**可与七牛 Kodo 新加坡 S3 兼容接口通信、但默认不联网且无真实凭据的私有对象存储后端代码**，并用可执行离线 S3 协议替身证明：短 TTL、owner-only、严格 WAV 边界、失败关闭、单条结果原子写入、重启后可读取；且不改变已上线的真实非计费 staging。

**不要再做另一轮相同的 MCP、D1、CSRF、WAV 假 provider 研究。** 聚焦到一个能被真实音频链复用的存储实现，避免新业务架构和泛化方案。

## 1. Opening Gate（精确现场；漂移即停）

- 唯一目标 GitHub 仓库：`nuonuo310/ShenShu-Voice-MCP`；唯一现存 **Draft/open PR #146**；目标分支 `codex/voice-v1-p2-d1-confirm-qualification-20261028`；固定 base `docs/voice-v1-p2-d1-confirm-qualification-20261027` @ `8c3ede3e3f3e2ef4d8387436019d3dd3d2a4a22d`。本包创建前代码 HEAD `814bc4b93fc0105705faf4e0ca76bdd4c1c00020`，Node24 GitHub PR CI run `40758697348` **371/371 PASS，0 fail/skip**。本文件提交后 HEAD 自然前进：**施工以包含本文件的最新 PR #146 HEAD 为权威**，不得从旧 worktree 强推覆盖；先核验远端、base、工作区、冲突施工。
- 当前真实 Render staging `srv-dbcgcsom7kps739tfpo0` LIVE 的代码仍为较旧的经过验收的 `f5e91ce59c1b7e642ed14b02878d05420cd2f53e`，autoDeploy OFF。ChatGPT → D1 005 加密提案 → desktop+iPhone 私有待确认页已在真实云端验收。**不能将 #146 新代码自动部署、触碰 live 开关或偷偷上线确认路由。**
- 这轮刚完成的离线 `src/v1-p2-offline-confirm-runtime.js` + `test/v1-p2-offline-explicit-confirm-wav.test.js`：真实本地 HTTP fake provider 恰好 1 次，004+005 one-claim、owner-only WAV，CI 371/371。**全盘复用，不要重新造相同链**。
- 冻结 Voice V1 九门禁：`docs/v1-closure/V1-CLOSURE-PLAN.md`；本轮不能扩大完成线，严格统计仍 **2/9**。先读 `src/p2-private-result-store.js`（其 backend `putLatest/getLatest/deleteExpired` 合同）、`src/private-web-player.js`、`src/v1-p2-d1-confirmation.js`、`src/v1-p2-stable-operation-identity.js`、`src/contract.js`、`src/v1-p2-private-text-sealer.js` 及已有测试。不可改 004/005 D1 schema/trigger/云端状态。

## 2. 总控已定存储方向与成本边界

**选七牛 Kodo 新加坡区域的 S3 兼容 HTTPS 服务作为首选候选**，不是另外开 R2、Postgres、Redis，也不是把 WAV 放进 D1。官方 S3 region `ap-southeast-1`；endpoint `https://s3.ap-southeast-1.qiniucs.com`；官方兼容 GET/PUT/HEAD/DELETE Object 与 AWS SigV4。通过服务器侧有认证的 S3 请求操作**私有 bucket**，不使用七牛 30 天测试域名，不要求播放器直接访问 bucket/custom CDN domain。

证据入口（开工时自行核对最新官方文档）：
- Kodo S3 服务域名：`https://developer.qiniu.com/kodo/4088/s3-access-domainname`；
- S3 兼容 Object API：`https://developer.qiniu.com/kodo/4087/compatible-s3-api`；
- AWS S3 兼容 SDK 示例：`https://developer.qiniu.com/kodo/12553/S3%20SDK%20sample`；
- 费用须知：`https://developer.qiniu.com/af/kb/12990/real-spending-detail-describe`。

**重要成本事实**：七牛有部分 10GB/月存储与 GET/PUT 等免费额度，但从 Kodo **源站直接向 Render 取回的外网流量可能按量收费且无免费额度**。因此这里**绝不声称「Kodo 免费」或「不会产生存储流量费」**。本包严禁发出任何真实 Kodo/S3 HTTP，也不能创建 bucket、绑定域名、读取/生成/设置 AK/SK、设置账单。之后若需开通，将由总控在明确用量、可能费用、具体权限、停止开关后另行询问用户许可。只要 V1 从原音频读取 S3，再由 Render 向登录的手机响应，不得返回临时签名 URL 给客户端。

## 3. 本轮能连续自主实现的工程范围

### A. Backend 真正履约

- 最小实现 `createP2PrivateResultStore` 现有注入式后端的 `putLatest(record)` / `getLatest({principal,now})` / `deleteExpired({before})`，不要改公开合同、`createP2PlayerAudioLoader` 或既有 provider 语音语义，除非有真实 blocker 且保持兼容。
- Kodo 客户端采用经过测试的 S3 SigV4 SDK 或可审查的通用 AWS SDK v3 API 实现；**不可自己临时发明未经测试的签名/请求算法**。S3 client、bucket、region、HTTPS endpoint、前缀、request timeout、operation cap 都由服务端显式注入；无有效配置默认 FAIL CLOSED。只允许上述新加坡官方 endpoint、HTTPS、指定私有 bucket；拒绝传入任意 URL（SSRF）、本地文件路径、客户端提供的 S3 key/prefix。
- 必须无公开对象 URL、无 browser 可用的 presigned URL、无 AK/SK/认证头/声音原文或 WAV 进入日志或 MCP response。用 HMAC 派生不可逆 owner object key，不能裸 principal/邮箱作路径。可以用**独立 HKDF domain** 派生存储对象加密密钥，避免直接复用 005 proposal-text AES key；对象保持完整、认证的密封内容，服务端解密验证 WAV，严格长度/TTL/owner 绑定。
- 将私有结果元数据 + WAV 作为一个**不可拆分的有认证对象**存储（例如单一版本化密文信封/二进制封装），避免「音频写成功、元数据写失败」的半写状态；SDK 单个 PUT 的成功/不确定结果应遵守 NO RETRY，不能因超时再覆盖并伪称成功。若无法证明同 principal 最新结果在并发情况下是安全的，必须交出具体行为的测试/证据与最小修正，**不得用两个异步 S3 PUT 冒充原子事务**。
- 短 TTL：`getLatest` 在逾期、缺失、错误 owner、错误签名/metadata/WAV 时必须拒绝；`deleteExpired` 在授权对象前缀内执行实际有界清理或提供可证明等效的受控过期清理方案（依托存储生命周期时清楚区分“5 分钟不可读”与“后台物理删除时间”）。**不能以空实现 `deleteExpired` 伪造清理成功**。若兼容 bucket 无法支持物理删除的最短期限，在最终回执中如实区分 access TTL 与 physical retention，留一条可执行上线配置门禁，而非扩大成新平台。
- 只允许一次短期最新私有 WAV、一次调用最长 60 秒、音频大小上限依照既有 `MAX_WAV_BYTES`，避免过量存储/GET/egr. 不做收藏、历史、下载分享、音色馆、跨设备自动同步或播放 UI 大改。现有 WAV / iPhone 显式点击播放行为不变。

### B. 测试必须直达用户旅程，但不能碰云

- Node24 使用受控 fake S3/SigV4 请求器模拟 **PUT→GET→DELETE/expiry**，无真实网络；测试必须至少让一条 **fake provider audio** 从 offline P2 confirmation runtime 经真实 HTTP MCP→owner consent→私有 backend→owner `/player/audio` 完整回放。正常 staging `server.js` 仍不挂载 paid confirm。
- 依照合同测同 principal 原子 latest-one、并发/双击后无二次 provider、跨 owner、无 session、错误密钥、篡改 AAD/audio/metadata/expired、断电重启取回、缺 S3 凭据/bucket、SDK 报错、PUT 超时/结果不确定、GET 失败/重复请求导致的 egress 约束、过期后无法读、实删或明确受控 retention 证据。
- 测试保证没有公网连接、没有 AK/SK 实际读取、没有对 Render/D1/Kodo 真实操作。特别在所有测试证明：`/player/confirm` 线上 server.js GET/POST 仍 404，当前公开 `/mcp` 不受影响，真实 live 的 P1 WAV fallback 行为不回归。
- 完整 `node --test` on **Node24** **0 fail / 0 skip**，`node test/smoke-server.mjs`、必要 `node --check`、`git diff --check`，GitHub CI 正常 PR push 通过。普通代码错误自主修复复验，不要每步停工搬回执。

### C. 真实接入所需的最少用户操作（先纸面确定，不执行）

只形成一页单独的可执行 Gate 清单：
- 将来明确选择/创建 **一个新加坡 private bucket**（允许账号存在，但不得自行读取/创建），记录真实 S3 bucket name 与隐私属性；无测试域名用作私有 CDN URL、无 public ACL。使用受限的 bucket/prefix 访问权限和安全 Render secret，AK/SK 不进聊天/仓库/日志。
- 真实财务查看项：标准存储免费额度、S3 源站出站流量与 HTTPS 的费用/超量机制；明确每次 WAV 最多几 MB、每日最多几次，以及如何硬关停。没有用户批准真实可产生费用的请求不得做任何 live Kodo 资格实验。
- 如果要真正接入 Render，需要另行批准 exact SHA staging build + 环境密钥注入 + Kodo synthetic object PUT/GET/DELETE **一次性限额** + 回滚。**真实 04 voice 及其他付费 TTS 单独授权**。
- 如该候选因成本或 bucket 权限不可行，仅交代实际 blocker 与更少变更的备选，不擅自迁移去 R2/其他架构。

## 4. 权限边界、STOP 与最终交付

允许改 `src/p2-private-result-store.js` 的 **兼容性局部**、新增唯一的 `src/p2-kodo-private-audio-backend.js` 或类似最小模块、相关离线 test fixtures / glue / test/** / 文档 / 最少 package 依赖。不可改 004/005 Trigger、canonical principal、Auth0 session 签名、已上线非计费 route、收费门禁、公开 schema、`main`、其它仓库或 Call。**禁止**真实 Render deploy/env、Kodo API/凭据/桶、Cloudflare D1/Worker、MiniMax/ElevenLabs 费用、真实用户语音、CI 手动 dispatch、PR merge、新 PR。只 push 原有 Draft PR #146，base 不动，autoDeploy OFF。

DONE LINE：离线 adapter 真正可运行、与 P2 private result contract 和 owner-only audio HTTP 组合通过；无法读取别人的音频、无法保留明文对象、过期规则和清理可验证；全量 CI 零跳过；不动真实云端、可部署版本依然 paid OFF；**明确的实用成本/权限上线门禁**。达到立刻 COMPLETE，不再扩张。

遇到缺少真实 bucket/费用授权：不属于本轮 BLOCKED（本轮不需要真实云）。如 Kodo S3 SDK 在离线证据中无法保证不可逆要求、对对象权限要求超出锁定范围、必须修改公共 Auth0/付费状态机、必须发出实打实可能收费请求或无限重试无信息增量，`TOTAL CONTROL DECISION REQUIRED`。

最终只给糯糯一份最多 8 行简报：`COMPLETE/BLOCKED/TOTAL CONTROL DECISION REQUIRED`；真实已实现的音频持久 backend 与短 TTL/owner 控制、Node24/CI、精确 #146 SHA、云端/真实 Kodo/04 是否调用（必须 NO）、下一个**实际**资格 gate 的唯一决策项。无冗长流水账，避免让她继续当消息搬运工。

**结束。**
