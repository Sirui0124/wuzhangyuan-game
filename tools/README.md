# 工具目录

| 目录或文件 | 职责 |
| --- | --- |
| `architecture/` | 文件规模、导入、章节边界和运行时循环依赖检查 |
| `local-game/` | 本地服务、后台启动、自动构建与版本切换 |
| `migration/` | 资源校验、当前浏览器回归，以及保留的迁移记录工具 |
| `art/` | 美术清单、审阅和界面验证 |
| `ai/` | AI 模块相关验证 |
| `musein/` | 专用媒体制作工具；见该目录 README |
| `import-chapter-one-review.py`、`prepare-chapter-one-flow.mjs`、`sync-chapter-one-plan.py` | 第一章特定版本的导入/映射工具；运行前对照最新策划，不能直接重放旧稿 |

当前入口使用根目录 `package.json` 的命令。脚本输出放 `outputs/`，可重建缓存与构建产物按 `.gitignore` 保持本地。

日常入口为 `npm run verify:daily`；与本次改动相关的测试另按需运行。`test:stability` 和 `test:release:browser` 留给发布或系统性回归，后一条才串行覆盖各章全分支。历史迁移脚本不属于日常验证入口，不能为了测试而重放旧剧情或素材替换。
