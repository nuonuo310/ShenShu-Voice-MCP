# 沈述总控｜Voice V1 真实上线前收口：Node/依赖安全 + SHA 防误部署 + 有限云端验收准备｜连续施工包 v1

日期：2026-10-30。总控：沈述。执行工程师：DeepSeek。
**权威文件：** \`docs/construction-envelopes/2026-10-30-voice-v1-release-hardening-real-gates-v1.md\`。
**性质：** 用户要求本轮「多做一点」——授权**一个完整、连续的离线工程与只读审核施工包**，不是授权真实云端扣费、配置凭据、数据库写入或上线付费服务。
遵守 \`nuonuo310/Shenshu-Continuity/rules/CONTINUOUS_CONSTRUCTION.md\`；冻结范围以 \`docs/v1-closure/V1-CLOSURE-PLAN.md\` 为唯一 V1 DONE LINE。**不可变的九项门禁，当前仅 2/9 fully evidenced**，任何离线 PASS 都不增报。

## 0. 本轮做什么、做到哪就停

**不是另做语音功能，不是再重做 400 项既有模拟场景，而是把真实付费上线前最后几项「能现在解决」的发布与安全阻断集中清零。** 四个紧密关联的工作流必须连续完成：

A. **部署运行时与依赖可复现、可审计**：修 Node26/Node24 版本漂移、没有 tracked lockfile、Render 两项高危依赖告警。目标 Node24 上锁、固定依赖、定位并修复有明确安全增量的 runtime 漏洞，保留所有业务接口。

B. **付费候选最后一道不可信环境/错误版本阻断**：把 staging 候选用于比对的“运行 SHA”改为**可核验的真正部署身份**，不能把两个人手填的 \`SHENSHU_STAGING_APPROVED_SHA\` 与 \`SHENSHU_STAGING_RUNTIME_SHA\` 相等就当独立证明。Render 官方提供只读 \`RENDER_GIT_COMMIT\`，以其为运行身份优先；local test fixture 可以注入明确的 test SHA，但不能通过生产可设的自报 env 绕开。正确失败模式是拒绝创建 paid candidate，而不是回退不受保护的路径。先查看实际安全调用图与 Render 运行时合同再改。

C. **一次性 real D1 + Kodo 非付费资格的「执行前完整备料」**：把真实 D1 004+005 quota/concurrency/replay/rollback、Kodo 当前无 DELETE 的 owner PUT→GET、登录态私有音频可听验收写成一个可运行前审查、可控退出的 **独立执行包和精确开关清单**。允许离线脚本/模拟代理/安全上限测试和只读的非秘密现场审查，**禁止在本轮执行任何真实 D1 更新、真实 Kodo 对象 PUT/GET、MiniMax、Render env/deploy**。后续由沈述向用户单独请求真实资源操作授权，不能借「额度充足」越界。

D. **真实已上线非计费 staging 的安全回归**：核验 deploy identity、已存的 Auth0 登录、paid OFF、原 MCP nonbillable proposal 和 P1 fixture 的源码级别与只读探针；原逻辑和部署一字不动。避免靠自报 CI 把实际未验证的 POST/手机 audibility 写成通过。

本轮 **DONE LINE**：安全版本锁定/漏洞裁决/关键 fail-closed 身份测试 + 一份限量云端资格 runbook + Node24 全量 0 fail/skip + GitHub PR CI SUCCESS。届时停止增加离线切片；向总控交两项必须单独授权的**下一步真实操作**，直接进入真实资格裁决。

## 1. Opening Gate：真实现场与冻结输入

- 目标唯一仓库 \`nuonuo310/ShenShu-Voice-MCP\`；唯一现有 **Draft/open PR #146**；branch \`codex/voice-v1-p2-d1-confirm-qualification-20261028\`；base \`docs/voice-v1-p2-d1-confirm-qualification-20261027\` @ \`8c3ede3e3f3e2ef4d8387436019d3dd3d2a4a22d\`。本包创建前 PR HEAD \`e452337d7579e4ad7504a0e520b08a846cd60f04\`，Node24 GitHub Actions CI \`40921639798\` / job \`123616145544\` **400/400 PASS、0 fail、0 skip**。本包提交后，以包含本文件的**最新 PR #146 HEAD**为开工权威，先核验 SHA/base、工作区/并发变更，不能从旧 worktree 强推覆盖。
- 现有 Render staging \`srv-dbcgcsom7kps739tfpo0\`（workspace \`tea-dbb28o5g1s2s73e0bfb0\`）**真实 LIVE** deploy \`dep-dbhod0flk1mc73d9aa9g\` @ \`e452337d7579e4ad7504a0e520b08a846cd60f04\`；手动指定提交，上一个回退 deploy \`dep-dbh476ek1f9s738lr0l0\` @ \`f5e91ce59c1b7e642ed14b02878d05420cd2f53e\`。Render configured branch **仍是旧 P1** \`codex/voice-v1-p1-auth-session-security-review-20261027\`，autoDeploy=no。**任何 Render env update 可能立即部署旧分支**，禁止操作。
- Render 此次实际构建日志：\`Using Node.js version 26.13.0 via ... package.json\`；仓库现 \`package.json\` engines \`>=20\` 无上界；CI 用 Node24，package 没有提交 \`package-lock.json\`；Render \`npm install\` 显示 **2 high severity vulnerabilities**，尚未定位具体包和可达性，不能臆称是哪个库。现有 CI \`.github/workflows/ci.yml\` 使用 \`npm install --ignore-scripts --no-audit\`。
- Render \`shenshu_staging_sealed_startup\` 显示 \`sealed_ready\`、\`static_test_jwks:false\`、\`paid_voice_enabled:false\`；已连接 staging \`verify_shenshu_login\` 返回 \`authenticated:true, paid_voice_enabled:false\`。**此日志不等于真正开启过付费确认或手机音频验收**。
- 项目 \`server.js\` 目前**不 import** \`src/v1-p2-controlled-staging-candidate.js\`，正常 deployable \`/player/confirm\` GET/POST 理应 404；不能凭此声称所有实际 HTTP 状态已外部测量。公开 MOCK /mcp、staging protected OAuth、非计费原文提案和固定 WAV 路径保持。
- 七牛真实私有 bucket \`shenshu-voice-v1-sg-20261029\`、region \`ap-southeast-1\`。IAM 唯一子用户 \`shenshu-voice-kodo-sg\`、仅自定义策略 \`ShenShuVoiceKodoPrivateAudio\`：用户已用截图证实现在只有 bucket-scoped GET/HEAD/LIST/单文件 PUT、无 DELETE。**真实 Kodo 旧 ETag 条件 DELETE 试验失败**，一次性 \`scripts/kodo-qualify-once.mjs\` 已封存，不准解锁/重跑。现行 \`src/p2-kodo-private-audio-backend.js\` 已消除程序 DELETE/HEAD/LIST/IfMatch，过期拒读、物理删除靠仅限 \`shenshu/voice-v1/private-audio/\` 前缀的 1 天 lifecycle（不保证物理删的精确时刻）。
- Cloudflare D1 仅准针对**专用资格库** \`shenshu-voice-v1-qualification-20261024\` UUID \`234913cd-8901-4607-8147-31c4a4317111\` 做**纸面/本地模拟**，004+005 以前已实际迁移完成；绝对禁止旧 \`shenshu-voice-budget-test\` UUID \`c39a6895-7028-4f59-a100-1455b92c96c1\`，包括 SELECT。短期 D1 Edit token 状态和过期时间**未在本轮确认**，不要自动读/换/复制/延长它。
- **绝对不触碰 Call、Asteria、Nightvoyage、Visual World、生产 Render \`shenshu-voice-mcp.onrender.com\`、任何真实 MiniMax 调用**。真正04固定音色来自未来受信服务端授权，不由 MCP 工具指定。

## 2. 工作流 A：确定 Node24 + 依赖可信构建（有实物交付）

1. 先只读检查 \`package.json\`、CI、现有安装依赖和 Render 版本选择文档；Render \`NODE_VERSION\` env > \`.node-version\` > \`.nvmrc\` > \`package.json.engines\`。本轮**仅通过仓库代码**将 engines 从无上界的 \`>=20\` 收窄到 **\`>=24 <25\`** 或经检查更合适的 Node24 bounded 语义；不在 Render 控制台手工改 \`NODE_VERSION\`。未来固定提交部署时必须通过日志实际确认运行的是 Node24（Node26 不算这一项完成）。
2. 用 npm 正常解析当前生产树，生成并提交**一份真正可用**的 \`package-lock.json\`，必要时加 \`.gitignore\` 防止 \`node_modules/\`、\`.env*\`、密钥和临时测试结果误进版本控制。禁止构造假 lockfile 或把开发者本地 \`node_modules\` 推上去。
3. **对当前依赖实际运行 \`npm audit --json\` 与/或 \`npm audit --omit=dev --json\`**；先定位 Render 的两项 high 对应的 package/version/advisory/依赖路径/生产可达性，再选择**最小非破坏性修复**。允许有明确兼容证据的直接/间接依赖升级和 lockfile 更新；禁止 \`npm audit fix --force\`、批量大版本跃迁、丢弃安全断言或把 high 隐藏为 0。若官方尚无补丁或修复必须大改冻结 MCP 契约：明确 \`TOTAL CONTROL DECISION REQUIRED\`，记录真实 advisory 和风险，不捏造“高危已修”。
4. CI 最小改成基于锁文件的确定性安装（优先 \`npm ci --ignore-scripts --no-audit --no-fund\`）、Node24 全量测试 0 fail/skip、smoke、语法/来源静态守卫；增加**可核实**的 audit 报告/阻断，不能因为上游可用性问题让整条 CI 无休止循环。审计应有实质性生产安全结论，并证明锁文件构建可以重复。
5. **不强迫 Render 在本轮重新部署**。交付必须把“代码已限制 Node24”与“Render 真正改用 Node24”分开记录；后者仅留到总控下一次指定提交部署核验。禁止改变已经 Live 的 exact SHA。

## 3. 工作流 B：真实 release SHA 不能由两个人手填的变量自证

当前 \`src/v1-p2-controlled-staging-candidate.js\` 的 \`assessV1P2ControlledStagingConfig\` 存在可审计身份弱点：\`SHENSHU_STAGING_APPROVED_SHA\` + \`SHENSHU_STAGING_RUNTIME_SHA\` 均可由操作员配置，彼此相等**不证明 Render 正在运行批准的提交**。

1. 阅读 Render 官方 \`RENDER_GIT_COMMIT\` 默认环境变量合同（https://render.com/docs/environment-variables）；只用于由 Render 提供的**实际部署 commit** 对照已单独批准的 \`expectedSha\`。正式 staging/prod 必须缺/错真实 commit 即 fail closed。绝不把仅用户可写的 \`SHENSHU_STAGING_RUNTIME_SHA\` 当成正式真实运行身份；已有变量保留如有兼容必要，也只能降为非权威、明确 test-only。
2. 测试代码在 \`NODE_ENV=test\` 时可以注入 synthetic \`currentSha\`，但正式可部署路径不能使用 caller/body/HTTP header、MCP 参数或可配置自报 SHA 冒充平台证明。优先只修改控制候选的最小入口/校验，**不改变已在线使用的非计费 \`composeV1P2StagingRuntime\` 或 \`server.js\` 路由**。若无法在不改变冻结入口的前提下引入可信版本对照，给出 exact blocker 总控裁决；不要为“测通”把实时路径挂上。
3. 负例覆盖：缺平台 commit、错平台 commit、approved SHA mismatch、错误 staging identity、缺/错 D1 sealed key、缺 Kodo key、缺 fixed provider ID/key、无 owner session、模型工具伪造确认、某一个 enable 被单独打开、静态 JWKS 生产禁用，**均无法进入 paid confirm/provider**。正例仅本地 synthetic fixtures。严格保留 \`server.js\` 完全不 import paid candidate，GET/POST \`/player/confirm\` 仍不可达。
4. 若检测到任何已运行生产/真实 staging 的付费入口意外变为可达，STOP 并交总控，不尝试自动修好后“继续真付费”。

## 4. 工作流 C：只准备真实 D1 / Kodo 有限资格，不先访问云

这是下一步实际可用的 SOP，不是新架构设计。允许把本地 SQLite / fake S3 的最小防重与结算边界做**有信息增量**的测试，但不得重复已经 PASS 的 400 个原有夹具。每条真实探针需先写出「对象、身份、查询/请求次数、上限、PASS/STOP 证据、残留处理、回退」。

**C1. D1 的真正独立 gate（以后需要用户再批准写入）**
- 只针对上方唯一资格库、现有 004+005 和**新 synthetic test principal**。单次受控真实资格应验：同一 owner 一个 operation 的并发/双击**只准一个 UPDATE ... RETURNING 成功**、一份 reservation、一份 \`consumed\` grant、超额请求 ABORT 并保持 0 新 reservation/grant、replay 无二次 admission、另一 owner 隔离、unknown outcome 不自动退款/重试；只允许有限人工触发，不把 synthetic grant 当作生产实际扣费。
- 确定极简的 server-side eligibility/nonce/claim 限流与证据，避免让用户手工拼十条危险 SQL。准备**本地只执行 dry-run 的候选**及只读验收格式；**禁止本轮任何真实 Cloudflare API/D1 写入、Wrangler --remote execute、token读取和真实 paid confirm**。不要再次运行 004/005 migration。
- 说明是否真实 D1 account-scoped token 已失效不能通过仓库推断，给下一次授权时才确认；明确权限最小化、后续撤销的 A5 与生产隔离。不能用前次仅封存 proposal 的 D1 测试冒称 paid claim 已通过。

**C2. Kodo 真实 owner audio 与成本 gate（以后需要用户再批准 PUT/GET）**
- 专用桶 \`shenshu-voice-v1-sg-20261029\`、唯一 prefix \`shenshu/voice-v1/private-audio/\`，IAM DELETE 已被用户撤销，只有非公开服务器端 PUT/GET 音频，签名 owner 会话和 60-300 秒访问 TTL；后台物理 1 天生命周期。不得使用任何 presigned URL、外链测试域名或前端直接 Kodo 请求。
- 对于以后**独立授权**的一次小型 owner-only encrypted synthetic WAV PUT→GET/跨 owner 拒读/expired 拒读，提前定义硬请求和流量上限、成本估计/停止规则与**永不发 DELETE**；不得复用旧一次性锁或解封 \`kodo-qualify-once.mjs\`。如为了无重复覆盖要使用旧对象，禁止；新合成随机 owner，唯一短 TTL，生命周期自然清理。
- 这一包所有 Kodo 行为仅限 fake S3，且不把“此前 PUT/HEAD 和 foreign GET 已成功”冒充完整的真实 owner GET 验收。

**C3. 未来首次04声音的最后一页审批卡**
- 只锁定既有固定 \`speech-2.8-hd\` 与用户已确认的04音色版本/服务器声音ID（不要在工具参数公开/记录真实 API key）；文字 800 UTF-8 bytes、一个 TTS request→**最多一次计费上游 attempt**、最多 60 秒 WAV/2MiB、私有音频 owner desktop+iPhone 显式播放。
- 真正启动前由用户另行批准**一次 MiniMax 费用上限**、密钥托管、exact Render SHA、成功和失败时是否计费的未知状态处理。不得把调试次数混入首次真实 smoke。保留真实可听反馈为 V1 gate 6/9 的唯一接受标准。
- 整个资格清单**最多两页**，必须能使沈述下一轮直接决定「先授权 D1+Kodo 小测试」还是「STOP 一个确切 blocker」；不得增加第五种系统或建新 PR。

## 5. 工作流 D：既有非计费 LIVE 服务回归、不动真实资源

- 只读核对 Render 现有 live deploy 的 exact commit \`e452337d7579e4ad7504a0e520b08a846cd60f04\`，分支仍旧 P1 和 autoDeploy=no，nonbillable \`sealed_ready\`、paid_voice_enabled=false、无 static test JWKS。已连接 staging 登录能力及固定 tone 控件可利用已批准的非计费探针；不要生成新 D1 提案、重复写真实 DB，也不要调用 paid confirmation。
- 若 HTTP 只读外部探针技术上无法获取状态，不凭源码编造“真实 404/手机可听”；源代码本地 HTTP 模拟与真实证据分别记录。
- Render 构建两项 high 只能按真实 audit 诊断，不得因其显示在旧部署把新 lockfile 改造结果当已上线。不要调用任何 Render \`update_environment_variables\`、\`trigger_deploy\`、手动部署、restart、Cloudflare D1 或 Kodo 请求。

## 6. 最终验收与写入终点

- 一个**真正复现**的 Node24 \`npm ci\` 构建和 400 项既有功能测试 + 本轮必要增量全量 **0 fail、0 skipped**；smoke、语法、git diff --check、GitHub 正常 PR CI SUCCESS；漏洞报告标明具体 advisory 的已修/不可修/与运行时的关系，不准把未修的 high 硬写 PASS。
- \`package.json\` 的 Node24 bounded + \`package-lock.json\`（如果审计/解析有不可解冲突就 STOP），明确 Render 需要未来新 SHA 发布时才会应用。
- SHA 可信性测试 + nonbillable/paid tool 隔离、没有 accidental payment path、Kodo GET/PUT no DELETE、D1 claim 不重复，全部 PASS；该模块仍不能被现有 \`server.js\` import。守护冻结 Auth0/canonical principal、004/005 SQL trigger、public MOCK、MiniMax 模型和声线选择，不改价格体系、用户交互或播放器美术。
- 单份最多两页 \`docs/v1-closure/V1-P2-REAL-GO-NO-GO-20261030.md\`：真实/离线证据分开、Node/安全、两道 cloud micro-qualification 的准确请求/费用范围及批准条件、后续单次04 smoke、exact SHA、回滚步骤。旧 staging SHA 不会被新 PR 代码改变。
- 唯一写入：**同一个 PR #146**，同一分支 commit/push，保持 Draft/open，不更换 base，不新开 PR、不 merge。普通工程/测试失败由 DeepSeek 自行修复、复验，连续施工，不需要糯糯转交每一步结果。
- **STOP / TOTAL CONTROL DECISION REQUIRED：** 遇到真实外部需要写入（Render/cloud/权限/费用/数据库/provider）、不可修的高风险 runtime 依赖、需改冻结 auth/billing 合同、真实版本来源不能可信确认、涉及其它仓库或 Call、出现不能解释的新 V1 大方向时，只提交已有合规代码+最小阻断报告，不能隐瞒风险赶交付。

### 最终简短回执（中文，最多 8 行）

终态 COMPLETE/BLOCKED/DECISION；Node24 真实版本与锁文件/审计两项 high 结论；真实 SHA 校验如何防环境自报；D1+Kodo 下一次真实可执行资格卡已准备；全量测试/CI ID；唯一 Draft PR #146 exact HEAD；所有真实 Cloudflare/Render/Kodo/MiniMax/Call 操作 **0**；最后两项需用户明确授权的真实云端资格及一次04 smoke。**Voice V1 仍 2/9**，不得把安全硬化误写成版本完成。

**结束。**