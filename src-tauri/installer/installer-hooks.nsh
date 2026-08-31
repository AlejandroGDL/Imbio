; =================================================================
; installer-hooks.nsh - Hooks NSIS para IMBIO
; =================================================================
; Approach: 2 MessageBox simples (YESNO) secuenciales en vez de
; uno solo con 3 botones. Esto evita el bug de NSIS con
; MB_YESNOCANCEL dentro de installerHooks.
; =================================================================

!define IMBIO_MODE_SERVER "server"
!define IMBIO_MODE_CLIENT "client"
!define IMBIO_MODE_SKIP "skip"

Var IMBIO_INSTALL_MODE

; -----------------------------------------------------------------
; NSIS_HOOK_PREINSTALL
; -----------------------------------------------------------------
!macro NSIS_HOOK_PREINSTALL
    StrCpy $IMBIO_INSTALL_MODE "${IMBIO_MODE_SKIP}"

    ; Mensaje 1: ¿Servidor?
    StrCpy $1 "IMBIO - Esta PC sera el SERVIDOR central?$\r$\n$\r$\nSI = Instala Node.js, PostgreSQL y el backend.$\r$\nEsta PC tendra la base de datos.$\r$\n$\r$\nNO = Esta PC sera un cliente (te pedira la URL del servidor)."

    MessageBox MB_YESNO|MB_ICONQUESTION "$1" IDYES imbio_pre_server IDNO imbio_pre_check_client
    Goto imbio_pre_cancel

    imbio_pre_server:
        StrCpy $IMBIO_INSTALL_MODE "${IMBIO_MODE_SERVER}"
        MessageBox MB_OK|MB_ICONINFORMATION "Modo SERVIDOR.$\r$\n$\r$\nAl finalizar la instalacion se descargaran Node.js y PostgreSQL, y se configuraran como servicios de Windows."
        Goto imbio_pre_done

    imbio_pre_check_client:
        ; Mensaje 2: ¿Cliente?
        StrCpy $1 "IMBIO - Esta PC sera un CLIENTE (se conecta a otra PC que es el servidor)?$\r$\n$\r$\nSI = Solo instala la app. Te pedira la URL del servidor.$\r$\nNO = Cancela la instalacion."

        MessageBox MB_YESNO|MB_ICONQUESTION "$1" IDYES imbio_pre_client IDNO imbio_pre_cancel

        ; Si llega aqui, era cliente pero canceló
        Goto imbio_pre_cancel

    imbio_pre_client:
        StrCpy $IMBIO_INSTALL_MODE "${IMBIO_MODE_CLIENT}"
        MessageBox MB_OK|MB_ICONINFORMATION "Modo CLIENTE.$\r$\n$\r$\nAl finalizar la instalacion se te pedira la URL del servidor IMBIO.$\r$\n(Por ejemplo: http://192.168.0.10:3000)"
        Goto imbio_pre_done

    imbio_pre_cancel:
        StrCpy $IMBIO_INSTALL_MODE "${IMBIO_MODE_SKIP}"
        MessageBox MB_OK|MB_ICONINFORMATION "Instalacion cancelada."
        Abort

    imbio_pre_done:
!macroend

; -----------------------------------------------------------------
; NSIS_HOOK_POSTINSTALL
; -----------------------------------------------------------------
!macro NSIS_HOOK_POSTINSTALL
    StrCmp $IMBIO_INSTALL_MODE "${IMBIO_MODE_SKIP}" imbio_post_done

    StrCpy $0 "$INSTDIR\resources\install.ps1"
    IfFileExists "$0" +2
    StrCpy $0 "$INSTDIR\install.ps1"

    IfFileExists "$0" imbio_post_run imbio_post_done

    imbio_post_run:
        CreateDirectory "$PROGRAMDATA\IMBIO\logs"
        CreateDirectory "$PROGRAMDATA\IMBIO"
        DetailPrint "Configurando IMBIO (modo: $IMBIO_INSTALL_MODE)..."
        ExecWait 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$0" -Mode $IMBIO_INSTALL_MODE -InstallDir "$INSTDIR"'

        StrCmp $IMBIO_INSTALL_MODE "${IMBIO_MODE_SERVER}" 0 imbio_post_client_msg
        StrCpy $1 "IMBIO Server instalado.$\r$\n$\r$\nServidor y PostgreSQL corriendo como servicios de Windows.$\r$\n$\r$\n- Busca 'IMBIO Server Manager' en el escritorio$\r$\n- Logs en: C:\ProgramData\IMBIO\logs\"
        MessageBox MB_OK|MB_ICONINFORMATION "$1"
        Goto imbio_post_done

    imbio_post_client_msg:
        StrCpy $1 "IMBIO Cliente instalado.$\r$\n$\r$\nAbre la app desde el acceso directo del escritorio."
        MessageBox MB_OK|MB_ICONINFORMATION "$1"

    imbio_post_done:
!macroend

; -----------------------------------------------------------------
; NSIS_HOOK_PREUNINSTALL
; -----------------------------------------------------------------
!macro NSIS_HOOK_PREUNINSTALL
    StrCpy $0 "$INSTDIR\resources\uninstall.ps1"
    IfFileExists "$0" +2
    StrCpy $0 "$INSTDIR\uninstall.ps1"
    IfFileExists "$0" 0 imbio_uninst_done
    DetailPrint "Deteniendo servicios de IMBIO..."
    ExecWait 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$0" -InstallDir "$INSTDIR" -KeepData'
    imbio_uninst_done:
!macroend

; -----------------------------------------------------------------
; NSIS_HOOK_POSTUNINSTALL
; -----------------------------------------------------------------
!macro NSIS_HOOK_POSTUNINSTALL
!macroend
