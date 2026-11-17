using System;
using System.Collections.Generic;
using System.Linq;
namespace Wuzhangyuan {
 [Serializable] public class StoryData { public int version; public string chapter,entry,contentHash; public Section[] sections; public Row[] rows; public StoryAction[] actions; public Scene[] scenes; public Choice[] choices; }
 [Serializable] public class Section { public string id,title,scene,nextKind,nextId; public string[] rows; }
 [Serializable] public class Row { public string id,speaker,text,clue; }
 [Serializable] public class StoryAction { public string id,label,scene,section; public string[] requires; }
 [Serializable] public class Scene { public string id,title,description; public string[] routes; }
 [Serializable] public class Choice { public string id,row,section; }
 [Serializable] public class SaveData { public int version=1; public string contentHash; public string[] commands; }
 // No Unity or browser dependencies. Facts derive only from completed source rows.
 public sealed class StorySession {
  public readonly StoryData Data;
  public string Phase {get;private set;}
  public string SceneId {get;private set;}
  public string SectionId {get;private set;}
  public int Line {get;private set;}
  readonly HashSet<string> completed=new HashSet<string>();
  readonly HashSet<string> clues=new HashSet<string>();
  readonly List<string> commands=new List<string>();
  public string[] Clues {get{return clues.OrderBy(x=>x).ToArray();}}
  public StorySession(StoryData data) {Data=data;if(data==null||data.version!=1)throw new ArgumentException("剧情版本不支持");Enter(data.entry);}
  public Section CurrentSection {get{return Data.sections.First(s=>s.id==SectionId);}}
  public Row CurrentRow {get{return Phase=="dialogue"?Data.rows.First(r=>r.id==CurrentSection.rows[Line]):null;}}
  public Row FindRow(string id){return Data.rows.First(r=>r.id==id);}
  void Enter(string id){var section=Data.sections.First(s=>s.id==id);SectionId=id;SceneId=section.scene;Line=0;Phase="dialogue";}
  public bool CanAct(StoryAction action){return Phase=="explore"&&action.scene==SceneId&&!completed.Contains(action.section)&&action.requires.All(completed.Contains);}
  public bool Apply(string command){
   bool applied=false;
   if(command=="next"&&Phase=="dialogue"){
    var row=CurrentRow;if(!String.IsNullOrEmpty(row.clue))clues.Add(row.clue);
    if(Line+1<CurrentSection.rows.Length)Line++;
    else {completed.Add(SectionId);Phase=CurrentSection.nextId=="explore"?"explore":CurrentSection.nextId=="choice"?"choice":"boundary";}
    applied=true;
   } else if(command.StartsWith("move:")&&Phase=="explore"){
    var target=command.Substring(5);var scene=Data.scenes.First(s=>s.id==SceneId);
    if(Data.scenes.Any(s=>s.id==target)&&scene.routes.Contains(target)){SceneId=target;applied=true;}
   } else if(command.StartsWith("action:")){
    var action=Data.actions.FirstOrDefault(a=>a.id==command.Substring(7));
    if(action!=null&&CanAct(action)){Enter(action.section);applied=true;}
   } else if(command.StartsWith("choice:")&&Phase=="choice"){
    var choice=Data.choices.FirstOrDefault(c=>c.id==command.Substring(7));
    if(choice!=null){Enter(choice.section);applied=true;}
   }
   if(applied)commands.Add(command);return applied;
  }
  public SaveData Snapshot(){return new SaveData{version=1,contentHash=Data.contentHash,commands=commands.ToArray()};}
  public static StorySession Restore(StoryData data,SaveData save){
   if(save==null||save.version!=1||save.contentHash!=data.contentHash||save.commands==null||save.commands.Length>10000)throw new ArgumentException("存档与当前剧情版本不兼容，原文件保留。");
   var session=new StorySession(data);
   foreach(var command in save.commands)if(command==null||!session.Apply(command))throw new ArgumentException("存档动作无效，原文件保留。");
   return session;
  }
 }
}
