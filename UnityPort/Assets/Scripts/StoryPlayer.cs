using System;
using System.IO;
using System.Linq;
using UnityEngine;
namespace Wuzhangyuan {
 public sealed class StoryPlayer : MonoBehaviour {
  StorySession session; StoryData data; GUIStyle text,button,title; Vector2 scroll; string notice=""; bool showClues,confirmRestart,protectAuto;
  string SavePath(string name){return Path.Combine(Application.persistentDataPath,"unity-ch1-slice-"+name+".json");}
  [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)] static void StartPlayer(){if(FindFirstObjectByType<StoryPlayer>()==null)new GameObject("StoryPlayer").AddComponent<StoryPlayer>();}
  void Awake(){
   data=JsonUtility.FromJson<StoryData>(Resources.Load<TextAsset>("chapter-one-slice").text);session=new StorySession(data);
   if(File.Exists(SavePath("auto")))try{session=Read("auto");}catch(Exception e){protectAuto=true;notice=e.Message;}
  }
  StorySession Read(string slot){return StorySession.Restore(data,JsonUtility.FromJson<SaveData>(File.ReadAllText(SavePath(slot))));}
  void Save(string slot){
   try{if(slot=="auto"&&protectAuto)return;Directory.CreateDirectory(Application.persistentDataPath);var path=SavePath(slot);var temp=path+".tmp";File.WriteAllText(temp,JsonUtility.ToJson(session.Snapshot(),true));
    if(File.Exists(path))File.Replace(temp,path,path+".bak");else File.Move(temp,path);
    if(slot!="auto")notice="进度已保存。";
   }catch(Exception e){notice="保存失败："+e.Message;}
  }
  void Load(){try{var candidate=Read("manual");session=candidate;notice="进度已恢复。";Save("auto");}catch(Exception e){notice="读取失败，当前进度保留："+e.Message;}}
  void Act(string command){if(session.Apply(command)){notice="";Save("auto");}}
  void Styles(){if(text!=null)return;var font=Font.CreateDynamicFontFromOSFont(new[]{"Microsoft YaHei","SimHei","Arial"},24);
   text=new GUIStyle(GUI.skin.label){font=font,fontSize=24,wordWrap=true};text.normal.textColor=new Color(.12f,.14f,.13f);
   title=new GUIStyle(text){fontSize=29,fontStyle=FontStyle.Bold};button=new GUIStyle(GUI.skin.button){font=font,fontSize=22,wordWrap=true,padding=new RectOffset(16,16,12,12)};
  }
  bool Button(string label){return GUILayout.Button(label,button,GUILayout.MinHeight(48));}
  void OnGUI(){
   if(session==null)return;Styles();GUI.matrix=Matrix4x4.TRS(Vector3.zero,Quaternion.identity,new Vector3(Screen.width/1280f,Screen.height/720f,1));
   var background=Resources.Load<Texture2D>("Backgrounds/"+session.SceneId);if(background!=null)GUI.DrawTexture(new Rect(0,0,1280,720),background,ScaleMode.ScaleAndCrop);
   Panel(new Rect(22,18,1236,84));GUILayout.BeginArea(new Rect(38,30,1204,60));GUILayout.BeginHorizontal();GUILayout.Label("五丈原 · 第六夜",title,GUILayout.Width(470));
   if(Button("线索"))showClues=!showClues;if(Button("保存"))Save("manual");if(Button("读档"))Load();if(Button("重玩"))confirmRestart=true;GUILayout.EndHorizontal();GUILayout.EndArea();
   Panel(new Rect(40,390,1200,305));GUILayout.BeginArea(new Rect(64,408,1152,265));scroll=GUILayout.BeginScrollView(scroll);
   if(confirmRestart){GUILayout.Label("重新开始这一段？当前进度会先备份。",text);if(Button("确认重玩")){try{if(File.Exists(SavePath("auto")))File.Copy(SavePath("auto"),SavePath("auto")+".before-new-"+DateTime.UtcNow.Ticks);session=new StorySession(data);protectAuto=false;confirmRestart=false;Save("auto");}catch(Exception e){notice=e.Message;}}if(Button("返回"))confirmRestart=false;}
   else if(showClues){GUILayout.Label("已有线索",title);if(session.Clues.Length==0)GUILayout.Label("尚无线索。",text);foreach(var id in session.Clues){var row=data.rows.Last(r=>r.clue==id);GUILayout.Label(row.speaker+"："+row.text,text);}if(Button("返回剧情"))showClues=false;}
   else if(session.Phase=="dialogue"){var row=session.CurrentRow;GUILayout.Label(row.speaker,title);GUILayout.Label(row.text,text);if(Button("继续"))Act("next");}
   else if(session.Phase=="choice"){GUILayout.Label("向斥候问清",title);foreach(var choice in data.choices)if(Button(session.FindRow(choice.row).text))Act("choice:"+choice.id);}
   else if(session.Phase=="explore"){
    GUILayout.Label(data.scenes.First(s=>s.id==session.SceneId).title,title);
    foreach(var action in data.actions.Where(session.CanAct))if(Button(action.label))Act("action:"+action.id);
    GUILayout.BeginHorizontal();foreach(var scene in data.scenes.Where(s=>s.id!=session.SceneId))if(Button(scene.title))Act("move:"+scene.id);GUILayout.EndHorizontal();
   }else {GUILayout.Label("移植试玩到此结束",title);GUILayout.Label("已到魏延自由发言环节。本次未接入AI与后续结局，不会写入正式版通关记录。",text);}
   if(!String.IsNullOrEmpty(notice))GUILayout.Label(notice,text);GUILayout.EndScrollView();GUILayout.EndArea();
  }
  void Panel(Rect rect){var previous=GUI.color;GUI.color=new Color(.94f,.93f,.88f,.96f);GUI.DrawTexture(rect,Texture2D.whiteTexture);GUI.color=previous;}
 }
}
