# 2026-10-18 迁移与精简报告

本地迁移整理及私有 GitHub 上传按用户授权进行；后续要求进一步移走图片 Prompt、过程稿和无关资料，当前目录已按运行依赖与最新制作状态精简。

## 保留与分类

有效源码、测试、原有 19 个 .meta、正式 chapter / endings JSON、完整人工编辑稿、最新第一轮确认稿、运行 AI 判定提示词、现用美术与音频、四段现用视频、最新六段待验收剪辑及其原片和在制参考图。主人工稿正文未覆盖，仍需结合最新首轮确认稿核对。

现用源美术统一为 source-art/visuals；音频源为 source-art/audio；在制视频统一为 video/in-progress/raw、references、edits。运行白名单和最新剪辑清单的路径同步更新；旧审稿工具、研究影片、图片生成 Prompt、过往生成图、审片截图、旧录屏与安装产物已移出。

## 保护与恢复

整理前完整私有检查点为 `/Users/sirui/Documents/ChatGPT/Game/GameJam-1011-checkpoint-20261018-153936`，包含原 3,639 个文件及哈希，含本机配置，不能上传。

首次仅移出 5 个重复或系统文件；本次进一步移入废纸篓 2590 个文件，共 1,431,867,198 字节。废纸篓：`/Users/sirui/.Trash/GameJam-1011-lean-20261018-161016`。恢复映射和移动映射为本机 outputs/migration-20261018/lean-trash-manifest.json。没有永久删除原件，也未用 Git reset / clean 覆盖未提交修改。Git 正常历史保留先前提交。

## 验证与边界

验收包括锁文件安装、类型检查、63 项叙事测试、2 项本地代理测试、剧情结构校验、网页构建、资源精确大小写 / 路径及四段视频哈希检查、Chrome 冒烟。最终结果见 UPLOAD.md 及本机 upload-result.json。Windows 禁用文件名与大小写冲突通过静态扫描；Windows 实机、Cocos、原生发布、真实 AI 质量及所有结局尚未完整验收。

网页默认 http://127.0.0.1:8811，代理 http://127.0.0.1:8787。根 README 和 WINDOWS.md 提供重新启动命令。本机 .env 原样保留且未上传。已知旧安装产物含密钥，已移入本机废纸篓；新打包默认空密钥。

项目源文件和可达历史检查排除凭据；版权许可作者署名保留。源码与素材清单见 FILES.md、ASSETS.csv、VIDEOS.csv；私有仓库信息见 GITHUB.md。
