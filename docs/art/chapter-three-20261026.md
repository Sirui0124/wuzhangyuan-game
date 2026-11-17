# 第三章街亭场景与人物美术

日期：2026-10-26。已用内建 `image_gen` 生成并保存到项目；未调用付费 CLI。共8处独立场景、1张赠物后的连续性变体、2位新人物，另保留1张已停用的马谡帐初版。所有素材均待用户审阅。

## 风格与实看依据

生成前实际查看了现用 `relay_tent.png`、`camp-v3/camp_gate-film-end-20261023.png`、姜维与魏延的 `neutral-v3.png`，并读取现用 `visual-assets.json` 和制片风格规范。新图沿用有色实拍历史电影的材质：粗麻、旧木、暗铁和真实土路；白天以柔灰日光、旧土和麻白为主，傍晚只让实际炉火照出局部暖色。没有使用SVG占位或用同图加滤镜冒充新场景。

参考文件：[现用美术说明](../../source-art/visuals/README.md)、[制片风格规范](../visual-direction/制片风格规范.md)、[第一视角适配](../visual-direction/原始参考关键词与第一视角适配.md)。

## 接入对应

下表路径相对 `source-art/visuals/`。整合时已加入 `GameStarter/web-demo/visual-assets.json`，并绑定第三章实际剧情。`jieting_defense_line` 在运行内容中另有 `jieting_battlefield` 别名。

| 建议 key | 名称 | 文件 | 尺寸与格式 | 使用位置 |
| --- | --- | --- | --- | --- |
| `jieting_camp` | 山下行军营与帐前 | `runtime/scenes/jieting/jieting_camp-v1.png` | 1672×941 RGB | 第一幕开场、两将争论、搬营调查。没有预画敌袭结果，可用于初始状态。 |
| `jieting_wangping_camp` | 王平山下关道营 | `runtime/scenes/jieting/jieting_wangping_camp-v1.png` | 1672×941 RGB | 向王平报告、询问分工、两处守路与增兵到营。正路和侧路明确分开。 |
| `jieting_water_path` | 侧路与取水道 | `runtime/scenes/jieting/jieting_water_path-v1.png` | 1672×941 RGB | 第二幕取水队遇袭后的调查。流水仍在、桶边有箭；不可在第一幕提前显示受袭结果。 |
| `jieting_mountain_path` | 山道与坡脚接应处 | `runtime/scenes/jieting/jieting_mountain_path-v1.png` | 1672×941 RGB | 第三轮接应调查、下山与末队接应安排。通路仍然畅通，不用于已经封路的困山结果。 |
| `jieting_evening_camp` | 傍晚战后营火 | `runtime/scenes/jieting/jieting_evening_camp-v1.png` | 1672×941 RGB | 守住街亭与大捷后的营地生活。没有宴会或喜庆仪式；马谡战死分支不得再叠加马谡立绘。 |
| `masu` | 马谡 | `runtime/characters/masu/neutral-v1.png` | 1024×1536 RGBA | 新设人物形象，约四十岁、书生气较重的军官，青灰衣、深铁甲、整齐短须和小髻；与姜维、魏延区分。站立交谈姿态。 |
| `wangping` | 王平 | `runtime/characters/wangping/neutral-v1.png` | 1024×1536 RGBA | 新设人物形象，约四十五至五十岁、宽脸短须、深铁盔、灰褐衣甲，稳重的野战军官。站立交谈姿态。 |
| `jieting_masu_tent` | 马谡山上议事帐 | `runtime/scenes/jieting/jieting_masu_tent-v2.png` | 1671×941 RGB | 见马谡、上山回报、议兵。v2案头木虎已改为伏卧；仅在尚未赠出时使用。 |
| `jieting_lure_camp` | 诱敌前的山营 | `runtime/scenes/jieting/jieting_lure_camp-v1.png` | 1672×941 RGB | 第三幕佯退准备、收旗与留下营具。没有画敌人上钩，不代替实际诱敌判定与战斗结果。 |
| `jieting_defense_line` | 山下守路战场 | `runtime/scenes/jieting/jieting_defense_line-v1.png` | 1672×941 RGB | 守备接战、阵线回报及战场衔接。保留可行通路和蜀军阵地；不能直接当作失守后的魏军占领画面。 |
| `jieting_masu_tent_after_gift` | 马谡议事帐：赠物后 | `runtime/scenes/jieting/jieting_masu_tent-after-gift-v1.png` | 1671×941 RGB | 与v2相同镜位，木虎已经移去。玩家实际收下伏虎木雕后换用此版本；不能继续把赠出的物品画在案上。 |

