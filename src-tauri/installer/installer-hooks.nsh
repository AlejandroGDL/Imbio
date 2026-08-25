; =================================================================
; installer-hooks.nsh
; =================================================================
; Hooks de NSIS para el instalador de IMBIO.
; Configurado en tauri.conf.json:
;   "bundle": { "windows": { "nsis": { "installerHooks":
;     "src-tauri/installer/installer-hooks.nsh" } } }
;
; Hooks (ver docs Tauri 2):
;   - NSIS_HOOK_PREINSTALL    → antes de copiar archivos
;   - NSIS_HOOK_POSTINSTALL   → después de copiar + accesos directos
;   - NSIS_HOOK_PREUNINSTALL  → antes de eliminar archivos
;   - NSIS_HOOK_POSTUNINSTALL → después de eliminar todo
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
; NSIS_HOOK_PREINSTALL
; Pregunta al usuario el modo de instalación.
; -----------------------------------------------------------------
!macro NSIS_HOOK_PREINSTALL
    StrCpy $IMBIO_INSTALL_MODE "${IMBIO_MODE_SKIP}"

    ; Mensaje 1: ¿Servidor?
    MessageBox MB_YESNO|MB_ICONQUESTION "IMBIO — Tipo de instalación$\r$\n$\r$\n¿Esta PC será el SERVIDOR central (con base de datos)?$\r$\n$\r$\nSÍ  → Instala Node.js, PostgreSQL y el backend. Esta PC alojará los datos.$\r$\nNO  → Esta PC será un cliente (se te pedirá la URL del servidor)." \
        IDYES imbio_mode_server

    ; Si no eligió servidor, preguntar si es cliente
    MessageBox MB_YESNO|MB_ICONQUESTION "¿Esta PC será un CLIENTE (se conecta a otra PC que es el servidor)?$\r$\n$\r$\nSÍ  → Solo instala la app y se te pedirá la URL del servidor.$\r$\nNO  → Cancela la instalación." \
        IDYES imbio_mode_client

    ; Si tampoco eligió cliente, cancelar
    Abort

    imbio_mode_server:
        StrCpy $IMBIO_INSTALL_MODE "${IMBIO_MODE_SERVER}"
        MessageBox MB_OK|MB_ICONINFORMATION "Modo SERVIDOR seleccionado.$\r$\n$\r$\nSe instalará:$\r$\n  • Interfaz IMBIO$\r$\n  • Node.js + backend (como servicio de Windows)$\r$\n  • PostgreSQL (como servicio de Windows)$\r$\n$\r$\nLa base de datos se inicializará al final."
        Goto imbio_mode_done

    imbio_mode_client:
        StrCpy $IMBIO_INSTALL_MODE "${IMBIO_MODE_CLIENT}"
        MessageBox MB_OK|MB_ICONINFORMATION "Modo CLIENTE seleccionado.$\r$\n$\r$\nAl finalizar la instalación se te pedirá la URL del servidor IMBIO.$\r$\n$\r$\n(Por ejemplo: http://192.168.0.10:3000)"
        Goto imbio_mode_done

    imbio_mode_done:
!macroend

; -----------------------------------------------------------------
; NSIS_HOOK_POSTINSTALL
; Ejecuta el script PowerShell de configuración.
; -----------------------------------------------------------------
!macro NSIS_HOOK_POSTINSTALL
    ; Si el usuario canceló, salir
    StrCmp $IMBIO_INSTALL_MODE "${IMBIO_MODE_SKIP}" imbio_post_done

    ; Buscar el script PowerShell (puede estar en resources/ o en raíz)
    StrCpy $0 "$INSTDIR\resources\install.ps1"
    IfFileExists "$0" +2
    StrCpy $0 "$INSTDIR\install.ps1"

    IfFileExists "$0" imbio_run_ps imbio_post_done

    imbio_run_ps:
        DetailPrint "Configurando IMBIO (modo: $IMBIO_INSTALL_MODE)..."

        ; Construir el comando PowerShell.
        ; NOTA sobre escaping: NSIS usa $ como escape. Para meter
        ; $ dentro de un string de NSIS hay que duplicarlo ($$).
        ; Los strings de PowerShell van entre ' (comilla simple) para
        ; evitar problemas con el escapado de NSIS.
        nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$0" -Mode $IMBIO_INSTALL_MODE -InstallDir "$INSTDIR"'

        ; (alternativa: usar ExecWait para ver la ventana)
        ; ExecWait 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$0" -Mode $IMBIO_INSTALL_MODE -InstallDir "$INSTDIR"'

        ; Mensaje final
        ${If} $IMBIO_INSTALL_MODE == "${IMBIO_MODE_SERVER}"
            MessageBox MB_OK|MB_ICONINFORMATION "IMBIO Server instalado correctamente.$\r$\n$\r$\nEl servidor y PostgreSQL están corriendo como servicios de Windows con auto-arranque.$\r$\n$\r$\nPara administrarlo, busca $\'IMBIO Server Manager$\' en tu escritorio."
        ${Else}
            MessageBox MB_OK|MB_ICONINFORMATION "IMBIO Cliente instalado correctamente.$\r$\n$\r$\nAbre la app desde el acceso directo del escritorio."
        ${EndIf}

    imbio_post_done:
!macroend

; -----------------------------------------------------------------
; NSIS_HOOK_PREUNINSTALL
; Detiene los servicios antes de borrar archivos.
; -----------------------------------------------------------------
!macro NSIS_HOOK_PREUNINSTALL
    StrCpy $0 "$INSTDIR\resources\uninstall.ps1"
    IfFileExists "$0" +2
    StrCpy $0 "$INSTDIR\uninstall.ps1"

    IfFileExists "$0" 0 imbio_preuninst_done
        DetailPrint "Deteniendo servicios de IMBIO..."
        nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$0" -InstallDir "$INSTDIR" -KeepData'
    imbio_preuninst_done:
!macroend

; -----------------------------------------------------------------
; NSIS_HOOK_POSTUNINSTALL
; No hace nada extra.
; -----------------------------------------------------------------
!macro NSIS_HOOK_POSTUNINSTALL
!macroend
