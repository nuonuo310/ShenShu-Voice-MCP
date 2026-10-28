# 沈述总控｜Voice V1 非计费 MCP → 私有播放器连续施工包 v1（2026-10-28）

**Status: AUTHORIZED FOR BOUNDED OFFLINE IMPLEMENTATION ONLY.**  
**Authority owner: 沈述（Voice V1 总控）；执行：DeepSeek 工程师，不拥有架构 / 发布 / 付费裁决权。**  
**施工包唯一仓库相对路径：`docs/construction-envelopes/2026-10-28-voice-v1-nonbillable-mcp-player-closure-v1.md`。**  
**管辖规则：`nuonuo310/Shenshu-Continuity/rules/CONTINUOUS_CONSTRUCTION.md`。**  
**V1 冻结完成线：`docs/v1-closure/V1-CLOSURE-PLAN.md` 的九门禁，不得扩充或重定义。**

## 0. 本包到底要交付什么

一次连续施工，将**已在 Draft PR #146 实现的非计费 MCP 提案工具**接到**现有 Auth0 独立播放器的只读待确认页面**，形成一条可运行、可测试、部署前明确关闸的最小闭环：

1. 经受保护 OAuth/JWT 校验的 ChatGPT MCP 请求 → `prepare_shenshu_voice({text})` 建立一条**非计费**提案；
2. `check_shenshu_voice_proposal({handle})` 只能查看同一 verified principal 的状态；
3. 相同 canonical principal 登录现有 `/player`，从清晰且轻量的入口进入 `/player/pending`，看到**原提案文字**和到期状态；其他用户、无会话者、错误 audience/scope 看不到；
4. 在本包范围内只提供**只读待确认**：**不开放 POST `/player/confirm`，不显示可实际生效的“确认生成”按钮**。如显示说明，须明确“目前为非计费预览，未开启实际生成”；
5. 原 `/player/audio` 的受认证固定非计费 WAV 和 iPhone Safari / 桌面显式播放体验不回归；
6. 通过完整 Node24 零跳过 CI，形成一份可复验、无秘密的交付回执，定位后续 staging 资格与隐私决策的**唯一实际阻断**。

本包是从代码测试走向真实可用的**部署前实现包**；不是付费上线包。代理应自主完成正常代码修复、回归、提交和 CI，而非每完成一个文件就停下。

## 1. 权威现场 / Opening Gate（必须先核验）

- 唯一目标仓库：`nuonuo310/ShenShu-Voice-MCP`，origin `https://github.com/nuonuo310/ShenShu-Voice-MCP.git`。
- 已有且唯一可继续的 PR：**Draft #146**：`https://github.com/nuonuo310/ShenShu-Voice-MCP/pull/146`。
- 允许目标分支：`codex/voice-v1-p2-d1-confirm-qualification-20261028`；PR #146 的固定 base：`docs/voice-v1-p2-d1-confirm-qualification-20261027` @ `8c3ede3e3f3e2ef4d8387436019d3dd3d2a4a22d`。
- **本施工包创建前的真实代码 HEAD：`2287471afcfff861c4cf27b75c98cf0298b06ab4`**，Node24 GitHub CI run `40724327707`：**322/322 PASS，0 fail，0 skip**。本施工包提交本身会把 HEAD 向前推进：以**包含本文件的最新 PR #146 HEAD**作为开工基准，不得退回到 `8ac347...`、`7bf8c8...` 或本地陈旧 HEAD。进入施工后应记录新基准 SHA/tree。
- 优先在**干净隔离 worktree**施工。用户 Windows 现有 `C:\Users\Administrator\Desktop\ShenShu-Voice-MCP-P2-145` 是**旧现场，不是权威 HEAD**；不要对它盲目覆盖/重置/清理。若另有未追踪文件、未提交修改或代理施工并发，保护现场，必要时 STOP。
- 先读本文件、Continuity 连续施工规则、V1 Closure Plan、PR #146 当前内容；检查 `server.js`、`src/staging-authenticated-mcp.js`、`src/v1-p2-nonbillable-mcp.js`、`src/private-web-player.js`、`src/v1-p2-player-confirmation.js`、`src/v1-p2-stable-operation-identity.js`、`src/d1-p2-confirmation-operation-store.js`、`src/v1-p2-d1-confirmation.js`、`src/cloudflare-d1-http.js`、`test/v1-p2-d1-confirm-qualification.test.js` 等实际代码，辨明已实现/未挂载部分；不重复造轮子。
- 云端事实基线（非开工授权）：用户亲自经 Wrangler 在**专用** D1 `shenshu-voice-v1-qualification-20261024` UUID `234913cd-8901-4607-8147-31c4a4317111` 完成 004 additive migration、四对象只读 postflight、一条合成测试提案、一次成功原子 claim（恰好 1 reservation + 1 consumed grant）以及一次相同操作 replay（0 行），证据位于 PR #146 评论。**这只证明真实 D1 单次操作/顺序重放，不证明并发、完整应用链路或真实账单**。本包不得重复远程 SQL 验证。
- **严格禁止目标数据库**：`shenshu-voice-budget-test` UUID `c39a6895-7028-4f59-a100-1455b92c96c1`，只读/写入都不得触碰。
- 当前真实 Render staging 服务 `srv-dbcgcsom7kps739tfpo0` 位于旧 P1 branch，`autoDeploy=no`；已有可用的 Auth0 独立播放器。不得假设 PR #146 已经部署。生产 `srv-dbb2jmu7bikc73bgq2e0` 永不触碰。

