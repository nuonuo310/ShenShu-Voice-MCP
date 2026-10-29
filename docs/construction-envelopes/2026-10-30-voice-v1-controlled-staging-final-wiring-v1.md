# 沈述总控｜Voice V1 最后一段受控 Staging 接线候选｜连续施工包 v1
日期：2026-10-30。**沈述：唯一总控。DeepSeek：执行工程师。**
仓库相对权威路径：`docs/construction-envelopes/2026-10-30-voice-v1-controlled-staging-final-wiring-v1.md`
规则：`nuonuo310/Shenshu-Continuity/rules/CONTINUOUS_CONSTRUCTION.md`。冻结 V1 DONE LINE：`docs/v1-closure/V1-CLOSURE-PLAN.md`，**九项条件不改，保守 2/9**。

## 0. 唯一目标与阶段 DONE LINE

**在一个隔离的 Node 24 本地集成验收环境中，把已完成但分散的 P2 组件拼成「未来可以受控部署」的完整候选：**

`verified ChatGPT MCP text proposal → owner-only /player/pending → 本人 signed session + Origin/CSRF 明确 POST 确认 → sealed 004+005 D1 atomic claim + one-use consumed grant → server-side fixed MiniMax model + 04 voice adapter（测试全部注入 fake，不调用真实 provider）→ validate WAV → Kodo 生命周期托管的 encrypted owner-only private latest-one store → signed-session /player/audio 显式读取 → replay/unknown/expired fail closed`。

**DONE LINE 是一份真实可运行的端到端候选及其测试，而非只画一份接线图，也不是另建一个 TTS 平台。** 不调用真实七牛/D1/MiniMax、不部署、不让用户再跑一次试验。候选必须可以在未来独立授权后以固定 SHA、安全注入/回滚上 Staging，**但本轮不授权启用**。

### 不属于本包
- 真实04试音/付费账单、实际 Cloudflare D1 原子并发实测、七牛新对象上传或 GET、iPhone 真人点击、浏览器真实可听性、生产发布、用户自动朗读、聊天跨轮自动转语音、Call 接线、音频收藏与历史。
- 不允许为了后续可能需求新增另一套鉴权、存储、收费、按钮、状态机或云资源。遇到真实 blocker 可只做本包必需的小修复；其他放 V1.1。

## 1. Opening Gate / 已知真实状态

- 唯一仓库 `nuonuo310/ShenShu-Voice-MCP`；唯一 Draft/open PR **#146**，branch `codex/voice-v1-p2-d1-confirm-qualification-20261028`，base `docs/voice-v1-p2-d1-confirm-qualification-20261027` @ `8c3ede3e3f3e2ef4d8387436019d3dd3d2a4a22d`。本施工包创建前代码 HEAD `d27fd6290a26297d0c159a642998c0d2fde35110`，正常 CI run `40916004148` **390/390 pass, 0 fail/skip**；以包含本文件的最新 #146 HEAD 为开工权威。核对 origin/工作区，禁止覆盖并发变更，不更改 PR base、不新建 PR、不 merge。
- 真实 Render staging `srv-dbcgcsom7kps739tfpo0` 目前 LIVE 的 SHA `f5e91ce59c1b7e642ed14b02878d05420cd2f53e`；branch 配置仍是旧 P1，autoDeploy=no。**不能调用 Render 更新环境变量；历史上更新 env 可能立即触发部署旧 branch，甚至 autoDeploy=no。不能把本 PR HEAD 误称已部署。**
- 真实 ChatGPT 受保护 MCP→密封 D1 005→owner /player/pending 在 staging 已经由用户于 iPhone + 桌面验证；此路径必须不变。当前 `/player/confirm` GET/POST 在 deployable `server.js` 仍 404，正式付费总开关仍关闭。公用 MOCK `/mcp` 与正常 P1 `/player/audio` 固定 WAV 保留。
- 唯一真实 Kodo 新加坡私有桶 `shenshu-voice-v1-sg-20261029`。通过用户截图核验 IAM 子用户 `shenshu-voice-kodo-sg` 仅有 `ShenShuVoiceKodoPrivateAudio` 策略（只读 GET/HEAD/LIST + 单文件 PUT，无 DELETE，限定 1 个 bucket）；仅前缀 `shenshu/voice-v1/private-audio/` 的生命周期删除当前版本 1 天，**物理删除不是 60 秒**。真实用户子账号 AK/SK 已在七牛界面但绝不能接触。
- 2026-10-29 单次真实 Kodo 条件 DELETE 资格试验：旧 ETag Delete 被接受，`QUALIFICATION_STOP: stale_etag_delete_was_accepted_stop_now`。安全 CLI 已永久禁止重复；**不得再发任何真实 Kodo 资格请求**，不得要求删除本机试验锁。Kodo backend 已由 DeepSeek 离线改为 **仅 GET/PUT**、加密对象/按 owner 隔离/严格 TTL、程序 **零 DELETE/HEAD/LIST**、由 bucket 生命周期物理清理；修复已 CI 390/390。
- 关键冻结文件：`src/v1-p2-d1-confirmation.js`、`src/v1-p2-player-confirmation.js`、`src/v1-p2-stable-operation-identity.js`、`src/d1-p2-confirmation-operation-store.js`、`src/v1-p2-private-text-sealer.js`、`src/minimax-adapter.js`、`src/v1-offline-paid-pipeline.js`、`src/p2-private-result-store.js`、`src/p2-kodo-private-audio-backend.js`、`src/private-web-player.js`、`src/v1-p2-staging-runtime.js`、`server.js`；已有 `src/v1-p2-offline-confirm-runtime.js` 和 kodo/confirm 测试是基线。**先审实际 import 图，不要重复造已有系统。**
- Call、Nightvoyage、Asteria、Gallery、Continuity 其余文件、生产入口、正式 Render/Cloudflare/七牛账号都不在本包修改范围。

