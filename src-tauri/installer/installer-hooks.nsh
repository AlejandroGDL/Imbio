; =================================================================
; installer-hooks.nsh - Hooks NSIS para IMBIO (sin macros)
; =================================================================
; Esta version NO usa macros personalizadas NI LogicLib.
; Todo el codigo es NSIS puro para maxima compatibilidad.
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

    ; UN MessageBox con 3 botones: SI=Servidor, NO=Cliente, Cancelar
    StrCpy $1 "IMBIO - Como se usara esta PC?$\r$\n$\r$\nSI (Servidor) = Instala Node.js, PostgreSQL y el backend.$\r$\nNO (Cliente) = Solo la app.$\r$\nCancelar = No instala nada."

    MessageBox MB_YESNOCANCEL|MB_ICONQUESTION "$1" IDYES imbio_pre_server IDNO imbio_pre_client IDCANCEL imbio_pre_cancel
    Goto imbio_pre_cancel

    imbio_pre_server:
        StrCpy $IMBIO_INSTALL_MODE "${IMBIO_MODE_SERVER}"
        Goto imbio_pre_done

    imbio_pre_client:
        StrCpy $IMBIO_INSTALL_MODE "${IMBIO_MODE_CLIENT}"
        Goto imbio_pre_done

    imbio_pre_cancel:
        StrCpy $IMBIO_INSTALL_MODE "${IMBIO_MODE_SKIP}"
        MessageBox MB_OK|MB_ICONINFORMATION "Instalacion cancelada."
        Abort

    imbio_pre_done:
        ; Mensaje de confirmacion (separado por modo)
        StrCmp $IMBIO_INSTALL_MODE "${IMBIO_MODE_SERVER}" 0 imbio_pre_client_msg
        StrCpy $1 "Modo SERVIDOR.$\r$\n$\r$\nSe descargaran Node.js y PostgreSQL. Servicios con auto-arranque.$\r$\n$\r$\n(Requiere internet y permisos de administrador)"
        MessageBox MB_OK|MB_ICONINFORMATION "$1"
        Goto imbio_pre_done_end

    imbio_pre_client_msg:
        StrCpy $1 "Modo CLIENTE.$\r$\n$\r$\nAl finalizar la instalacion se te pedira la URL del servidor IMBIO.$\r$\n$\r$\n(Por ejemplo: http://192.168.0.10:3000)"
        MessageBox MB_OK|MB_ICONINFORMATION "$1"

    imbio_pre_done_end:
!macroend

; -----------------------------------------------------------------
; NSIS_HOOK_POSTINSTALL
; -----------------------------------------------------------------
!macro NSIS_HOOK_POSTINSTALL
    StrCmp $IMBIO_INSTALL_MODE "${IMBIO_MODE_SKIP}" imbio_post_done

    ; Buscar install.ps1
    StrCpy $0 "$INSTDIR\resources\install.ps1"
    IfFileExists "$0" +2
    StrCpy $0 "$INSTDIR\install.ps1"

    IfFileExists "$0" imbio_post_run imbio_post_done

    imbio_post_run:
        CreateDirectory "$PROGRAMDATA\IMBIO\logs"
        CreateDirectory "$PROGRAMDATA\IMBIO"
        DetailPrint "Configurando IMBIO (modo: $IMBIO_INSTALL_MODE)..."

        ; Ejecutar PowerShell en ventana VISIBLE para que el usuario
        ; vea el progreso (descarga de binarios tarda)
        ExecWait 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$0" -Mode $IMBIO_INSTALL_MODE -InstallDir "$INSTDIR"'

        ; Mensaje final
        StrCmp $IMBIO_INSTALL_MODE "${IMBIO_MODE_SERVER}" 0 imbio_post_client_msg
        StrCpy $1 "IMBIO Server instalado.$\r$\n$\r$\nServidor y PostgreSQL corriendo como servicios de Windows con auto-arranque.$\r$\n$\r$\n- Busca 'IMBIO Server Manager' en el escritorio$\r$\n- Logs en: C:\ProgramData\IMBIO\logs\"
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
