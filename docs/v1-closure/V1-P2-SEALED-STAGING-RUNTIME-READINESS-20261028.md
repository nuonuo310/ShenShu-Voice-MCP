# 沈述 Voice V1｜密封非计费提案 Staging 启动接线与发布资格｜回执 v1

日期：2026-10-28
权威：`docs/construction-envelopes/2026-10-28-voice-v1-sealed-staging-runtime-readiness-v1.md`
范围：仅离线代码、测试、同一 Draft PR #146；未部署、未触碰云端/密钥/付费服务。

## 1. 本轮完成（COMPLETE，离线）

- 新增 `src/v1-p2-staging-runtime.js`，由 `server.js` 的正常启动入口
  `createShenShuRuntimeServer()` 调用；不再只依赖单测手工注入 closure。
- 一次启动只构造一个 verified-identity resolver 与一个 JWKS cache，同时交给
  受保护 MCP 路由和密封提案 broker；静态 test JWKS 仅在显式
  `SHENSHU_AUTH_STATIC_JWKS_TEST_ONLY=1` 时可用，`NODE_ENV=production` 拒绝。
- `createV1P2StagingSealedClosureCandidate` 增加非秘密预检：staging identity、
  四个显式开关、32 字节 master key、32–256 字节 session secret、合法 Auth0
  client ID、D1 client 与 005 schema 缺一不可；任何失败都返回 null。
- 启动失败只输出非秘密布尔/错误码；不会回退明文 D1、内存 Map、静态身份或
  付费 provider。公共 `/mcp`、P1 `/player` 固定 WAV、`/player/confirm` 404 保持。
- 新增 Node24 HTTP 集成测试：正常启动 → 签名 JWT MCP prepare/status →
  同一 owner 的 `/player/pending` 原文/expiry → 密文与 keyed HMAC 落库；
  并覆盖重启、错误身份/JWT/session、篡改 tag/AAD/metadata/digest、错误密钥。

验证（Node 24.19.0）：全量 `node --test`：358 tests, 358 pass, 0 fail,
0 skipped, 0 todo；
`node test/smoke-server.mjs`、语法检查与 `git diff --check` PASS。
本轮 GitHub CI run 记录在 PR #146 最新一次正常 `pull_request` 运行。

## 2. Staging 上线资格清单（只文档，未执行）

以下四项必须由沈述/用户分别明确授权；发布资格不等于发布许可。

### Gate A｜D1 005 单次迁移

- 唯一资格库：`234913cd-8901-4607-8147-31c4a4317111`。
- 仅执行一次 `ALTER TABLE paid_voice_confirmation_operations
  ADD COLUMN sealed_text TEXT`；执行前后对同一对象/字段做只读 preflight/postflight。
- 已存在、状态不明、超时：STOP，不重试，不自动补列。
- 禁止旧库 `c39a6895-7028-4f59-a100-1455b92c96c1`；不运行 rollback。
- 保留 004 既有测试行证据；封存模式必须拒绝把旧明文行当作可解封记录。

### Gate B｜Staging master key

- 另行生成 32 字节随机 key；生成、托管、备份/恢复责任先由用户书面确认。
- 只通过安全 Render secret 渠道注入；禁止出现在聊天、回执、日志、仓库、工单。
- 与既有 P1 `SHENSHU_PLAYER_SESSION_SECRET` 区分，不覆盖旧登录凭据。
- key 丢失后历史 sealed 文本不可解密；不得热重建 key 冒充恢复。

### Gate C｜固定版本 staging 构建

- 从经审查的 PR #146 exact HEAD 构建 staging，不能把旧 P1 branch 当新版本。
- 现有 staging 服务：`srv-dbcgcsom7kps739tfpo0`（autoDeploy=no）。
- 固定 revision、核对 deploy commit、限定手动开关；不自动改 production
  `srv-dbb2jmu7bikc73bgq2e0`、live worker、Auth0 callback 或登录环境。

### Gate D｜限量合成文案资格试验

- 仅在单独云端授权后，在 staging 用合成文案验证 Auth0 身份连续性、非计费
  prepare/status、player pending，以及数据库无明文。
- 必须有硬上限、故障停止、可执行关闭开关/退出程序（A5）；确认无账单与模型调用。
- paid P2 保持 OFF；04 付费授权另开固定 model/voice ID、一次调用、上限与 WAV
  私有交付门禁。

## 3. 边界与状态

- 云端/SQL/Render/Auth0/R2/Qiniu：NO；真实密钥创建或复制：NO。
- Actions dispatch、merge、新 PR、base 变更：NO；只使用现有 Draft PR #146。
- 未修改 004/005 SQL、paid trigger、session cookie 合同、OAuth audience、
  V1 DONE LINE 或计费 pipeline。
- Deployment: NO。当前 Voice V1 仍为 2/9，本轮 COMPLETE 不代表 V1 DONE。
