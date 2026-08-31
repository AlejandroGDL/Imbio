; =================================================================
; installer-hooks.nsh
; =================================================================
; Hooks de NSIS para el instalador de IMBIO.
; Configurado en tauri.conf.json:
;   bundle.windows.nsis.installerHooks = "installer/installer-hooks.nsh"
; =================================================================

; -----------------------------------------------------------------
; Constantes
; -----------------------------------------------------------------
!define IMBIO_MODE_SERVER  "server"
!define IMBIO_MODE_CLIENT  "client"
!define IMBIO_MODE_SKIP    "skip"

; -----------------------------------------------------------------
; Variables globales
; -----------------------------------------------------------------
Var IMBIO_INSTALL_MODE

; -----------------------------------------------------------------
; Helper: log SIEMPRE (incluso si el usuario aborta)
; IMPORTANTE: usar ${LOGMSG} con delimitadores {}, NO $LOGMSG.
; -----------------------------------------------------------------
!macro IMBIO_LOG LOGMSG
    Push $0
    Push $1
    CreateDirectory "$PROGRAMFILES\IMBIO\logs"
    FileOpen $0 "$PROGRAMFILES\IMBIO\logs\imbio-install.log" a
    FileSeek $0 0 END
    FileWrite $0 "[NSIS] ${LOGMSG}$\r$\n"
    FileClose $0
    Pop $1
    Pop $0
!macroend

; -----------------------------------------------------------------
; NSIS_HOOK_PREINSTALL
; Pregunta al usuario con UN SOLO MessageBox de 3 botones.
;
; Importante: todo en una sola linea fisica (sin \ al final) y
; sin caracteres especiales (em dash, arrows) que pueden romper
; el parser de NSIS en algunos charsets.
; -----------------------------------------------------------------
!macro NSIS_HOOK_PREINSTALL
    StrCpy $IMBIO_INSTALL_MODE "${IMBIO_MODE_SKIP}"
    !insertmacro IMBIO_LOG "PREINSTALL"

    ; Texto del MessageBox (sin acentos, sin caracteres especiales)
    ; Los saltos de linea en NSIS MessageBox se indican con $\r$\n
    StrCpy $0 "IMBIO - Como se usara esta PC?$\r$\n$\r$\nSI (Servidor) = Instala Node.js, PostgreSQL y el backend. Esta PC tendra la base de datos.$\r$\n$\r$\nNO (Cliente) = Solo instala la app. Te pedira la URL del servidor.$\r$\n$\r$\nCancelar = No instala nada."

    MessageBox MB_YESNOCANCEL|MB_ICONQUESTION "$0" IDYES imbio_mode_server IDNO imbio_mode_client IDCANCEL imbio_mode_cancel
    Goto imbio_mode_cancel

    imbio_mode_server:
        StrCpy $IMBIO_INSTALL_MODE "${IMBIO_MODE_SERVER}"
        !insertmacro IMBIO_LOG "Modo: SERVIDOR"
        Goto imbio_mode_done

    imbio_mode_client:
        StrCpy $IMBIO_INSTALL_MODE "${IMBIO_MODE_CLIENT}"
        !insertmacro IMBIO_LOG "Modo: CLIENTE"
        Goto imbio_mode_done

    imbio_mode_cancel:
        StrCpy $IMBIO_INSTALL_MODE "${IMBIO_MODE_SKIP}"
        !insertmacro IMBIO_LOG "Usuario cancelo"
        MessageBox MB_OK|MB_ICONINFORMATION "Instalacion cancelada."
        Abort

    imbio_mode_done:
        ${If} $IMBIO_INSTALL_MODE == "${IMBIO_MODE_SERVER}"
            MessageBox MB_OK|MB_ICONINFORMATION "Modo SERVIDOR.$\r$\n$\r$\nAl finalizar la instalacion se descargaran Node.js y PostgreSQL, y se configuraran como servicios de Windows con auto-arranque.$\r$\n$\r$\n(Requiere internet y permisos de administrador)"
        ${Else}
            MessageBox MB_OK|MB_ICONINFORMATION "Modo CLIENTE.$\r$\n$\r$\nAl finalizar la instalacion se te pedira la URL del servidor IMBIO.$\r$\n$\r$\n(Por ejemplo: http://192.168.0.10:3000)"
        ${EndIf}
!macroend

; -----------------------------------------------------------------
; NSIS_HOOK_POSTINSTALL
; Ejecuta el script PowerShell de configuracion.
; -----------------------------------------------------------------
!macro NSIS_HOOK_POSTINSTALL
    !insertmacro IMBIO_LOG "POSTINSTALL"

    StrCmp $IMBIO_INSTALL_MODE "${IMBIO_MODE_SKIP}" imbio_post_done

    ; Buscar el script PowerShell
    StrCpy $0 "$INSTDIR\resources\install.ps1"
    IfFileExists "$0" +2
    StrCpy $0 "$INSTDIR\install.ps1"

    IfFileExists "$0" imbio_run_ps imbio_post_done

    imbio_run_ps:
        ; Crear carpetas
        CreateDirectory "$PROGRAMDATA\IMBIO\logs"
        CreateDirectory "$PROGRAMDATA\IMBIO"

        DetailPrint "Configurando IMBIO (modo: $IMBIO_INSTALL_MODE)..."

        ; Ejecutar PowerShell en ventana VISIBLE para que el usuario
        ; vea el progreso (descarga de binarios tarda).
        ExecWait 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$0" -Mode $IMBIO_INSTALL_MODE -InstallDir "$INSTDIR"'

        ${If} $IMBIO_INSTALL_MODE == "${IMBIO_MODE_SERVER}"
            MessageBox MB_OK|MB_ICONINFORMATION "IMBIO Server instalado.$\r$\n$\r$\nEl servidor y PostgreSQL estan corriendo como servicios de Windows con auto-arranque.$\r$\n$\r$\n- Para ver el estado: busca 'IMBIO Server Manager' en el escritorio$\r$\n- Para ver logs: C:\ProgramData\IMBIO\logs\"
        ${Else}
            MessageBox MB_OK|MB_ICONINFORMATION "IMBIO Cliente instalado.$\r$\n$\r$\nAbre la app desde el acceso directo del escritorio."
        ${EndIf}

    imbio_post_done:
!macroend

; -----------------------------------------------------------------
; NSIS_HOOK_PREUNINSTALL
; -----------------------------------------------------------------
!macro NSIS_HOOK_PREUNINSTALL
    StrCpy $0 "$INSTDIR\resources\uninstall.ps1"
    IfFileExists "$0" +2
    StrCpy $0 "$INSTDIR\uninstall.ps1"

    IfFileExists "$0" 0 imbio_preuninst_done
        DetailPrint "Deteniendo servicios de IMBIO..."
        ExecWait 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$0" -InstallDir "$INSTDIR" -KeepData'
    imbio_preuninst_done:
!macroend

; -----------------------------------------------------------------
; NSIS_HOOK_POSTUNINSTALL
; -----------------------------------------------------------------
!macro NSIS_HOOK_POSTUNINSTALL
!macroend
