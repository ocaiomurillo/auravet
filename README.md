# Auravet 🐾  
_Plataforma web full stack para gestão de clínica veterinária_

A **Auravet** é uma clínica veterinária _digital-first_ que une tecnologia, ciência e acolhimento.  
Este repositório contém o sistema web da Auravet: uma plataforma completa para gerir **tutores, pets, agenda, atendimentos, estoque, caixa, financeiro, usuários e funções**, construída em monorepo com **React + Node.js + Prisma + PostgreSQL + Docker**.

> “Cuidar é natural” – e o objetivo do sistema é fazer com que a parte burocrática seja a mais leve possível.

---

## ✨ Principais funcionalidades

- **Cadastro de Tutores e Pets**
  - Registro completo de tutores (dados pessoais, contato, endereço)
  - Vínculo tutor ➝ múltiplos pets
  - Histórico de atendimentos por pet

- **Agenda e Agendamentos**
  - Agenda interna por profissional
  - Criação de agendamentos (data, horário, médico, assistente, pet)
  - Confirmação de presença
  - Reagendamento com verificação de conflitos

- **Atendimentos**
  - Abertura do atendimento a partir da agenda
  - Registro de anamnese, serviços realizados e produtos utilizados
  - Notas de prontuário por atendimento
  - Conclusão do atendimento gerando fatura automaticamente

- **Serviços e Produtos**
  - Catálogo de serviços (consultas, exames, vacinas, cirurgias…)
  - Cadastro e edição de produtos (medicamentos, insumos, itens de venda)
  - Controle de estoque e itens críticos
  - Inserção de serviços/produtos diretamente no atendimento e na fatura

- **Caixa e Faturas**
  - Faturas geradas automaticamente a partir dos atendimentos
  - Ajuste de itens na fatura (inclusive vendas de última hora)
  - Registro de pagamento com forma e condição de pagamento
  - Geração de **PDF** da fatura/recibo

- **Módulo Financeiro**
  - Monitoramento de faturas abertas, pagas e vencidas
  - Acompanhamento de inadimplência e renegociação
  - Cadastro de condições de pagamento (à vista, 30 dias, parcelado etc.)

- **Usuários, Funções e Permissões**
  - Cadastro de colaboradores (médicos, enfermeiros, auxiliares, assistentes, contador, admin)
  - Módulo de **funções** (roles) com controle de quais módulos cada função acessa
  - Modelo de autorização baseado em módulos/permissões

- **Dashboard**
  - Visão geral com indicadores operacionais da clínica (tutores, pets, atendimentos, faturas etc.)

---

## 🏗 Arquitetura

A Auravet foi construída em **arquitetura em camadas** e organizada em **monorepo**:

- **Frontend (Camada de Apresentação)**
  - React 18
  - Vite 5
  - Tailwind CSS
  - React Router, React Query, React Hook Form

- **Backend (Camada de Aplicação)**
  - Node.js 20
  - Express
  - Zod para validação de payloads
  - Swagger para documentação da API

- **Banco de Dados (Camada de Dados)**
  - PostgreSQL 16
  - Prisma ORM (mapeamento, migrações e tipagem)

- **Infraestrutura**
  - Docker + Docker Compose
  - npm workspaces (monorepo)
  - Husky + lint-staged (hooks de commit)
  - Configuração de ambientes via variáveis de ambiente

---

## 📁 Estrutura de pastas (visão geral)