若仓库/PR/base/代码身份与本包产生实质冲突，或无法确认哪些文件属于实际运行路径，**TOTAL CONTROL DECISION REQUIRED**，不能以猜测覆盖现场。

## 2. 冻结接口、状态与权利边界

- **状态权威**：现有 owner-scoped P2 operation contract；真实资格 DB 采用 `paid_voice_confirmation_operations` 和 004 trigger，不迁移到旧 003，不用多 SQL 假装原子授权。不得让内存 Map 成为上线时的权威状态。离线测试可用已有 local node:sqlite/in-memory fixture。
- **用户身份**：受保护 MCP 每次 JWT 仍按已验证 issuer、audience、scope 验证；播放器用既有 Auth0 Authorization Code + PKCE、服务器签名 HttpOnly Secure SameSite cookie；两侧通过同一 `deriveCanonicalPrincipal` 获得 principal。绝不信任前端字段、工具参数、`X-User` 或未验证 header 传来的 principal。
- **MCP 只能提案/查状态**：保留当前 `prepare_shenshu_voice`、`check_shenshu_voice_proposal` 的安全合同；**不得增加或暴露模型可调用的 confirm / grant / quota / provider 工具**。禁止用户以工具文本选择 model、voice、每日限制、grants、operation ID、收费规则。
- **确认属于播放器本人**：已有 `src/v1-p2-player-confirmation.js` 的签名 session、Origin、Fetch Metadata、CSRF、owner text digest 约束是冻结合同；本包只允许挂载安全只读的 pending view，保留 POST confirm 为**不可达**。可以用最小读模式复用原模块，或独立只读 view；绝不可因为“方便完整演示”触发其付费 broker。
- **生成及播放**：P1 已证明独立播放器在 iPhone/桌面播放固定的非计费 WAV；保持 `/player`、`/player/login`、`/player/callback`、`/player/audio` 原行为。不要重做音色、播放器视觉或 iOS iframe/host bridge；不安装新依赖除非 V1 真阻断。
- **安全开关**：默认关闭。真实请求路由仅在明确服务器端 staging guard 生效，缺配置一律 503/404 fail closed；不能从 query/form/header/工具参数打开。生产和公共 MOCK `/mcp` 必须与该路径隔离。

## 3. 施工执行：代理在包内连续完成，不需逐步请示

### A. 把已实现但未挂载的非计费桥打通

- 先承接当前 PR #146 代码，特别是已有可选 `proposalBroker` 注入的 `handleStagingAuthenticatedMcp` 和 `makeStagingMcpServer`；检查实际入口 `server.js` 尚未供给 broker 的事实。
- 在严格 staging-only、显式 env/config guard 下实现最窄的 server-side composition：同一权限域中的非计费 `initiate/status`、player pending list 共用同一个 operationStore / 同一个 canonical principal。
- 提案操作本身**不执行** `claim`、`authorizePaidAttempt`、MiniMax、真实 quota/reservation/grant 或 private audio 保存。本包禁止把一条 nonbillable prepare 偷偷解释成付费授权。
- **注意既有 broker 接口要求 paid dependencies**。允许最小安全抽取一个 nonbillable proposal broker/facade，复用 `validRecord`、D1 operationStore、固定状态合同；不要依赖“装一个假的可付费 synthesizer 就先上线”的危险捷径。离线 fixture 可以 mock，但运行路径中不应存在可调用的付费 provider。
- 区分可运行入口与显式不可运行条件。没有安全的持久化文本策略时，可完成只在本地 synthetic fixture 运行的 composition，但不得把未加密个人文案写入真实 D1。明确在代码/测试中 fail-closed；不得用新 env flag 绕过隐私门禁。

### B. 让播放器能查看、不能付费确认

- 在独立播放器提供轻量 `/player/pending` 入口（如在 `/player` 中添加一个链接），保留既有视觉与播放。
- 待确认页只显示本人完整文本、到期与“尚未生成”状态；正确 HTML escaping、缓存禁止、CSP / frame-ancestors 限制、统一状态码。过期不继续展示；无登录 401/跳登录，非本人看不到。
- 这一轮不挂载 `/player/confirm`，不要出现真的可提交的 paid form；任何直接 POST/GET confirm 试探必须 404/405 等 fail-closed，0 写入，0 provider。
- 浏览器不自动刷新、不自动合成、不预留配额、不自动播放；用户在自己的播放器中主动打开查看。
- 保留已验证 P1 固定 WAV 按钮，不用漂亮 UI 掩盖不可用的逻辑。

### C. 端到端离线集成验收（必须真跑）

在 Node **24** 的可复验环境中运行真实 server / MCP handler 和 player route 的端到端或可信近端集成测试；不要只运行纯 mock 工具列表。至少覆盖：

1. 已签名/已验证 JWT、正确 scope/audience 以真实 MCP 协议创建提案 → 状态可查 → 同一 Auth0 派生 principal 的签名 player cookie 在只读 pending 页面看见**原文字**。
2. 未登录、他人 principal、不同 issuer/audience、缺 scope、伪造 header、超长/无效文本、不合法 handle、重复参数和过期提案 fail closed；这些分支没有 D1 quota、grant 或合成调用。
3. 只通过非计费路径测试，不能观察到任何 `/player/confirm` 的有效入口、任何 MCP confirm 工具或 provider 调用；包括用户直接伪造 POST、双击、重复请求、HTTP 断线后的安全状态检查。
4. local SQLite fixture 的 **004 operation 表**真实读写，确认 owner-scoped listPending、回读、expiry 和重启后在同一 store 上恢复；明确区分本地 SQLite 证明与已完成的有限真实 D1 claim 证明。
5. 出错/宕机/缺 D1 配置/失效安全开关时不 fallback 到内存模拟、不打开付费路径；返回稳定通用错误而不是输出 secrets。
6. `/player/audio` 固定 WAV 原有认证/播放回归、P1 登录回调、公共 MOCK `/mcp` 无新增付费工具。
7. `node --test` 全量 Node24 **0 fail / 0 skip**；`node test/smoke-server.mjs`、语法/静态检查（如项目支持）和 `git diff --check` 通过。不可通过删测试、降低断言或改冻结 V1 目标让 CI 变绿。

普通失败（实现 bug、测试夹具、lint/语法、预期内的局部路径兼容）须在授权范围内自行修好、复验、提交。禁止只写“设计完成/建议后续实现”就算 COMPLETE。

### D. 严格分离“部署前完成”和“真实云端验证”

该包**授权的终点**是代码完成 + 本地及 GitHub CI + 同一个 Draft PR #146 推送。下面内容**不在本包自动授权范围内**：

- 不得部署/重启 Render staging，不得修改其分支、autoDeploy、环境变量、Auth0 callback、应用配置或现有用户会话；也不允许操作生产。
- 不得调用 Cloudflare API/Worker/D1 或执行真实 SQL（包含 SELECT），不得重新打开任何 Worker 公网路由；旧 D1 绝对禁止。
- 不得新建/读取/复制/旋转密钥、把真实用户的语音文案或 OAuth token 发到日志或云端。
- 真实 D1 当前 `004` 提案表 **`text` 字段明文存储**，它尚无获批的 private-at-rest sealing/密钥持有方案。**不要为了演示把糯糯的私人文字直接写入该表**。可以写出一份最小可执行的密封需求/候选与具体权限决策点，但不得擅自选择/启用真实密钥管理方案或修改既有 canonical state。
- 真实 miniMax / ElevenLabs / 04 克隆语音产生费用；**没有任何新的付费授权**，不准调用，不准把“点确认”指向真实 provider。
- 不得擅自挑选、创建、收费绑定 Qiniu/Kodo、R2 或别的私有音频存储。D1 不负责存音频。真实生成的私人音频持久化与最终 iPhone/桌面播放仍需后续明确资格。
- 不得 merge/rebase 改 base、关闭 PR、碰其他仓库、创建分支森林或新 PR；不要调度新自动任务。

