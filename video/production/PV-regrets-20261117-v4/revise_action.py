from pathlib import Path
import json
R=Path(__file__).resolve().parent
p=R/'production-plan.json';plan=json.loads(p.read_text('utf-8'))
old=plan['units'][1]
u={**old,'id':'C01K','name':'马谡凝望丞相后叩首','duration':7,'edit_duration':7}
u['prompt']='''7秒连续单镜头，16:9真人历史电影实拍质感。参考图E07为唯一人物和构图依据。保持原中景、相机高度、角度和画幅，不推近、不切镜、不水平翻转。原有四人保持身份和站位：马谡居中双膝跪地、双手缚在背后；刀斧手在左前景，低位刑刀保持原斜线；两名持矛卫兵在后景原位。右前景为空地。诸葛亮在画面右上方画外、数步外稍高监斩台，不进入此镜。
0至2秒：马谡保持原跪姿，脸与眼睛安静望向画面右上方的诸葛亮。眼神留恋、郑重，嘴唇闭合，轻轻呼吸，不哭喊、不摇头。
2至3秒：马谡收回视线，缓缓低头，颈部自然弯曲，身体开始从髋部前倾。膝盖始终贴地，不移动膝盖位置。
3至5.5秒：完成一次缓慢而庄重的叩首。臀部略离脚跟，躯干向前下方俯伏，额头轻轻触及双膝前方、刀刃后侧的空地。双手始终被缚在背后，不伸出、不解绳、不用手撑地。重心沿身体前倾自然移动，衣料受力与躯干姿态相符。头和身体保持在刀刃后方的空间，不碰刀、不穿过刀刃、不突然变成趴倒。
5.5至7秒：额头贴地，保持俯伏一拍，不抬头，不重复磕头。结尾用于接诸葛亮反打举扇掩面。
刀斧手始终等待，不动刀、不挥刀、不改变刀的位置；卫兵不移动。保留原演员面孔、头发、粗布衣、绳索、低位刀、营帐、栅栏与原夕照光向。无雨，自然肤色，皮肤与材质有真实细节，避免游戏CG、蜡像和塑料质感。相机固定，动作符合人体关节、接触和重力。
唯一允许发声的原句：无。所有人物全程不说话、不做口型；禁止读出角色名、时间、数字或导演说明。声音只允许自然呼吸、衣料摩擦、膝下细土轻响和极弱营地风。额头触地仅极轻接触声，不夸张撞击。完全无对白、旁白、哭喊、歌唱、音乐、BGM或低音铺底。画面无字幕、文字、水印、制作信息。'''
plan['units'][1]=u
plan.update(authorization='2026-11-17用户要求重做假柴火；后续明确取消对白，改为马谡望向丞相后叩首。',target_duration=66.75,generation_status='blocked_missing_configured_credential',new_remote_tasks=0)
p.write_text(json.dumps(plan,ensure_ascii=False,indent=2),'utf-8')
d=R/u['id'];d.mkdir(exist_ok=True)
(d/'prompt.txt').write_text(u['prompt'],'utf-8')
(d/'生成说明.md').write_text('# 马谡凝望丞相后叩首｜v4\n\n状态：待review；尚未提交生成。\n\n'+u['prompt']+'\n\n参考图：\n'+u['reference_paths'][0],'utf-8')
for id in ['A01R','C01D']:
 s=R/id/'state.json';v=json.loads(s.read_text('utf-8'))
 v.update(status='blocked_missing_credential' if id=='A01R' else 'superseded_before_submission',remote_submission_occurred=False,note='核对api-run.log及入口脚本：配置指定的DPAPI文件缺失，脚本在第69行、本地凭据检查处终止，未到POST。C01D对白被用户取消，禁止使用。')
 s.write_text(json.dumps(v,ensure_ascii=False,indent=2),'utf-8')
(R/'修订说明.md').write_text('''# v4 修订制作记录

2026-11-17；待生成、待用户review，尚无v4成片。

用户先指出谷地柴火假，随后要求延长马谡镜头；最后明确取消“丞相，请您保重”对白，改为望向丞相后叩首。以最后指示为准。

雨中谷地A01R重拍8秒，去除规整柴火堆和贴镜头的粗大圆木，以湿泥、散落烧损营寨支柱、局部遮雨残火表现雨压火。文字生成，避免沿用被否定木堆的形态。

马谡C01K重拍7秒，沿用E07原构图，0—2秒望向右上方丞相；2—3秒低头；3—5.5秒双手背缚、缓缓俯身叩首；5.5—7秒额头触地停留。左前刀斧手、低刀和后方两卫兵原位不动，切原诸葛亮举扇反打。无对白、无BGM，不用定格或倒放补时长。

剪辑计划：替换v3的1.25—9.25秒谷地镜头；将26—27.5秒马谡镜头替换为7秒新镜头，其后顺延5.5秒，预计66.75秒。原马谡35.5秒回看镜头需在新片落点41秒检查；若与叩首后状态不连续，不能沿用旧昂首回看，应另择实际生成叩首末段或取消该回看并相应缩短，不用定格掩盖。

当前阻塞：H3入口配置指定的本机加密凭据文件不存在。A01R与已取消C01D均在读取凭据前本地报错，未发送POST、未生成远端任务。旧pipeline把没有任务号统称unknown_outcome，经日志与入口代码核实，现已纠正。C01D已标废弃，不再提交。

待恢复本机既有H3凭据后：提交A01R及C01K各一次；核对木材、雨火关系、叩首接触、刀具空间和人物连续性；仅将合格素材剪入新成片，检查声音及完整解码。旧v3保持原样。
''','utf-8')
print('Action prompt saved; canceled dialogue; both prior attempts confirmed before POST.')
