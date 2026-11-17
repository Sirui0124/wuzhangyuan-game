# 本机游戏 API 代理

服务器可在没有密钥时启动，玩家先通过游戏设置填写服务网址、模型和 API 密钥。已有配置会预填；密钥只保存在本机，设置界面应使用密码框。

当前完整游戏在「设置 → 自由表达服务」提供「保存配置」和「保存并测试连接」。测试保存当前填写的地址、模型与密钥后，通过游戏的同一生成接口发送简短请求；成功显示模型和耗时，失败保留已保存配置并显示错误。测试期间禁用重复提交及配置编辑。

`npm.cmd run test:settings` 在独立浏览器上下文中模拟配置与模型接口，验证配置页，不读取或修改真实密钥。可设置 `SMOKE_BROWSER_CHANNEL=chrome` 或 `msedge` 使用已安装浏览器。

配置文件优先使用进程环境变量 `GAME_SETTINGS_FILE` 指定的路径，未指定时使用本模块同目录的 `.env`。文件中的 `DEEPSEEK_API_KEY`、`DEEPSEEK_BASE_URL`、`DEEPSEEK_MODEL` 优先于启动环境中的同名变量；没有保存值时默认网址为 `https://api.deepseek.com`，模型为 `deepseek-flash`。无密钥时 `/health` 仍可用，生成接口返回 503，提示先填写密钥。

- `GET /api/game/settings` 返回 `{baseUrl, model, apiKey}`，用于本机设置页预填。响应禁止缓存；不要把此响应写入日志或报告。
- `POST /api/game/settings` 接收同结构的 JSON，校验 HTTP/HTTPS 网址及非空模型、密钥。成功返回 `{ok:true}`，原子保存后立即更新后续调用。保存文件权限为 600，保留其他环境变量。
- 设置接口只接受本机连接、本机 Host，以及现有 localhost/127.0.0.1 预览来源。服务器继续绑定 127.0.0.1。发布启动器必须将这两个接口转发到本机后端，并指定用户可写的配置路径。
- 网址支持服务根地址、末尾 `/v1` 或完整 `/chat/completions` 地址；完整 `/v1/messages` 地址使用 Messages 协议，发送 `x-api-key`、`anthropic-version:2023-06-01`、`max_tokens:4096`。两种协议都请求关闭思考，Messages响应只提取最终text块，不向游戏传递thinking块；截断或工具调用不算完整结果。

## 主配置与限时配置2

长期主配置仍在本机 `.env`。可选的 `.env.profiles.json` 保存独立配置档案，含 `version:1`、`activeId`（primary/config2）、带时区的 `activeUntil` 和 `profiles.primary/config2`。该文件含凭据，已由Git忽略，不输出其正文。

每次请求按当前时间选择配置；配置2到期后直接使用主配置，无需重启或定时任务。`GET /health` 返回不含密钥的当前model、profile、profileExpiresAt和protocol。`GET /api/game/settings` 预填当前生效配置；在配置2生效期间保存设置只修改配置2，不覆盖主配置或原始主配置快照。语音设置独立保留。

2026-10-25最新用户要求：游戏使用原 `https://api.deepseek.com` / `deepseek-flash`，不要使用 OpenAI Next。已将本机档案 `activeId` 持久化切为 `primary`，运行服务即时生效，原密钥保持不变。配置2已停用；其原计划是本日临时使用，到2026-10-26 00:00（Asia/Shanghai）恢复主配置，此计划已被本次立即恢复取代。阶段快照保存在本机 `.cache/model-profiles/`，不提交Git。调试脚本应通过本机代理读取当前配置，不从主配置文件推断生效模型。恢复后通过真实游戏表达代理完成首轮接受、第二轮接受及缺项追问三项验证，见 `outputs/deepseek-restored-20261025/verification.json`。


本轮验证：40项后端测试及类型/架构检查通过，覆盖到期即恢复、重启持久化、设置保存保留主配置、协议和系统角色、截断拒绝与思考过滤。实际调用记录（不含密钥）在 `outputs/model-config2-20261025/`。

验证命令：`node --test server/server.test.mjs`。测试使用隔离的临时配置和模拟模型服务，不读取或覆盖真实密钥。

## 已退役的手机接口（2026-11-17）

手机、购物、核价及预检模块已移除。`POST /api/game/shop`、`POST /api/game/shop/confirm`、`POST /api/game/phone/guard` 返回 404；`/health` 的 `shopping` 为 false。旧存档兼容数据不启用这些接口。

根目录运行 `npm run test:api` 验证隔离服务端测试；后端更新后须重启本地游戏服务。
