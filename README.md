# 逆转五丈原 · 开发工作区

2026-11-02 已补强素材发布校验、清理停用视频副本，并扩充第二、第三章浏览器回归；见[架构、清理与验证记录](docs/architecture/REVIEW-20261102.md)。

日常工作用的 HTML 页面默认采用浅色、简约界面，方便阅读、编辑和审阅；有明确美术或展示风格要求时，再按具体要求设计。这一约定也写入了 [AGENTS.md](AGENTS.md)，后续新增或修改工作工具时沿用。（2026-10-30）

TypeScript 桌面浏览器游戏，当前接入第一章五丈原、第二章祁山、第三章街亭、第四章夷陵、第五章荆州及第七章落凤坡。第四、第五章的剧情与玩法仍待用户试玩审核。第五章支持自定义追问，由 AI 理解问题并选择预设口供；第四章保留军营固定选择、地图问讯、两处说服与军令接应。Cocos Creator 工程版本为 3.8.8，主场景尚未接入完整玩法。请复制或克隆整个工作区。

## 安装与启动

Windows 玩家安装版的构建与数据目录说明见 [Windows 安装版](GameStarter/packaging/windows/README.md)。该版本自带运行时，使用生成的安装程序安装。下面的 Node/npm 步骤用于开发工作区。

安装 Node.js 22 或更新版本，在根目录运行：

```sh
npm ci
npm run open
```

Windows 可直接双击 **启动游戏.cmd**，重复启动会复用后台服务。

