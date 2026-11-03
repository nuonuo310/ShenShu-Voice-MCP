# Voice V1 — Render → Kodo 唯一一次非计费合成验证施工包

**状态：REAL CLOUD PROBE 执行一次后 UNKNOWN；唯一 D1 锁已消耗，已安全关闭。下方原施工步骤仅保留历史，不得重跑。** 此包不授权新的 MiniMax 或语音额度操作。项目总控沈述；糯糯已批准一次七牛 1 PUT / 1 GET 的受限验证（2026-11-01）；**独立 D1 表结构创建需要额外确认**，不得将已有同意扩大为对任何 D1 Schema 的写入许可。

## 2026-11-02 实际执行后的最终裁决（覆盖下方旧施工步骤）

**REAL CLOUD: UNKNOWN / CLOSED / ONE-SHOT LOCK SPENT；严禁按下文旧步骤再次开启或重跑。**

糯糯已在 Cloudflare 执行上述新增独立锁表 DDL，并在获批 Render staging 精确 SHA `3f27e0bd8e1860579ea8c98b779b3b9c23419db5` 启用一次性验证。本人确认按钮执行一次后返回 `{"code":"probe_outcome_unknown"}`。按当时唯一代码路径，此状态仅能在独立 D1 `INSERT ... RETURNING` 返回成功后出现；因此**固定锁 `shenshu_kodo_render_probe_once_20261101_v1` 必须按已消耗永久保留**。不能从缺少阶段日志推断真实七牛 PUT / GET 是否到达或成功，也不能重置锁再试。

用户随后关闭验证入口。Render 独立回读确认最新安全部署 `dep-dbk8hkflk1mc73b655mg`（2026-11-02T12:58:26Z）仍运行 `3f27e0bd8e1860579ea8c98b779b3b9c23419db5`，其启动日志证明 `kodo_probe_mounted:false`、`paid_confirm_mounted:false`、`paid_voice_enabled:false`、`final_wiring_flag_off`。

旧的下文“STOP 1–4”是**历史上已走过的单次操作流程，不再构成未来执行授权**。不删除 / 重建 / 转储已消耗锁，不对七牛执行新的 PUT / GET / HEAD / DELETE / LIST，不调用 MiniMax，不动旧付费授权。

2026-11-02 离线后续修补：
- `71a6b061a2adc4d47cbb07b29c3de47682ede6e2`：单次探针真实 AWS SDK v3 请求组装、SigV4、响应解码的**无联网**完整回归测试，CI `41449932544` SUCCESS。
- `c2b1585aaa1cb5fcdb3e5e06b71a0ef9f85162b7`：修复先消耗 D1 锁、后才创建和校验 Kodo 客户端的顺序错误。先执行无网络的 SDK / bucket / 合成固定音频配置预检；预检失败返回 `probe_local_preflight_failed` 且**不占锁、不调用七牛**；一旦占锁，网络失败仍为不可重试 UNKNOWN。新增非法 bucket 和 SDK 构造失败的离线反例，CI `41451366145` SUCCESS。
- 两项修补仍只在 Draft PR #146，**没有部署，不是旧 UNKNOWN 根因证明**。前端指纹浏览器无须更换；未知的是真实 Render 云端侧失败。
- Voice V1 仍维持 **2/9**。只允许检查此前真实服务已有的非秘密请求回执 / 七牛官方工单；需另行审批对外披露的信息。绝不把已消耗的单次验证当作可再授权循环。

---

## 目标和完成线

只证明真实 Render Free 进程的环境配置和网络出口能使用既有七牛新加坡私有桶，以隔离的 synthetic 440 Hz WAV 完成一次签名、加密 PUT → 本人服务端 GET 解密、逐字节比对。该结果不能证明 MiniMax 真正输出正常，也不能关闭 V1 所有 9 门禁。

