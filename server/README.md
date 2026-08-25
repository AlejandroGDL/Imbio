# IMBIO Server

Backend del sistema IMBIO. Fastify + Prisma + PostgreSQL.

Sirve una API REST que el frontend Tauri consume desde la misma PC (modo servidor) o desde PCs clientes en la LAN.

---

## 🧱 Stack

- **Node.js** 20+ (usa `--env-file` nativo)
- **Fastify** 5 — servidor HTTP rápido y ligero
- **Prisma** 6 — ORM
- **PostgreSQL** 14+
- **Zod** — validación de payloads

---

## 🚀 Setup local (primera vez)

### 1. Instala PostgreSQL

En macOS con Homebrew:

```bash
brew install postgresql@16
brew services start postgresql@16
```

Crea el usuario y la base de datos (una sola vez):

```bash
createuser -s imbio        # o:  createuser imbio -P  (te pedirá password)
createdb -O imbio imbio
```

Si tu Postgres requiere password, edita `server/.env` y pon:

```
DATABASE_URL=postgresql://imbio:TU_PASSWORD@localhost:5432/imbio?schema=public
```

### 2. Configura variables de entorno

```bash
cd server
cp .env.example .env       # ya hay un .env con defaults
# Edita .env si necesitas cambiar puerto, DB, etc.
```

### 3. Instala dependencias (raíz del repo)

```bash
cd ..
npm install
```

### 4. Genera el cliente Prisma y corre migraciones

```bash
npm run db:generate
npm run db:migrate
# Cuando te pregunte el nombre de la migración, pon: "init"
```

### 5. Siembra los 15 trámites preconfigurados

```bash
npm run db:seed
```

Deberías ver algo como:

```
🌱 Iniciando seed de IMBIO...
⚙️  Insertando configuración inicial...
📋 Insertando 15 trámites al catálogo...
   ✓ PERMISO_QUEMA               → Permiso de Quema de Horno Ladrillera
   ✓ PERMISO_PODA                → Permiso de Poda de Árbol
   ...
✅ Seed completado.
   Trámites:  15
   Técnicos:  1
   Usuarios:  1
   Config:    1
```

---

## ▶️ Correr el servidor

### Modo desarrollo (con hot-reload)

```bash
npm run server:dev
```

Salida esperada:

```
╔══════════════════════════════════════════════════════════╗
║   🌿  IMBIO Server iniciado correctamente                ║
╚══════════════════════════════════════════════════════════╝
   URL local:    http://localhost:3000
   URL en LAN:   http://0.0.0.0:3000
   Health:       http://127.0.0.1:3000/health
   Health (DB):  http://127.0.0.1:3000/health/db
   Info:         http://127.0.0.1:3000/info
```

### Modo producción (para la PC servidor)

```bash
npm run server:build      # compila TypeScript → dist/
npm run server:start      # corre node dist/index.js
```

Para dejarlo corriendo 24/7 en la PC servidor, considera:

