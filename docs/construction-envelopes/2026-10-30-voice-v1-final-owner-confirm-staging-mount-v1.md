# 沈述总控｜Voice V1 最后一道真实上线接线：staging 本人确认入口与安全关闭｜连续施工包 v1

日期：2026-10-30。总控：沈述。施工工程师：DeepSeek。
本文件为本轮**唯一权威**：`docs/construction-envelopes/2026-10-30-voice-v1-final-owner-confirm-staging-mount-v1.md`。
适用规则：`nuonuo310/Shenshu-Continuity/rules/CONTINUOUS_CONSTRUCTION.md`。冻结 V1 九项 DONE LINE：`docs/v1-closure/V1-CLOSURE-PLAN.md`，目前 **2/9**。这是**必须完成的一次真实可部署接线**，不是新项目、泛化模拟研究或重复云端测试。

## 0. 总控裁定、DONE LINE

**唯一目标**：把现成的 `src/v1-p2-controlled-staging-candidate.js`（内部已连接本人确认→004+005 sealed claim→server-fixed MiniMax04 单次调用→Kodo 私有 WAV）集成到**当前 Render 正常启动的 `server.js` 路由/启动流程**，使未来在**另一轮明确的人工上线授权**、真实密钥和严密开关均齐全时，Owner 在 `/player/pending` 看原文并亲自点「确认生成」，才可能产生**一次**计费 TTS。默认仍 **付费 OFF**，现有 staging/production、ChatGPT MCP、公用 P1-MOCK、旧非计费体验不退化。

**DONE LINE = 已实施可部署接线代码，带明确 OFF/ON 双态的真实本地 HTTP 端到端验收，付费 OFF 时 `/player/confirm` GET/POST 404，正常 GitHub CI PASS；交一页实装/回退说明。到此停止其他离线切片，下一步由沈述裁决真实 staging 灰度与首次04费用授权。**

**NOT IN SCOPE**：这一轮没有 Render 部署/改 env、Cloudflare/D1 写读资格、Kodo PUT/GET（真实资格已通过，不重复）、MiniMax04 调用与费用、真实 AK/SK/API Key、iPhone 真人播放、Call、Asteria、Nightvoyage，绝不重跑 `scripts/qualify-d1-cloud-once.mjs`、`scripts/qualify-kodo-owner-once.mjs` 或已经封存的旧条件 DELETE 资格脚本。

## 1. Opening Gate：必须核验的真实现场

- 唯一仓库 `nuonuo310/ShenShu-Voice-MCP`，同一现有 **Draft/open PR #146**，branch `codex/voice-v1-p2-d1-confirm-qualification-20261028`，base `docs/voice-v1-p2-d1-confirm-qualification-20261027` @ `8c3ede3e3f3e2ef4d8387436019d3dd3d2a4a22d`；本施工包落库前 HEAD `19b56dec8a74050b7185e552055dad9bc8f0d338`，以本文件提交后的 PR 实际 HEAD 为开工权威，若工作区/PR SHA 漂移，先审因由、STOP 影响授权的冲突。只能沿此 PR 提交/推送，无新 PR、无合并、不改 base。
- 真实 Render staging service `srv-dbcgcsom7kps739tfpo0`，LIVE 正常 Node24.22.2，手工固定部署 **`b9681a1572d06ad007a3a047f2188c5661174529`**，旧分支配置 `codex/voice-v1-p1-auth-session-security-review-20261027`，autoDeploy=no。**不能**调用 Render generic deploy/env update：后者可触发旧 P1 分支部署。此包一律不碰 Render。
- 现有在线 `shenshu_staging_sealed_startup: sealed_ready`、`static_test_jwks:false`、`paid_voice_enabled:false`；OAuth `verify_shenshu_login` 实际通过，仍是非计费，现在线上没有 `/player/confirm` 正式可达路线。
- **两条真实云端资格已 PASS，不允许重新验证**：D1 专用资格库 UUID `234913cd-8901-4607-8147-31c4a4317111`，真实 004+005 并发/配额/一次性 grant（run `bbcbea5b13d47735`，3 密文操作/2 reservations/2 consumed grants，零 provider）；七牛新加坡私有桶 `shenshu-voice-v1-sg-20261029`，1 synthetic encrypted PUT + 3 GET，owner 解密/foreign 拒绝/expiry 拒读，**无 DELETE/HEAD/LIST**。证据 `docs/v1-closure/V1-P2-REAL-D1-KODO-CLOUD-QUALIFICATION-20261030.md`。user-held 一次性 D1 Edit token 已撤销，Kodo 子用户删除权已撤销；不能重新创建账号权限或读取密钥。
- 当前 `server.js` 的 `createShenShuRuntimeServer` 只组合 `composeV1P2StagingRuntime`（read-only sealed proposal），`createShenShuHttpServer` 仅将 GET `/player/pending` 路由到非计费 handler 并用 `handlePrivateWebPlayer` 处理播放器。对于 GET/POST `/player/confirm` **404**。现有 `src/v1-p2-controlled-staging-candidate.js` 构造独立 HTTP server、内部能处理 owner confirm 和加载 Kodo WAV，**但不被正常 server.js import/mount**，单独用该 server 替换进程可能导致旧公开 MOCK/fixture/P1/静态资源丢失。需最小组合而不是简单全替换。
- 现有候选严格基于 `RENDER_GIT_COMMIT` 校验真实运行 SHA（不信可写 `SHENSHU_STAGING_RUNTIME_SHA`），独立 staging enable flags（`SHENSHU_STAGING_FINAL_WIRING_ENABLED`, `SHENSHU_STAGING_PAID_CONFIRM_ENABLED`, `SHENSHU_STAGING_REAL_PROVIDER_ENABLED`, `SHENSHU_STAGING_PRIVATE_AUDIO_ENABLED`），受信 Auth0、session secret、密封私文 master key、Kodo owner 加密 master key、MiniMax key/voiceId；全不齐 fail-closed。CI Node24 现有 414/414，无高危漏洞，后加云端验收文档 CI SUCCESS。核验每个 key、flag 的实际来源，绝不在文档或测试泄露真实值。
- 唯一04声线已被用户认可的冻结基线：`speech-2.8-hd` + `ShenShuCN04Ziran_20261025220130`，语速 1.0、音量1.0、音调0、单次完整句 TTS。若模型/ID 与仓库冻结合同有冲突，**STOP / TOTAL CONTROL DECISION REQUIRED**，不能偷偷换另一声音或让 ChatGPT 选择 voice。