## 2. 总控裁定：接线方式与不可更动安全边界

1. **ChatGPT 绝无付费决定权**：受保护 MCP 只提案/查状态，绝不增加模型可用的 confirm/charge/quota/grant/paid API。唯一批准入口是独立 Auth0 owner player 的明确 POST，校验同一 principal、signed session、strict Origin、Fetch Metadata、CSRF、不可变原文/操作 ID 绑定与过期。任何自动 refresh、重连、模型工具、URL query 不得触发计费。
2. **单一权威 D1 原子 claim**：只用 004+005 密封 proposal/原子 reservation + consumed grant，不能回到旧 003 或用多个 SQL 冒充一次事务；并发双击、离线重启、配额、未知上游账单状态必须 fail closed，恰好 1 个付费 attempt；不可自动重试或退款。
3. **真实 MiniMax 配置未来只能来自可信服务端**：固定 `speech-2.8-hd`（或本仓 V1 `V1_FIXED_MODEL_ID`）及批准的04 voiceId；text/voice/model 不由 caller 选择。重用 `synthesizeMiniMax` 和已有 `validateWav`，不得引入第二 adapter 或多次/分句收费。离线测试只能注入明确的 fake synthesizer，**绝不要求、读取、打印、联网真实 MiniMax API Key 或04 voice ID**。不能把 fake 适配器作为可部署生产合成器。
4. **唯一私有 Kodo 结果**：只用当前 `createP2KodoPrivateAudioBackend` 与 `createP2PrivateResultStore`，新加坡 region、固定私有 bucket、HMAC opaque principal key、AES-GCM 隐私封装、单对象 PUT、无 retry、TTL owner-only GET。**禁止任何 DELETE、If-Match、HEAD、LIST、公开直链、浏览器签名 URL、私有 WAV inline MCP base64**。生命周期为 1 天兜底，访问期按应用 60–300 秒强制拒绝。正式 Kodo 子账号已无 DELETE 权。
5. **Staging 候选独立、默认关闭，fail closed**：允许在 `src/**` 新增*最小* startup/handler composition，把现有 D1 sealed runtime + paid consent handler + Kodo authenticated player audio loader 组合；但任何真实 paid implementation 必须对 `production main` 和非 staging origin 无条件禁用。测试可注入 local D1 sqlite / fake Kodo / fake MiniMax；live candidate 在没有**明确的 staging paid enable、独立 real-provider enable、校验通过的 server secrets、独立由总控授权的固定版本**时不可通过单个默认开关生效。**本轮不允许把 paid confirm 接进现有 deployable server.js 默认路径，更不能在当前生产/staging 通过环境变量单项切换就变成可达。** 若仅能通过未来总控明确审查的独立可部署模块、封存 entrypoint 提供候选，应优先这样做，而不是削弱现有 404 守卫。
6. **不要破坏已上线的非计费服务**：静态测试 JWKS 仅 test、不回退假身份；正式 OAuth/JWKS 用单一 verified principal；当前 staging 启动 `sealed_ready` 和公开 MOCK 都必须保持；P1 固定 WAV、iPhone 明确点播放结构不回归。不能把无私有对象时 `/player/audio` 改成不明原因的 503，从而破坏原已验收 P1。
7. **成本/凭据不能越权**：当前已有的真实子用户 AK/SK **绝不经 GitHub、ChatGPT、DeepSeek、邮件、CI 或日志**。如果未来通过 Render 用户界面注入，须另行给用户 exact SHA/manual deploy/rollback/密钥备份清单，任何 env 改动可能部署旧分支。当前旧 D1 临时 Edit token 后续需要 A5 撤销或降权独立处理；不得用它去读写非资格库，更不可触碰旧 `shenshu-voice-budget-test`。
8. **真实 Kodo STOP 不能变 PASS**：只有 PUT/GET/owner 加密曾真实通过；程序主动条件删除不兼容，永久绕开。不得将“离线全通过”写为真实 Kodo 自动物理删除安全性、已合成04或 iPhone 已可听。

