Set WshShell = CreateObject("WScript.Shell")
' Run the batch file with window style 0 (hidden)
WshShell.Run chr(34) & "C:\Users\sai\cnjp\scripts\start_server.bat" & chr(34), 0
Set WshShell = Nothing
