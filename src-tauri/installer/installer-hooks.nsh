; Hooks NSIS para IMBIO - VERSION MINIMAL DE DEBUG
; Si esto compila, voy agregando cosas de a poco.

!define IMBIO_MODE_SERVER "server"
!define IMBIO_MODE_CLIENT "client"
!define IMBIO_MODE_SKIP "skip"

Var IMBIO_INSTALL_MODE

; PREINSTALL: por ahora, hardcoded a server
!macro NSIS_HOOK_PREINSTALL
    StrCpy $IMBIO_INSTALL_MODE "${IMBIO_MODE_SERVER}"
    ; Mensaje simple
    MessageBox MB_OK "IMBIO - Modo Servidor (hardcoded para debug)"
!macroend

; POSTINSTALL: ejecutar el script de instalacion
!macro NSIS_HOOK_POSTINSTALL
    StrCmp $IMBIO_INSTALL_MODE "${IMBIO_MODE_SKIP}" imbio_post_done

    StrCpy $0 "$INSTDIR\resources\install.ps1"
    IfFileExists "$0" +2
    StrCpy $0 "$INSTDIR\install.ps1"

    IfFileExists "$0" imbio_run_ps imbio_post_done

    imbio_run_ps:
        CreateDirectory "$PROGRAMDATA\IMBIO\logs"
        DetailPrint "Configurando IMBIO..."
        ExecWait 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$0" -Mode $IMBIO_INSTALL_MODE -InstallDir "$INSTDIR"'
        MessageBox MB_OK "IMBIO Server instalado."

    imbio_post_done:
!macroend

; PREUNINSTALL
!macro NSIS_HOOK_PREUNINSTALL
    StrCpy $0 "$INSTDIR\resources\uninstall.ps1"
    IfFileExists "$0" +2
    StrCpy $0 "$INSTDIR\uninstall.ps1"
    IfFileExists "$0" 0 imbio_preuninst_done
    ExecWait 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$0" -InstallDir "$INSTDIR" -KeepData'
    imbio_preuninst_done:
!macroend

; POSTUNINSTALL
!macro NSIS_HOOK_POSTUNINSTALL
!macroend
