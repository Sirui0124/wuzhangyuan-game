# 夷陵营地 · 写实场景精修

2026-11-06。用户已认可上一版的空间结构，本轮细化场景视觉。大本营仍是刘备御营附近的江南集结营；两营、道路、南北渡口和四路去向继续沿用已确认的布局。用户随后确认六张精修图的结构与视觉质感：“可以的，这个质感非常完美了。请你相应帮忙优化和完善，做完整。” 确认范围记录于 `review-approval.json`；新接入的试玩界面仍待用户实际试玩。

场景试玩：[夷陵 · 归路](http://127.0.0.1:8945/)。已接入现有四路军情、问讯、调遣与回报流程。

美术预览：[六视角与原版对照](http://127.0.0.1:8944/review.html)。也可直接用浏览器打开本目录的 `review.html`，不依赖剧情服务。

## 图片与三维源文件

当前预览使用 **Blender 构图参考 + 内置 imagegen 图像精修**。六张原始结构图提供固定机位与主要物体位置，先完成营地精修图，再以它统一其余五张图的木料、麻布、土石、植被与自然日光。

三维工作文件 `yiling-camp-v3.blend` 已增加扫描植被与岩石、地表材质、帐布褶皱、板箱结构和营地物件。它保留了可编辑的布局和相机。最终 PNG 中进一步生成的纹理、枝叶和细部未回写进三维网格，所以重新渲染该文件不会直接复现最终图片的全部细节。

六张精修图的实际原生尺寸均为 **1672×941**，未放大冒充1920×1080；预览以接近16:9的原始比例显示。照片式细节仍是生成美术，不是历史实景摄影。

| 视角 | 精修原图 | 完整生成提示词 |
| --- | --- | --- |
| 大本营 | [camp.png](art/camp.png) | [camp.txt](prompts/camp.txt) |
| 营门望江 | [river.png](art/river.png) | [river.txt](prompts/river.txt) |
| 东侧陆路 | [east.png](art/east.png) | [east.txt](prompts/east.txt) |
| 山路岔口 | [south.png](art/south.png) | [south.txt](prompts/south.txt) |
| 高处望御营 | [imperial.png](art/imperial.png) | [imperial.txt](prompts/imperial.txt) |
| 调度总览 | [overview.png](art/overview.png) | [overview.txt](prompts/overview.txt) |

完整来源、尺寸、生成原件路径和文件校验值见 `image-generation.json`。使用的是内置 `image_gen.imagegen`，没有调用 CLI 图像 API。六张图均以对应的v2结构图为编辑目标；营地图另以本项目既有 `yiling_reception_camp-v1.png` 为材质参考，其余五张以新的营地图统一视觉。

## 视觉与界面

营帐保留原来的位置，增加厚麻布的受力褶皱、缝线、脏痕和绳结；木门、围栅、木车和箱子增加自然木纹、接缝和磨损。路面细化为有碎石、浅车辙和边缘杂草的土路。山坡增加岩层、灌木与林地层次，渡口补足木桩、水线和细小水流反光。

视觉对照采用本项目既有夷陵营地图，以及[《天国：拯救 II》官方林地画面](https://www.deepsilver.com/media/pq0hd34n/locations-4-forests-2.jpg)。具体借鉴其地面与植被的尺度、层次和自然光，营帐与道具仍依据本作的三国营地语境。官方图片只保存在 `references/` 作研究参考，没有用作游戏背景或材质。

预览让场景占据主要区域，六个视角控件放在画面下方，避免遮挡总览下方的沙摩柯方向。地标与路线仍是独立的可关闭界面层，未烧进图片。每个视角可以一键对照原版；左右键切换机位，C键切换原版与精修版。所有操作只用于审阅，不发送军令或推进剧情。

## 空间、接入与验证

`camera-layout.json` 保存三维布局。相机、地标、路线和陆水段数据与v2逐项一致。`art-layout.json` 是精修图片的显示入口，记录 `art/*.png` 路径、实际尺寸和投影来源。`legacy-map-layout.json` 给出总览图的兼容坐标；接入时应配合 `art/overview.png` 使用。

精修图保留了两营、两岸泊点、两艘原有视觉占位船及四路方向。我已逐图检查主要位置，并复查带标记的总览和渡口。图像精修不是逐像素几何锁定；当前地标继续使用原归一化投影，正式接入时应以本版图片与配套布局一起使用。

浏览器检查记录在 `verification.json`，截图在 `review-checks/`。检查包括六张图实际载入、逐视角原版对照、四路筛选、地点跳转、标记开关、键盘操作、全屏以及390px视口无横向溢出。此检查覆盖独立美术预览；未作为正式剧情试玩或用户美术通过的证明。

美术精修保留原v2场景与8943预览。后续场景接入放在 `demos/yiling-expert-lab/`，使用8945独立页面，复用8942的剧情服务；仅为原前端增加可选场景入口，剧情数据、规则引擎、服务端及正式游戏存档均未更改。

试玩使用六张1672×941的WebP交付图，保留完整PNG原件与校验值。六张主图合计由21.34 MB减至5.07 MB，另有小尺寸导航缩略图，未放大或裁切主图。格式转换脚本为 `prepare-scene-assets.mjs`，来源记录为 `public/art/scenes/provenance.json`。

## 三维重建

`refine_scene.py` 读取相邻v2目录的 `.blend`，增加模型和材质后保存本版源文件。扫描模型和材质来自 [Poly Haven CC0 资源](https://polyhaven.com/license)，逐项来源和校验和见 `asset-provenance.json`，56张使用中的图片已打包进本版 `.blend`。`fetch_assets.py` 可重新下载对应资源。

```powershell
blender -b --python source-art/maps/yiling-camp-v3-20261106/refine_scene.py
blender -b --python source-art/maps/yiling-camp-v3-20261106/render_scene.py -- --preview camp river overview
python source-art/maps/yiling-camp-v3-20261106/build_review.py
node source-art/maps/yiling-camp-v3-20261106/inspect_review.mjs
```

Blender试渲染保存在本目录的 `*-preview.png`，与 `art/` 的最终精修图分开。预览服务可在本目录执行 `python -m http.server 8944 --bind 127.0.0.1` 启动。
