; Hooks NSIS para IMBIO - VERSION SIMPLIFICADA
; El instalador Tauri solo copia los archivos y crea un acceso
; directo al script de instalacion del servidor. El usuario lo
; corre manualmente (mas confiable que depender del hook POSTINSTALL
; que tiene bugs en Tauri 2.6.3).

!macro NSIS_HOOK_PREINSTALL
    ; Sin wizard. El usuario elige modo despues, corriendo el script
    ; de instalacion manualmente.
    MessageBox MB_OK|MB_ICONINFORMATION "Bienvenido a IMBIO.$\r$\n$\r$\nLa instalacion copiara los archivos.$\r$\n$\r$\nAl finalizar, abre el acceso directo 'IMBIO Server Setup' del escritorio para configurar esta PC como servidor o cliente."
!macroend

!macro NSIS_HOOK_POSTINSTALL
    ; Crear acceso directo en el escritorio al script de setup
    CreateDirectory "$INSTDIR\resources"

    ; Acceso directo: "IMBIO Server Setup"
    CreateShortcut "$DESKTOP\IMBIO Server Setup.lnk" "$INSTDIR\resources\install-server-standalone.ps1" "" "$INSTDIR\resources" 0 SW_SHOWNORMAL "" "Configurar esta PC como servidor IMBIO"

    ; Acceso directo: "IMBIO Diagnostico"
    CreateShortcut "$DESKTOP\IMBIO Diagnostico.lnk" "$INSTDIR\resources\diagnose.ps1" "" "$INSTDIR\resources" 0 SW_SHOWNORMAL "" "Diagnosticar el estado de IMBIO"

    ; Acceso directo: "IMBIO" (la app)
    CreateShortcut "$DESKTOP\IMBIO.lnk" "$INSTDIR\IMBIO.exe" "" "$INSTDIR" 0 SW_SHOWNORMAL "" "Abrir IMBIO"
!macroend

!macro NSIS_HOOK_PREUNINSTALL
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
!macroend
