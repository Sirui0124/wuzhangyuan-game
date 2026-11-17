# 图片式交谈构图

2026-10-27 用户确认：默认按一对一交谈处理，人物向画面中间移动，人脸在横向约 65%，默认朝向玩家。特殊场景再单独指定中央或保留原构图。

## 维护入口

- `GameStarter/web-demo/src/game/portrait-stage.ts` 统一输出立绘舞台，默认 `conversation`；`center` 用于明确要求居中的镜头，`scene` 保留场景自己的定位。
- `GameStarter/web-demo/public/portrait-staging.css` 维护公共位置与响应式规则。所有章节的独立交谈立绘使用该组件，不单独复制 right/left 数值。人物图片保持原比例，不镜像武器与服装来假装改变目光。
- 65% 指脸部所在的近似横向位置。舞台中心固定在 65%，素材脸部应接近图片中央。窄屏继续使用同一横向位置，人物在对白上方留出空间。
- 第三章帐前的王平、马谡双人构图保留 `jieting-pair`。第二章 `image`、`cameraHold` 和回应定格属于完整镜头，保留原机位，不把背景连同人物一起横移。
- 人物志与成就卡片是资料页面，不套用场景中的 65% 站位。无人物的线索与输入页面保持原布局。

## 朝向素材

使用内置 imagegen 编辑斥候、传报军士、姜维亲兵，以及第三章探马、军吏、取水军士、搬营军士、传令军士、带队军士，共九张。各人保留身份、服装、道具和姿势，调整头部与双眼朝向玩家。已有朝向玩家的立绘保留；剧情明确的低头等表情保留。

新素材为 `source-art/visuals/runtime/characters/conversation-20261027/` 下的独立 PNG；旧版仍保留。逐张原图、生成路径、正式素材路径见 `outputs/portrait-staging-20261027/assets.json`。发布引用在 `GameStarter/web-demo/visual-assets.json`。

八张首批素材共用的实际提示词：

> Edit this exact character sprite for a cinematic Three Kingdoms first-person dialogue game. Preserve EXACT same individual identity, age, unique facial features, hairstyle/hat, costume, props, hand positions, pose and realistic worn material details. Only turn head gently toward camera and redirect BOTH eyes to meet the viewer/player directly, natural conversational eye contact, head near frontal, body may remain subtly three-quarter. Preserve original emotion. No looking off-screen. Face centered horizontally at 50% of image canvas, preserve original head height and body scale as closely as possible, same head-to-thigh crop. Keep weapon/bucket/scroll/rope props intact where present. True transparent alpha background, no background scenery, no brown glow or shadow matte, no text, no new objects. This image is the edit target and identity reference.

传报军士实际提示词：

> Edit this exact Three Kingdoms messenger character. Preserve exact same man identity, age, face, hair, cloth head covering, worn blue robe, letter held in both hands, pose and original crop. Only redirect both eyes and gently turn head to look directly at viewer/player in natural conversation. Face centered horizontally on canvas, same body size and head height. True transparent alpha background, no backdrop, halo, text, extra objects or changed props. Photorealistic original game art style.

## 验证

`node tools/migration/portrait-staging-smoke.mjs` 使用真实章节视图函数，验证第一章立绘、第三章八位 NPC、第二章完整定格保留，以及 1440×900、844×390、390×844 的定位和水平溢出；另检查双人场景与中央配置。它是视图检查，不代表所有剧情均已试玩。截图与结果保存在 `outputs/portrait-staging-20261027/`。
