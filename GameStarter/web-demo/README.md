# 五丈原网页游戏

2026-11-17：线索列表、推理画布和手机系统已移除，改为剧情与选择；旧存档兼容及新展示边界见[本轮架构记录](../../docs/architecture/ITERATION-20261117.md)。

从工作区根目录运行 `npm ci`、`npm run open`，或双击 `启动游戏.cmd`。固定入口为 http://127.0.0.1:8812/ ，本地服务状态页为 `/local/`。`npm start` 在前台运行同一服务；AI 代理监听 8787。安装与迁移见[根 README](../../README.md)。

物品获取直达试玩（每次打开或刷新回到获取前，使用独立存档）：

- [姜维赠头巾](http://127.0.0.1:8812/?playtest=item-headscarf)：从赠礼前最后一句对话开始，继续后获得。
- [营地拾酒杯](http://127.0.0.1:8812/?playtest=item-cup)：点击“野草里似有一点亮光”。
- [军帐拿蜡烛台](http://127.0.0.1:8812/?chapter=grain&playtest=item-candlestick)：点击“看看自己的军帐”，再拿起蜡烛台。

入口回归：`node tools/migration/item-playtest-links-smoke.mjs`（需本地服务运行），验证获取、物品栏、刷新重试和主线存档隔离。

## 代码与关卡

第五章荆州使用六份固定军报，每人最多三次追问，可暂留两名存疑者。玩家逐份判断属实或不属实，判断确定后不能回改；六份全部判断完成后自动复命，按判断正确数进入结局，不再选三人或随机抽签。自由追问由 AI 选择预设口供，未设定的问题或服务失败不扣次数；无 AI 时可填入引导问题再发送。正式入口为 `/?chapter=jingzhou`，`playtest=reports` 使用独立存档。旧版选人动作仅用于恢复历史存档。

2026-10-27第二章更新：本批17段中14段已接入待审版，C02、C05C、C06因玩家台词口型落在NPC身上而暂留旧版；见[审核与替换记录](../../docs/video/CHAPTER-TWO-RECEIVED-UPDATE-20261027.md)。读信、查账和回帐确认仍保留，旧存档编号与分数规则不变。

正式入口现按历史进度顺序开放五丈原、祁山、街亭、夷陵、荆州、落凤坡，直达网址同样检查。旧存档已玩到后续章节时，保留该章并允许重玩前章；读取早期存档不会撤销本轮资格。主菜单“新游戏”会备份并重置章节进度，重新从第一章逐章解锁；“重玩本关”和舆图重玩保留本轮资格。规则及验证见[历史章节解锁](../../docs/design/CHAPTER-PROGRESSION-20261027.md)。专用开发试玩不能绕过入口，也不写正式解锁记录。

- `src/game.ts`：当前入口的依赖装配、生命周期与用户动作。
- `src/game/`：渲染、设置、模态、输入、拖放、界面状态。
- `src/chapters/catalog.ts`：关卡目录。
- `src/characters/`：只读人物志、小传与出场节点表；两章各自提供进度适配器。手机及线索操作界面已退役；`src/modules/evaluation.ts` 提供可替换、可取消的评估接口，部署开关在 `src/modules/config.ts`。节点清单与待审文案见[人物志说明](../../docs/design/CHARACTER-DOSSIER-20261025.md)。
- `src/chapter-two.ts` / `src/chapters/chapter-two/`：第二章最新影片贯通试玩，入口为 `/?chapter=grain`，包含两轮表达与五类结局。无 AI 模式使用可见固定发言；原第一轮专项入口 `?chapter=grain&playtest=open1` 保留。分支与影片仍待用户试玩审核，接入记录见 [第二章影片接入](../../docs/video/CHAPTER-TWO-FILM-INTEGRATION-20261025.md)。
- `src/chapter-three.ts` / `src/chapters/chapter-three/`：第三章街亭，入口为 `/?chapter=jieting`。独立正文、12条线索、最多五轮连续进言与8个结局；AI接通时自由交谈，关闭时使用预写选项。线索和结局条件见[街亭解锁说明](../../docs/design/CHAPTER-THREE-UNLOCKS-20261026.md)。
- `src/chapters/chapter-one/`：第一章推进、推理、表达、存档恢复、内容校验及专有视图。其他章节不能导入这里的状态与实现。
- `src/session/contracts.ts`：共享存档身份。具体存档结构和恢复策略由章节维护。
- `src/chapter-session.ts`、`thought-canvas-model.ts`、`thought-workspace.ts`：保留已有调用方的薄兼容导出。

默认入口读取 `content/chapters/wuzhang/chapter-one.script.json` 和 `chapter-one.flow.json`，正文与流程的哈希决定存档内容版本。旧版网页和专属剧情数据不再发布。第一章专有类型名为 `ChapterOne*`，旧类型名保留兼容导出。

`public/` 保存网页和发布资源。`public/game.css` 与 `thought-workspace.css` 保留原 URL，以有序 `@import` 组合 `public/styles/` 下的组件样式。调整顺序可能改变层叠结果。

构建通过 `visual-assets.json`、`public/cinematics.json` 与 `public/video/media-manifest.json` 选择外部工作区素材；`.build/` 可以重新生成，不进入 Git。不要只复制本目录。

## 手机横屏基准

手机玩法按横屏适配，主要检查 667×375、844×390、932×430。共用的 `mobile-landscape.css` 与 `mobile-viewport.ts` 处理短屏、刘海安全区和软键盘改变的可见高度；菜单、存档、输入、线索和兵力面板应各自可滚动，不能把确认或关闭按钮裁掉。正文及字幕仍遵循[跨章节字号标准](../../docs/art/CHAPTER-TYPOGRAPHY.md)，不通过单独缩小后续章节字号来塞进屏幕。

这些是网页适配要求，不表示已经完成 Android 原生外壳或真机验收。当前本地 AI 代理只服务电脑本机；APK 仍需单独配置服务连接、Android 工程和签名，再验证返回键、系统输入法、切后台、安装及升级保存。2026-10-27 的修复与实际验证见[发布前修复记录](../../outputs/release-fixes-20261027/FIXES.md)。

## 验证

荆州 `/?chapter=jingzhou&playtest=reports` 先播放关羽帐中短对白，再开始六条判断。结尾直接按正确条数复命、回应关羽并进入结局，不再选三人或抽签。已有进度可续玩；加 `&restart=1` 后确认重开可查看新开场。对应设计见[荆州问报前后](../../docs/design/CHAPTER-FIVE-STORY-20261028.md)，浏览器专项检查为 `node tools/migration/chapter-five-story-smoke.mjs`。

夷陵统一使用 `/?chapter=yiling` 的多路营救版本，包含九路营救、六轮军令及原有兵力安排。旧 `playtest=story`、`playtest=reception` 链接也进入此版本。黄权三队240人的旧接应故事及专用运行代码已删除，旧存档不再生成终章营救经历。本机历史存档保留。多路玩法见[夷陵营救说明](../../demos/yiling-rescue/README.md)。

根目录 `npm run check` 检查架构和类型；`npm run build` 编译；`npm run test:game` 验证当前玩法；`npm test` 构建并执行全部章节单元测试；`npm run test:smoke` 在独立 Chrome 上下文走完整第一章。第三章浏览器检查为 `node tools/migration/chapter-three-smoke.mjs` 与 `node tools/migration/chapter-three-online-smoke.mjs`。测试不读取真实玩家存档。

街亭专项入口使用独立存档，每次打开回到检查点：`/?chapter=jieting&playtest=reinforcement` 为第一轮进言，`playtest=item` 为持有伏虎木雕的进言点，`playtest=lure` 为第三幕分路，`playtest=withdrawal` 为下山说服。玩法、美术与对白仍待用户试玩审核。

[架构与扩章边界](../../docs/architecture/README.md)说明模块职责和自动检查范围。Cocos Creator 3.8.8 的编辑器、主场景和原生应用仍需独立验收。

## 稳定性回归

`npm run test:stability` 顺序执行类型、构建、全部玩法与底层核心、服务、字幕、架构、本地构建恢复、夷陵营救和发布资源校验。`npm run test:stability:browser` 在构建后运行存档保护、视频切换、跨章字幕、第一章通关、夷陵至荆州及终章回归，使用独立浏览器上下文。

发布字幕只取 `cinematics.json` 的当前引用；历史 VTT 留在源目录，不进入构建。详见[本轮 review 与重构](../../docs/architecture/REVIEW-20261029.md)。