[可合并的映射建议 JSON](../../source-art/visuals/runtime/scenes/jieting/generation/manifest-proposal.json) · [完整生成记录、原始路径、尺寸和 SHA256](../../source-art/visuals/runtime/scenes/jieting/generation/records.json)

## 人物与配角复用

马谡、王平是本作新设形象，不能作为历史肖像考据。两张均为1024×1536的RGBA人物图，实际alpha范围0–254；马谡完全透明像素占47.14%，王平占39.50%。肤色与衣甲保持各自色相，头顶及双手完整，供现有人物层叠加。

普通配角可按实际角色复用现有资产：探马使用 `scout`，军吏使用 `military-clerk`，传令军士使用 `relay`，搬营与取水军士可复用不带高级军官特征的 `guard`。复用不改变角色身份，不把魏延、姜维或诸葛亮改名当新配角。

## 检查与接入边界

12个实际PNG文件均已通过解码检查，并记录尺寸、文件大小和SHA256。最终9张场景宽1671或1672、高941（约16:9）；内建工具返回的原始尺寸保留，没有通过拉伸、硬裁切或画黑边伪造比例。每张生成结果已逐张查看，核对空白旗帜、通路、取水源、人物站位与现有风格。

马谡帐v1的小虎为站姿，已停用；v2改为伏卧并保留原景。为避免赠物后案上仍留木虎，另制作了 `after-gift` 变体。水路场景中的箭支属于已发生袭击的画面信息，场景切换必须晚于对应剧情；其他场景也不能凭背景生成新的军情或判定胜负。

原图已接入游戏，并检查了公共调色下的实际场景、马谡立绘、普通选项、结局页及两个桌面分辨率的开放对话界面。生成素材与整章体验仍待用户审阅。

## 预览

### 山下行军营与帐前

![山下行军营与帐前](../../source-art/visuals/runtime/scenes/jieting/jieting_camp-v1.png)

### 王平山下关道营

![王平山下关道营](../../source-art/visuals/runtime/scenes/jieting/jieting_wangping_camp-v1.png)

### 侧路与取水道

![侧路与取水道](../../source-art/visuals/runtime/scenes/jieting/jieting_water_path-v1.png)

### 山道与坡脚接应处

![山道与坡脚接应处](../../source-art/visuals/runtime/scenes/jieting/jieting_mountain_path-v1.png)

### 傍晚战后营火

![傍晚战后营火](../../source-art/visuals/runtime/scenes/jieting/jieting_evening_camp-v1.png)

### 马谡

![马谡](../../source-art/visuals/runtime/characters/masu/neutral-v1.png)

### 王平

![王平](../../source-art/visuals/runtime/characters/wangping/neutral-v1.png)

### 马谡山上议事帐

![马谡山上议事帐](../../source-art/visuals/runtime/scenes/jieting/jieting_masu_tent-v2.png)

### 诱敌前的山营

![诱敌前的山营](../../source-art/visuals/runtime/scenes/jieting/jieting_lure_camp-v1.png)

### 山下守路战场

![山下守路战场](../../source-art/visuals/runtime/scenes/jieting/jieting_defense_line-v1.png)

### 马谡议事帐：赠物后

![马谡议事帐：赠物后](../../source-art/visuals/runtime/scenes/jieting/jieting_masu_tent-after-gift-v1.png)

## 完整提示词与生成关系

各图独立调用内建生成工具。前8处场景与两位人物为文字生成；马谡帐v2以v1为编辑输入，只修木虎姿势；赠物后变体以v2为编辑输入，只移去木虎。原始生成文件保留在记录所列的Codex目录，项目引用均指向本地副本。

### 1 · jieting_camp · v1