## 2. 具体必须做的单次实现

A. **统一的服务器路由接线，不损失原有服务。**

- 复用现有 `createV1P2ControlledStagingCandidate`、`createV1P2D1Confirmation`、`createV1P2PlayerConfirmationHandler`、`createP2PlayerAudioLoader`，使其可作为 `server.js` 的可选受信启动组合注入；必要时把独立 `makeServer` 重构为导出的/可复用的请求 handler，**不要复制**鉴权/claim/provider 逻辑或另开新 HTTP 端口、第二项目。
- **付费 OFF/default/部分配置/错误 SHA/错误 origin/无正确 Kodo credentials/无 D1 005 schema**：`server.js` 仍服务公开 P1-MOCK `/mcp` 和固定 tone、私有 `/player` P1 fixed WAV、受保护 staging OAuth 的 `prepare_shenshu_voice`/status 和 owner 的原文 read-only `/player/pending`。GET/POST `/player/confirm` 始终 404、模型无法调 paid tool、任何 env 1 个变量不能授权费用。若配置试图开启付费却不全，**显式 fail-closed**，不能降级到非密封记录、未签名身份、非隔离 provider 或本机 memory; 也不能影响纯 P1 公共路径安全。
- **所有上线门禁完整且总控单独批准时**，同一 `server.js` 只挂现成 owner-protected `/player/pending` 与 POST `/player/confirm`、真实 owner `/player/audio` 私有读取。GET `/player/confirm` **405** 或更严格响应，不显示可自动触发的按钮；POST 只能同源、signed Auth0 principal session、strict Origin/Fetch Metadata/CSRF、exact sealed text+handle、未过期、唯一 D1 claim，经一次服务器固定 MiniMax 尝试，validated WAV 经 Kodo owner-only GET/PUT。**MCP 工具仍只能 prepare/status，不产生任何 paid/confirm/charge tool**。公众 MOCK、非计费 P1 和 OAuth 仍能访问。既存 004/005 SQL 原子合同和 account/owner 隔离不可修改。
- 04 固定模型+声音 ID 必须服务端可信且经本轮冻结 pin 校验（`ShenShuCN04Ziran_20261025220130`）；**不得由 MCP 调用参数、表单、查询串指定**。若公版接口确实要暴露未来付款文字，UI 必须显示确切原文、明确「会消耗一次额度/可能产生费用」，只有真实 owner 主动按钮提交，绝不自动 refresh/submit。V1 不要新增按句、多模型、自动朗读功能。
- **安全优先级**：真实付款链路异常应停止，不得再试一次 provider、不退款、不重放重复 grant；Kodo 若 PUT 结果不明，执行 unknown终态不重复计费；之前旧 ETag DELETE 已失败，程序 **永久零 DELETE/HEAD/LIST/IfMatch**，一天前缀生命周期自行物理删，不在网页显示公开 WAV URL。若现有 HTTP 处理顺序导致 `/player/pending` 误被 read-only handler 先截获或 `/player/audio` 总是固定 P1 WAV，必须用路由优先级和测试显式锁住，不能宣称已接线而永远走不到。

B. **精确启动身份与密钥隔离。**

