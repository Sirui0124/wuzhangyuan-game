from pathlib import Path
import json,subprocess,sys
R=Path(__file__).resolve().parent
p=R/'A24/review.json';v=json.loads(p.read_text('utf-8'));v.update(motion_review='selected_with_documented_scope',selected_for_work_edit=True,method='2fps entire source, final cut contact frames',notes=['Only empty camp, rain/drips and wisps; no added people/flames seen','Opening composition preserves principal tent peaks, timber, wheel and box from F21 selected end; slight subsequent framing drift, not pixel-locked for full clip','Select0—4seconds; native sound machine-screened no speech and low music score'],user_review='待review');p.write_text(json.dumps(v,ensure_ascii=False,indent=2),'utf-8')
p=R/'final_qa.py';s=p.read_text('utf-8').replace("new_video_requests=9,discarded_video=['A21','A22']","new_video_requests=10,discarded_video=['A21','A22','A23']");p.write_text(s,'utf-8')
p=R/'修订记录-v2.9.md';s=p.read_text('utf-8').replace('27.92—32.92','27.92—31.92').replace('32.92—35.42','31.92—34.42').replace('35.42—39.42','34.42—39.42')
start=s.index('共9个新视频请求：');end=s.index('\n\n',start)
s=s[:start]+'共10个新视频请求：H21、H22、H23、F21、S21、F22、A21、A22、A23、A24。A21绕场并新增余火；A22新增人物与近景；A23新增火焰，三条均停用。A24改为只描述雨水、湿木架和滴水的4秒环境镜头，选用0—4秒。均有各自任务ID，不存在未知结果自动重投。最后5秒选用v2.8/Y01原片3—8秒的既有灾后大全景，接在湿炭细节后，不要求它与前面同机位画面形成连续运镜。'+s[end:]
s=s.replace('以原有干净火营环境音替换。','以原有干净火营环境音替换。').replace('不表示检查已完成。','不表示检查已完成。最终检查记录随成片一同交付。')
p.write_text(s,'utf-8')
p=R/'导演执行稿-v2.9.md';s=p.read_text('utf-8');s=s.replace('## 同轮后续更正（替代下表营地段的原计划时长）','## 最终执行\n\n最终使用A24的4秒雨后空营，27.92—31.92秒；湿炭31.92—34.42秒；Y01原片3—8秒作最后5秒大全景。A21、A22、A23均停用。下方保留方案演变，准确成片以修订记录和edit-timeline.json为准。\n\n## 同轮后续更正（历史执行计划）');p.write_text(s,'utf-8')
subprocess.run([sys.executable,str(R/'record_reviews.py')],check=True)
print('Final selected version and source records saved')
