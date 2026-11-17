# 军营空间样机 V1

状态：待review。双击 `index.html` 可离线审阅；支持10个固定机位、鼠标环绕缩放、主帐剖视和平面图。

`camp-exterior.obj`、`main-tent-ritual.obj`、`main-tent-council.obj` 是可导入的真实几何模型，与 `camp-materials.mtl` 放在同一目录。单位米，Y向上、Z向南；导入器请核对轴向。它们是空间一致性样机，不含人物精模、动画或影视材质。

总平面 `camp-plan.svg/png` 与帐内平面 `main-tent-plan.svg/png`、坐标 `camp-layout.json` 来自同一生成器。`preview-*.png` 是浏览器实际渲染截图；`evidence` 内是当前视频抽帧及来源哈希。

完整设计依据、观察事实与设计约束、机位、人物朝向及验证限制见 [报告](../../../../docs/art/camp-spatial-20261022.md)。

在工作区根目录运行：

```powershell
node source-art/visuals/spatial/camp-v1/build-spatial.mjs
node source-art/visuals/spatial/camp-v1/verify-spatial.mjs
```

`validation.json` 记录实际检查。程序验证通过不等于用户批准；没有修改正式游戏资源绑定、剧情、视频台账或 `.meta`。
