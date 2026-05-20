# Colibri — DigitalOcean Deployment Guide

Target: Ubuntu droplet, subdomain `colibri.gabitosoft.com`  
Stack: NestJS API (port 3000) + React/Vite SPA served via Nginx + PostgreSQL

---

## 1. Server prerequisites

```bash
# Node.js 20 via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20 && nvm use 20 && nvm alias default 20

# PostgreSQL, Nginx, Certbot
apt update
apt install -y postgresql postgresql-contrib nginx certbot python3-certbot-nginx

# PM2 (process manager)
npm install -g pm2
```

---

## 2. PostgreSQL setup

```bash
sudo -u postgres psql
```

```sql
CREATE USER colibri_user WITH PASSWORD 'strong-password-here';
CREATE DATABASE colibri OWNER colibri_user;
\q
```

Then enable the `uuid-ossp` extension (required by the migrations):

```bash
sudo -u postgres psql -d colibri -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
```

---

## 3. Clone and build the project

```bash
mkdir -p /var/www/colibri.gabitosoft.com
cd /var/www/colibri.gabitosoft.com
git clone <repo-url> .

npm ci --workspaces
npm run build
```

The React build output lands at `apps/web/dist/` — Nginx serves from there.

---

## 4. API environment variables

Create `apps/api/.env` on the server (never commit this file):

```env
NODE_ENV=production
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_USER=colibri_user
DB_PASSWORD=strong-password-here
DB_NAME=colibri

JWT_SECRET=<output of: openssl rand -hex 64>
JWT_EXPIRES_IN=7d

CORS_ORIGIN=https://colibri.gabitosoft.com
```

> **Important:** `NODE_ENV=production` disables TypeORM's `synchronize` mode.
> Run migrations manually if needed.

---

## 5. Run database migrations

Migrations live in `apps/api/src/migrations/` and are tracked in a `migrations` table TypeORM creates automatically.

```bash
cd /var/www/colibri.gabitosoft.com
npm run migration:run --workspace=apps/api
```

Expected output — one line per statement, ending with:

```
Migration InitialSchema1747612800000 has been executed successfully.
```

To undo the last migration if something goes wrong:

```bash
npm run migration:revert --workspace=apps/api
```

### Adding migrations in the future (locally)

After changing an entity, generate a migration against the local dev database:

```bash
cd apps/api
npm run migration:generate --name=describe-your-change
```

Review the generated file in `src/migrations/` before committing — TypeORM can emit destructive `DROP` statements if it misreads a column rename. Then build, commit, and run `migration:run` on the server as part of the redeployment step.

---

## 6. Start the API with PM2

Pass the `.env` path explicitly so PM2 finds it regardless of working directory:

```bash
pm2 start /var/www/colibri.gabitosoft.com/apps/api/dist/main.js \
  --name colibri-api \
  --node-args="--env-file=/var/www/colibri.gabitosoft.com/apps/api/.env"
pm2 save
pm2 startup   # follow the printed command to enable auto-start on reboot
```

> If the project is cloned into the user's home directory instead (e.g. `/home/deployer/colibri`), adjust both paths accordingly.

Useful PM2 commands:

```bash
pm2 status              # check running processes
pm2 logs colibri-api    # tail logs
pm2 restart colibri-api # restart after a redeploy
```

---

## 7. Nginx — phase 1 (HTTP only)

**Do this before running Certbot.** Certbot needs Nginx running to complete the ACME challenge.

```bash
nano /etc/nginx/sites-available/colibri.gabitosoft.com
```

Paste an HTTP-only config:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name colibri.gabitosoft.com;

    root /var/www/colibri.gabitosoft.com/apps/web/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location ~ /\. { deny all; }
}
```

Enable and start:

```bash
ln -s /etc/nginx/sites-available/colibri.gabitosoft.com /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
```

---

## 8. SSL certificate with Certbot

```bash
certbot --nginx -d colibri.gabitosoft.com
```

Certbot will write SSL directives into the config automatically.

### Critical — fix the config after Certbot runs

Certbot sometimes merges its SSL directives into the wrong block, creating a redirect loop (`ERR_TOO_MANY_REDIRECTS`). After Certbot finishes, **replace the entire file** with the clean version from `deploy/nginx/colibri.conf` (already has the correct two-block structure):

```bash
cp /path/to/repo/deploy/nginx/colibri.conf /etc/nginx/sites-available/colibri.gabitosoft.com
nginx -t && systemctl reload nginx
```

The file in this repo is the canonical reference. The two blocks must be:

| Block | Listens on | Does |
|---|---|---|
| Block 1 | `80` | Redirects all traffic to HTTPS |
| Block 2 | `443 ssl` | Serves the SPA and proxies `/api/` |

Never let Certbot produce a block that listens on `443` **and** contains a `return 301` — that is the loop.

---

## 9. Firewall

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'   # ports 80 + 443
ufw enable
ufw status
```

Port 3000 must **not** be open publicly — Nginx proxies all traffic to it internally.

---

## 10. Verify the deployment

```bash
# Check Nginx config is valid
nginx -t

# Check API process is running
pm2 status

# Test HTTP redirect
curl -I http://colibri.gabitosoft.com

# Test HTTPS response
curl -Ik https://colibri.gabitosoft.com

# Tail API logs
pm2 logs colibri-api --lines 50
```

---

## 11. Redeployment (future updates)

```bash
cd /var/www/colibri.gabitosoft.com
git pull
npm ci --workspaces
npm run build
npm run migration:run --workspace=apps/api
pm2 restart colibri-api
```

No Nginx reload needed unless the config changed. `migration:run` is a no-op if there are no new migrations, so it's safe to include on every deploy.

---

## Directory layout on the server

```
/var/www/colibri.gabitosoft.com/
├── apps/
│   ├── api/
│   │   ├── dist/          # compiled NestJS (served by PM2)
│   │   └── .env           # production secrets (not in git)
│   └── web/
│       └── dist/          # compiled React SPA (served by Nginx)
├── packages/
└── ...

/etc/nginx/sites-available/colibri.gabitosoft.com   # Nginx config
/etc/letsencrypt/live/colibri.gabitosoft.com/       # SSL certs (auto-renewed)
```
