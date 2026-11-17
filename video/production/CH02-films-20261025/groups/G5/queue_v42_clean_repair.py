from pathlib import Path
import json,copy,hashlib
OUT=Path(__file__).parent
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8')
id='V42-R2-clean'
assert not (OUT/'tasks'/f'{id}.json').exists(),'Known/unknown task may never be submitted again'
ref=read(OUT/'references/old-scroll-oblique-back/dispatch-guard.json');assert ref['state']=='succeeded'
assert hashlib.sha256(Path(ref['path']).read_bytes()).hexdigest()==ref['sha256']
prompt='A single continuous fifteen-second historical live-action close shot. Only the linen-sleeved hands, rough wooden desk and aged paper from the first frame. The camera stays very low and oblique, seeing the plain reverse of the paper held toward an unseen reader; the written side always faces away from the camera. From 0 to 5 seconds, the hands gently unroll the remaining curled ends and settle the sheet. From 5 to 12 seconds, the hands hold it steady while the camera glides slightly along its worn lower edge and backlit fibres. From 12 to 15 seconds, the right hand lifts one near corner, turns one sheet away toward the reader, then settles beside the paper. Preserve two normal hands and physical contact. The reverse remains plain fibrous paper. Only paper rustle, cloth and quiet room ambience, no voices or music.'
body=dict(model='MiniMax-H3',duration=15,resolution='768P',ratio='16:9',content=[dict(type='text',text=prompt),dict(type='image_url',image_url={'local_path':ref['path']},role='first_frame')])
save(OUT/'requests'/f'{id}.local.json',body)
plan=read(OUT/'plan.json')['clips'];parents=[c for c in plan if c['slot']=='V42'];c=copy.deepcopy(parents[0]);c.update(id=id,parentId='V42',duration=15,nodes=[n for x in parents for n in x['nodes']],sourceLines=[n for x in parents for n in x['sourceLines']],generatedSpokenLines=[],postVoiceLines=[],post=[],action=prompt,status='necessary-picture-repair',visualRepairReason='当前V42三个源片有清晰伪文字；局部抹字/大块柔焦试修不可用。以低斜角纸背取景从几何上排除可读正面，一条15秒验证，未扩展批量。',references=[dict(id='old-scroll-oblique-back',path=ref['path'],use='本镜唯一首帧，锁定手、灰褐麻袖、旧木案、纸背与低斜角柔光')]);c.pop('holdPendingOriginalReview',None)
rp=read(OUT/'repair-plan.json');rp['clips']=[x for x in rp['clips'] if x['id']!=id]+[c];save(OUT/'repair-plan.json',rp)
q=read(OUT/'queue-plan.json');q['clips']=[x for x in q['clips'] if x['id']!=id]+[c];save(OUT/'queue-plan.json',q)
save(OUT/'post-gate.json',dict(enabled=True,reason='User authorized necessary visual repairs; only one V42-R2-clean pilot queued, all previous IDs held',allowedNewIds=[id],unknownNeverRepost='V32A-01'))
rows=['尺寸：16:9','模型：MiniMax-H3（本轮OpenAI Next实际使用）','声音：有声音','时长：15秒','','## 参考图（实际上传顺序）','',f'1. 图片1｜{ref["path"]}｜本镜唯一首帧，负责手、麻袖、旧木案、纸背构图与日光。','','## 逐句映射（制作记录，不发送API）','']
for x in c['sourceLines']:rows.append(f'- {x["node"]}｜{x["speaker"]}｜{x["voiceAndLipOwner"]}｜{x["text"]}')
rows+=['','## 视频生成 Prompt','', '分镜1｜0-5秒','参考图关系：图片1锁定同一木案、灰褐麻袖双手、低斜角与向读者倾斜的纸背；保持墨字面朝向画外读者。','画面动作与摄影：双手舒展开仍卷起的两端，纸落稳，保留真实接触。低斜角不拍玩家脸。','对白：无；全部心声继续用已有中央WAV后期加入。','','分镜2｜5-12秒','参考图关系：图片1继续锁定同一手、纸卷、空间及左侧柔和天光，机位只沿纸的下缘轻移。','画面动作与摄影：双手持卷稳定，摄影关注纸背透光纤维与旧纸边缘，字面始终背向摄影机，不暴露可读原生伪字。','对白：无；已有玩家心声为画外，画面中无NPC。','','分镜3｜12-15秒','参考图关系：图片1保持手和卷的方向，近处右角可被右手提起，桌面不换场。','画面动作与摄影：右手提一角，向读者方向翻过一页，停稳；保留接触、翻页和放手的完整动作。','对白：无新增对白。','','API实际镜头文本：',prompt,'','连续性约束：仅E1/E3各自裁处后尾声；不新增史料数值或人口事实，不新增玩家脸、旁白、重生特效。只有当前付费动作一条验证；旧原片/未知提交不覆盖或重投。准确栏目与原句仅按冻结源接入，不能靠备注掩盖任何实际可读伪字。','','拍摄手法参考：《1917》仅取根据实际动作耗时安排机位与注意力转移的拍法，应用本条三段连续动作；沿用已核验ASC摄影访谈 https://theasc.com/article/lives-under-siege-the-goldfinch-and-1917/ ，不复制其时代和人物。','','声音要求：全片无BGM、无背景音乐、无配乐。禁止新增人声，只保留与画面同步的纸张、衣料摩擦和安静帐内环境声；冻结源心声由已有WAV后期加入，不生成任何TTS。']
(OUT/'prompts'/f'{id}.md').write_text('\n'.join(rows)+'\n',encoding='utf-8')
print('One fifteen-second visual repair queued; no repeated original or unknown submission')
