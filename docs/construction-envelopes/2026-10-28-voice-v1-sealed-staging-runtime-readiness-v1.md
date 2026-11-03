# 沈述总控｜Voice V1 密封提案 Staging 启动接线与发布资格｜连续施工包 v1
日期：2026-10-28

**唯一施工包：`docs/construction-envelopes/2026-10-28-voice-v1-sealed-staging-runtime-readiness-v1.md`，权威：沈述总控；执行：DeepSeek 工程师。**
**授权性质：仅离线代码施工 + 测试 + 同一 Draft PR #146 commit/push/正常 CI。没有真实云端/凭据/部署/费用授权。**
先读 `nuonuo310/Shenshu-Continuity/rules/CONTINUOUS_CONSTRUCTION.md`，按规则在边界内连续做完、普通失败自行修复；只在真正越过授权边界时停止。

## 1. 裁决：本轮目的，不扩张 V1

上轮 005 应用层密封包已完成，审查通过；但 `src/v1-p2-staging-sealed-closure.js` **尚未挂载 `server.js` 真正启动路径**。本轮唯一目标：

**把现有 AES-256-GCM 密封非计费提案候选，安全地接入实际 Staging 启动流程；在一份可以复验的 Node24 HTTP 集成测试中实现“正常启动→受保护 MCP create/status→相同 owner 的独立播放器 /player/pending 只读查看→数据库只存密文；错误配置 fail closed；P1 固定 WAV 和公开 MOCK 不回归”。**

这轮也要固定一份**下一次 staging 上线的一次性人工授权/操作门禁清单**（只读身份、005 单 ALTER、密钥注入、staging exact build、资格试验、A5 停止/撤销），但**不执行任何真实云端步骤**。

不增加付费工具、不挂 `/player/confirm`、不合成新04语音、不建音频存储、不扩张视觉。完整 Voice V1 仍以 `docs/v1-closure/V1-CLOSURE-PLAN.md` 冻结的 9 门禁验收，当前保守 **2/9**；本包 COMPLETE 不代表 V1 DONE。

## 2. Opening Gate：一处不符就先查清，禁止盲覆

- 仓库：`nuonuo310/ShenShu-Voice-MCP`；origin `https://github.com/nuonuo310/ShenShu-Voice-MCP.git`。
- **唯一目标**：现有 Draft/open PR #146，branch `codex/voice-v1-p2-d1-confirm-qualification-20261028`，其 base `docs/voice-v1-p2-d1-confirm-qualification-20261027` @ `8c3ede3e3f3e2ef4d8387436019d3dd3d2a4a22d`。
- 开包前权威代码 HEAD `287951c76adbf5e74cff760d993fb7772bc89824`；GitHub CI run `40734460482` 确认 **348/348 PASS、0 skipped**。本施工包提交后 PR HEAD 会自然前进，开工请以**包含本文件的最新 #146 HEAD**固定新 base，不可从旧 Windows worktree 强推/重置覆盖本轮成果。
- 首先检查当前 PR #146 是否有别的并发修改、工作区是否干净。现存 `C:\Users\Administrator\Desktop\ShenShu-Voice-MCP-P2-145` 可能是旧现场，不能将它当已更新工作区；优先独立干净 worktree。
- 阅读本包、连续施工规则、Voice V1 Closure Plan、前两次施工回执 `docs/v1-closure/V1-P2-NONBILLABLE-MCP-PLAYER-CLOSURE-20261028.md`、`docs/v1-closure/V1-P2-PRIVATE-TEXT-SEALING-20261028.md`。
- 必查运行时 `server.js`、`src/protected-resource-shell.js`、`src/staging-authenticated-mcp.js`、`src/v1-p2-staging-sealed-closure.js`、`src/v1-p2-nonbillable-player-closure.js`、`src/v1-p2-private-text-sealer.js`、`src/d1-p2-confirmation-operation-store.js`、`src/verified-identity.js`、`src/auth0-jwks-cache.js`、`src/private-web-player.js`、`src/v1-p2-readonly-player-pending.js` 和相关测试。不要重新实现已有合同。
- Render **既有** staging 服务 `srv-dbcgcsom7kps739tfpo0`、`shenshu-voice-mcp-staging.onrender.com` 目前部署自旧 P1 branch `codex/voice-v1-p1-auth-session-security-review-20261027`，**autoDeploy=no**，并非 #146；本轮不能更改。生产 `srv-dbb2jmu7bikc73bgq2e0` 禁止触碰。
- D1 专用资格库 UUID `234913cd-8901-4607-8147-31c4a4317111` 的 004 已经由用户批准并实际迁移、完成单次 claim + sequential replay 验证，但 005 尚未远端运行。**本包不授权远程 SELECT、ALTER 或写入。**旧 `shenshu-voice-budget-test` UUID `c39a6895-7028-4f59-a100-1455b92c96c1` 不得进行任何操作。
- 若真实 PR HEAD/base、冻结 identity/state 语义与本文实质冲突，或未授权修改无法隔离，`TOTAL CONTROL DECISION REQUIRED`。不能通过修改生产或声称已有部署来通过 Gate。

