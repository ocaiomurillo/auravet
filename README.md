# Auravet — Cuidar é natural

Auravet é a clínica veterinária digital-first da equipe, com backend Node + Express + Prisma, frontend React + Vite + Tailwind e infraestrutura preparada para rodar tanto localmente quanto via Docker. Este guia foi reescrito para orientar a instalação passo a passo nos dois cenários.

## 📁 Estrutura do monorepo
```
auravet/
├─ apps/
│  ├─ api/        # Node 20, Express, Prisma, Swagger
│  └─ web/        # React 18, Vite, Tailwind (tema Auravet)
├─ docs/          # Prévias visuais
├─ infra/docker/  # Stack Docker Compose
├─ .env.example
├─ package.json   # Scripts e workspaces
└─ README.md
```

## 🧰 Tecnologias principais
- Node.js 20 + Express, Prisma ORM, Swagger
- React 18, Vite, TailwindCSS, React Query
- PostgreSQL 16
- Husky, ESLint, Prettier, TypeScript estrito

## ✅ Pré-requisitos
| Cenário | Dependências |
| ------- | ------------- |
| **Sem Docker (instalação local)** | Node.js 20+, npm 9+, PostgreSQL 16 (servidor acessível), `psql`/`createdb` opcionais |
| **Com Docker** | Docker 24+, Docker Compose Plugin | 

## 🔐 Variáveis de ambiente
1. Copie o arquivo base:
   ```bash
   cp .env.example .env
   ```
2. Ajuste os valores conforme o ambiente:
   - `DATABASE_URL` (conexão PostgreSQL)
   - `API_PORT`, `API_HOST`, `CORS_ORIGIN`
   - `JWT_SECRET`, `JWT_EXPIRES_IN`, `PASSWORD_SALT_ROUNDS`
   - `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME` (opcionais)
   - `VITE_API_URL` (URL consumida pelo frontend; defina antes de gerar o build de produção)

> `PASSWORD_SALT_ROUNDS` controla o custo exponencial (`2^N`) usado pelo Scrypt ao hashear senhas.

---

## 🖥️ Instalação local (sem Docker)
1. **Clonar o repositório**
   ```bash
   git clone https://github.com/<sua-organizacao>/auravet.git
   cd auravet
   ```

2. **Garantir PostgreSQL**
   - Crie um banco vazio conforme o `DATABASE_URL`. Exemplo:
     ```bash
     createdb auravet
     ```
   - Certifique-se de que o usuário definido na conexão possui permissões de leitura/escrita.

3. **Instalar dependências**
   ```bash
   npm install
   ```

4. **Gerar Prisma Client, migrar e semear dados**
   ```bash
   npm run prisma:generate --workspace apps/api
   npm run prisma:migrate --workspace apps/api
   npm run prisma:seed --workspace apps/api
   ```
   - O comando `prisma:migrate` aplicará todas as migrações no banco configurado.
   - O seed cria o usuário administrador (email e senha definidos em `.env`).

5. **Executar em modo desenvolvimento**
   ```bash
   npm run dev
   ```
   - API: `http://localhost:4000`
   - Swagger: `http://localhost:4000/docs`
   - Frontend: `http://localhost:5173`

6. **Executar serviços individualmente (opcional)**
   ```bash
   npm run dev --workspace apps/api   # somente API
   npm run dev --workspace apps/web   # somente frontend
   ```

---

## 🐳 Instalação com Docker
1. **Preparar variáveis**
   - Garanta que o arquivo `.env` na raiz contenha os valores desejados.
   - (Opcional) Exponha `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT`, `API_PORT`, `WEB_PORT` diretamente no shell antes de subir o Compose para sobrescrever os padrões.

2. **Subir a stack**
   ```bash
   cd infra/docker
   docker compose up --build -d
   ```
   Serviços publicados:
   - PostgreSQL (`db`): porta padrão 5432
   - API (`api`): `http://localhost:4000`
   - Frontend (`web`): `http://localhost:5173`

3. **Aplicar migrações e seed dentro do container**
   ```bash
   docker compose exec api npx prisma migrate deploy
   docker compose exec api npx prisma db seed
   ```
   Esses comandos usam o Prisma instalado na imagem para sincronizar o schema e criar o administrador inicial.

4. **Logs e desligamento**
   ```bash
   docker compose logs -f api web
   docker compose down            # encerra todos os serviços
   docker compose down -v         # encerra e remove volume do banco
   ```

---

## 🧪 Scripts e checagens úteis
- `npm run lint` — aplica ESLint nos workspaces.
- `npm run typecheck` — roda o TypeScript em modo estrito.
- `npm run format` — verifica formatação com Prettier.
- `npm run build` — build completo da API e do frontend.
- `npm run test --workspace apps/api` — suite de autenticação/autorização com Node Test Runner.

## 🚀 Fluxo funcional mínimo
1. Acesse `/login` com o administrador seed (`SEED_ADMIN_EMAIL`).
2. Cadastre um tutor em **Tutores** e inclua os respectivos pets em **Animais**.
3. Registre atendimentos em **Registrar serviço** (rotas protegidas por `services:write`).
4. Gerencie colaboradores em **Usuários** (apenas administradores).

## 🔍 Qualidade & design system
- Tema Tailwind customizado com paleta: savia `#A7C7A0`, azul `#B3D4E0`, verde escuro `#3D6655`, gelo `#F8FAF9`, grafite `#0F172A`.
- Tipografia Montserrat (títulos) e Nunito Sans (texto).
- Copy empática e sustentável, alinhada ao posicionamento “Na Auravet, seu pet é cuidado com ciência e carinho”.

Pronto! Escolha o cenário de instalação que melhor se adapta ao seu ambiente e comece a evoluir a plataforma Auravet.
