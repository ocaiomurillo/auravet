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
docker compose --env-file "$REPO_ROOT/.env" run --rm api \
  sh -lc "cd /app && npx prisma migrate deploy --schema prisma/schema.prisma"

echo "• Aplicando seed dentro de um container efêmero da API"
docker compose --env-file "$REPO_ROOT/.env" run --rm api \
  sh -lc "cd /app && npm run prisma:seed"

echo "• Subindo API e Web (detach)"
docker compose --env-file "$REPO_ROOT/.env" up -d api web

echo "✅ Pronto! Acesse web em http://localhost:5173 e API em http://localhost:4000"
