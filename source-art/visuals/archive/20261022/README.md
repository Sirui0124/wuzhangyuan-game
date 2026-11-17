# 2026-10-22 可逆归档

本目录保留已明确不再作为第一视角候选的 E1 营门、E2 候报两张旁支图。依据是原有 `style-tests/20261019-first-person/README.md` 对这两张图的明确定位；它们仍可供环境研究，不被认定为损坏图片。

移动前已检索工程文本引用，两图未被运行时配置或视频 Prompt 引用，只有原目录 README 链接。README 已定点改为归档路径，生成 Prompt 保持原文。没有删除任何图片，没有移动运行时图、视频参考图、用户参考或其他风格候选。

[manifest.json](manifest.json) 逐项记录原路径、归档路径、内容哈希与恢复方法。需要恢复时将两张图按映射移回，并恢复原 README 的相对链接。图片旁的 `.meta` 若存在必须一起移动；这两张图没有 `.meta`。

随后按用户“木板奇怪，先审整页”的反馈，将四张本轮 UI 材质样品及两份制作记录从 `runtime/ui/materials/` 整目录移入 `ui-material-prototypes/`。移动前确认整个目录没有 `.meta`，四项 `material_` 绑定已移除，页面停止调用。四张 PNG 的移动前后哈希一致；制作记录只更新归档位置和历史状态说明。本轮样品未采用，待整体 UI 审核。

`runtime-map-before.json` 是同步前旧索引的原样快照。当前 `runtime-map.json` 由唯一权威 `GameStarter/web-demo/visual-assets.json` 导出，不再维护另一套手写绑定。