目标：`runtime/scenes/jieting/jieting_camp-v1.png`
状态：generated-and-visually-inspected; pending user review
原始图：`C:/Users/zhousirui/.codex/generated_images/01a1783b-4b0d-7902-bc61-3d87bd7e56b8/exec-62a27283-adb7-4320-a85b-de80299cf356.png`

```text
Use case: historical-scene. Create one finished 16:9 landscape raster background for a first-person dialogue game set at Jieting, China, 228 CE, Three Kingdoms Shu army. Asset: jieting_camp. First-person standing eye height, 35mm natural perspective, at the foot of a dry mountain pass, outside a large weathered linen command tent on the right. A clearly walkable earthen path goes from lower center toward low military tents and the mountain trail in the mid-left distance. Foreground: one timber tent pole, coils of hemp rope and two water buckets near the edge; no object held by the viewer, no visible player body. Stacked tent poles, folded canvas and a few grain sacks show the army is still moving camp. Several small, non-identifiable soldiers work naturally far in the background, leaving the central and right-middle character-overlay area unoccupied. Visually plausible Han/Three Kingdoms camp, rough timber palisade and plain muted cloth standards with no writing. Clear near/mid/far depth, mountain ridges and sparse dry grass. Soft grey late-morning daylight, ink-dark tent shadows with readable texture, muted mountain blue-green and earth brown, aged linen whites, natural material hues, subtle film grain. Tactile live-action historical cinema, realistic old wood, coarse cloth, dirt and dark iron; not a painted illustration, not a fantasy render or glossy promotional game art. Palette consistent with a grounded Chinese military-camp film; daylight has no orange-blue night grade. Quiet tension before disagreement, no active battle. Keep bottom quarter visually calm for dialogue UI while still rendering real ground. No text, labels, subtitles, symbols, logo, watermark, UI, split image, panel, borders, white margins, modern objects, lantern festival, huge stone palace, exaggerated fog, mirror-wet ground, fire battlefield or close-up named character. One complete scene, full bleed, exact widescreen 16:9.
```

### 2 · jieting_masu_tent · v1

目标：`runtime/scenes/jieting/jieting_masu_tent-v1.png`
状态：superseded: tiger was standing; use v2 before gift or no-tiger plate after gift
原始图：`C:\Users\zhousirui\.codex\generated_images\01a1783b-4b0d-7902-bc61-3d87bd7e56b8\exec-242097be-8f5a-4fe8-a244-3cea0b86d138.png`

```text
Use case: historical-scene. One standalone 16:9 landscape scene background for a grounded first-person historical dialogue game, Jieting 228 CE, Shu military camp. Asset jieting_masu_tent. Camera at a standing soldier's eye height inside Ma Su's temporary command tent high on a dry mountain shoulder. Large rough linen tent, a low practical wooden campaign table on the left-middle side with a plain unlabeled cloth map held by a small ordinary crouching carved wooden tiger and one river stone, rolled bamboo documents, an ink dish; no legible writing anywhere. Right half is clear standing space for composited NPC character portraits, textured tent fabric behind it. Across the left rear opening is a believable downhill view of low valley tents, a winding road and layered blue-grey mountain ridges. Thick timber supports and taut ropes frame the near edges; old linen canopy makes deep but readable shadows. A single small bronze oil lamp near the map gives a restrained amber reflection even in daylight. Soft grey afternoon daylight from tent opening, natural earth and aged-linen colors, quiet dark iron weapons at far edge, no ornate gold. Tactile live-action Chinese historical cinema: real coarse fabric, worn wood, crisp but not oversharpened materials, subtle film grain, nuanced shadow transitions, low to moderate saturation, deep ink-dark near shadow and pale mountain distance. Entirely new composition, not a repeat of an outdoor camp. Keep foreground lower quarter unobtrusive for dialogue UI. No close-up people, no named characters in background, no throne, palace, fantasy temple, modern objects, text, lettering, captions, UI, logos, watermark, panel montage, white margin, crop, fake vignette or painterly brushwork. Full bleed landscape approximately exact 16:9.
```

### 3 · jieting_wangping_camp · v1