```bash
.
├── apps
│   ├── api        # Backend (Node.js + Express + Prisma)
│   └── web        # Frontend (React + Vite + Tailwind)
├── docs           # Documentação técnica, diagramas e artefatos
├── infra
│   └── docker     # Arquivos de Docker e Docker Compose
├── prisma         # schema.prisma, migrations e seed
├── scripts        # scripts de setup (local e docker)
├── doc.pdf        # Documento completo do projeto (relatório + diagramas)
└── README.md
````

> 🔎 O arquivo **`doc.pdf`** na raiz traz a documentação completa do projeto (texto do relatório, explicação dos módulos, diagramas de caso de uso, classes, sequência, atividades etc.).
> As figuras usadas nesse PDF são as mesmas organizadas na pasta `docs/` (diagramas em UML, telas e fluxos).

---

## 🚀 Como rodar o projeto

### 1. Pré-requisitos

* Node.js 20+
* npm (ou pnpm/yarn, se quiser adaptar)
* Docker e Docker Compose (para a opção com containers)
* PostgreSQL (apenas se for rodar tudo localmente, sem Docker)

Certifique-se também de ter um `.env` na raiz do repositório (para Docker, ele é usado pelo `setup-docker.sh`).
Caso não exista, o script local já cuida de criar um `.env` a partir de `.env.example`.

---

### 2. Setup rápido com scripts (recomendado)

Na raiz do projeto existe a pasta `scripts/` com dois scripts de automação:

* `scripts/setup-local.sh` → prepara **ambiente local** (Node + Prisma + banco local)
* `scripts/setup-docker.sh` → prepara e sobe o ambiente completo com **Docker**

> No Linux/macOS, antes de rodar pela primeira vez:

```bash
chmod +x scripts/setup-local.sh
chmod +x scripts/setup-docker.sh
```

#### 2.1 Ambiente local (sem Docker)

Esse script cuida de:

* Garantir que exista um `.env` (copiando de `.env.example` se necessário)
* Instalar as dependências do monorepo (`npm install`)
* Gerar o Prisma Client
* Aplicar as migrações (`prisma migrate`)
* Executar o seed (cria usuários, tutores, pets, produtos, serviços, agendamentos, atendimentos e faturas de exemplo)

Passo a passo:

```bash
# Na raiz do repositório
./scripts/setup-local.sh

# Depois que o setup terminar:
npm run dev
```

Por padrão (ajuste se seu `package.json` estiver diferente):

* API: `http://localhost:4000`
* Web: `http://localhost:5173`

#### 2.2 Ambiente completo com Docker

O script `setup-docker.sh` faz o seguinte:

1. Vai para `infra/docker`
2. Derruba containers antigos e **remove volumes** (`down -v`) → banco zerado
3. Faz o **build** das imagens `api` e `web`
4. Sobe apenas o container `db`
5. Dentro do container da API:

   * Aplica migrações (`prisma migrate deploy`)
   * Gera o Prisma Client
   * Compila e executa o script de seed (`prisma/seed.ts`)
6. Sobe os containers `api` e `web` em modo *detach*

Uso:

```bash
# Na raiz do repositório, com o .env já configurado
./scripts/setup-docker.sh
```

Ao final, o próprio script mostra os endpoints padrão:

* Web: `http://localhost:5173`
* API: `http://localhost:4000`

---

## 👥 Usuários criados pelo seed (logins de demonstração)

Após rodar o seed (via scripts ou manualmente), o sistema já vem com:

### Admin principal

* **Função:** Administrador
* **E-mail:** `admin@auravet.com`
* **Senha padrão:** `Admin123!`
  (pode ser alterada via variáveis de ambiente: `SEED_ADMIN_EMAIL`, `SEED_ADMIN_NAME`, `SEED_ADMIN_PASSWORD`)

Esse usuário tem acesso completo a todos os módulos.

### Colaboradores de exemplo

Todos os usuários abaixo são criados com **senha padrão**:

```text
Auravet123!
```

> A senha pode ser sobrescrita via variável de ambiente `SEED_COLLABORATOR_PASSWORD`.

