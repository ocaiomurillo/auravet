# Auravet — Cuidar é natural.

Auravet é uma clínica veterinária digital-first que une ciência e acolhimento. Este monorepo entrega frontend React com Tailwind e backend Node + Express + Prisma, totalmente integrado com PostgreSQL, validação Zod e documentação Swagger.

## ✨ Identidade Auravet
- **Paleta:** savia `#A7C7A0`, azul `#B3D4E0`, verde escuro `#3D6655`, gelo `#F8FAF9`, grafite `#0F172A`.
- **Tipografia:** Montserrat (títulos) e Nunito Sans (texto).
- **Tom:** empático, didático, sustentável.

## 🏗️ Estrutura do monorepo
```
auravet/
├─ apps/
│  ├─ api/        # Node 20 + Express + Prisma + Swagger
│  └─ web/        # React 18 + Vite + TailwindCSS (tema Auravet)
├─ docs/          # Visual previews
├─ infra/docker/  # Docker Compose stack
├─ .env.example
├─ package.json   # Workspaces (api + web)
└─ README.md
```

## 🚀 Primeiros passos

### 1. Pré-requisitos
- Node.js 20+
- npm 9+
- PostgreSQL 16 (opcional se usar Docker)

### 2. Configuração de ambiente
```bash
cp .env.example .env
```
Ajuste `DATABASE_URL`, `API_PORT`, `CORS_ORIGIN` e `VITE_API_URL` conforme o cenário.

### 3. Instalar dependências
```bash
npm install
```

### 4. Preparar banco de dados
```bash
npm run prisma:generate --workspace apps/api
npm run prisma:migrate --workspace apps/api
```

### 5. Executar em modo desenvolvimento
```bash
npm run dev
```
- API disponível em `http://localhost:4000`
- Swagger em `http://localhost:4000/docs`
- Frontend em `http://localhost:5173`

### 6. Scripts úteis
- `npm run lint` — ESLint em ambos os apps.
- `npm run typecheck` — TypeScript estrito.
- `npm run format` — Prettier (modo check).
- `npm run build` — build completo (api + web).

## 🐳 Stack com Docker
```bash
cd infra/docker
cp ../../.env.example ../../.env  # se ainda não existir
docker compose up --build
```
Serviços provisionados:
- **db**: PostgreSQL 16 (healthcheck incluso).
- **api**: Express + Prisma rodando em `http://localhost:4000`.
- **web**: Vite build servido por Nginx em `http://localhost:5173`.

## 🔌 API REST
Principais endpoints:
- `GET /health`
- CRUD de tutores (`/owners`)
- CRUD de animais + histórico (`/animals`)
- Serviços com filtros (`/services`)
- Swagger: `GET /docs`

Todas as requisições passam por validação Zod (422 em caso de erro) e retornam `{ error, details? }` para mensagens amigáveis.

## 🖥️ Frontend React
- React Router com páginas: Home, Tutores, Animais, Serviços, Novo Serviço.
- Componentes de design (Logo, Header, Card, Field, Button, Modal) com Tailwind e fontes Montserrat/Nunito.
- React Query + Fetch wrapper (`apiClient`) usando `VITE_API_URL`.
- Formulários com React Hook Form, toasts com Sonner e modais HeadlessUI.

Fluxo mínimo testável:
1. Cadastre um tutor em **Tutores**.
2. Cadastre um pet em **Animais** vinculando ao tutor.
3. Registre dois serviços em **Registrar serviço**.
4. Veja o histórico completo em **Animais** e filtre em **Serviços**.

## 📸 Previews
| Tela | Visual |
| ---- | ------ |
| Home | ![Home Auravet](docs/home-preview.svg) |
| Tutores | ![Tutores Auravet](docs/owners-preview.svg) |
| Serviços | ![Serviços Auravet](docs/services-preview.svg) |

## 🔍 Qualidade e automações
- **TypeScript estrito** nos dois apps.
- **ESLint + Prettier** configurados por workspace.
- **Husky** roda `lint` + `typecheck` em todo commit.
- **Prisma** com relacionamentos Owner → Animal → Serviço e enumerações oficiais da clínica.

## 💚 Filosofia de produto
> “Na Auravet, seu pet é cuidado com ciência e carinho.”

Toda a copy e experiência seguem essa premissa, entregando uma plataforma acolhedora, sustentável e didática para a equipe da clínica.