目标：`runtime/scenes/jieting/jieting_wangping_camp-v1.png`
状态：generated-and-visually-inspected; pending user review
原始图：`C:\Users\zhousirui\.codex\generated_images\01a1783b-4b0d-7902-bc61-3d87bd7e56b8\exec-cf070c48-6868-40a4-83cc-cf97f1f21f6d.png`

```text
One finished wide 16:9 raster environment for a first-person historical dialogue game, Jieting, Shu army, 228 CE. The mountain-foot defensive camp commanded by Wang Ping, daytime. Standing eye-height view from just inside a practical timber barrier toward a junction: the main dirt passage extends from lower left into the middle distance between low dry hills, and a narrower side track turns distinctly behind a rocky shoulder on the right. The two routes are spatially clear and both passable; this is a defendable road junction, not a walled city or vast fortress. Several staggered dark wooden shields and modest spear racks stand at the middle edges; rough linen tents and a plain grey-green standard at the left, water containers under an awning, small groups of distant anonymous Shu soldiers checking their posts. No major named person in scene; leave an empty right-center plane for a half-body speaking character to be composited. Distant mountain layers, sparse brown grass and worn dirt. Natural overcast afternoon grey light, realistic tactile wood, iron, linen, soil. Colored live-action Chinese historical-film image, restrained ink-dark shadows and muted blue-green mountains, distinct earth and fabric hues, nuanced contrast, fine film grain. No glossy 3D game render, fantasy building, giant stone gate, black-and-white wash, monochrome filter, excessive mist, rain, active battle, bodies, foreground hands/weapons, lettering, text, symbols, banners with writing, watermark, logo or UI. Bottom quarter calm ground for dialogue overlay. One independent full-bleed landscape 16:9.
```

### 4 · jieting_water_path · v1

目标：`runtime/scenes/jieting/jieting_water_path-v1.png`
状态：generated-and-visually-inspected; pending user review
原始图：`C:\Users\zhousirui\.codex\generated_images\01a1783b-4b0d-7902-bc61-3d87bd7e56b8\exec-02ceaf60-3852-445c-b783-4c34a87fbe95.png`

```text
One finished 16:9 landscape raster game background, Three Kingdoms period Jieting in 228 CE, Shu army. First-person standing eye height at the exposed water-carrying track below a dry mountain camp. A narrow worn dirt path curves from foreground beside two rough wooden water buckets and a carrying pole at the edge, down toward a small clear stream in the middle distance; the water source is visibly intact and flowing, not a dry well, dam or reservoir. On the opposite side low scrub and grey-brown rocky slopes provide sight lines where enemy cavalry could threaten the path, but show no identifiable enemy soldiers and no action that proves an attack already happened. Sparse grasses, a modest small plank crossing, a few willow branches near water, distant pale ridges. Include one unattended arrow with shaft embedded in a discarded bucket's rim at the far edge as a subtle clue to recent danger, not giant or centered; no blood, corpses, flames. Large empty central-right plane for an NPC overlay; low foreground uncluttered for text. Live-action Chinese historical cinema, finely textured old wood, soil, rope, rough linen, water with natural small reflections, soft grey afternoon daylight, muted earth brown and mountain blue-green, ink-dark near shadows, no global tint. Grounded and readable, delicate film grain, realistic depth, no illustration/painted or glossy CGI look, modern objects, text, captions, labels, symbols, UI, watermark, poster, split panels, borders. Full bleed exact widescreen 16:9.
```

### 5 · jieting_mountain_path · v1

目标：`runtime/scenes/jieting/jieting_mountain_path-v1.png`
状态：generated-and-visually-inspected; pending user review
原始图：`C:\Users\zhousirui\.codex\generated_images\01a1783b-4b0d-7902-bc61-3d87bd7e56b8\exec-5c1fcab2-4b83-4d64-8866-df35c693c5da.png`

