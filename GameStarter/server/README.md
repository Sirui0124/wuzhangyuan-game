# 本机游戏 API 代理

服务器可在没有密钥时启动，玩家先通过游戏设置填写服务网址、模型和 API 密钥。已有配置会预填；密钥只保存在本机，设置界面应使用密码框。

配置文件优先使用进程环境变量 `GAME_SETTINGS_FILE` 指定的路径，未指定时使用本模块同目录的 `.env`。文件中的 `DEEPSEEK_API_KEY`、`DEEPSEEK_BASE_URL`、`DEEPSEEK_MODEL` 优先于启动环境中的同名变量；没有保存值时默认网址为 `https://api.deepseek.com`，模型为 `deepseek-flash`。无密钥时 `/health` 仍可用，生成接口返回 503，提示先填写密钥。

- `GET /api/game/settings` 返回 `{baseUrl, model, apiKey}`，用于本机设置页预填。响应禁止缓存；不要把此响应写入日志或报告。
- `POST /api/game/settings` 接收同结构的 JSON，校验 HTTP/HTTPS 网址及非空模型、密钥。成功返回 `{ok:true}`，原子保存后立即更新后续调用。保存文件权限为 600，保留其他环境变量。
- 设置接口只接受本机连接、本机 Host，以及现有 localhost/127.0.0.1 预览来源。服务器继续绑定 127.0.0.1。发布启动器必须将这两个接口转发到本机后端，并指定用户可写的配置路径。
- 网址支持服务根地址、末尾 `/v1` 或完整 `/chat/completions` 地址，不会重复附加路径。请求固定使用 Chat Completions JSON，并发送 `thinking: {type:'disabled'}`。

验证命令：`node --test server/server.test.mjs`。测试使用隔离的临时配置和模拟模型服务，不读取或覆盖真实密钥。
