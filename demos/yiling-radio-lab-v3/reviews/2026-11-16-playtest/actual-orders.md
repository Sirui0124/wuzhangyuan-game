# 本版逐局实际军令与结局

2026-11-16。由隔离浏览器存档及完整交互记录汇总。这里列确认执行的军令；未传令的错误输入另见每局 transcript.json 和各模型报告。用时为实际结算时段数。

## gpt6-sol-first

种子 731115；8时段；4/4将领、3/3批次；减员0；余粮0斤；API请求3次。

- 第1时段：先分三路：派900人接傅肜、700人接冯习和张南、500人接沙摩柯。都把将领和部众接齐后回来；各路正常配粮、正常推进，余下400人留营待命。
- 第2时段：把营中待命的400人增派给冯习、张南这一路，专门接手新增散兵；原来的接应队继续收前后队，正常配粮、正常推进。
- 第6时段：沙摩柯一路现有500人不变，从本时段起口粮少给两成，正常推进，继续接齐西沟部众并护送回营。

[完整交互与接口响应](evidence/gpt6-sol-first/transcript.json) · [最终状态](evidence/gpt6-sol-first/final-state.json) · [结局截图](evidence/gpt6-sol-first/final.png)

## gpt6-sol-other

种子 731117；6时段；4/4将领、3/3批次；减员0；余粮10斤；API请求3次。

- 第1时段：先分三路：派900人接傅肜、700人接冯习和张南、500人接沙摩柯。都把将领和部众接齐后回来；各路正常配粮、正常推进，余下400人留营待命。
- 第2时段：把营中待命的400人增派给沙摩柯一路，接手新发现的饥饿部众；原队继续搜两沟、守林口，正常配粮和推进，全部接齐后回来。
- 第5时段：营粮不够下一时段正常补给。冯习张南现有700人、沙摩柯现有900人都暂时少给两成口粮，仍正常推进、继续把各自部众接齐，不抽兵。

[完整交互与接口响应](evidence/gpt6-sol-other/transcript.json) · [最终状态](evidence/gpt6-sol-other/final-state.json) · [结局截图](evidence/gpt6-sol-other/final.png)

## gpt6-sol-ration80

种子 731115；8时段；4/4将领、3/3批次；减员25；余粮570斤；API请求7次。

- 第1时段：派900人接傅肜，接齐部众后回来，口粮少给两成，正常推进。
- 第1时段：派700人接冯习、张南及部众，接齐回来，口粮少给两成，正常推进。
- 第1时段：派500人接沙摩柯，搜齐东、西两沟部众后回来，口粮少给两成，正常推进。
- 第2时段：给冯习张南一路增派400人，接手新增散兵；继续接齐部众，仍少给两成粮，正常推进。

[完整交互与接口响应](evidence/gpt6-sol-ration80/transcript.json) · [最终状态](evidence/gpt6-sol-ration80/final-state.json) · [结局截图](evidence/gpt6-sol-ration80/final.png)

## gpt6-sol-repeat

种子 731115；8时段；4/4将领、3/3批次；减员0；余粮0斤；API请求3次。

- 第1时段：先分三路：派900人接傅肜、700人接冯习和张南、500人接沙摩柯。都把将领和部众接齐后回来；各路正常配粮、正常推进，余下400人留营待命。
- 第2时段：把营中待命的400人增派给冯习、张南这一路，专门接手新增散兵；原来的接应队继续收前后队，正常配粮、正常推进。
- 第6时段：沙摩柯一路现有500人不变，从本时段起口粮少给两成，正常推进，继续接齐西沟部众并护送回营。

[完整交互与接口响应](evidence/gpt6-sol-repeat/transcript.json) · [最终状态](evidence/gpt6-sol-repeat/final-state.json) · [结局截图](evidence/gpt6-sol-repeat/final.png)

## sol-extra-ration

种子 731115；6时段；4/4将领、3/3批次；减员0；余粮0斤；API请求5次。

- 第1时段：傅肜派八百人，旧营派八百人，沙摩柯派七百人，留两百人在营中待命。三路都接齐将军和部众再回营，口粮都比正常多给两成，按正常的一百二十个百分点配发，正常推进。
- 第2时段：给旧营新增的散兵发400斤救济粮。冯习、张南仍用现有800人，口粮保持多给20%，正常推进，接齐全部人后回来。
- 第4时段：接受缺粮后果。冯习张南现有800人、沙摩柯现有700人，都保持加粮20%和正常推进，继续接齐全部人回来，不增兵不改粮。

[完整交互与接口响应](evidence/sol-extra-ration/transcript.json) · [最终状态](evidence/sol-extra-ration/final-state.json) · [结局截图](evidence/sol-extra-ration/final.png)

## sol-first

种子 731115；5时段；4/4将领、3/3批次；减员0；余粮400斤；API请求2次。

- 第1时段：傅肜派八百人，旧营派八百人，沙摩柯派七百人，留两百人在营中待命。三路都接齐将军和部众再回营，正常配粮，正常推进。
- 第2时段：用四百斤救济粮安置新增散兵，原有八百名接应兵继续正常配粮、正常接应，把所有人接齐回来。

[完整交互与接口响应](evidence/sol-first/transcript.json) · [最终状态](evidence/sol-first/final-state.json) · [结局截图](evidence/sol-first/final.png)

## sol-other

种子 731116；6时段；4/4将领、3/3批次；减员25；余粮12斤；API请求2次。