**NON-GOALS**：MiniMax 调用、真实 04 语音、D1 paid admission/claims/grants、复用旧 UNKNOWN、文件回放、公共音频 URL、使用生产 Call、修改账户密钥/桶权限、自动启动检测、自动复试或删除 Kodo 对象。

## Opening Gate

- Repository: `nuonuo310/ShenShu-Voice-MCP`，只使用现有 Draft PR #146 分支 `codex/voice-v1-p2-d1-confirm-qualification-20261028`。
- 权威的最终可部署 SHA 只能从完成本包后 **最新的 PR HEAD 且 CI SUCCESS** 获取；不得因文件内记录的过时 SHA 而部署旧版本。
- Render 服务 `srv-dbcgcsom7kps739tfpo0`，本轮前 LIVE `dep-dbjn35nb9u1s73eh5sc0` / `72378d0a19015a83b79b8622600550fa236a0a8f`、autoDeploy=no；已有最新启动 `paid_confirm_mounted:false`，四个付费开关为字符串 `0`，保持不变。
- 现有 Render 配置分支**仍为旧 P1 分支**；仅可手动选择 **Deploy a specific commit**。禁止使用普通 Render `trigger_deploy` / Deploy latest。
- 独立 Cloudflare D1 仅允许已验收 UUID `234913cd-8901-4607-8147-31c4a4317111`；禁止触碰旧的 `c39a6895-7028-4f59-a100-1455b92c96c1`。
- Kodo：固定新加坡私有桶、既有主密钥和仅 GET/PUT 子凭据。不要更换既有任何密钥；Kodo 一天前缀生命周期仍管物理清理。

## 已提交的默认关闭实现

- `db/d1/006_voice_kodo_render_single_probe_lock.sql`：独立于 paid_voice_* 的 D1 一次性持久锁表 **DDL 仅文件，不自动运行、不删除**。
- `src/v1-kodo-render-one-shot-probe.js`：`/player/internal/kodo-probe-once`，已有 Auth0 登录会话、精确同源 Origin、独立高熵批准码、恰好四个 paid OFF、独立功能开关、Render 平台 SHA 与明确核准 SHA 严格相等、15 分钟窗口后才能操作。没有任何 GET 自动副作用，页面没有自动 JavaScript。
- D1 先原子 `INSERT ... ON CONFLICT DO NOTHING RETURNING` 争夺全局唯一 ID `shenshu_kodo_render_probe_once_20261101_v1`。失败、超时、不确定均永久失去本次验证机会，不退款不重试。**即使进程崩溃或再次部署，锁也不能被重置。**
- 独立固定 synthetic principal（不可与用户实时音频冲突），0.7 秒 16kHz 单声道 PCM16，原始字节 22,444，整份加密对象硬上限 32,768 字节。
- AWS SDK `maxAttempts:1`，限定最多 **1 PutObjectCommand / 1 GetObjectCommand**，两者各 10 秒超时，GET Response Body 流式累计上限 32,768 字节，自动重试为零；0 DELETE / HEAD / LIST / PRESIGN。结果只返回固定状态码，绝不返回声波、对象键、私有身份、签名/凭据。
- `server.js` 仅在所有门禁满足时挂载，现有生产和付费路径不变；启动日志仅添加 `kodo_probe_mounted` 布尔值。
- `test/v1-kodo-render-one-shot-probe.test.js` 用真实本地 HTTP + fake D1 原子锁 + fake Kodo，覆盖缺凭据/配置、未认证、Origin、错误批准码、双击/并发、PUT/GET 失败永久消耗、时间窗和默认关闭。此组测试不调用任何真实云服务。

## 云端前必须完成的单独授权及手动动作

**STOP 1：D1 Schema**。用户另行同意向以上指定 D1 增加一个空的独立锁表后，才可在 Cloudflare D1 Console 对该数据库运行完整且仅一次 DDL（见仓库 `db/d1/006_voice_kodo_render_single_probe_lock.sql`）。不运行历史 004/005，不 UPDATE/DELETE/DROP，不能清理或重建已消耗锁。建表成功仅是前提，不代表 Kodo 验收成功。

