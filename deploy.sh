#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════
# PushSisten — Script de Deploy Automatizado
# VPS: Ubuntu (Hostinger)
# Domínio: pushsisten.com.br
# ═══════════════════════════════════════════════════════

echo "══════════════════════════════════════════════"
echo "  PushSisten — Deploy Automatizado"
echo "══════════════════════════════════════════════"
echo ""

# ─── ETAPA A: Preparar o servidor ───────────────────
echo "[1/8] Atualizando sistema..."
apt update -qq && apt upgrade -y -qq

echo "[2/8] Instalando Docker, Nginx, Git..."
apt install -y -qq docker.io docker-compose-plugin git curl nginx
systemctl enable docker
systemctl start docker

echo "  ✔ Docker: $(docker --version | cut -d' ' -f3)"
echo "  ✔ Compose: $(docker compose version --short)"

# ─── ETAPA B: Clonar repositório ────────────────────
echo "[3/8] Clonando repositório..."
mkdir -p /opt/pushsisten
cd /opt/pushsisten

if [ -d ".git" ]; then
  echo "  Repositório já existe, atualizando..."
  git pull origin main
else
  git clone https://github.com/andreiquerencia-create/PushSisten.git .
fi

# ─── ETAPA C: Gerar senhas e criar .env ─────────────
echo "[4/8] Gerando credenciais e criando .env..."

PG_PASS=$(openssl rand -base64 24 | tr -d '/+=\n' | cut -c1-32)
AUTH_SECRET=$(openssl rand -base64 32 | tr -d '\n')
BACKUP_SECRET=$(openssl rand -base64 24 | tr -d '/+=\n' | cut -c1-32)

cat > .env << EOF
# ═══ Banco de Dados ═══
DATABASE_URL="postgresql://pushy:${PG_PASS}@db:5432/pushy?connection_limit=10&pool_timeout=20"
POSTGRES_PASSWORD="${PG_PASS}"

# ═══ Auth ═══
NEXTAUTH_SECRET="${AUTH_SECRET}"
NEXTAUTH_URL="https://pushsisten.com.br"

# ═══ IA (OpenAI) ═══
LLM_API_BASE_URL=https://api.openai.com
LLM_API_KEY=__LLM_API_KEY__
LLM_MODEL=gpt-4o-mini

# ═══ Storage (placeholder — migrar para R2 depois) ═══
# AWS_REGION=auto
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# AWS_BUCKET_NAME=
# AWS_ENDPOINT=

# ═══ Backup ═══
BACKUP_WORKER_SECRET="${BACKUP_SECRET}"

# ═══ Mercado Pago (placeholder) ═══
MP_ACCESS_TOKEN=PLACEHOLDER
MP_PUBLIC_KEY=PLACEHOLDER
MP_SANDBOX=true
MP_WEBHOOK_SECRET=PLACEHOLDER
BILLING_PROVIDER=mercadopago
BILLING_GRACE_DAYS=5

# ═══ Sistema ═══
PROTECTED_COMPANY_IDS=""
EOF

echo "  ✔ .env criado com senhas geradas automaticamente"
echo "  ⚠ IMPORTANTE: Edite /opt/pushsisten/.env e coloque sua LLM_API_KEY real!"
echo "    Senha do PostgreSQL: ${PG_PASS}"
echo ""

# ─── ETAPA D: Subir banco e restaurar dump ──────────
echo "[5/8] Subindo container do PostgreSQL..."
docker compose up -d db
echo "  Aguardando Postgres inicializar..."
sleep 15

# Verificar se o dump existe
if [ -f "/opt/pushsisten/pushsisten_backup_completo.sql" ]; then
  echo "  Restaurando dump do banco..."
  docker exec -i $(docker compose ps -q db) psql -U pushy -d pushy < /opt/pushsisten/pushsisten_backup_completo.sql 2>&1 | tail -5
  echo "  ✔ Dump restaurado!"
  echo "  Validando..."
  docker exec $(docker compose ps -q db) psql -U pushy -d pushy -c "SELECT 'Companies: ' || count(*) FROM companies;"
  docker exec $(docker compose ps -q db) psql -U pushy -d pushy -c "SELECT 'Sales: ' || count(*) FROM sales;"
  docker exec $(docker compose ps -q db) psql -U pushy -d pushy -c "SELECT 'Users: ' || count(*) FROM users;"
