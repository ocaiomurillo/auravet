#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT/infra/docker"

echo "• Limpando containers e volumes anteriores (db zerado)"
docker compose --env-file "$REPO_ROOT/.env" down -v || true

echo "• Buildando imagens da API e Web"
docker compose --env-file "$REPO_ROOT/.env" build api web

echo "• Subindo apenas o banco de dados"
docker compose --env-file "$REPO_ROOT/.env" up -d db

echo "• Aplicando migrações (Prisma) antes de subir a API"
docker compose --env-file "$REPO_ROOT/.env" run --rm api sh -c "npx prisma migrate deploy"

echo "• Rodando seed (Prisma) dentro do container da API"
docker compose --env-file "$REPO_ROOT/.env" run --rm api sh -c "
  npx prisma generate &&
  npx tsc prisma/seed.ts \
    --module commonjs \
    --moduleResolution node \
    --target ES2020 \
    --outDir prisma/dist \
    --esModuleInterop \
    --resolveJsonModule \
    --skipLibCheck &&
  echo 'Arquivos em prisma/:' && ls prisma &&
  echo 'Arquivos em prisma/dist/:' && ls prisma/dist &&
  node prisma/dist/seed.js
"

echo "• Subindo API e Web (detach)"
docker compose --env-file "$REPO_ROOT/.env" up -d api web

echo "✅ Pronto! Acesse web em http://localhost:5173 e API em http://localhost:4000"
