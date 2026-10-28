# 沈述总控｜Voice V1 本人确认 → 单次领取 → 私有 WAV 离线闭环｜连续施工包 v1
日期：2026-10-28
状态：**只授权离线代码、测试与现有 Draft PR #146 推送。未授权云端付费确认、MiniMax、任何真实数据库追加写入、部署。**
总控：沈述；执行工程师：DeepSeek。遵循 `nuonuo310/Shenshu-Continuity/rules/CONTINUOUS_CONSTRUCTION.md`。本文件路径：`docs/construction-envelopes/2026-10-28-voice-v1-explicit-confirm-private-wav-offline-v1.md`。

## 0. 本轮 DONE LINE：一条真正完整的离线语音链，不开新系统

在一个可启动、可回归的 **Node24 本地真实 HTTP** 测试环境里，把现有代码组合为：

**受保护 MCP 非计费提案 → 相同 Auth0 派生 principal 的独立播放器看到原文 → 本人浏览器表单提交（session + Origin + CSRF）→ 本地 SQLite 004+005 sealed 单语句原子 claim、恰好一份 reservation + consumed grant → 固定模型/固定假音色的注入式、非计费模拟合成器恰好调用一次 → WAV 严格校验并保存到独立的私有结果存储测试后端 → /player/audio（或最小受认证等价路径）由同一 principal 显式加载并播放 → 状态完成 / 回放幂等、不重复生成。**

以上全部在本地使用合成文字、合成音频、合成密钥和假 provider；**真实 MiniMax 调用为零**。这一轮要交付的不是又一份纸面设计，也不是只重跑 358 项老测试，而是把目前分离的 P2 确认/结果/播放器拼成一条**新的完整可执行离线闭环**。

项目原先的 V1 九门禁（`docs/v1-closure/V1-CLOSURE-PLAN.md`）不改，Voice V1 依然保守 2/9；本包 COMPLETE 不等于付费 Voice V1 DONE。

## 1. Opening Gate：精确现场与已经通过的云端事实

- 仓库唯一：`nuonuo310/ShenShu-Voice-MCP`，origin `https://github.com/nuonuo310/ShenShu-Voice-MCP.git`。
- **唯一现有工作 PR：#146 Draft/open**，branch `codex/voice-v1-p2-d1-confirm-qualification-20261028`，base branch `docs/voice-v1-p2-d1-confirm-qualification-20261027` @ `8c3ede3e3f3e2ef4d8387436019d3dd3d2a4a22d`。本包创建前代码 HEAD `f5e91ce59c1b7e642ed14b02878d05420cd2f53e`，Node24 GitHub CI run `40738584448` PASS **358/358/0 skipped**。本文件新增会推进 HEAD：开工以**包含本施工包文档的 #146 最新 HEAD**为唯一权威。禁止从旧本地 worktree 强推覆盖；优先干净、隔离的新 worktree，检查任何并发工作。
- 当前 Render staging `srv-dbcgcsom7kps739tfpo0` **Live** 精确提交 `f5e91ce59c1b7e642ed14b02878d05420cd2f53e`（deploy `dep-dbh476ek1f9s738lr0l0`）；自动部署关闭。Live 日志 `sealed_ready`，`paid_voice_enabled=false`。**严禁在本包中改变这一已验证的非计费线上状态**。
- 真实非计费云端闭环已经由沈述执行、糯糯在电脑和 iPhone 亲眼验证：ChatGPT 受保护 `prepare_shenshu_voice` 创建 synthetic 提案 → staging D1 005 密封保存 → 独立 `/player/pending` 同一登录身份显示原文；真实 D1 元数据只读后验 `text='sealed:v1'`、加密信封/算法标记存在、测试短句未明文出现。验收证据见 #146 2026-10-28 评论。**不要重做这轮、不要再写新的真实 D1 测试提案。**
- 专用 D1（本包严禁访问）：`shenshu-voice-v1-qualification-20261024`, UUID `234913cd-8901-4607-8147-31c4a4317111`。严禁触碰旧库 `shenshu-voice-budget-test` UUID `c39a6895-7028-4f59-a100-1455b92c96c1`（连 SELECT 都不准）。005 已真实迁移一次且核验通过，不能重复 ALTER。
- **Call 正在独立施工。** 本包不能触碰 Call、Asteria、Nightvoyage、Visual World、Continuity 的其他业务状态，也不能占用它们的部署端口/凭据。
- 先读本包、连续施工规则、V1 Closure Plan、关键文件及实测合同：`src/v1-p2-staging-runtime.js`、`src/v1-p2-staging-sealed-closure.js`、`src/v1-p2-nonbillable-mcp.js`、`src/v1-p2-nonbillable-proposal-broker.js`、`src/v1-p2-d1-confirmation.js`、`src/v1-p2-player-confirmation.js`、`src/v1-p2-stable-operation-identity.js`、`src/d1-p2-confirmation-operation-store.js`、`src/v1-p2-private-text-sealer.js`、`src/v1-offline-paid-pipeline.js`、`src/minimax-adapter.js`、`src/p2-private-result-store.js`、`src/private-web-player.js`、`server.js` 与已有测试。遵循已有 contracts，不重新发明相同层。
- 若 Opening Gate 的 repo/base/SHA/重要合同发生影响授权的漂移，停止：`TOTAL CONTROL DECISION REQUIRED`。

## 2. 已冻结：架构和绝对安全边界

1. **模型没有支付权**。保护的 MCP 只有 `prepare_shenshu_voice` 和 `check_shenshu_voice_proposal`；没有可由模型调用的 confirm/charge/quota/grant/tool、没有 query param 一键付费。用户点击独立 Auth0 播放器中的明确表单才进入确认候选；表单走 POST + signed owner session + strict Origin + Fetch Metadata + CSRF + immutable text binding。
2. **唯一权威 D1 operation 状态**：004+005 sealed operation store，不重写 trigger、不用旧 003、不改 principal 或 scope，不增加并行的收费事实状态。唯一单语句 `UPDATE ... RETURNING` 由 004 trigger 同步 reserve slot + issue/consume one-use grant；失败原子回滚，不靠 3 次网络 SQL 拼成一次交易。text 固定 `sealed:v1`、`sealed_text` AES-256-GCM、`text_digest` HMAC；已经部署的非计费路径与密封策略冻结。
3. **合成逻辑**：服务端固定 `V1_FIXED_MODEL_ID` 与待审批的04 voice_id，工具参数不能改变。离线测试用明确的 fake voice ID/固定 WAV 合成器，不接真实 API Key，不发起任何外部付费请求，不把合成成功冒称“04声音已生成”。复用现有 adapter `src/minimax-adapter.js` 的真实规格约束，但**本包任何运行入口不可 import/调用真实 MiniMax 请求函数作为可达路径**。
4. **私有音频**：复用 `createP2PrivateResultStore` 和现有 `/player/audio` 注入式 `loadAudio`；不生成公共永久 URL，不把 WAV 放到 D1 文本表、不在 MCP response 返回 base64 私有音频。只允许已登录 owner 下载短 TTL WAV、`Cache-Control: no-store`、无 token 放 URL，音频拒绝越权并在过期后不可读。现有 P1 固定非计费 WAV 在真实 staging 行为必须保持不变。除非真实阻断，不做另一个独立播放器/画廊。
5. **私有存储后端限制**：现有结果存储合同为后端注入，真正持久私有对象仓**尚未得到单独选择或授权**。本包可以用明确标注为 test-only 的本地受控 fixture / 文件或内存后端模拟原子 latest-one-per-principal、TTL、重启/过期/owner 隔离；**绝不让内存 Map 被当作部署版本的持久业务权威，也不得自动新建 Qiniu/R2/Render 数据库或 bucket**。交付必须明确后续首次真实音频所必需的最低存储条件，而不是强推一个新收费架构。
6. **严格区分资格**：本包可在**离线 test-only** 的 staging-shaped HTTP 服务上暴露 /player/confirm，且唯一 synthesize 为非计费 WAV fixture；但**绝不能将此 handler 挂到当前运行中的 server.js 可部署常规路径**，也不能通过一个孤立 env=true 开关使它在 Render staging 意外生效。未来真实付费入口启用需要独立总控授权、部署锁和凭据，不能随 #146 提交自动开通。
7. **不改变其他项目与云端**：本包不调用 Cloudflare/D1/Render/Auth0/MiniMax 的真实 API，不修改已有环境变量、Token、云端 D1、staging、生产、Worker、Kodo/R2、不触发部署、不合并 PR、不新建 PR、不购买服务。真实用户名、OAuth token、voiceId、密钥、用户私聊不得写入 fixture、仓库或 CI 日志。

## 3. 连续施工任务（包内自治，不需要一次次找糯糯）

### A. 安全拼合现成 P2 组件，而不是重做

- 保留现有实时线上 `server.js` 主启动密封非计费路径；在**明确的离线测试可控组合入口**集成 `createV1P2D1Confirmation` + `createV1P2PlayerConfirmationHandler`、同一个 AES sealed operation store、fake provider、注入式 privateResultStore、existing Auth0 player audio loader。
- 已有代码存在 provider fixture 由 `createV1OfflinePaidPipeline` 生成的 `inline-base64-experimental` 中间形态和 private WAV contract；在合理可测试的边界把生成结果转为 owner-only `/player/audio`，检查 payload 大小、MIME、duration、音频数据及 TTL。不能把完成后的 private audio 仍然塞回模型可见的 MCP payload。
- 本轮能够在 Node24 本地发起真实 HTTP：受保护 MCP 创建（仍非计费）、播放器显示确认文案，符合表单限定的单次 synthetic confirm POST 成功（fixture provider call count = 1），再在 owner session 取回短 WAV，且另一个 principal、未登录、过期均失败。
- 完成/unknown/status 刷新/重连/replay 要与现有 operation contract 对齐。某些状态不可恢复（如 provider 不确定）必须保持 `unknown`，不得“帮用户重试再合成一次”。

### B. 必须跑通的负例/边界

- 缺 JWT/scope/audience、不同 principal、错 cookie、错 Origin/CSRF/fetch metadata、重复/伪造表单、文本篡改/expiry、同一/并发双击、断线重放、quota limit + next UTC day、原子触发器拒绝、缺 005/错 sealed key、provider timeout/异常/坏 WAV、私有存储写失败/重启、音频 GET/HEAD 越权/过期、服务重启后持久记录语义。
- 成功路径：确切 1 reservation + 1 consumed grant + 1 fixture provider invocation + 1 owner-only private WAV, repeat/no second provider. 失败路径：0 provider 在 admission 前；任何 provider 已尝试而结果不确定时 0 自动重试、0 退款，并保留状态/额度证据；不把本地证明写成真实 D1 竞态资格。
- 显式保留已线上验收的非计费 `prepare/status`、只读 `/player/pending`、P1 Auth0 / `/player/audio` 固定测试 WAV、公开 MOCK 工具列表不回归；线上 /player/confirm GET/POST **仍 404**。针对这条保留自动测试。
- 每个测试只用合成身份、音色占位符、合成文本和固定 synthetic WAV；不得把新 04 克隆声当 fixture 偷偷调用。

### C. 最小“下一阶段真实付费上线资格”收口

不写无限设计报告。最多一页准确回答：是否仅需 (i) 现有 D1 真实并发/quota rollback 负例及带锁资格测试、(ii) 私有短 TTL 音频后端选择/部署许可、(iii) 真实04固定 model+voice/key/一次费用上限与唯一 smoke 授权，以及 (iv) 受控独立播放器确认路由上线？如有额外真实 blocker，必须给出**代码证据**说明为何不做就无法满足九门禁；非 blocker 放 V1.1。
- **现有临时 D1 Edit Token / staging key** 已由用户直接安全设置，不能读取或复制；资格结束后的 A5 凭据撤销/降权待总控独立决定。不要在本包调用或重置它们。
- 明确"真人点击"的验收需要后续用户在自己的浏览器实际点击；自动化 HTTP CSRF 测试不能冒充物理人类手势。
- 已验收非计费真实 staging 闭环不要重复；不要新建 unrelated 项目或不断细分回执。

## 4. DONE LINE / 写入 / STOP

本包 **COMPLETE** 仅在全满足时：
1. Node24 一个真实本地 HTTP 从 protected MCP → owner signed session GET/POST explicit confirm → sealed SQLite 004+005 one-claim + fake provider → private resultStore → owner-only `audio/wav` 可完整取回，owner+error negative cases PASS。
2. 重复确认 / 并发 / 不确定响应不产生第 2 次模拟 provider；有效签名身份、账单 fail closed、固定 model/voice、私有音频 TTL 经测试不破坏。
3. 已上线非计费与公共 MOCK 保持不变，**实际 Render/staging paid confirm 仍完全不可达**；没有任何真实付费调用或外部资源操作。
4. 在 Node **24** 运行 `node --test` 全量 **0 fail / 0 skipped**，`node test/smoke-server.mjs`、适当 syntax / `git diff --check` PASS。普通失败包内自主修复、再测；不可通过删测试、降低断言或改 V1 DONE LINE 制造绿灯。
5. 仅 **现有 PR #146 Draft/open** 同一 branch 上 commit/push，正常 GitHub PR CI PASS；不 merge，不更改 base，不新 PR。交付一个简短真实证据文档与最少下一阶段决策项。

可自主修改范围：现有 P2 组合层、**仅离线测试入口**、private result loader / fixture backend、最小确认与音频路由 glue、`test/**`、必要的短文档。禁止改已部署的密封非计费 runtime 开关行为、Cloudflare 004/005 schema & trigger、Auth0/canonical principal/scope、P1 session cookie、安全限制、生产入口以及其他仓库。若必须更改冻结合同或需触碰真实云端/付费/凭据，停在 `TOTAL CONTROL DECISION REQUIRED`，不要擅自越过。

若不能实现本包完成线，终态为 `BLOCKED` 或 `TOTAL CONTROL DECISION REQUIRED`，说明唯一明确根因、已确认范围和需要沈述的最小裁决，不准用新 PR 或增加无限报告规避。

## 5. 最终回执（中文，最多 8 行）

- `COMPLETE / BLOCKED / TOTAL CONTROL DECISION REQUIRED`
- **实际离线用户旅程**：本人点击 → 一次 synthetic 确认 → WAV owner-only 播放是否通过
- **安全**：无可达线上 paid confirm、无云端/密钥/provider 变更、MiniMax 调用 0
- **验收**：Node24 PASS/FAIL/SKIP；HTTP/CSRF/重放/私有 WAV、smoke；CI run ID
- **写入**：唯一 Draft PR #146，精确 HEAD SHA；无新 PR/merge
- **离 V1 首次真正04声音只剩哪个真实 blocker**，短句；不得将离线 green 视为真实计费资格
- 如果真要总控裁决：只说一个具体无法跨越的边界

普通实现/测试失败自主修复直到结束；不要让糯糯成为你们的人工日志搬运者。

**结束。**
