# Colibri

GPS location tracking SaaS. Devices push coordinates from Android; the web dashboard shows real-time history on a map.

## Architecture

```
colibri/
├── apps/
│   ├── api/        NestJS + Express + TypeORM  (port 3000)
│   ├── web/        React 19 + Vite + TailwindCSS (port 5173)
│   └── android/    Kotlin Android app
├── packages/
│   └── shared/     Shared TypeScript types
└── docker-compose.yml  PostgreSQL
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20+ |
| npm | 10+ |
| Docker + Docker Compose | any recent |
| Android Studio | Ladybug+ (for Android app) |

---

## Local development

### 1. Install dependencies

```bash
npm install
```

### 2. Start PostgreSQL

```bash
docker-compose up -d
```

### 3. Configure the API

```bash
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env` and set at minimum:

```env
JWT_SECRET=a-long-random-string   # change this
```

### 4. Run both apps concurrently

```bash
npm run dev
```

| Service | URL |
|---------|-----|
| API | http://localhost:3000 |
| Web | http://localhost:5173 |

The database schema is created automatically on first run (`synchronize: true` in development).

---

## Running apps individually

```bash
# API only
npm run dev --workspace=apps/api

# Web only
npm run dev --workspace=apps/web
```

---

## Environment variables — API (`apps/api/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | `development` or `production` |
| `PORT` | `3000` | HTTP port |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | `postgres` | Database password |
| `DB_NAME` | `colibri` | Database name |
| `JWT_SECRET` | — | **Required.** Secret for signing JWT tokens |
| `JWT_EXPIRES_IN` | `7d` | Token expiry |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |

---

## API endpoints

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/login` | — | Login with email, password, tenantSlug |
| `GET` | `/api/auth/me` | JWT | Returns current user |

**Login body:**
```json
{
  "email": "user@example.com",
  "password": "password",
  "tenantSlug": "my-workspace"
}
```

### Tenants

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/tenants` | JWT | Create tenant |
| `GET` | `/api/tenants` | JWT | List tenants |
| `GET` | `/api/tenants/:id` | JWT | Get tenant |

### Users

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/users` | JWT | Create user |
| `GET` | `/api/users` | JWT | List users (tenant-scoped) |
| `GET` | `/api/users/:id` | JWT | Get user |

### Devices

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/devices` | JWT | Register a device (returns `deviceKey`) |
| `GET` | `/api/devices` | JWT | List devices (tenant-scoped) |
| `GET` | `/api/devices/:id` | JWT | Get device |
| `PATCH` | `/api/devices/:id` | JWT | Update device |
| `DELETE` | `/api/devices/:id` | JWT | Delete device + history |

### Location tracking

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/locations/:deviceKey` | deviceKey | Push a location (Android) |
| `GET` | `/api/devices/:id/locations` | JWT | Location history |
| `GET` | `/api/devices/:id/locations/latest` | JWT | Latest location |

**Push location body** (from Android):
```json
{
  "latitude": 9.9341,
  "longitude": -84.0877,
  "altitude": 1150.0,
  "speed": 12.5,
  "heading": 270.0,
  "accuracy": 5.0,
  "recordedAt": "2026-05-09T22:00:00.000Z"
}
```

**History query params:** `from`, `to` (ISO 8601), `limit` (max 1000), `offset`

---

## Android app

Located at `apps/android/`. Open the folder in Android Studio and sync Gradle.

### Setup in the app

1. Open the app on the device
2. Enter the **Server URL** — must be reachable from the device (use your server's public IP or domain, not `localhost`)
3. Paste the **Device Key** shown after registering a device in the web dashboard
4. Choose a **send interval**
5. Tap **Start tracking**

The app runs a foreground service and will auto-restart after device reboot if tracking was active.

### Requirements

- Android 8.0+ (API 26)
- Location permission — "Allow all the time" for background tracking

---

## Production deployment

### API

1. Build the app:
   ```bash
   npm run build --workspace=apps/api
   ```

2. Set production environment variables (see table above). Critical changes:
   ```env
   NODE_ENV=production
   JWT_SECRET=<strong-random-secret>
   DB_PASSWORD=<strong-password>
   CORS_ORIGIN=https://your-frontend-domain.com
   ```

3. Start:
   ```bash
   node apps/api/dist/main.js
   ```

4. **Before going to production**, switch `synchronize: false` in `database.module.ts` and use TypeORM migrations instead:
   ```bash
   npm run migration:generate --workspace=apps/api -- -n InitialSchema
   npm run migration:run --workspace=apps/api
   ```

### Web

1. Build:
   ```bash
   npm run build --workspace=apps/web
   ```
   Output is in `apps/web/dist/` — serve with any static host (Nginx, Vercel, Cloudflare Pages, etc.).

2. Set the Vite proxy target or configure your reverse proxy so `/api/*` routes to the API server.

### Docker Compose (production database)

```bash
# Override credentials for production
DB_USER=colibri_prod DB_PASSWORD=<strong-password> docker-compose up -d
```

---

## Multitenant model

- Every **tenant** has a unique `slug` (e.g. `acme-corp`)
- **Users** are scoped to a tenant — the same email can exist in multiple tenants
- **Devices** are scoped to a tenant; they authenticate using a `deviceKey` (not a user JWT)
- Every JWT carries `tenantId`, so all data queries are automatically tenant-isolated

### Initial setup flow

```
1. POST /api/tenants          → create a workspace
2. POST /api/users            → create the first user (role: owner)
3. POST /api/auth/login       → get a JWT
4. POST /api/devices          → register a device, copy the deviceKey
5. Configure the Android app  → paste server URL + deviceKey
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API + web concurrently |
| `npm run build` | Build all packages |
| `npm run lint` | Lint all workspaces |
| `npm run test` | Run tests in all workspaces |
