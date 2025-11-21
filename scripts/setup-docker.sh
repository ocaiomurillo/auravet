#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT/infra/docker"

echo "• Subindo stack Docker (build + detach)"
docker compose up --build -d

echo "• Aplicando migrações dentro do container API"
docker compose exec api sh -c "npx prisma migrate deploy"

echo "• Aplicando seed dentro do container API"
docker compose exec api sh -c "npx prisma db seed"

echo "✅ Pronto! Acesse web em http://localhost:5173 e API em http://localhost:4000"
