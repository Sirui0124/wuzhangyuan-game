# Unity 原生移植试验

2026-11-18：用户要求暂停Unity移植，当前交付改为Windows安装EXE与Mac网页版。现有试验工程保留，以下内容仅记录已完成范围，后续移植需用户重新授权。

目标编辑器：Unity 6.3 LTS（ProjectVersion固定为6000.3.0f1）。当前状态：已编写原生C#内核与IMGUI试玩界面，内核已在本机.NET Framework编译并运行测试；Unity Editor尚未成功下载，因此未验证Unity程序集编译、画面或Player构建。

## 当前范围

使用现有第一章原文和流程：醒来、读告示、询问斥候、A/B两个回答、迎上魏延，共6段14行对白。读取来源后才获得对应线索；A回答读完取得T02，B不取得。进入魏延自由发言时停止，不伪造AI回应、成功或后续结局。开篇PV、帐篷支线、AI/配音、人物志、成就及后续章节尚未移植；正式网页中的这些功能继续保留。

界面已有背景、对白推进、地点切换、剧情选项、只读线索栏、手动档、自动档和重玩确认。使用源素材，当前布局仅用于移植验证，尚未经过Unity视听审阅。

## 工程组成

- Assets/Scripts/StorySession.cs：不依赖Unity的C#运行内核，按读完行、选择和行动推进，条件来自导出的章表。
- Assets/Scripts/StoryPlayer.cs：原生Unity界面及持久化适配。存档写至Application.persistentDataPath，以unity-ch1-slice前缀隔离；覆盖前保留备份。损坏自动档不会静默覆盖。
- Assets/Resources/chapter-one-slice.json：从正式content导出，保留行号及来源文本；内容哈希绑定移植存档。
- Assets/Editor/PortBuild.cs：菜单Wuzhangyuan/Open prototype scene建立或打开场景；Build Windows prototype生成Unity Windows试验程序。
- Tests/PortTests.cs：仅用于外部C#测试，不纳入Unity发布。

## 开发命令

工作区根目录执行：

```powershell
npm run unity:sync
npm run test:unity-core
$env:UNITY_EDITOR='实际安装路径/Editor/Unity.exe'
powershell -NoProfile -ExecutionPolicy Bypass -File tools/unity/build.ps1
```

编辑器成功安装并激活后，将UnityPort作为独立项目打开。选择Wuzhangyuan/Open prototype scene，然后Play。也可用build.ps1批量构建到outputs/unity-prototype/WuzhangyuanUnity.exe。批量构建仍需要有效Unity许可；不把脚本存在视为已构建成功。

unity:sync不会回写正式章表。策划修改后重新导出，旧试验存档的内容哈希不匹配时明确拒绝并保留原文件。当前未实现正式网页旧档到Unity的迁移。

## 已完成验证

42项原生C#断言通过：流程门槛、按实际来源取得线索、分支差异、存读档重放、无效动作和版本拒绝。两条分支逐步与网页ChapterSession比较，共34次状态比较通过，包括场景、当前行、阶段及所持线索。只有终点将尚未移植的expression映射为boundary；不是把它当成已实现的自由发言。

官方Editor下载被当前网络重定向至中国区后返回404，6000.3.28f1、6000.3.0f1及6000.0.62f1均未成功。已下载并安装官方签名的Unity Hub，现有Hub返回旧版编辑器列表，不能据此声称已取得Unity6。下一步需恢复可访问的官方Editor下载并完成许可激活，再进行真正的编辑器编译与试玩。
