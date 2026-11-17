# 人物形象与跨章节身份

2026-10-27 用户要求：不同关卡的不同人物使用不同形象，同一人物跨场景、跨关卡保持一致；普通士兵也须有区分度。

- 人物身份由稳定角色 ID 决定。相同姓名、称呼或兵种不足以证明是同一个人。不同章节的普通人使用章节专属 ID。
- 同一人物的不同表情归到 `characterExpressions` 同一身份；换场景不换脸。马谡、王平、魏延、姜维、诸葛亮继续使用各自原身份。
- 不同普通人至少在脸型、年龄、发式或头饰上可分辨，再用体型、服装、职务用具加强区别；只换衣服或调色不算新人物。
- 以 `GameStarter/web-demo/visual-assets.json` 为唯一绑定入口。对话与人物志引用同一 ID；`runtime-map.json` 从主清单导出。
- 未确认身份的群体喊话、伤兵声音，不借用已知人物或将军的脸。街亭领队的带队、领队、押队称呼沿用同一名队率的立绘；传令军士与王平的传令军士沿用同一名往返传令兵。
- 新增或替换后，人工比较脸型与轮廓；`npm run check:assets` 按实际文件 SHA-256 拒绝不同人物共用同一份图片，允许同一身份的表情别名。机器检查只能发现误绑，不能代替形象审阅。

## 本轮接入

| 人物 | 识别特征 | 最终资产 |
| --- | --- | --- |
| 第三章 · 探马 | 中年瘦脸、旧皮盔、短须、马缰 | [立绘](../../source-art/visuals/runtime/characters/jieting-scout/neutral-v1.png) |
| 第三章 · 军吏 | 年长、灰须、素服、竹简与笔 | [立绘](../../source-art/visuals/runtime/characters/jieting-clerk/neutral-v1.png) |
| 第三章 · 取水军士 | 宽圆脸、粗布短褐、木水桶 | [立绘](../../source-art/visuals/runtime/characters/jieting-water/neutral-v1.png) |
| 第三章 · 搬营军士 | 宽肩方脸、卷袖、帐杆与绳索 | [立绘](../../source-art/visuals/runtime/characters/jieting-mover/neutral-v1.png) |
| 第三章 · 传令军士 | 年轻圆脸、短髭、蓝衣、木令牌 | [立绘](../../source-art/visuals/runtime/characters/jieting-messenger/neutral-v1.png) |
| 第三章 · 领队军士 | 铁胄、灰黑络腮胡、卷起的令旗 | [立绘](../../source-art/visuals/runtime/characters/jieting-leader/neutral-v1.png) |
| 第一章 · 姜维亲兵 | 无须、皮胄、暗红内袍、长戟 | [立绘](../../source-art/visuals/runtime/characters/jiangwei-guard/neutral-v1.png) |

[浏览器形象对照](http://127.0.0.1:8812/art-review/character-distinction-20261027.html) · [生成提示词](../../source-art/visuals/production/character-distinction-20261027/prompts.md) · [生成记录](../../source-art/visuals/production/character-distinction-20261027/generation-record.json)

本轮使用内置 image_gen 生成透明 PNG，原素材保留；只调整人物形象、绑定和实际出场后的资料收录。2026-10-27 接入试玩，仍待用户审核。

