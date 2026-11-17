# Unity 移植可行性评估

后续状态更正（2026-11-17）：用户已授权保留网页/Windows并开始Unity原生移植。下面保留评估时的判断；当前工程及验证进度见[双线开发记录](DUAL-TRACK-20261117.md)。

2026-11-17。状态：代码与官方文档桌面评估；未建立 Unity 工程，未运行 Unity 原型。用户已确认当前只维护浏览器和 Windows，Unity 是待讨论方向。

## 结论

可以移植。当前 Windows 版是 Electron 窗口加网页前端和 Node 本机后端，不能把安装包直接转换成 Unity 工程。真正迁移需用 Unity 实现界面、生命周期、媒体播放和本地持久化，并决定如何运行既有规则及 AI 服务。

当前以预置剧情、选择、自由发言、视频和独立营救玩法为主。建议先继续维护同一套网页代码生成浏览器与 Windows 版本，收敛章节接口。若以后有明确的实时场景、角色动画或引擎工具需求，再进行一章纵向原型。此建议基于当前代码形态，不是 Unity 性能测试结论，也不承诺自动减小包体或提高运行速度。

## 本项目迁移范围

| 模块 | 可复用部分 | 必须适配的部分 |
| --- | --- | --- |
| 剧情、对白、线索、人物志、成就 | content 中的数据、稳定编号、条件含义 | C# 数据类型、内容校验、资源加载 |
| 图片、视频、音效与音乐 | 已确认源素材及索引 | VideoPlayer/音频播放、暂停恢复、字幕时间轴、平台解码验证 |
| 章节规则 | 现有分支逻辑与测试用例 | 若改为原生 C#，移植 TypeScript 运行器；不能认为 JS 可直接编译成 Unity 脚本 |
| 界面 | 视觉设计、交互规则 | HTML、CSS、DOM、popover、dialog、iframe 均需替换或桥接 |
| AI与润色 | 请求协议、提示词、事实约束 | C# HTTP调用、取消与重试；Node后端可先继续作为本机服务，需另做进程和部署管理 |
| 实时配音 | 可选开关、服务协议、音色设定 | WebSocket连接、音频流缓冲、解码和中断播放 |
| 存档 | 版本、稳定事实、历史保护策略 | localStorage导出导入、Unity文件持久化、旧档迁移；第四章需连同服务端存档迁移 |
| 第四章 | 九路六轮营救引擎、确定性种子、API契约 | 营救地图/对话界面重写；初期可继续调用现有服务，后续再决定是否移植引擎 |
| Windows启动器 | 产品入口、数据目录约定 | Electron窗口及启动子进程代码不直接复用；改为Unity启动和安装布局 |

人物志本身是预置目录及只读展示（characters/catalog.ts、characters/module.ts），没有必须删除的复杂业务。成就与卡册继续保留。

## 三种做法

1. **继续现有网页与Electron**：两端共用前端、剧情与服务，实现成本最低，是当前建议。
2. **Unity加载嵌入网页**：可能复用大量现有页面，但需要选定并验证WebView方案，增加桥接、焦点、媒体和发布维护；没有因此获得原生Unity界面的架构简化收益。未选择或采购任何插件。
3. **原生Unity迁移**：长期可统一Unity内的展示与引擎能力，但前端重写范围最大。若保留现有网页版，暂时会同时维护两套展示；若将浏览器也改为Unity Web，则需单独验证Web平台限制。

Unity UI Toolkit支持运行时UI，采用UXML、USS和事件机制；这可作为新界面的候选，但与当前HTML/CSS的相似性不代表原文件可以直接复用。[Unity UI Toolkit](https://docs.unity3d.com/6000.0/Documentation/Manual/UIElements.html)

Unity提供平台相关的persistentDataPath用于持久化；现有Electron浏览器资料和localStorage仍需明确导出、转换和导入，不会自动被Unity读到。[Unity持久化路径](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/Application-persistentDataPath.html)

若未来同时改成Unity Web，HTTP需考虑UnityWebRequest及跨域规则，WebSocket需浏览器JavaScript或其他适配；Windows可用的本机服务/文件方案不能直接套用浏览器。[Unity Web网络限制](https://docs.unity.cn/6000.0/Documentation/Manual/webgl-networking.html)

## 在决定迁移前的最小验证

用第一章的一段真实剧情验证：视频与字幕→对白→线索插入→选项和分支→保存→退出重启恢复。再补一次AI成功、断线取消与可关闭配音。用现有分支测试中的状态快照对比结果，禁止因迁移改变人物授权或结局条件。第二个样本再测试第四章的确定性存读档。

目前未承诺工期；应先完成上述小段原型，再按界面、媒体、AI和存档实际适配量估算。此记录不构成已开始Unity迁移的声明。
