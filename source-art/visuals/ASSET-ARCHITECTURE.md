# 美术资产分类与使用边界

2026-10-22 建立分类入口。已有运行时路径和视频参考路径保持稳定；新增资产使用角色、场景或组件子目录。完整机器清单位于 [inventory-20261022.json](../../docs/art/inventory-20261022.json)，可浏览 [分类图册](../../docs/art/catalog-20261022.html)。

| 类别 | 文件夹 | 使用规则 |
| --- | --- | --- |
| 人物立绘 | `runtime/characters/<角色ID>/` | 一人一目录，表情独立 PNG；真实 alpha；`neutral-v3.png` 等版本名可并存。旧平铺原件仍是身份与视频参考，未经引用核对不迁移。 |
| 场景底图 | `runtime/scenes/` | 玩家可走地点按稳定场景 ID 绑定；新版本单独命名。场景结构由空间模型与视频共同校准，不能用滤镜掩盖不同地形。 |
| 系统美术组件 | `runtime/ui/` | 按按钮、纸面、边饰、标记、图标组织；文字、触发区、状态与图案分离。主菜单的历史发布图目前仍位于 `GameStarter/web-demo/public/`。 |
| 固定人物合成镜头 | `runtime/cinematics/` | 含人物的静帧，不作为无人场景底图；必须与当时在场人物一致。 |
| 空间连续性 | `spatial/` | 平面地图、人物锚点、相机、模型与视频证据。模型是美术布局约束，原型模型不冒充已完成可投产的精模。 |
| 技术与视觉复核 | `review/` | 最新视频抽帧、角色黑白底联络表及复核证据，不参与构建。 |
| 未选定画风候选 | `style-tests/` | 用户未定稿的试验与其 Prompt。候选不自动绑定、不自动审批、不因为未绑定就删除。 |
| 历史与停用分支 | `archive/<日期>/` | 可逆归档；清单逐项记录 original→archive、原因和哈希。引用尚有效的文件先保留原位。 |

运行时绑定唯一依据是 [`GameStarter/web-demo/visual-assets.json`](../../GameStarter/web-demo/visual-assets.json)。`runtime-map.json` 现在由 `python tools/art/build_review.py` 从该文件导出，只作可查阅镜像，不单独手改；旧版已保留于 `archive/20261022/runtime-map-before.json`。`characterExpressions` 是角色→表情→角色资产 ID 的查找表，真实文件路径仍从 `characters` 读取。`design-tokens.json` 保留旧版本设计记录，不代表当前游戏已使用全部资源。新完整入口与 `/legacy.html` 可能消费不同的资源；同一文件仍供旧存档读取时不得因新入口未使用而删除。

`video/production/` 等目录中的同哈希副本是可独立上传的参考包与制作证据。它们不移入美术原件目录，也不因重复而被删除。视频 Prompt 的本地绝对路径和附件顺序受视频制作规则保护。

资产状态与审核分开记录：技术可读、存在 alpha、构建已绑定都不能代替用户的视觉通过。新图需检查身份、服装、光照、画风和透明边缘；场景需检查最新影片的地标和空间方向；系统组件需在实际字号和屏幕尺寸下查看清晰度。

重新盘点：在工作区运行 `python tools/art/asset_inventory.py`。它只读取源文件并生成报告，不移动图片，不改 `.meta`，不清理构建或缓存。

整页优先的[本地审阅图册](review/20261022/index.html) 由 `python tools/art/build_review.py` 生成。只有确认是用户反馈之后重新截取的整页截图，才使用 `--include-ui` 或 `--include-gameplay`；`rejected-v1` 不进入主墙。木板、朱印、纸/布料生成样品固定标明“本轮样品未采用，待整体UI审核”。生成图册、同步绑定镜像和技术验证均不更改用户审核状态。