- startup 确认真实 `RENDER_GIT_COMMIT` 与由总控批准的 exact SHA 匹配，错误/缺失一律没有 paid path；test-only `currentSha` 只允许 `NODE_ENV=test`，实际 Render 进程不能注入自称 SHA。生产 `main`/非 staging origin 不可达，static test JWKS 不可用于 live。
- 真实 TTS 密钥、Kodo AK/SK、D1 授权不出现于 Git、GitHub Actions、issue、测试 fixture 提交或日志；本轮绝不改 Render env。原 Render service 配置的分支是旧 P1，因此未来必须手工按本包交付的 exact SHA 部署，不能 generic deploy；env 变更可能另触发旧 P1 redeploy，需清晰写 STOP/rollback。
- 完成一页**未来安全人工启用顺序**：准备正确的用户密钥保管、D1 资格库 scope 固定（绝不访问老 `shenshu-voice-budget-test`）、Kodo无 DELETE、provider固定04，Render paid flags 独立且默认 OFF；现场先仅新代码非付费上线验证，再经下一次总控/用户**单独批准一次真实04费用**后做 owner 手动点击/可听验收。不得提前让任何后台测试/自动任务“帮助完成”首次费用调用。
- 禁止用之前已撤销的 Cloudflare 一次性 Token（`shenshu-d1-qualification-once-20261030`）来启动长期 server。需要新的正式上线限权方案另行审批，绝不可默认复制已有账号级管理员 Token。

C. **验收必须是可运行的双态真实本地 HTTP 回归，不要仅凭代码注释。**

- Node24 测试至少证明：同一 deployable server 的 **OFF** 模式 P1/MCP/OAuth/nonbillable pending 正常且 `/player/confirm` 404，开启一个 flag 仍不能付费；错误 SHA、错误身份、错误/缺失 secret、重复 grant/额度不足、provider未知/超时、跨 owner、错误 CSRF/Origin/FetchMetadata、异常重启全部 fail closed。
- **ON** 模式仅 local `NODE_ENV=test` 注入 fake D1 SQLite 004+005、fake S3、fake MiniMax 生成合成 WAV：完整 request from authenticated protected MCP prepare → authenticated owner pending 显示精确文本与可见「确认生成」→ 模拟本人明确 POST → single atomic claim + one provider attempt → owner `/player/audio` 返回私有 WAV；wrong owner 401/404/503，刷新/双击/重连不再次收费、过期不返回音频、无公开直链。实际生产/staging CI 绝不配置任何真 key，也不访问外网。
- 测试 NON-REGRESSION：原 `/mcp` mock、`/test-tone.wav`、已有 OAuth 登录/fixture、`/player`、原来 read-only pending 都不退化；生产域不意外开放 paid；没有任何模型工具可以调用 confirm。受测断言必须区分「human explicit POST 模拟」和真正 iPhone 物理点击，不能把离线 fake 当真付费完成。
- 正常 GitHub CI `node --test` 全量 0 fail/skip + smoke + syntax + diff + npm production audit 0，发现普通 bug 自行修复和复验，不要每小步向糯糯要指令。**云端真实 D1/Kodo 测试不再重跑**（已单次 PASS），只能本地 fake。

## 3. STOP 与真实费用边界

- **这轮只允许该仓库已有 Draft PR #146 内的代码、测试、最小启用文档变更，普通 commit/push/正常 PR CI。** 禁止新 PR、merge、变更 frozen V1 DONE LINE、真实环境/Cloudflare/Kodo/Render、真实 MiniMax 请求/费用、真实 user audio、修改 Cloudflare token 或 Qiniu IAM/账户、Call、其它仓库。
- 若要真部署/注入 secret/启用 paid flags/花费一次 MiniMax04，必须**停止并向沈述申请独立批准**；不能因用户说「接下来」就推定已批准账单。
- 如果只有“替换整个 server”才能实现付费候选、会破坏 P1/MOCK/当前 Auth0，或者固定04 ID 与实际 MiniMax 合同不一致，进入 `TOTAL CONTROL DECISION REQUIRED` 并标出精确冲突，**不能另造第二套账号/语音应用**。
- 如果无法兼顾明确点击与真实单次付费的安全边界，STOP；不为了赶进度弱化 CSRF/nonce/不可逆 grant 或把 Model 工具直接变成付费工具。

## 4. 交付终点

**COMPLETE** 仅在：真实可部署代码已与正常 `server.js` 接通、OFF/ON 本地 HTTP fake 端到端都实测、CI PASS、新增文档一页描述 live 启用/回退/首次04审批与人机手动验收、同一 Draft #146 新 HEAD 已 push，才可宣布。Voice V1 **仍保守 2/9**，因为真实04调用与本人 iPhone/桌面可听尚未完成。

最终回执最多 8 行：`COMPLETE/BLOCKED/TOTAL CONTROL DECISION REQUIRED`；正常 server 新接线 / paid OFF 行为；真实本地 ON 冒烟范围；Node24 全量/CI run；PR #146 HEAD / base；本轮真实 Cloudflare/Kodo/MiniMax/Render/Call **0**；唯一下一次上线动作（确切 SHA、人工按提交部署、哪些 flags 默认 OFF）；真实04一笔费用仍需糯糯独立同意。不要继续挖新坑。