| Função                    | Nome                        | E-mail (login)                                                                |
| ------------------------- | --------------------------- | ----------------------------------------------------------------------------- |
| Administrador             | Marina Duarte Azevedo       | [marina.azevedo@auravet.com.br](mailto:marina.azevedo@auravet.com.br)         |
| Médico                    | Dr. Rafael Nogueira Prado   | [rafael.prado@auravet.com.br](mailto:rafael.prado@auravet.com.br)             |
| Médico                    | Dra. Camila Teixeira Lins   | [camila.lins@auravet.com.br](mailto:camila.lins@auravet.com.br)               |
| Médico                    | Dr. Lucas Almeida Furtado   | [lucas.furtado@auravet.com.br](mailto:lucas.furtado@auravet.com.br)           |
| Médico                    | Dra. Bianca Correia Menezes | [bianca.menezes@auravet.com.br](mailto:bianca.menezes@auravet.com.br)         |
| Médico                    | Dr. Henrique Sales Pacheco  | [henrique.pacheco@auravet.com.br](mailto:henrique.pacheco@auravet.com.br)     |
| Auxiliar Administrativo   | Juliana Costa Ribeiro       | [juliana.ribeiro@auravet.com.br](mailto:juliana.ribeiro@auravet.com.br)       |
| Auxiliar Administrativo   | Bruno Henrique Matos        | [bruno.matos@auravet.com.br](mailto:bruno.matos@auravet.com.br)               |
| Assistente Administrativo | Carolina Pires Andrade      | [carolina.andrade@auravet.com.br](mailto:carolina.andrade@auravet.com.br)     |
| Assistente Administrativo | Eduardo Lima Sanches        | [eduardo.sanches@auravet.com.br](mailto:eduardo.sanches@auravet.com.br)       |
| Enfermeiro                | Enf. Vanessa Borges Freire  | [vanessa.freire@auravet.com.br](mailto:vanessa.freire@auravet.com.br)         |
| Enfermeiro                | Enf. Thiago Ramos Silveira  | [thiago.silveira@auravet.com.br](mailto:thiago.silveira@auravet.com.br)       |
| Enfermeiro                | Enf. Larissa Melo Coutinho  | [larissa.coutinho@auravet.com.br](mailto:larissa.coutinho@auravet.com.br)     |
| Enfermeiro                | Enf. Gustavo Vieira Campos  | [gustavo.campos@auravet.com.br](mailto:gustavo.campos@auravet.com.br)         |
| Enfermeiro                | Enf. Paula Regina Saldanha  | [paula.saldanha@auravet.com.br](mailto:paula.saldanha@auravet.com.br)         |
| Contador                  | Rodrigo Faria Montenegro    | [rodrigo.montenegro@auravet.com.br](mailto:rodrigo.montenegro@auravet.com.br) |

Com esses logins é possível testar na prática:

* Fluxo do **Auxiliar Administrativo** (agenda, confirmação, reagendamento, estoque)
* Fluxo do **Assistente Administrativo** (cadastro de tutores/pets, caixa, faturas)
* Fluxo do **Médico/Enfermeiro** (agenda inteligente, atendimentos, prontuário)
* Fluxo do **Contador** (financeiro, condições de pagamento, produtos/serviços)

---

## 🔐 Segurança

* Autenticação baseada em **JWT** (Bearer Token)
* Hash de senha com **scrypt** e salt configurável
* Validação forte de entrada com **Zod**
* Middlewares de autorização baseados em módulos/funções
* Uso de **helmet** e configuração cuidadosa de CORS

---

## 🧪 Testes

O backend utiliza o runner nativo do Node (`node:test`) para testar:

* Fluxos de autenticação
* Regras de negócio (ex.: agendamentos)
* Controle de permissões

Exemplo (ajuste para o script real):

```bash
cd apps/api
npm test
```

---

## 🧹 Padrões de código

* **ESLint** + **Prettier**
* **Husky** + **lint-staged** (checagens antes do commit)

```bash
npm run lint
npm run format
```

---

## 🗺 Fluxos principais da aplicação

### Gerenciar Agendamentos

* Criação, confirmação e reagendamento com base na Agenda Inteligente.

### Gerenciar Atendimentos

* Abertura a partir do agendamento, registro clínico, serviços/produtos e prontuário, concluindo com geração automática da fatura.

### Gerenciar Faturas (Caixa + Financeiro)

* Ajuste de itens, definição de forma/condição de pagamento, geração de PDF e registro de pagamento.
* No financeiro, acompanhamento de faturas em aberto/vencidas e registro de ações de cobrança/renegociação.

---

## 🖼 Screenshots

* Login
* Dashboard
* Agenda Inteligente
* Agendamento
* Atendimento
* Caixa
* Financeiro

---

## 🧭 Roadmap

* Portal do tutor (visualização de histórico, faturas, agendamentos)
* App mobile para tutores e equipe interna
* Integração com gateways de pagamento
* Relatórios avançados e BI

---

## 👤 Autor

**Caio Murillo de Oliveira**
Projeto desenvolvido como parte do **Projeto Integrador** do curso de Análise e Desenvolvimento de Sistemas (UNIMAR).