- 第1时段：傅肜派八百人，旧营派八百人，沙摩柯派七百人，留两百人在营中待命。三路都接齐将军和部众再回营，正常配粮，正常推进。
- 第2时段：接受新增任务造成的效率下降和额外风险，傅肜现有八百人照原令继续，不增兵，不发救济粮，不休整，仍正常配粮正常接应，接齐全部人再回营。

[完整交互与接口响应](evidence/sol-other/transcript.json) · [最终状态](evidence/sol-other/final-state.json) · [结局截图](evidence/sol-other/final.png)

## sol-repeat

种子 731115；7时段；4/4将领、3/3批次；减员0；余粮0斤；API请求2次。

- 第1时段：傅肜派八百人，旧营派八百人，沙摩柯派七百人，留两百人在营中待命。三路都接齐将军和部众再回营，正常配粮，正常推进。
- 第2时段：接受新增任务造成的效率下降，现有八百人照原令继续，不增兵，不发救济粮，不休整，仍正常配粮正常接应，接齐全部人再回营。

[完整交互与接口响应](evidence/sol-repeat/transcript.json) · [最终状态](evidence/sol-repeat/final-state.json) · [结局截图](evidence/sol-repeat/final.png)

## sol-rest

种子 731115；6时段；4/4将领、3/3批次；减员0；余粮400斤；API请求2次。

- 第1时段：傅肜派八百人，旧营派八百人，沙摩柯派七百人，留两百人在营中待命。三路都接齐将军和部众再回营，正常配粮，正常推进。
- 第2时段：冯习张南用现有八百人先休整并重整一时段，安置好新增散兵，不增兵不发救济粮。下一时段自动恢复正常推进，仍正常配粮，接齐全部人再回来。

[完整交互与接口响应](evidence/sol-rest/transcript.json) · [最终状态](evidence/sol-rest/final-state.json) · [结局截图](evidence/sol-rest/final.png)

## sol-rush

种子 731115；5时段；4/4将领、3/3批次；减员50；余粮424斤；API请求2次。

- 第1时段：傅肜派八百人，旧营派八百人，沙摩柯派七百人，留两百人在营中待命。三路都接齐将军和部众再回营，正常配粮，全部赶路。
- 第2时段：给旧营新增的散兵发400斤救济粮。冯习、张南仍用现有800人，口粮保持正常，继续赶路，接齐全部人后回来。

[完整交互与接口响应](evidence/sol-rush/transcript.json) · [最终状态](evidence/sol-rush/final-state.json) · [结局截图](evidence/sol-rush/final.png)

## terra-first

种子 731115；5时段；4/4将领、3/3批次；减员0；余粮0斤；API请求2次。

- 第1时段：派800人接应傅肜，其中200人先守隘口；派900人去旧营迁旗清路，留200人维持岔口；派800人去山林搜寻沙摩柯和西沟伤兵，留200人接应出口。三路正常配粮、正常推进。
- 第2时段：拨400斤救济粮安置旧营散兵，其余照原令执行。

[完整交互与接口响应](evidence/terra-first/transcript.json) · [最终状态](evidence/terra-first/final-state.json) · [结局截图](evidence/terra-first/final.png)

## terra-other

种子 731116；5时段；4/4将领、3/3批次；减员0；余粮0斤；API请求2次。

- 第1时段：派800人接应傅肜，900人接应冯习张南，800人接应沙摩柯，三路正常配粮正常推进，接齐后回来。
- 第2时段：傅肜这路休整并重整一时段，处理侧翼追兵威胁，之后恢复接应。

[完整交互与接口响应](evidence/terra-other/transcript.json) · [最终状态](evidence/terra-other/final-state.json) · [结局截图](evidence/terra-other/final.png)

## terra-recover

种子 731115；8时段；3/4将领、2/3批次；减员100；余粮0斤；API请求4次。

- 第1时段：派800人接应傅肜，900人接应冯习张南，800人接应沙摩柯，三路正常配粮，全都加紧赶路，接齐后回来。
- 第2时段：拨400斤救济粮安置旧营散兵，其余照原令执行。
- 第3时段：三路人马疲劳过高，全部休整一时段，之后恢复正常推进，接齐后回来。
- 第4时段：三路都少给两成口粮，继续正常接应。

[完整交互与接口响应](evidence/terra-recover/transcript.json) · [最终状态](evidence/terra-recover/final-state.json) · [结局截图](evidence/terra-recover/final.png)

## terra-repeat

种子 731115；8时段；3/4将领、2/3批次；减员0；余粮0斤；API请求3次。

- 第1时段：派800人接应傅肜，900人接应冯习张南，800人接应沙摩柯，三路正常配粮正常推进，接齐后回来。
- 第2时段：接受照旧，按原令继续。
- 第5时段：照旧，接受缺粮后果。

[完整交互与接口响应](evidence/terra-repeat/transcript.json) · [最终状态](evidence/terra-repeat/final-state.json) · [结局截图](evidence/terra-repeat/final.png)

## terra-rush

种子 731115；5时段；4/4将领、3/3批次；减员50；余粮412斤；API请求2次。

- 第1时段：派800人接应傅肜，900人接应冯习张南，800人接应沙摩柯，三路正常配粮，全都加紧赶路，接齐后回来。
- 第2时段：拨400斤救济粮安置旧营散兵，其余照原令执行。

[完整交互与接口响应](evidence/terra-rush/transcript.json) · [最终状态](evidence/terra-rush/final-state.json) · [结局截图](evidence/terra-rush/final.png)