## 3. 一次连续完成的工程与验收

A. **先复用现有组合**：审现成 P2 D1 consent, fake provider pipeline, Kodo backend, private-player Auth0 handler 的数据通路，找出唯一最小未连通处。实现小而清晰的 *offline-deployment-candidate* 组合：在本地 Node24真实 HTTP 使用 fake trusted JWT/session 和 SQLite 004+005、fake Kodo SigV4 request handler、fake provider WAV，完成「提案→真人必须点的表单（测试用 HTTP 显式模拟）→一次原子 admission→private encrypted PUT→owner session audio GET→completed+replay/unknown」。不需要再测试真实七牛、只复用已验收接口。该 endpoint 未来可在审批后接上受控 staging，但**本包绝不能提升当前 server.js 可部署的付费可达性**。

B. **核对未来的受控部署 seam**：给出可审查、fail-closed 的 staging-only composition/配置诊断：不存在完整 validated staging身份、专用实用 Kodo secrets、D1 sealed key、paid feature grant、提供者 key/批准 voice 及独立总控授权时，任何 live paid handler 都不可达。**不能新增会在目前 Render 生效的 flag/handler；本包只离线候选。** 若 provider/key/charge gate 的安全断言需要改变已有冻结安全合同，STOP 请总控裁定；不借新系统绕过。

C. **新增且只有真正增量的测试**：本地 real HTTP+SQLite+fake S3 合成的全程、P1 staging startup nonbillable regression、server.js /player/confirm GET/POST 仍404、prod and wrong origin never mount, principal mismatch, wrong session/Origin/CSRF/expired, double click and concurrent claim, Kodo wrong owner/expired/tamper and **zero DELETE/HEAD/LIST**, quota failure, provider error/bad WAV/ambiguous outcome (no second provider), failed PUT/GET, signed private output & no public URL, JWKS non-test readiness, paid tool absence. **严禁调用一次性真实 Kodo 脚本。** 测试用 synthetic key/voice fixtures，绝无真实个人音频。

D. **最少一页未来 staging 可执行启用清单（不执行）**：列精确 SHA、构建/回滚方式（旧 Render branch + env update 可能触发意外部署的风险）、各 secret 必须走用户安全渠道、现有 Kodo IAM 权限已取消 DELETE、D1 004+005 real quota/concurrency 独立验证、首次 one real 04 smoke separate cost authorization、可关闭开关、owner desktop+iPhone 手动实际可听验收。所有所需真实合规动作必须待下一次总控明确批准。

## 4. 允许 / 禁止 / STOP

允许修改 `src/**` **仅必要 P2 staging candidate composition**、isolated server creation for offline integration、`test/**`、最少文档、必要 package 依赖。**不改冻结 D1 004/005 schema、canonical principal 算法、受保护 MCP 工具权限、现有 staging startup flag 行为、生产 main、Call/其他仓库**。禁止 Render deploy/改 env、Cloudflare D1 实库、七牛 Kodo 真实对象请求或 IAM、任何 TTS 付费请求、授权外 secrets、真实用户音频、创建新 PR、merge、手动 Actions dispatch。不得抹掉一次性试验的 STOP 证据；CLI 维持封存。

无法在既有合同之内让 staging 候选安全 fail-closed 时，**TOTAL CONTROL DECISION REQUIRED**，指出具体冲突的单一接口/断言，不准通过放松测试或给 ChatGPT 计费权“修复”。

**COMPLETE** 只在本地真实 HTTP 的上述端到端 synthetic 工作流通过、无任何线上 paid 可达代码、Node24 `node --test` 全量 0 fail / 0 skip、`node test/smoke-server.mjs`、syntax + diff PASS，并普通 commit/push 现有 Draft PR #146 同一 branch、GitHub PR CI SUCCESS 后宣布。普通失败包内自主修复/复验直至终态；不问糯糯重复已批准的细节。

最终回执 **最多 8 行**：COMPLETE/BLOCKED/DECISION；新增可运行接线到底做了什么；Node24 tests、CI run；安全 0 Cloudflare/Render/Kodo/MiniMax/Call；exact PR #146 HEAD；真实首次04播放还剩哪两个独立授权与实体验收。**不能写“Voice V1 完成”，严格 2/9。**

**结束。**