```text
Create one finished 16:9 landscape raster background for a grounded Three Kingdoms dialogue game, Jieting, 228 CE. A first-person eye-level view from Wang Ping's reception position at the foot of the mountain, facing up a rough but passable sloping military trail. The trail comes down in an S-curve from a linen camp high on the right hillside into a broad firm patch of earth at the foreground left where retreating columns can form up, then opens into the valley road. This is an intact exit and reception route, not a broken bridge or cliff trap. Low timber barriers and a few stacked shields line only the edges, a tall plain grey-green military standard marks the rendezvous at the left-middle, a few anonymous soldiers wait small in the distant defensive line. No active charge, no bodies, no prominent named character. Readable terrain and routes, rocky dry slopes with sparse grasses, distant mountains seen through clear afternoon air with a little depth haze. Eye height, natural 35mm lens, foreground left timber post and middle distant trail establish depth; leave the right-center open enough for NPC portrait and lower quarter simple ground for dialogue. Colored live-action Chinese historical-film photography, soft grey late-afternoon light, muted earth and aged linen, cold mountain blue-green, ink-dark timber shadow, tactile old wood/iron/rope and natural soil, controlled fine film grain. Natural color with no monochrome or uniform tint, no painted style, no glossy 3D, no fantasy gate or great wall, modern objects, on-image text, signage, writing on flags, UI, watermark, panels or border. Full bleed one wide scene, 16:9.
```

### 6 · jieting_evening_camp · v1

目标：`runtime/scenes/jieting/jieting_evening_camp-v1.png`
状态：generated-and-visually-inspected; pending user review
原始图：`C:\Users\zhousirui\.codex\generated_images\01a1783b-4b0d-7902-bc61-3d87bd7e56b8\exec-9fc7772f-4f89-4b14-a725-05ba789facdb.png`

```text
Create one complete wide 16:9 landscape game background: the Shu army's camp at the foot of Jieting after a difficult day's battle, Three Kingdoms China 228 CE. First-person seated-low but normal conversational viewpoint beside a large clay water jar and a rough timber bench on the far left foreground; an earthen cooking hearth with a small real amber fire under an iron pot is in the left middle distance, not a bonfire spectacle. Several ordinary soldiers sit in a small informal group far left-midground with simple bowls, none large enough to be a named portrait. Tired quiet living camp, not a celebration parade, no corpses or blood. Right center remains unoccupied near a linen tent opening for a speaking portrait. The valley road remains visibly open across the background with one distant small returning column silhouette and plain standards. Mountain ridges turn blue-grey in dusk; the tent's aged linen, dark timber, rope, clay jars and soil retain material color. Match a tactile live-action Chinese historical film, ink-dark shadows, soft evening light, localized amber firelight on nearby objects only, small natural skin warmth, muted earth brown and mountain blue-green; fine film grain and readable nuanced shadow detail. No generic orange floodlight, no magical glow, no rain or mirror mud, no castle, no festival lanterns, no ultra-sharp CGI, no painting/ink wash, no foreground hands, no text, captions, watermarks, logos, UI, montage or border. Calm lower quarter for a dialogue box, one full-bleed widescreen 16:9.
```

### 7 · masu · v1

目标：`runtime/characters/masu/neutral-v1.png`
状态：generated-and-visually-inspected; pending user review
原始图：`C:\Users\zhousirui\.codex\generated_images\01a1783b-4b0d-7902-bc61-3d87bd7e56b8\exec-a355df6a-9030-4608-9764-4ed843dfa2e7.png`

```text
Create one photorealistic transparent character sprite for a Chinese historical dialogue game set at Jieting, 228 CE. Character: Ma Su, a fictional casting of the historical Shu officer, distinctly new face, about 38-42 years old, lean upright scholarly military officer. Long oval Chinese face, high forehead, alert narrow eyes, neatly kept short mustache and a restrained narrow goatee, black hair in a topknot wrapped with a modest dark cloth military headpiece. He looks directly at the player at conversational eye height with composed authority and a slight impatient concentration, not a villain sneer. Medium shot from full head with margin to mid-thigh, both shoulders and complete natural hands visible; slight three-quarter body angle, neutral standing stance, one hand resting against a rolled blank cloth military map at waist. Wears practical muted dark blue-green linen under a dark weathered lamellar chest armor and simple leather belt, a restrained slate-brown outer garment with cloth sleeves, no ornate gold, no giant shoulder spikes or fantasy crown. Natural human skin color and texture, individual beard hairs, tactile coarse linen, dark iron and leather, fine historical-cinema realism rather than waxy beauty portrait or hyper-sharp CGI. Soft grey daylight from upper left, subtle natural warm skin, readable deep shadows, no strong colored rim light. Match the functional three-quarter-length military character-sprite proportions of a realistic Three Kingdoms game. Truly transparent alpha background, no opaque black/grey backdrop, no checkerboard rendered into pixels, no scenery, no ground shadow, no floating props, no text/name/caption/UI/watermark/border. Exactly one complete person, hands anatomically correct, head and hands not cropped. Portrait 2:3 canvas, subject occupies about 85 percent height.
```

