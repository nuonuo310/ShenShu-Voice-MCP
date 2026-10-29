# Kodo 私有音频：首次真实资格验收边界（2026-10-29）

**状态（2026-10-29）：A1 已由用户亲自完成并以截图核验；用户已授权限定的 A2 单次合成数据资格试验，但尚未执行任何真实 S3 对象请求。真实 AK/SK 只能在用户本人本机的隐蔽交互终端使用；不得交给 ChatGPT、DeepSeek、GitHub、CI 或 Render。** Voice V1 仍按冻结九门禁保守记 2/9，paid P2 OFF。此文件更新的是**同一** PR #146 中既有的资格 Gate，不是新的施工包。上一轮离线 Kodo backend commit `f0142f960a68a554bb1a6e5815577857da79e393`、Node24 389/389 与正常 CI 40762439813 success；真实 Kodo **未调用**。

## 权威现实与费用边界

- 七牛 Kodo 的 Bucket **创建本身不收费**；存储对象和数据访问可能计费。创建时必须明确选 **亚太-新加坡 / STANDARD（标准存储）/ 私有**，严禁「公开」或把 30 天测试域名用于私有音频播放。桶的名称和区域建成后不可修改。
- S3 Region 固定 `ap-southeast-1`；endpoint 固定 `https://s3.ap-southeast-1.qiniucs.com`；SDK SigV4、服务器侧 HTTPS + 私有 bucket；外部浏览器只访问同源、带登录 Cookie 的 `/player/audio`，不接受公开 URL、签名分享 URL、任意其他区域。**实际 S3 bucket 名**应从控制台确认，不能假定控制台显示名称总等于 S3 名称。
- 实名用户的标准存储/月免费额度为 10GB，GET 100 万次、PUT/DELETE 10 万次；**10GB CDN 回源流量免费额度 ≠ Kodo 源站直接出网免费额度**。Kodo S3 通过 Render 直接 GET 属于源站外网流出；七牛官方说该项 **无免费额度**，具体费率随用户类别、区域/计费计划变化。测试绝不声称 0 元、绝不自动购买资源包或给账户充值。
- 七牛财务中心的“可用额度预警”是**可能有一天延迟的告警**，不是停用账单的硬限制。不能对用户承诺「到 1 元就自动停止收费」；本轮只能用**请求次数、每对象字节、有限运行时间**做程序侧上限，人工查看财务，手工关闸。
- Kodo 官方列出 `DELETE Object` 兼容，并未独立明示此服务端对 **`If-Match` 条件 DELETE** 与 AWS 2025 年新增加的语义完全等同。**任何普通带 If-Match 的 DELETE 返回成功并不足以证明条件语义**；必须用旧 ETag 删除新对象的**拒绝**作反证测试，才能决定是否允许自动清理。
- 证据来源：`https://developer.qiniu.com/kodo/8498/the-new-space`、`https://developer.qiniu.com/kodo/4088/s3-access-domainname`、`https://developer.qiniu.com/kodo/4087/compatible-s3-api`、`https://developer.qiniu.com/af/kb/12990/real-spending-detail-describe`、`https://developer.qiniu.com/af/kb/12989/Bill-overview`。

## A0｜独立、明确授权前的事实

先由用户确认是否愿意**创建一个可能产生按量费用的新加坡私有 bucket，并允许最多一次小规模 synthetic PUT/GET/条件删除资格测试**。未获明确许可，停在这里。授权需包含：单 bucket、允许的不可强制费用预算、对象/请求/流量上限，以及条件失败时的退出策略。

无需生成或传送任何 AK/SK 以允许“仅建一个空的私有 Bucket”；绝不在聊天中收集凭据。若没有适用的安全临时受限子账号/IAM，**不能用主账号管理 AK/SK 冒充最小权限**；先裁决实际可用的隔离方式。

## A1｜建立最小私有存储空间（仅获授权后）

- 限**一个**新加坡私有 STANDARD bucket，唯一名字由实际控制台确认；确认访问控制=私有，没有 public ACL、公开 CDN 域名或生产 URL。创建本身无对象写入；不建立额外 Bucket。
- 不从现有账户中任选一个桶进行试验；不触碰他人或旧桶。确认如有自带 30 天测试域名也**不用于业务或浏览器音频**。
- 只给试验用账号允许执行必需的 PUT/GET/HEAD/LIST/DELETE，严格限定 bucket 与前缀 `shenshu/voice-v1/private-audio/`；**先实际查明七牛 IAM/Bucket Policy 是否支持该账号/密钥的前缀权限**，不把服务端代码前缀校验等同云端最小权限。
- 真实 AK/SK、随机 32 字节对象加密密钥只以安全渠道注入获批的 staging secret，不经过聊天/Issue/CI/日志；新密钥与已存在的 D1 提案密封 key 分离，明确备份与撤销责任。任何变量更新可能使 Render **立即部署**，必须先批准 exact commit、A5、允许窗口；不得再认为 Save only 或 autoDeploy=no 就保证“没有部署”。

## 2026-10-29 A1 实际验收记录（用户截图，非云端 API 证明）

