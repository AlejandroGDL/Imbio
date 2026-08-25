# IMBIO — Instalador de Windows

Este directorio contiene todo lo necesario para construir el instalador
de Windows de IMBIO con soporte para **dos modos de instalación**:

- **Servidor** — Instala Node.js + PostgreSQL + backend, los registra
  como servicios de Windows con auto-arranque. Esta PC alojará la base
  de datos.
- **Cliente** — Solo instala la app y guarda la URL del servidor. Esta
  PC se conectará a otra PC que actúa como servidor.

Cualquier PC puede ser servidor o cliente. El usuario elige al instalar.

## Arquitectura

```
installer/
├── build-server-bundle.mjs    # Construye el bundle del server (deps + tsc)
├── fetch-binaries.mjs         # Descarga binarios para desarrollo local
├── scripts/                   # Scripts PowerShell ejecutados por el instalador
│   ├── common.ps1             # Funciones compartidas
│   ├── install.ps1            # Entry point (llamado por el hook NSIS)
│   ├── install-server.ps1     # Configura el server + PostgreSQL
│   ├── install-client.ps1     # Configura el cliente con la URL del server
│   ├── uninstall.ps1          # Desinstala servicios y limpia
│   └── download-binaries.ps1  # Descarga Node, PostgreSQL, nssm
├── resources/                 # Recursos externos (se generan)
│   ├── server-bundle/         # Server compilado con prodDeps
│   ├── node/                  # Node.js portable (descargado por el instalador)
│   ├── pgsql/                 # PostgreSQL binaries (descargado por el instalador)
│   └── nssm.exe               # Service manager (descargado por el instalador)
└── docs/
    └── installer.md           # Este archivo
```

El hook NSIS (`src-tauri/installer/installer-hooks.nsh`) se ejecuta en
el instalador Tauri. Configurado en `src-tauri/tauri.conf.json` bajo
`bundle.windows.nsis.installerHooks`.

## Flujo de instalación

### Cuando el usuario ejecuta el `.exe`:

1. **Tauri muestra su wizard estándar** (bienvenida, licencia, ruta).
2. **`NSIS_HOOK_PREINSTALL`** se ejecuta:
   - MessageBox: "¿Esta PC será el SERVIDOR?"
   - Si NO → MessageBox: "¿Esta PC será un CLIENTE?"
   - Si NO → cancelar instalación
3. Tauri copia los archivos al `C:\Program Files\IMBIO\`.
4. **`NSIS_HOOK_POSTINSTALL`** se ejecuta:
   - Llama a `install.ps1` con `-Mode server` o `-Mode client`.
   - `install.ps1` descarga los binarios externos si faltan (Node, PostgreSQL, nssm).
   - Si es servidor: `install-server.ps1` configura todo.
   - Si es cliente: `install-client.ps1` guarda la URL.
5. Listo. El usuario abre la app desde el acceso directo del escritorio.

## Para construir el instalador localmente

### Prerrequisitos
- Node.js 22+
- Rust (stable)
- Tauri CLI
- Windows (para compilar el .msi/.exe)

### Pasos

```bash
# 1. Instalar dependencias
npm install --legacy-peer-deps

# 2. Generar el cliente de Prisma
npx prisma generate --schema=server/prisma/schema.prisma

# 3. (Opcional) Construir el bundle del server
#    El instalador NO incluye el bundle; se descarga al instalar.
#    Pero si quieres probarlo localmente:
node installer/build-server-bundle.mjs

# 4. Construir el instalador Tauri
npm run tauri build