### 8 · wangping · v1

目标：`runtime/characters/wangping/neutral-v1.png`
状态：generated-and-visually-inspected; pending user review
原始图：`C:\Users\zhousirui\.codex\generated_images\01a1783b-4b0d-7902-bc61-3d87bd7e56b8\exec-afcf631b-4676-4cdf-8358-ce6ae9aa72bb.png`

```text
Create one photorealistic transparent character sprite for a Chinese historical dialogue game set at Jieting, 228 CE. Character: Wang Ping, a fictional casting of the historical Shu officer, distinctly new face, about 45-50 years old, sturdy experienced practical field commander. Broad but not obese build, squarer sun-weathered Chinese face, straight thick brows, steady attentive dark eyes, short uneven black beard touched lightly by grey at chin, no similarity to a glamorous young hero. Modest rounded dark iron lamellar helmet with short cheek protection leaving full face visible; no crest, antlers, horns or huge plumes. Muted ash-grey and olive-brown rough cloth under worn dark iron lamellar armor, simple leather bindings and belt, a short dark earth-brown cloak gathered behind one shoulder; no bright red costume, no ornate gold or fantasy engraving. Medium standing portrait from full helmet top with margin to mid-thigh, shoulders and complete relaxed hands visible; slight three-quarter angle toward camera, eye-level direct gaze, a calm concerned expression as though listening to a soldier's report. Both hands relaxed, one thumb resting on belt, no held weapon and no commanding action that implies an event. Live-action historical Chinese cinema, natural warm skin, fine pores and beard, coarse linen and dark metal materials, soft directional grey daylight from upper left, readable deep shadows, nuanced moderate contrast, no glam studio shine or waxy CGI. Truly transparent alpha background, no opaque black/grey backdrop, no rendered checkerboard, scenery, ground shadow, text, caption, watermark, UI, border, montage. One anatomically believable person, unclipped head and hands. Portrait 2:3 canvas, subject about 85 percent height, suitable to composite over earth-toned camps.
```

### 9 · jieting_masu_tent · v2

目标：`runtime/scenes/jieting/jieting_masu_tent-v2.png`
状态：generated-and-visually-inspected; pending user review
原始图：`C:\Users\zhousirui\.codex\generated_images\01a1783b-4b0d-7902-bc61-3d87bd7e56b8\exec-b0518dcd-40b0-42f3-9425-0650f7629dc3.png`

```text
Edit the supplied scene only at the small wooden tiger carving on the left side of the table. Change that standing tiger into a palm-sized plain brown wooden TIGER LYING LOW ON ITS BELLY, forepaws stretched forward together, hind legs folded under the body, tail curled close to its side, back smooth and worn. It is an ordinary humble map paperweight, not a seal, gold ornament, lion or jade token. Keep its approximate location and scale; it still pins the corner of the map. Preserve all other elements of this exact command-tent image: the entire 16:9 composition, tent and ropes, mountain view, table, map, small lamp, stone, wood and cloth texture, color and daylight. No new writing or objects. Only the tiger's pose is changed, full-bleed same scene.
```

### 10 · jieting_lure_camp · v1

目标：`runtime/scenes/jieting/jieting_lure_camp-v1.png`
状态：generated-and-visually-inspected; pending user review
原始图：`C:\Users\zhousirui\.codex\generated_images\01a1783b-4b0d-7902-bc61-3d87bd7e56b8\exec-3820fd6b-2559-4d3b-9e6a-b8efc4786027.png`

