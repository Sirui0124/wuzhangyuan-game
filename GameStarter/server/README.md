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

此渠道实测Messages端点没有遵守单独的system指令，且在请求关闭思考后仍返回thinking块。因此配置2额外显式保存同源 `systemBaseUrl:https://api.openai-next.com/v1/chat/completions`；只有带独立system规则的采购/定价请求走此兼容接口，模型仍为同一个 `deepseek-v4-flash`。普通表达、判定等完整提示词请求仍走Messages。兼容接口已实测遵守系统指令，且无reasoning内容；不会把定价规则降为玩家数据。Messages健康状态标为 `disabled-requested`，不宣称渠道真正关闭了思考。

本轮验证：40项后端测试及类型/架构检查通过，覆盖到期即恢复、重启持久化、设置保存保留主配置、协议和系统角色、截断拒绝与思考过滤。实际调用记录（不含密钥）在 `outputs/model-config2-20261025/`。

验证命令：`node --test server/server.test.mjs`。测试使用隔离的临时配置和模拟模型服务，不读取或覆盖真实密钥。

## 自然语言采购

前端每条新消息先调用 `POST /api/game/phone/guard`，提交 `{requestId,query}`；普通消息得到 `{blocked:false}`，明确干扰系统的消息得到后台固定惩罚收据。请求ID先随当前关卡存档保存，关闭或取消UI不取消已经发出的检查，刷新按相同ID恢复检查以防漏扣或重复扣款。

购物预检通过后，`POST /api/game/shop` 接收 `{query,budget,guardRequestId,history?}`；guardRequestId必须对应完全相同原话的正常收据，否则409。query最多600字，支持普通换行与制表符；budget为整数分的虚拟余额。复用已配置的模型理解商品名、目的或拟说对白，生成1至3项实体商品建议。第一步仅识别中性规格、数量、配件和用途，不生成或采信价格；规划输出即使夹带 `estimatedYuan`、价格或报价链接，也不会成为价源。全过程不创建现实订单、不扣游戏资金。

点击购买时，前端先调用 `POST /api/game/shop/confirm`，只提交 `{offerId}`；后台返回已保存完整快照，忽略客户端附带金额或商品字段。快照不存在返回409并提示重新询价；前端核对ID、名称、价格与规格后才使用后台快照进行本关结算。

返回 `{message, products}`。每次推荐生成新的 `shop-UUID` 报价ID；每项含名称规格、整数分价格、能力、限制、推荐原因、报价类型、来源原文、检索状态及日期。新增 `specification` 为规范规格对象，`priceKey` 为规格SHA256，`pricingVersion` 为1。后台同时持久化完整报价快照，购买路由可用 `defaultPriceBook.getOffer(id)` 取得权威记录，不接受浏览器传来的价格。旧三项仅保留旧存档兼容，动态商品没有类别白名单；剧情路由仍限制在已经实现的后续类型。请求可附 `history`（最多8条user/assistant文本，各1200字符）以理解追问，不把聊天当作已购事实。

### 独立定价与固定报价

`shop-pricing.mjs` 接收严格校验的 `specification`：规范品名、品牌、型号、客观规格、数量、单位和套装配件；拒绝价格、网址与指令字段。检索关键词由后台根据规格构造，不使用玩家或首轮模型提供的查询字符串/价格链接。独立报价模型仅接收规格和检索摘要；独立常识估价模型仅接收规格。二者都通过真正的 `system` / `user` 角色隔离规则和不可信数据，不接收玩家query、budget、history或why。

公开报价必须匹配实际摘要原文、人民币金额和模型核验的型号数量；未查到或未核实则另调常识定价模型，明确为 `estimate`。第一个有效结果按规范规格键写入工作区 `.cache/phone-economy/prices.json`，后续相同规范规格直接复用，不随预算、对话或模型再次回答改价。不同型号、数量、颜色和配件不会共用同一键；名称规范化由识别模型完成，不能保证所有任意同义名称都能归入同键。

后台配置 `config/shop-pricing.json` 固定定义 `penaltyFen:5000` 和可选 `fixedPrices`。固定项格式为 `{specification,priceFen,note?}`，note最多160字，只对尚未存入价本的新规格生效；其 `priceKind:'configured'`、空来源、`searchState:'not-needed'`，说明明确为后台游戏价而非市场报价。已有持久报价优先，不暗改已发报价。玩家输入不能编辑该配置。

价本按同规格合并并发定价，写入队列和原子替换避免不同商品/报价互相覆盖。取消单个等待者不打断其他有效请求；全部取消、无效估价或落盘失败不会写入不完整报价。价格与报价记录仅保存在后台本地文件，不是远端账户系统。

测试或独立实例可指定 `GAME_SHOP_PRICES_FILE` 与 `GAME_SHOP_PRICING_CONFIG`，或使用 `createPriceBook({path,configPath})`。程序API为 `priceFor(specification,{model,search,signal})`、`saveOffers(products,signal)`、`getOffer(id)` 和 `getConfig()`；`getOffer` 不存在时返回null。模块测试命令：`node --test GameStarter/server/shopping.test.mjs GameStarter/server/shop-pricing.test.mjs`，均使用隔离临时价本，不读取玩家数据。

采购接口限制本机访问，75秒总超时；客户端取消会中止模型与检索。搜索只请求固定搜索服务，不抓取模型或玩家提供的网址；摘要视作不可信数据，报价原文须确实出现在检索结果并含匹配金额。检索来源链接由服务端和前端共同过滤。

根目录运行 `npm run test:api` 验证隔离服务端测试；`node tools/ai/shopping-live-browser.mjs` 会实际调用已配置模型和网络搜索，以独立浏览器存档验证完整流程（消耗正常模型调用额度）。后端代码更新后须重启本地游戏服务。