## 3. 冻结安全合同

1. **身份**：MCP 每个受保护请求都使用已验证 JWT（issuer/audience/voice:speak、轮换 JWKS），播放器用现有 Auth0 PKCE + 已签名 HttpOnly 会话；两侧统一 `deriveCanonicalPrincipal`；不能以请求参数、前端 header、cookie 自己声明 subject 作为权限。优先复用当前已在运行的权威身份校验路径；不要自己复制一套不一致的 verifier/JWKS。
2. **唯一状态**：现有 004 + 005 `paid_voice_confirmation_operations`，沿用同一个 D1 store/一个 sealed codec/同一个 principal，绝无生产内存 fallback/平行状态。现有 `text` 固定 `sealed:v1`，`sealed_text` 为版本化 AEAD 信封，`text_digest` 为 keyed HMAC。短句也不能把裸 SHA 或原文写到 D1、日志、MCP 响应。
3. **付费不可达**：MCP 只暴露 `prepare_shenshu_voice`、`check_shenshu_voice_proposal`，**没有确认、合成、quota、grant 或 provider 工具**。只挂只读 `/player/pending`，`/player/confirm` GET/POST 均 404，不能让 `createV1P2D1Confirmation` 或付费 broker 进入运行时。原 `/player/audio` 固定非计费 WAV 保持可用。
4. **保密**：应用层 AES-256-GCM/HKDF/HMAC 005 方案冻结，不再重新择型；32 字节随机 master key 将来由 staging secret/env 注入；本轮不创建、获取、复制任何真实密钥。测试只使用固定 synthetic test key；错误/缺配置、错身份、005 缺字段、D1 不可达统一 fail closed，不将 sealed proposal 写入明文模式。
5. **默认安全**：没有多重明确 staging-only flag、身份、合格 sealed D1 client、真实密钥、005 preflight，则新功能不可达；P1 播放器仍可工作。任何启用路径都不得让生产 /mcp 出现新工具。不要把 dry-run 本地环境配置误当作上线资格。

## 4. 一轮连续施工任务（无需分步回执）

### A. 完成真实运行时接线

- 审核 `createV1P2StagingSealedClosureCandidate` 的依赖和全程 fail-closed 条件。现在它尚未由 `server.js` 的正常 startup 调用：实现**最窄的 staging-only 运行时 composition**，共享一份 validated closure 到 protected MCP 和 signed player route。必须有明确 server-start lifecycle gate，避免“只在单测里注入过，正式启动仍永远是 null”。
- 可选轻量 bootstrap/helper；保留既有 `createShenShuHttpServer({env,nonbillableClosure})` 测试注入兼容性，不能重写 P1 login/callback/audio、公共 MOCK 或原来稳定的 Render entrypoint。
- 启动时缺配置/失败不得误宣称功能已启用或 silently 退回明文 D1/内存 Map；只输出非秘密布尔/错误码，不泄露 master key、authorization header、音频文本、D1 API token。所有 provider 路径仍完全不可达。
- 如果配置需要 `createStagingIdentityVerifier` + JWKS cache，必须保证与现有 protected MCP 每请求验证的 issuer/audience/scope 完全一致，并对静态 test JWKS 的生产使用 fail closed。若因为无法安全共享权威信任根而需要改变冻结 OAuth 合同，应 STOP 交总控，不要自行“宽松认证”。

### B. 全部离线验收

