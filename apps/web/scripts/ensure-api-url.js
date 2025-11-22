#!/usr/bin/env node
import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const modeFromEnv = process.env.MODE ?? process.env.NODE_ENV;
const mode = modeFromEnv?.trim() || 'production';
const envCandidates = [`.env.${mode}`, '.env'];

for (const candidate of envCandidates) {
  const envPath = resolve(process.cwd(), candidate);
  if (existsSync(envPath)) {
    config({ path: envPath, override: false });
  }
}

if (!process.env.VITE_API_URL) {
  console.error(
    `Erro: VITE_API_URL não definida. Configure a variável ou crie um arquivo .env.<modo> com o endpoint da API antes do build. Modo atual: ${mode}.`,
  );
  process.exit(1);
}

console.log(`VITE_API_URL configurada para ${process.env.VITE_API_URL} (modo ${mode}).`);