- [完整第一章](http://127.0.0.1:8812/)
- [第三章街亭](http://127.0.0.1:8812/?chapter=jieting) · [连续进言直达](http://127.0.0.1:8812/?chapter=jieting&playtest=reinforcement) · [五次进言与分兵规则](docs/design/CHAPTER-THREE-PERSUASION-20261027.md) · [解锁条件](docs/design/CHAPTER-THREE-UNLOCKS-20261026.md)
- [第四章夷陵](http://127.0.0.1:8812/?chapter=yiling)：使用九路、六轮的多路营救版本。舆图支持直接抢先体验，进度与结果保留；通关街亭后衔接荆州，其他章节仍按顺序解锁。旧接应故事已删除，旧链接统一进入多路营救；本机历史存档保留。
- [第五章荆州](http://127.0.0.1:8812/?chapter=jingzhou)：主线通关街亭且第四章完整结算后开放，夷陵抢先体验的结果可沿用。六份军报、每人最多三次追问、两个待命位；逐份判断真假，按判断正确数进入关羽结局，不再另选三人或随机抽签。支持自由追问和无 AI 固定问题。正式进度与 `playtest=reports` 分开。
- [第七章庞统](http://127.0.0.1:8812/?chapter=luofengpo)：六处调查选择、四条完整结局；正式流程在第五章结束后开放，四个结局收进完整游戏成就卡册。可通过[独立试玩入口](http://127.0.0.1:8812/?chapter=luofengpo&playtest=pangtong)直接审阅，不写正式通关或卡册。此前经历影响对白，不锁死结局。独立夷陵营救可在结局页明确采用本轮结果。详见 [第七章接入说明](docs/design/CHAPTER-SEVEN-INTEGRATION-20261028.md)，剧情与美术待用户审阅。
- [本地入口与版本状态](http://127.0.0.1:8812/local/)
- [片场工作台](http://127.0.0.1:8926/)：双击 **启动片场.cmd**，首页每段视频旁留有评论框，输入后自动保存到本机。台本、版本对照和军营3D参考保留在页底的旧版入口。详见[使用说明](tools/film-studio/README.md)。
- [手机助手专项试玩](http://127.0.0.1:8812/?playtest=supplies)：解锁后从画面侧边打开手机，单页聊天提供“帮我买…”和“我想问问…”输入提示，右上角显示钱包。AI问答、商品建议、确认购买和物品佐证都在同一页；支持动态商品及三种附加结局类型，未核实报价明确标为估价。启用 AI 并开放手机时，第一章在自定义发言行动入口一次性充值50元并解锁手机；首次专项试玩从该检查点开始，之后刷新恢复独立存档。同关聊天、余额、物品保存，新开关卡全部清空，读档不重复充值。正常主线与不附物品的解法保留，新增内容待review，详见[开发记录](docs/design/SUPPLY-DIALOGUE-20261024.md)。

`npm start` 在终端运行同一服务；`npm run stop` 关闭本工程后台服务。本地修改会触发构建，成功后提示玩家手动刷新；失败保留上一可玩版。使用同一浏览器和 `127.0.0.1:8812` 保持存档，详见[本地访问架构](docs/design/LOCAL-GAME-ACCESS.md)。

AI 代理自动启动或复用，监听本机 8787。首次配置使用 `GameStarter/server/.env.example` 创建本机 `.env`，或在游戏设置填写密钥。首次默认有 AI、有手机；启动检查发现 AI 未配置或本地 AI 服务无法连接时，第一章自动转为无需密钥的无 AI 模式。补好配置后恢复 AI 与手机；手机与物品由同一个开关控制；关闭物品时同时关闭手机，AI 连接恢复后按该开关恢复手机。第二章无 AI 逻辑待更新；配置不进入 Git。

三种模式、默认参考句和后续待办见[运行模式说明](docs/design/RUNTIME-MODES-20261025.md)。

## 目录与架构

| 目录 | 内容 |
| --- | --- |
| `GameStarter/` | 游戏源码、测试、发布资源、AI 代理与 Cocos 工程 |
| `content/` | 按章保存的正文、流程、契约和人工编辑稿 |
| `docs/architecture/` | 模块边界、扩章方法、架构 review 和验证记录 |
| `docs/design/` | 机制、策划协作和当前设计记录 |
| `docs/video/` | 视频规范、素材索引和接入记录 |
| `source-art/` | 美术、音频原件和制作素材 |
| `video/` | 现用影片、原片、审阅与制作历史 |
| `tools/` | 本地服务、校验、美术与视频工具 |
| `outputs/` | 本地测试报告、截图、备份与草稿归档，Git 忽略 |

默认第一章读取 `content/chapters/wuzhang/chapter-one.script.json` 和 `chapter-one.flow.json`，实现位于 `GameStarter/web-demo/src/chapters/chapter-one/`。`game.ts` 负责装配，`game/` 负责界面，`chapters/catalog.ts` 统一关卡目录。旧版网页入口已移除。详见[代码架构](docs/architecture/README.md)和[本次整理与 review](docs/architecture/REVIEW-20261023.md)。

架构检查阻止错误导入、章节交叉依赖和运行时循环依赖；文件规模只作提示。原资源路径和 `.meta` 保留；`library`、`temp`、`.build`、`.cache`、`node_modules` 为本机生成内容。剧情 JSON 和历史审阅稿保持编辑结构，不按程序文件行数拆碎。

## 验证

日常改动默认运行 `npm run verify:daily`，只做架构/类型检查、构建和一条主线浏览器检查。改设置时补跑 `npm run test:settings` 与 `npm run test:ai-guidance`；按改动选择相关单元测试，不默认重跑全部故障与边界案例。发布前再运行下面的完整技术检查，以及 `npm run test:release:browser`。

```sh
npm run test:stability
npm run test:stability:browser
```

`check`、`build` 包含 `check:architecture`；`test:architecture` 验证守卫自身的边界案例。当前完整浏览器回归使用已安装的 Chrome，采用独立上下文，不读写玩家存档。模型相关自动测试使用受控样例，不代表真实模型质量。编辑器、编译、浏览器试玩分别验收。

`npm test` 先构建，再自动发现并执行全部章节单元测试；`npm run test:core` 单独验证保留的底层叙事核心。

## 策划与素材入口

- [思绪画布定稿规范](docs/design/THOUGHT-CANVAS-FINAL.md) · [对白界面规范与修订](docs/design/DIALOGUE-INK-UI-20261023.md) · [思绪界面规范](docs/design/THOUGHT-NIGHT-UI-20261023.md)

- [协作原则](docs/design/COLLABORATION-PRINCIPLES.md) · [飞书在线原文](https://my.feishu.cn/docx/MSdZd2H8IoWkXyxpkpNcgxRKn0b) · [自然语言规则映射](docs/design/PLANNING-RULE-MAPPING.md)
- [全局游戏规则](docs/design/GLOBAL-GAME-RULES.md) · [飞书原文](https://my.feishu.cn/docx/BloVdzBIKogBDmxAIEQcqvZInke) · [第一章规则审查](docs/design/RULES-REVIEW-20261022.md)
- [视频资产索引](docs/video/ASSET-INDEX.md) · [最新影片接入记录](docs/video/NEW1022-INTEGRATION-20261022.md) · [视频制作规范](docs/video/VIDEO-PRODUCTION-RULES.md)
- [Windows 安装与迁移](docs/migration/WINDOWS.md) · [GitHub 与大文件边界](docs/migration/GITHUB.md)

策划同步前通过飞书 CLI 核对线上最新版；未设置自动监控。

私有仓库：[Sirui0124/wuzhangyuan-game](https://github.com/Sirui0124/wuzhangyuan-game)。克隆前安装 Git LFS，克隆后运行 `git lfs pull`。凭据、本机存档、缓存和构建产物不提交。

2026-10-29 全面检查、字幕发布清理、共享校验与存档保护见[review 与重构记录](docs/architecture/REVIEW-20261029.md)。