## 4. 本轮 DONE LINE / BLOCKING / LATER

**本包 DONE LINE（全部达成才可 COMPLETE）：**

- 一份可在 Node24 跑通的非计费 MCP → 同 principal 只读 player pending 的真实路由/编排代码；
- 实际签名身份链路、owner-only、expiry、fail-closed、公共 MOCK 隔离、P1 WAV 回归通过；
- 无任何可达 paid confirm/实际 provider/新账单/真实云写入；
- GitHub 上**同一 PR #146** 包内提交存在，正常 CI 新 HEAD **全部 PASS、0 skip**，并有精简真实收据；
- 后续 staging 上线所缺的 privacy-at-rest / credential / deploy 授权点明确到**可由总控裁决的最少事项**，不再分散成无穷设计研究。

**BLOCKING 本包的：** 无法保持 owner Auth0 合同；无法保证只读 pending/付费不可达；真实执行入口未接通；试图使用明文真实 D1 文本；CI/test 失败且无法在边界内修复；缺关键依赖使所有可验证代码都不能实现。

**NON-BLOCKING / LATER：** 真正的 04 MiniMax 合成、私有持久音频仓、收费账单证据、真实 D1 并发与 quota 负例、生产发布、嵌入式官端播放器、自动朗读、多人/多音色、音色馆、历史档案、页面重绘。它们属于 Voice V1 **后续独立门禁**或 V1.1，不得扩大此施工包。

**完整 Voice V1 DONE LINE 与本包 DONE LINE 不同。** 当前 V1 严格计数 **2/9**；不得因这轮 322→更多绿测自称 V1 已交付或付费链完整。

## 5. 允许写入 / STOP

允许变更：`server.js`、`src/staging-authenticated-mcp.js`、`src/v1-p2-nonbillable-mcp.js`、`src/private-web-player.js`、`src/v1-p2-player-confirmation.js` 仅为只读 view/guard 所需部分、`src/v1-p2-stable-operation-identity.js` 仅非计费接口安全抽取、必要小型组合模块及相应 `test/**`、极小 UI 链接 `ui/private-player.html`、最小验收证据。需要更改 004 trigger / schema、真正付费 pipeline、冻结 Auth0 身份或 state owner 时 STOP，不得自作主张。

**唯一写入终点：** 在当前 #146 目标 branch 上 commit/push 并等待默认 `pull_request` CI 完成（不得手动 workflow dispatch）。保留 Draft/open，不 merge，不新开 PR。施工包本文件冻结为总控指令，不要自行改成另一目标；普通工程修改应在其他文件落地。

必须 STOP / `TOTAL CONTROL DECISION REQUIRED`：Opening Gate 发生不兼容 SHA/branch/base 漂移、真实收费/权限/密钥/部署请求、无法保持付款不可达、必须更换 canon principal / D1 owner / schema / V1 DONE LINE、与现有确认/语音音频行为产生不可逆冲突、反复尝试无信息增量、需要用户批准的真实个人数据落云或私有存储决策。

外部依赖缺失且合法路径已用尽时为 `BLOCKED`：写明已证明与未证明，切勿将“离线完成”伪报为“staging 可用”。

## 6. 用户可见最终回执（尽量 6–10 行）

只提交最终一份中文简报，不逐文件停工汇报：

- **状态**：`COMPLETE` / `BLOCKED` / `TOTAL CONTROL DECISION REQUIRED`；
- **真正完成的体验**：MCP 准备 → 独立播放器只读查看是否在测试中成功；是否已部署（默认 NO）；
- **安全**：没有真实 D1/Minimax/生产/凭据/付费调用，未开放 confirm；
- **验证**：Node24 全量及 smoke、CI 具体 pass/fail/skip、run ID；
- **写入**：PR #146 + exact commit SHA；无新 PR；
- **还差什么**：从 staging 可用到首次 04 语音，只列**真实阻断**；
- **需要沈述决定的唯一事项**（如果触边）：最小范围的 privacy-at-rest、staging/credentials、provider 付款授权，按真实顺序提出，不一起申请大授权。

不要替糯糯写长施工周报，不要求她搬日志，不要因为普通工程失败提前退出。最终接受、云端开启及付费决策只归沈述总控。

**结束。**