else
  echo "  ⚠ Dump não encontrado em /opt/pushsisten/pushsisten_backup_completo.sql"
  echo "  Para enviar o dump do seu PC, execute (no PowerShell/Git Bash do Windows):"
  echo "    scp \"C:\\Users\\Alice\\PUSHSISTEN 01\\05-MIGRACAO\\pushsisten_backup_completo.sql\" root@179.197.77.193:/opt/pushsisten/"
  echo "  Depois rode: docker exec -i \$(docker compose ps -q db) psql -U pushy -d pushy < /opt/pushsisten/pushsisten_backup_completo.sql"
  echo ""
fi

# ─── ETAPA E: Build e start do app ──────────────────
echo "[6/8] Fazendo build da aplicação (pode demorar 3-5 min)..."
docker compose up -d --build

echo "  Aguardando app inicializar..."
sleep 10

if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200\|302"; then
  echo "  ✔ App rodando na porta 3000!"
else
  echo "  ⚠ App pode estar iniciando. Verifique: docker compose logs app --tail 30"
fi

# ─── ETAPA F: Nginx reverse proxy ───────────────────
echo "[7/8] Configurando Nginx..."

cat > /etc/nginx/sites-available/pushsisten << 'NGINX'
server {
    listen 80;
    server_name pushsisten.com.br www.pushsisten.com.br;

    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Timeouts generosos para SSE (streaming IA)
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/pushsisten /etc/nginx/sites-enabled/pushsisten
rm -f /etc/nginx/sites-enabled/default

if nginx -t 2>&1 | grep -q "ok"; then
  systemctl restart nginx
  echo "  ✔ Nginx configurado e rodando!"
else
  echo "  ✖ Erro na configuração do Nginx:"
  nginx -t
fi

# ─── ETAPA G: Backup automático ─────────────────────
echo "[8/8] Configurando backup automático..."

mkdir -p /backups

cat > /opt/pushsisten/backup.sh << 'BACKUP'
#!/bin/bash
STAMP=$(date +%F_%H%M)
mkdir -p /backups
docker exec $(docker compose -f /opt/pushsisten/docker-compose.yml ps -q db) pg_dump -U pushy pushy | gzip > /backups/pushy_$STAMP.sql.gz
find /backups -name "*.sql.gz" -mtime +14 -delete
echo "Backup concluído: $STAMP"
BACKUP

chmod +x /opt/pushsisten/backup.sh

# Adicionar ao crontab se não existir
if ! crontab -l 2>/dev/null | grep -q "backup.sh"; then
  (crontab -l 2>/dev/null; echo "0 3 * * * /opt/pushsisten/backup.sh >> /var/log/pushsisten-backup.log 2>&1") | crontab -
  echo "  ✔ Backup agendado (diário às 3h)"
else
  echo "  ✔ Backup já estava agendado"
fi

# ─── FIM ────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════"
echo "  ✅ Deploy concluído!"
echo "══════════════════════════════════════════════"
echo ""
echo "  🌐 URL: https://pushsisten.com.br"
echo "  📦 App: docker compose -f /opt/pushsisten/docker-compose.yml ps"
echo "  📋 Logs: docker compose -f /opt/pushsisten/docker-compose.yml logs app --tail 50"
echo "  🔄 Rebuild: cd /opt/pushsisten && git pull && docker compose up -d --build"
echo ""
echo "  ⚠ Lembrete:"
echo "    1. Edite /opt/pushsisten/.env e coloque sua LLM_API_KEY real"
echo "    2. No Cloudflare: SSL/TLS → modo 'Flexible'"
echo "    3. Teste: https://pushsisten.com.br"
echo ""
