; Hooks NSIS para IMBIO - VERSION FINAL
; El PREINSTALL muestra un mensaje informativo.
; El setup REAL ocurre dentro de la app Tauri al primer inicio
; (src/pages/Setup.tsx) - no dependemos del hook POSTINSTALL
; porque tiene bugs en Tauri 2.

!macro NSIS_HOOK_PREINSTALL
    ; Mensaje simple de bienvenida
    MessageBox MB_OK|MB_ICONINFORMATION "Bienvenido a IMBIO.$\r$\n$\r$\nLa instalacion copiara los archivos.$\r$\n$\r$\nAl abrir la app por primera vez, se mostrara un asistente para configurar esta PC como servidor o cliente."
!macroend

!macro NSIS_HOOK_POSTINSTALL
!macroend

!macro NSIS_HOOK_PREUNINSTALL
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
!macroend
