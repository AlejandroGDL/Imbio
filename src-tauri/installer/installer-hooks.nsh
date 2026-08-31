; =================================================================
; installer-hooks.nsh
; =================================================================
; Hooks de NSIS para el instalador de IMBIO.
;
; Configurado en tauri.conf.json:
;   "bundle": { "windows": { "nsis": { "installerHooks":
;     "src-tauri/installer/installer-hooks.nsh" } } }
;
; Flujo del usuario:
;   1. Wizard estándar de Tauri (bienvenida, licencia, ruta)
;   2. PREINSTALL: 1 MessageBox con 3 botones (Servidor/Cliente/Cancelar)
;   3. Tauri copia los archivos
;   4. POSTINSTALL: ejecuta PowerShell según el modo elegido
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
; Usa Push/Pop para preservar $0 y no contaminar el scope del caller
; IMPORTANTE: usar ${LOGMSG} con delimitadores {}, NO $LOGMSG$.
; En NSIS, $LOGMSG$ sería una variable llamada "LOGMSG$" (el $
; final no es delimitador), lo que causa warning 6000.
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
; -----------------------------------------------------------------
!macro NSIS_HOOK_PREINSTALL
    StrCpy $IMBIO_INSTALL_MODE "${IMBIO_MODE_SKIP}"
    !insertmacro IMBIO_LOG "PREINSTALL: mostrando MessageBox de selección de modo"

    ; UN SOLO MessageBox con 3 botones (SÍ / NO / Cancelar)
    ; - SÍ      = Servidor
    ; - NO      = Cliente
    ; - Cancelar = Abortar instalación
    MessageBox MB_YESNOCANCEL|MB_ICONQUESTION "IMBIO — Selecciona cómo se usará esta PC$\r$\n$\r$\nSÍ (Servidor) → Instala Node.js, PostgreSQL y el backend. Esta PC será la que tenga la base de datos.$\r$\n$\r$\nNO (Cliente) → Solo instala la app. Te pedirá la URL de la PC servidor.$\r$\n$\r$\nCancelar → No instala nada." \
        IDYES imbio_mode_server \
        IDNO imbio_mode_client \
        IDCANCEL imbio_mode_cancel

    ; Si llega aquí sin saltar a una etiqueta, también cancelar
    Goto imbio_mode_cancel

    imbio_mode_server:
        StrCpy $IMBIO_INSTALL_MODE "${IMBIO_MODE_SERVER}"
        !insertmacro IMBIO_LOG "Modo seleccionado: SERVIDOR"
        Goto imbio_mode_done

    imbio_mode_client:
        StrCpy $IMBIO_INSTALL_MODE "${IMBIO_MODE_CLIENT}"
        !insertmacro IMBIO_LOG "Modo seleccionado: CLIENTE"
        Goto imbio_mode_done

    imbio_mode_cancel:
        StrCpy $IMBIO_INSTALL_MODE "${IMBIO_MODE_SKIP}"
        !insertmacro IMBIO_LOG "Usuario canceló la instalación (IDCANCEL)"
        MessageBox MB_OK|MB_ICONINFORMATION "Instalación cancelada."
        Abort

    imbio_mode_done:
        ; Mensaje de confirmación
        ${If} $IMBIO_INSTALL_MODE == "${IMBIO_MODE_SERVER}"
            MessageBox MB_OK|MB_ICONINFORMATION "Modo SERVIDOR.$\r$\n$\r$\nAl finalizar la instalación se descargarán Node.js, PostgreSQL y se configurará todo como servicios de Windows.$\r$\n$\r$\n(Requiere internet y permisos de administrador)"
        ${Else}
            MessageBox MB_OK|MB_ICONINFORMATION "Modo CLIENTE.$\r$\n$\r$\nAl finalizar la instalación se te pedirá la URL del servidor IMBIO.$\r$\n$\r$\n(Por ejemplo: http://192.168.0.10:3000)"
        ${EndIf}
!macroend

; -----------------------------------------------------------------
; NSIS_HOOK_POSTINSTALL
; Ejecuta el script PowerShell de configuración.
; -----------------------------------------------------------------
!macro NSIS_HOOK_POSTINSTALL
    !insertmacro IMBIO_LOG "POSTINSTALL: modo=$IMBIO_INSTALL_MODE, INSTDIR=$INSTDIR"

    ; Si el usuario canceló, salir (no hacer nada)
    StrCmp $IMBIO_INSTALL_MODE "${IMBIO_MODE_SKIP}" imbio_post_done

    ; Buscar el script PowerShell (puede estar en resources/ o en raíz)
    StrCpy $0 "$INSTDIR\resources\install.ps1"
    IfFileExists "$0" +2
    StrCpy $0 "$INSTDIR\install.ps1"

    IfFileExists "$0" imbio_run_ps imbio_post_done

    imbio_run_ps:
        ; Crear carpeta de logs y config
        CreateDirectory "$PROGRAMDATA\IMBIO\logs"

        ; Log con timestamp
        FileOpen $1 "$PROGRAMDATA\IMBIO\logs\imbio-install.log" a
        FileSeek $1 0 END
        FileWrite $1 "[POSTINSTALL] Ejecutando: powershell -File $\"$0$\" -Mode $IMBIO_INSTALL_MODE -InstallDir $\"$INSTDIR$\"$\r$\n"
        FileClose $1

        DetailPrint "Configurando IMBIO (modo: $IMBIO_INSTALL_MODE)..."

        ; Ejecutar PowerShell en una ventana VISIBLE para que el
        ; usuario vea el progreso (descarga de binarios tarda).
        ; -Wait: esperar a que termine
        ; El usuario ve toda la salida del script
        ExecWait 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$0" -Mode $IMBIO_INSTALL_MODE -InstallDir "$INSTDIR"'

        ; Log del resultado
        FileOpen $1 "$PROGRAMDATA\IMBIO\logs\imbio-install.log" a
        FileSeek $1 0 END
        FileWrite $1 "[POSTINSTALL] PowerShell terminó con código: $0$\r$\n"
        FileClose $1

        ; Mensaje final
        ${If} $IMBIO_INSTALL_MODE == "${IMBIO_MODE_SERVER}"
            MessageBox MB_OK|MB_ICONINFORMATION "IMBIO Server instalado.$\r$\n$\r$\nEl servidor y PostgreSQL están corriendo como servicios de Windows con auto-arranque.$\r$\n$\r$\n• Para ver el estado: busca 'IMBIO Server Manager' en el escritorio$\r$\n• Para ver logs: C:\ProgramData\IMBIO\logs\"
        ${Else}
            MessageBox MB_OK|MB_ICONINFORMATION "IMBIO Cliente instalado.$\r$\n$\r$\nAbre la app desde el acceso directo del escritorio."
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
        ExecWait 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$0" -InstallDir "$INSTDIR" -KeepData'
    imbio_preuninst_done:
!macroend

; -----------------------------------------------------------------
; NSIS_HOOK_POSTUNINSTALL
; No hace nada extra.
; -----------------------------------------------------------------
!macro NSIS_HOOK_POSTUNINSTALL
!macroend
