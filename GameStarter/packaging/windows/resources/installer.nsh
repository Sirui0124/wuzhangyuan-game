; Current-user install only. Never request elevation or replace another user's copy.
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend
