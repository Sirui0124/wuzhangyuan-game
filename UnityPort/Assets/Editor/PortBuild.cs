using System;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
namespace Wuzhangyuan {
 public static class PortBuild {
  [MenuItem("Wuzhangyuan/Open prototype scene")]
  public static void Prepare(){const string path="Assets/Scenes/Prototype.unity";Directory.CreateDirectory("Assets/Scenes");if(!File.Exists(path)){var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);EditorSceneManager.SaveScene(scene,path);}else EditorSceneManager.OpenScene(path);EditorBuildSettings.scenes=new[]{new EditorBuildSettingsScene(path,true)};}
  [MenuItem("Wuzhangyuan/Build Windows prototype")]
  public static void Windows(){Prepare();PlayerSettings.companyName="Wuzhangyuan";PlayerSettings.productName="Wuzhangyuan Unity Prototype";PlayerSettings.defaultScreenWidth=1280;PlayerSettings.defaultScreenHeight=720;PlayerSettings.fullScreenMode=FullScreenMode.Windowed;
   var output=Path.GetFullPath("../outputs/unity-prototype/WuzhangyuanUnity.exe");Directory.CreateDirectory(Path.GetDirectoryName(output));
   var report=BuildPipeline.BuildPlayer(EditorBuildSettings.scenes,output,BuildTarget.StandaloneWindows64,BuildOptions.None);if(report.summary.result!=UnityEditor.Build.Reporting.BuildResult.Succeeded)throw new Exception("Unity build failed: "+report.summary.result);
  }
 }
}
