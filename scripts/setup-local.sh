#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [ ! -f .env ]; then
  echo "• Criando .env a partir de .env.example"
  cp .env.example .env
else
  echo "• .env já existe — mantendo configurações atuais"
fi

echo "• Instalando dependências do monorepo"
npm install

echo "• Gerando Prisma Client"
npm run prisma:generate --workspace apps/api

echo "• Aplicando migrações do banco"
npm run prisma:migrate --workspace apps/api

echo "• Executando seed (cria o admin inicial se configurado)"
npm run prisma:seed --workspace apps/api

echo "✅ Pronto! Rode \"npm run dev\" para iniciar API e frontend."