```text
One finished widescreen 16:9 landscape raster background for Jieting 228 CE, a realistic Three Kingdoms historical dialogue game. A mountain-top Shu camp being prepared for a feigned withdrawal, seen from first-person standing eye level at the edge of the tent rows. Two lowered plain grey-green cloth standards lie neatly near a timber post, a couple of bundled tent poles and plain sacks are intentionally left along the upper dirt path, several tents have open flaps while the important rear tents remain occupied only as distant anonymous silhouettes, so this is a staged withdrawal, not a magically vanished or destroyed army. The main mountain trail descends clearly toward a small visible reception camp and open valley road far below to the left. No enemy soldiers shown yet; this background does not assert that the enemy has taken the bait. Dramatic but believable late afternoon, dry earth, rough linen tents, tactile rope and old wood, sparse grasses and layered pale mountains. Central right area largely empty for an NPC character overlay, bottom quarter unobtrusive ground for dialogue. Live-action Chinese historical-cinema realism, soft directional grey daylight, muted earth/linen/blue-green material colors, deep readable shadow, tiny worn dark-red cloth detail only if natural, fine film grain. Not a watercolor, ink drawing, illustration, glossy 3D, fantasy fortress or huge palace. No battle fire, corpses, gore, giant torn flags, modern objects, text or letters, writing on banners, map labels, UI, watermark, poster or collage. One independent full-bleed 16:9 scene.
```

### 11 · jieting_defense_line · v1

目标：`runtime/scenes/jieting/jieting_defense_line-v1.png`
状态：generated-and-visually-inspected; pending user review
原始图：`C:\Users\zhousirui\.codex\generated_images\01a1783b-4b0d-7902-bc61-3d87bd7e56b8\exec-4319fc96-ee87-458e-9d70-2f62def1af4f.png`

```text
One finished 16:9 landscape raster environment for a first-person Chinese historical game, Jieting, Shu army 228 CE. View from safely behind a field defense on the open valley road, looking outward through a gap between dark timber shield barricades and waist-high rough stakes. A few Shu crossbowmen and spearmen appear only in the middle distance on the extreme left/right flanks, naturally varied and non-identifiable; no large foreground character blocking room for a portrait. The crucial pass road remains open into layered dry grey mountains; a curved side track appears behind the right outcrop. Light dust hangs low in the distant road, a few scattered arrows and a dented shield at the edge show battle has reached this position, but no bodies, blood, ongoing melee, named character death, enemy banner capture or definite victory/defeat. A plain grey-green military standard marks the near defensive position. Coherent ground-level 35mm cinematic perspective, distinct near barriers, middle formation and far ridges, clear safe path for returning units. Late afternoon grey light breaking softly through cloud, natural colors of earth, aged linen, worn timber, dark iron and subdued skin. Tactile live-action historical cinema, ink-dark shadows, fine grain, nuanced contrast, no monochrome, orange-blue blanket grade, painted illustration, glossy promotional CGI, modern weapon, high fortress walls, text, captions, readable letters, logo, UI, watermark, montage or borders. Keep central area and lower quarter relatively calm for dialogue, one full-bleed wide 16:9 background.
```

### 12 · jieting_masu_tent_after_gift · v1

目标：`runtime/scenes/jieting/jieting_masu_tent-after-gift-v1.png`
状态：generated-and-visually-inspected; pending user review
原始图：`C:\Users\zhousirui\.codex\generated_images\01a1783b-4b0d-7902-bc61-3d87bd7e56b8\exec-c863ac8e-b0d6-48be-aae6-359cd18a4899.png`

```text
Precise object removal edit. In this exact historical command-tent scene, remove only the small crouching brown wooden tiger paperweight from the left portion of the table because it has just been given away. Where the tiger was, reveal the existing ordinary wooden tabletop and edge of the unlabelled map naturally; do not replace it with another object. Preserve the stone paperweight on the other side, map position, table, lamp, bamboo rolls, all tent structure, mountains, camp, perspective, framing, original colors and soft daylight. No other changes, no new people or text. Full bleed, same landscape aspect ratio.
```
