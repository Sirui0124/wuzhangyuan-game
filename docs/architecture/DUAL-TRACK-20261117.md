# 网页 / Windows 与 Unity 双线开发记录

2026-11-18状态更正：用户已暂停Unity移植，改为Windows安装EXE与Mac网页版交付；下文为2026-11-17历史记录，继续移植的旧授权已被替代。

2026-11-17。用户已明确授权双线开发及下载所需开发工具。本记录替代上一轮“Unity只做评估”的阶段限制。

## 网页与Windows线：已交付安装程序

当前网页代码继续维护；新增根目录 `npm run build:windows` 及 `打包Windows.cmd`。每次先检查架构，再独立构建网页并生成Windows安装器；使用时间戳目录保留旧产物。目录版可使用 `npm run build:windows -- --dir`。

本次Windows产物：
`outputs/windows-release-20261117200053/Wuzhangyuan-0.1.0-20261117200053-win-x64-setup.exe`

大小1,481,400,127字节。SHA256：`6dd2ff4680fa9d94159c636656419888b6c9557c9d6cf1bf814487a7b6a2b4fe`。

实际修复了打包依赖缺失：正在接入的夷陵指令服务需要campaign-runtime、campaign-engine、fu-ai及傅肜规则与设计数据。已加入发布白名单，TypeScript规则在打包阶段转为JavaScript，运行不依赖工作区编译器；指令营救存档也改为通过参数传入Windows用户数据目录。未改变其营救与AI机制。

693个发布文件通过大小与SHA256校验。将目录版复制到工作区外的独立测试目录后，实启Electron程序，验证自带运行时、6章入口、视频解码与时间推进、设置、本机营救存档、退出重启恢复及退出时服务回收，均通过。页面错误、资源缺失、计费模型请求均为0。验证报告：`outputs/windows-release-20261117200053/validation-unpacked/installed-app-verification.json`，其中mode明确为unpacked-probe-not-installation。本轮没有安装或卸载NSIS，因此不将其说成安装流程测试通过。

第一次带截图测试在隐藏窗口媒体流程中未完成，已停止该次测试并以脚本已有的skip-captures模式重跑通过；不使用未完成的截图测试作为完整通过证据。

## Unity线：已开始实际移植，编辑器验证受下载限制

独立工程 `UnityPort/`，原生C#规则与Unity界面，不使用WebView套网页。先迁第一章告示和斥候分支至魏延自由发言入口，共6段14行原文。包含场景移动、选择、线索展示、进度重放、自动/手动保存与重玩备份。自由发言及后续剧情尚未迁移，到边界明确停止，不伪造通关。

已用Windows自带.NET Framework C#编译器编译实际内核，42项断言通过；再与当前网页ChapterSession执行同一动作，两条分支34次逐步状态比较通过。UnityPlayer显示及存档UI代码尚未通过Unity编辑器编译或视听验证。没有生成Unity可执行文件。

下载尝试：Unity官方release API确认6000.3.28f1；6000.3.28f1、官方归档6000.3.0f1和6000.0.62f1的Windows下载均被当前网络重定向到download.unitychina.cn，响应404 NoSuchKey。也核对当前系统已配置代理，结果相同。没有关闭证书验证，没有使用未知来源安装包。

已从Unity官方CDN下载Unity Hub安装器（137,590,016字节），Authenticode签名有效，发布者为优三缔科技（上海）有限公司，并安装到当前用户的 `AppData/Local/Programs/UnityHub`。该Hub查询返回2020等旧版列表，未取得Unity6 Editor。项目目标固定6000.3.0f1，后续需要可用的官方编辑器下载与有效许可，才能执行Unity编译/试玩。

## 下一步边界

当前已建立两个独立工程入口，不表示两者功能已经等价。网页/Windows继续作为完整版本；Unity继续按真实章表移植，内容从content导出，不分叉维护另一份人工对白。下一关口是Unity Editor成功安装后验证当前小段，再迁视频字幕、输入/线索引用、AI异步取消和存档迁移。

详细命令与范围见 `UnityPort/README.md`。更新后的长期范围已写入AGENTS.md。