**STOP 2：Render 环境变量和单次部署**。仅在 D1 表真实存在且单独确认云端请求成本后，由拥有账户权限的人在 Render Environment 保存以下配置，初始 `SHENSHU_KODO_RENDER_PROBE_ENABLED=0`：

- `SHENSHU_KODO_RENDER_PROBE_APPROVED_SHA`：本包最终审核 CI 通过的完整 40 位提交；
- `SHENSHU_KODO_RENDER_PROBE_APPROVAL_TOKEN`：用户本人随机生成、长度 32–128 的 URL 安全高熵字符串（仅保存在 Render 和用户本地，严禁在聊天/GitHub/截图公布）；
- `SHENSHU_KODO_RENDER_PROBE_START_AT` 和 `SHENSHU_KODO_RENDER_PROBE_END_AT`：完整 UTC ISO 8601 时间字符串，二者间距 <=15 分钟，用户触发时必须位于其内；
- `SHENSHU_KODO_RENDER_PROBE_ENABLED=1`：只在获批的验证窗口启用，**四个 `SHENSHU_STAGING_*_ENABLED` 付费开关仍全是 `0`**。

使用 **Save only**，然后 **Manual Deploy → Deploy a specific commit** 精确部署上述 SHA。日志应证明新运行 SHA、`paid_confirm_mounted:false`、`paid_voice_enabled:false`、`kodo_probe_mounted:true`，且仍 `sealed_ready`。任何偏差 STOP，不进行 POST。

**STOP 3：本人唯一一次点击**。使用同一浏览器完成现有 Auth0 登录，然后只打开 `https://shenshu-voice-mcp-staging.onrender.com/player/internal/kodo-probe-once`。页面必须显示 1 PUT/1 GET 与潜在费用，输入上述本人持有的批准码，一次提交。HTTP 200 `private_roundtrip_verified` 表示 Render 真正完成受控云端加密 PUT+GET。409 `probe_already_spent_or_unavailable`、503 `probe_outcome_unknown` / `probe_lock_unavailable`、超时等均 **STOP / 无第二次**。不要把错误视为可以刷新提交的提示。

**STOP 4：立即收口**。无论结果如何，把 `SHENSHU_KODO_RENDER_PROBE_ENABLED=0` Save only，然后用相同精确 SHA 再做一次手动受控部署；核验运行进程启动为 `kodo_probe_mounted:false`、全部 paid OFF。保留唯一 D1 锁记录，不手动 DELETE Kodo 对象；依赖既有一日生命周期规则。任何 UNKNOWN 不额外触发一次 GET 或 PUT。

## 费用与不可突破边界

该操作 **不调用 MiniMax**，语音合成费用和真实语音额度为零。七牛存储、PUT、GET、出网，以及少量 Cloudflare D1 读写可能按量计费；**1 PUT/1 GET/32KiB 是操作量上限，不能推出账单金额硬封顶**。仅从 Render 发起，拒绝另外新建付费机器。不能声称 Free 计划有 Shell 或能跑 One-off Job。也不能将此次本地 CI 当作已验证真实 Render 凭据。

## 验收与终态

- 离线阶段：代码、默认关闭、安全测试和最终 Node24 CI 完整通过，才可标记 **COMPLETE OFFLINE**。
- 云端阶段：仅本地机外的真实 Render 日志 + D1 唯一锁 + 经用户授权的一次签名 Kodo PUT/GET 回执才能标记 **COMPLETE REAL CLOUD**；这份文件本身不是云端证据。
- 如 D1 Schema 未获授权、云端必要门禁无法确认、CI 失败、认证异常、锁已消耗或费用权限超出范围，终态为 **BLOCKED** 而非自动重试。
- V1 保守计数保持 **2/9**，直到有真实 04 生成和桌面、iPhone 可听见的证据。不因此引入其他功能。