- 创建唯一新加坡私有空间 `shenshu-voice-v1-sg-20261029`，区域 `ap-southeast-1`，空间概览显示「私有」；文件数 0、自定义 CDN/源站域名未绑定。
- IAM 新建唯一子用户 `shenshu-voice-kodo-sg`，**控制台登录关闭**，确认仅挂载自定义策略 `ShenShuVoiceKodoPrivateAudio`。策略只授权本空间的对象 GET、HEAD、LIST、单文件 PUT 和 DELETE；**实际权限边界是指定 Bucket，不是服务端前缀强制限制**。程序在本次试验中另固定使用 `shenshu/voice-v1/private-audio/`。
- 七牛子用户详情页已有一组「已启用」的 AK/SK，截图仅显示模糊 AK 和星号 SK，**没有在对话、仓库或文档曝光明文，也没有向服务端注入**；无需创建第二组。此条不等于凭据已通过签名认证。
- 七牛生命周期规则 `ShenShuVoiceAudioExpiry` 已实际创建并显示：**仅前缀** `shenshu/voice-v1/private-audio/`，当前版本 1 天后删除。它是物理保留兜底，**不能替代**应用内 60–300 秒的访问 TTL，也不能保证精确 24 小时删完。
- 目前无真实 Kodo PUT/GET/HEAD/LIST/DELETE 执行报告；未部署、未调用 MiniMax、未接入付费确认；Voice V1 仍保守 2/9。
- A2 **用户已同意**最多 10 次对象请求的**一次性**小量 synthetic 试验。使用经过 Node24 本地安全校验的自持脚本/本机 PowerShell，由**用户自己**通过隐藏输入提供子用户 AK/SK；不要让开发代理代输入、在终端命令行参数/聊天/Issue 里放置凭据。脚本带持久一次性防重试锁并将日志限制为非秘密 PASS/STOP。**无云平台硬账单封顶**，若用户无法接受任何潜在计费，应在执行前停下。
- 一次性真实试验的最先重要断言是：对象 B 覆盖 A 后，用 **ETag_A** 条件 DELETE 必须返回拒绝（412）且 B 可完整读回；若返回 2xx 或不确定，立即 STOP，不准进行新对象的清理或替换。若确实不支持该条件删除，进入总控裁决替代设计，**绝不因测试通过离线模拟而宣称 Kodo 条件删除可用**。

## A2｜最小合成资格请求（仅另行明确授权后）

**只测试对象存储兼容性，不接 MiniMax、不允许 /player/confirm。** 使用 synthetic encrypted payload（不是任何真人/04 音频），仅在新建的 private bucket 固定前缀内、**同一个测试对象 key**。

建议硬上限：**2 次 PUT、3 次 GET、3 次 HEAD、2 次条件 DELETE，全部最多 10 个对象请求**（若探针步骤需要超过上限立即停止）；**每次 PUT 的完整密文信封不超过 256 KiB、累计 GET 响应正文不超过 768 KiB、测试窗口 15 分钟、0 自动重试、0 额外 Bucket、0 provider 调用**。与环境探针无关的 LIST/清理/失败后重试一律不做。若响应模糊，STOP，先只读确认，不以增加次数掩盖错误。

固定检验：
1. 使用后端将 synthetic 对象 A PUT 到单一 key；**一次 HEAD** 取得 ETag_A。
2. 将不同 synthetic 对象 B PUT 到**相同 key**；**一次 HEAD** 取得 ETag_B，必须与 ETag_A 不同。
3. 用 `DELETE Object` 带旧 `If-Match: ETag_A` 请求；**必须返回 412 Precondition Failed 或明确等价拒绝**。接着**一次 GET** 确认 B 的完整密文仍可解密、其数据与 B 相符。若 Kodo 忽略 header、返回 2xx、误删 B 或状态不可判定 → **立即 STOP，不运行真正自动清理**，转总控决定替代安全删除策略。
4. 只有负例通过，才允许以 `If-Match: ETag_B` 删除 B 并用**一次 GET** 确认 404。结果只证明该测试对象消失；不能外推完整 bucket 生命周期和计费结算。
5. 审查服务器响应与可见日志无 AK/SK/Principal、原始 WAV、合成音频或公开临时 object URL；分清访问 TTL 与物理删除/计费保留。

**NOTE:** 上述“10 请求”按 S3 对象请求计算；内部 SDK/预检实际发生的请求如果超额也应 STOP。须先能以无秘密方式观测这些计数，不能只写报告口头保证。真实 provider/model 仍为零。

## A5｜关闭、留证、后续决定

- 首先停止测试入口，禁止自动补采与自动重试，确认没有浏览器可访问的公网对象 URL；如果出现 412 不支持/未知应当**保留现场，不发无条件 DELETE 清理一个可能更新过的对象**。
- 最小化保存合成对象哈希/ETag 是否匹配、请求类型与次数、返回 412/204/404、有限流量与时间、桶/区域/私有状态、费用预估和失败停止状态；绝不留真实秘钥、私有音频内容。
- 测试凭据撤销或移出 staging 需要受控部署窗口，因为修改 Render 环境可能触发服务重启；保留已经验证的非计费 MCP/播放器链，不触碰生产。
- 当 Kodo 条件删除/成本/权限三项在真实服务上通过且用户另行批准，才可继续把付费合成路线接到 staging。首次真实 04 克隆音色、固定 MiniMax model/voice、一次调用费用上限、私有 WAV 播放验收依然需要**独立明确授权**。

**没有明确新费用/新 bucket 授权，本 Gate 不能执行。**