# Salida:
#   src-tauri/target/release/bundle/msi/*.msi
#   src-tauri/target/release/bundle/nsis/*.exe
```

## Tamaño del instalador

- **.exe (NSIS)**: ~10 MB (solo la UI + scripts de configuración)
- **.msi (WiX)**: ~10 MB

Los binarios externos (Node 30MB + PostgreSQL 80MB + nssm 1MB) **se
descargan al instalar en modo servidor** desde los servidores oficiales.
Esto reduce el tamaño del instalador y permite actualizar Node/PostgreSQL
sin recompilar el instalador.

## Requisitos en la PC destino

### Modo Servidor
- Windows 10/11 (64-bit)
- Permisos de administrador (para instalar servicios)
- **Internet** (solo durante la instalación, para descargar Node, PostgreSQL, nssm)
- ~500 MB de espacio en disco (PostgreSQL + Node + datos)

### Modo Cliente
- Windows 10/11 (64-bit)
- Permisos de administrador
- Acceso a la PC servidor por la red (puerto 3000)
- ~50 MB de espacio en disco (solo la app)

## Estructura después de instalar

```
C:\Program Files\IMBIO\
├── IMBIO.exe                    # La app de escritorio
├── nssm.exe                     # Service manager
├── node\                        # Node.js portable
├── pgsql\                       # PostgreSQL binaries
├── server\                      # Bundle del server
│   ├── dist\index.js            # Entry point
│   ├── node_modules\            # Dependencias
│   ├── prisma\                  # Schema + migraciones
│   ├── .env                     # Generado por el instalador
│   └── package.json
└── resources\                   # Scripts PowerShell (resources de Tauri)
    ├── install.ps1
    ├── install-server.ps1
    ├── install-client.ps1
    ├── uninstall.ps1
    ├── common.ps1
    └── download-binaries.ps1

C:\ProgramData\IMBIO\
├── config.json                  # Configuración para la app (serverUrl, mode)
├── logs\                        # Logs de instalación y server
│   ├── install.log
│   ├── postgresql.log
│   ├── server.log
│   └── server-error.log
└── data\postgresql\             # Cluster de PostgreSQL (datos reales)
```

## Servicios de Windows instalados (modo servidor)

| Servicio | Nombre | Descripción | Auto-arranque |
|---|---|---|---|
| PostgreSQL | `ImbioPostgreSQL` | Base de datos local | ✓ |
| IMBIO Server | `ImbioServer` | Backend Fastify | ✓ (depende de PostgreSQL) |

## Comandos útiles

```powershell
# Ver estado de los servicios
Get-Service ImbioServer, ImbioPostgreSQL

# Reiniciar el server
Restart-Service ImbioServer

# Reiniciar PostgreSQL
Restart-Service ImbioPostgreSQL

# Ver logs del server
notepad C:\ProgramData\IMBIO\logs\server.log

# Ver logs de PostgreSQL
notepad C:\ProgramData\IMBIO\logs\postgresql.log

# Cambiar manualmente la URL del servidor (cliente)
notepad C:\ProgramData\IMBIO\config.json

# Desinstalar (conservando datos)
& "C:\Program Files\IMBIO\resources\uninstall.ps1" -KeepData $true

# Desinstalar TODO (incluyendo la base de datos)
& "C:\Program Files\IMBIO\resources\uninstall.ps1"
```

## Troubleshooting

### El instalador no muestra los MessageBox de selección de modo
Probablemente los hooks no se están ejecutando. Verifica que:
- `src-tauri/tauri.conf.json` tiene `bundle.windows.nsis.installerHooks: "installer/installer-hooks.nsh"`
- El archivo `src-tauri/installer/installer-hooks.nsh` existe
- El build de Tauri se completó sin errores

### El server no arranca después de instalar
Revisa los logs:
```powershell
notepad C:\ProgramData\IMBIO\logs\server.log
notepad C:\ProgramData\IMBIO\logs\server-error.log
```
Las causas más comunes:
- Puerto 3000 ya en uso por otro programa
- PostgreSQL no terminó de arrancar (espera 30 segundos)
- Firewall bloqueando el puerto

### No me puedo conectar desde otro PC cliente
1. Verifica que el firewall de Windows está abierto para el puerto 3000
2. Verifica que el server está corriendo: `Get-Service ImbioServer`
3. Verifica que otra PC puede hacer ping a esta
4. Verifica la URL en el cliente: debe incluir `http://` y el puerto (`:3000`)

### La descarga de binarios falla
Si la PC servidor no tiene internet (o tiene proxy), necesitas:
1. Descargar manualmente los binarios en otra PC con internet:
   - `https://nodejs.org/dist/v22.11.0/node-v22.11.0-win-x64.zip`
   - `https://get.enterprisedb.com/postgresql/postgresql-16.4-1-windows-x64-binaries.zip`
   - `https://nssm.cc/release/nssm-2.24.zip`
2. Copiarlos a `C:\ProgramData\IMBIO\binarios\`
3. Modificar `download-binaries.ps1` para usar esa carpeta local