- **macOS** — [`pm2`](https://pm2.keymetrics.io/) o un `launchd` plist
- **Windows** — Servicio de Windows o NSSM
- **Linux** — systemd unit

Ejemplo rápido con `pm2`:

```bash
npm install -g pm2
pm2 start dist/index.js --name imbio-server
pm2 save
pm2 startup
```

---

## 🌐 Conectar las PCs clientes

### 1. Averigua la IP de la PC servidor

En la PC servidor (Mac):

```bash
ipconfig getifaddr en0        # Wi-Fi
ipconfig getifaddr en1        # Ethernet
```

Ejemplo: `192.168.1.50`

### 2. Abre el puerto en el firewall

**macOS:**

```bash
# Abrir el puerto 3000 (TCP) en el firewall de aplicación
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/node
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblock /usr/local/bin/node
```

Si el firewall de macOS te lo pide, acepta cuando se inicie el server.

**Windows (PowerShell como admin):**

```powershell
New-NetFirewallRule -DisplayName "IMBIO Server" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

### 3. Configura el frontend (PCs clientes)

En cada PC cliente, al abrir la app Tauri, ve a **Configuración → Servidor** y pon:

```
URL: http://192.168.1.50:3000
```

(o el IP de tu PC servidor — esto se conecta en el siguiente paso del desarrollo)

### 4. Verifica conectividad

Desde cualquier PC cliente, abre el navegador y ve a:

```
http://192.168.1.50:3000/health
```

Deberías ver: `{"ok":true,"service":"imbio-server",...}`

---

## 📡 Endpoints principales

### Health

| Método | Ruta           | Descripción                            |
| ------ | -------------- | -------------------------------------- |
| GET    | `/health`      | El server responde                     |
| GET    | `/health/db`   | Server + DB responden                  |
| GET    | `/info`        | Versión, conteos, datos institucionales |

### Ciudadanos

| Método | Ruta                       | Descripción                          |
| ------ | -------------------------- | ------------------------------------ |
| GET    | `/ciudadanos`              | Lista (filtros: `q`, `page`, `limit`, `activo`) |
| GET    | `/ciudadanos/:id`          | Detalle + últimas 20 solicitudes     |
| GET    | `/ciudadanos/curp/:curp`   | Búsqueda rápida por CURP             |
| POST   | `/ciudadanos`              | Registrar ciudadano                  |
| PATCH  | `/ciudadanos/:id`          | Actualizar datos                     |
| DELETE | `/ciudadanos/:id`          | Desactivar (borrado lógico)          |

### Trámites (catálogo)

| Método | Ruta                  | Descripción                                |
| ------ | --------------------- | ------------------------------------------ |
| GET    | `/tramites`           | Listar (filtros: `categoria`, `q`, `activo`) |
| GET    | `/tramites/:idOrCodigo` | Detalle (por ID numérico o por código)   |
| POST   | `/tramites`           | Crear trámite personalizado               |
| PATCH  | `/tramites/:id`       | Editar (campos, precio, etc.)              |
| DELETE | `/tramites/:id`       | Desactivar                                 |

### Solicitudes (flujo completo)

| Método | Ruta                              | Descripción                                            |
| ------ | --------------------------------- | ------------------------------------------------------ |
| GET    | `/solicitudes`                    | Listar (filtros: `estado`, `tramiteId`, `q`, `desde`, `hasta`) |
| GET    | `/solicitudes/:idOrFolio`         | Detalle                                                |
| POST   | `/solicitudes`                    | Crear (estado inicial según `requierePago`)            |
| PATCH  | `/solicitudes/:id`                | Editar datos (antes del pago)                          |
| POST   | `/solicitudes/:id/estado`         | Cambiar estado (transiciones validadas)                |
| POST   | `/solicitudes/:id/pago`           | Registrar pago + pasar a `PAGADA`                      |
| POST   | `/solicitudes/:id/autorizacion`   | Crear autorización + pasar a `AUTORIZADA`              |
| DELETE | `/solicitudes/:id`                | Solo si está en `REGISTRADA`                           |

#### Flujo de estados

```
REGISTRADA ─┬─→ PENDIENTE_PAGO ─→ PAGADA ─┬─→ EN_REVISION ─→ AUTORIZADA
            │                              │
            ├─→ EN_REVISION (si no requiere pago)
            │                              ├─→ RECHAZADA
            └─→ CANCELADA                  └─→ CANCELADA
```

---

## 🗄️ Estructura del schema

| Modelo         | Propósito                                              |
| -------------- | ------------------------------------------------------ |
| `Ciudadano`    | Personas registradas                                   |
| `Tramite`      | Catálogo de los 15 tipos (campos dinámicos en JSON)    |
| `Solicitud`    | Caso concreto de un ciudadano pidiendo un trámite     |
| `Pago`         | Folio de pago del banco/recaudación                    |
| `Autorizacion` | Documento final con número oficial                    |
| `Tecnico`      | Personal que firma autorizaciones                      |
| `Usuario`      | Operadores/admin del sistema                           |
| `Configuracion`| Singleton con datos institucionales                    |

---

## 🛠️ Scripts útiles

```bash
# Desde la raíz del repo
npm run server:dev          # dev con hot-reload
npm run server:build        # compilar a dist/
npm run server:start        # correr compilado

# Base de datos
npm run db:generate         # generar Prisma Client
npm run db:migrate          # crear/aplicar migración
npm run db:seed             # sembrar 15 trámites
npm run db:studio           # Prisma Studio (GUI para ver la DB)
npm run db:reset            # ⚠️  BORRA todo y re-migra
```

---

## 🔐 Notas de seguridad

- **Red local solamente**: Este server está pensado para LAN. NO lo expongas a internet sin un proxy reverso con HTTPS.
- **Autenticación**: El modelo `Usuario` ya está en el schema, pero la implementación de login es para la siguiente iteración.
- **CORS**: En LAN está abierto (`*`). Para producción, lista las IPs explícitas en `CORS_ORIGINS`.
- **Contraseña admin**: El seed crea `admin` con password `admin123` (placeholder, **cámbialo** en la primera corrida real).

---

## 📂 Estructura

```
server/
├── prisma/
│   ├── schema.prisma      # Modelos
│   └── seed.ts            # 15 trámites preconfigurados
├── src/
│   ├── index.ts           # Entry point
│   ├── server.ts          # Setup de Fastify
│   ├── env.ts             # Variables de entorno
│   ├── prisma.ts          # Cliente Prisma (singleton)
│   ├── lib/
│   │   ├── errors.ts      # Manejo de errores consistente
│   │   └── folios.ts      # Generación de folios
│   └── routes/
│       ├── health.ts
│       ├── ciudadanos.ts
│       ├── tramites.ts
│       └── solicitudes.ts
├── .env                   # (gitignore'd)
├── .env.example
├── package.json
└── tsconfig.json
```