- Node24 local SQLite 加 001/002/004/005；真实 HTTP 服务生命周期（包括**正常代码启动入口**、非仅专门手动 injection），签名 JWT to MCP prepare/status，再使用匹配 signed player cookie 读取相同原文和 expiry；检查 DB 的 `text` 固定标记、`sealed_text` 真密文、`text_digest` HMAC、无 grant/reservation/provider。
- 过期、Unicode/恰好 800 UTF-8 bytes、重启后同一持久表读取、不同 owner、错误/缺少/过期 JWT、bad issuer/audience/scope、错 session、篡改密文/AAD/tag/metadata/密钥、缺 005、缺 D1 API token、缺 master key、错误 staging identity，以及启动被中断都 fail closed，不默认退回不加密旧路径。
- GET/POST `/player/confirm` 404，公开 /mcp 无 paid/proposal 工具；HTTP 暴露界面不得有真实 Confirm/Pay button。iPhone/桌面原 P1 明确点击播放测试回归；不重复进行已证实无法播放的 ChatGPT 嵌入式 Web Audio 探针。
- Node24 `node --test` 全量 **0 fail / 0 skip**，`node test/smoke-server.mjs`，适用的语法/lint、`git diff --check` PASS。普通失败必须修复并再测，不要把易修复 bug 升级为总控申请。

### C. 写一个可实际执行的、短的 staging 上线资格清单（**只文档，不执行**）

必须先明确四个必需审批/事实，不允许凭旧回执猜：
1. 对唯一专用 D1 `234913cd-...` 的 005 仅一次 `ALTER TABLE ... ADD COLUMN sealed_text TEXT`，执行前后指定对象/字段的只读 preflight/postflight，若已存在/状态不明/超时**STOP 不重试**；不触碰旧 DB，不运行 rollback。原 004 测试行必须保留证据，封存模式拒绝对旧明文行解封。
2. 32 字节 staging master key 的**生成、托管、备份/恢复责任**：经专门用户授权后才通过安全渠道创建并注入 Render secret，禁止在聊天/回执/日志/仓库出现 key；区分真实 staging P1 现有 session secret 与新封存 key，不覆盖旧登录凭据。key 丢失后历史 sealed 文本不可解密；不能热重建 key 来假装恢复。
3. 从 **经审查的 PR #146 exact HEAD** 构建 staging，不能把旧 P1 branch 当作新版本；现有 Render staging autoDeploy=no，先计划如何固定 revision、可核查 deploy commit 和限定手动开关，不自动改 production、live worker、Auth0 callback 或登录环境。
4. 只有得到单独明确云端授权后，才允许在 staging 用**合成文案**验证 Auth0 身份连续性、非计费 prepare/status、player pending 和数据库无明文；需要硬上限、故障停止、可执行关闭开关/退出程序。确认无任何账单/模型调用，再另开 04 付费授权门禁（固定 model/voice ID、一次调用、上限和 WAV 私有交付）。

**发布资格 NOT EQUAL 发布许可**。本轮没有 staging 修改权，不要写成已上线。

## 5. 施工写入终点、STOP 与回执

仅允许修改此仓库为完成 A/B/C 必要的最小 `server.js` / startup helper / protected identity glue / nonbillable closure injection / test / bounded deployment checklist；不修改 004/005 SQL、paid trigger、真实 session cookie 规范、OAuth audience、V1 DONE LINE 或计费 pipeline。不为每个局部修复创建新 PR；**只推送现有 Draft #146**，正常 CI 跑到 PASS 后收口。不新建密钥、D1 表、云资源、音频存储、Worker route，也不更新 Render config/deploy，不手动 Actions dispatch，不 merge。

只在需要真实权限/凭据/云端流量/付费、冻结合同改变、不可逆迁移或信息无增量的循环失败时停下来给沈述做决策。日志/测试报告中不包含用户文本、bearer、token、主密钥。所有真实命令必须留待独立审批；不能把它们塞进自动脚本悄悄执行。

**DONE LINE:** 确切正常 staging 启动代码能在本地安全 boot 并完成 MCP→sealed D1→owner-only player 的受保护非计费 HTTP 闭环 + negative cases + P1 MOCK/音频回归 + GitHub CI 0 skip + 一页具体 staging 资格单。达成就 COMPLETE，不继续跑无关研究；不以离线 PASS 宣布线上 PASS。

最终给糯糯**最多 8 行**：
- `COMPLETE/BLOCKED/TOTAL CONTROL DECISION REQUIRED`；
- 真实启动路径是否已接好/是否仍未部署；
- Node24 CI PASS/FAIL/SKIP、run ID；
- 代码 HEAD + PR #146，是否碰云端（必须 NO）；
- 真正待人工批准的单组上线事务（005、密钥、固定版本 staging 部署、限量合成文本验证），以及保持 paid P2 OFF。
**结束。**
