# Roadmap de Autenticação e Perfis de Usuário

## Objetivo
Adicionar autenticação para colaboradores internos da Auravet, controlando acesso a funcionalidades administrativas com base em perfis (roles).

## Status Atual — abril/2024
- ✅ Monorepo mantém `apps/api` (Express + Prisma) e `apps/web` (React + Tailwind) com autenticação JWT.
- ✅ Prisma agora modela `User` e o enum `Role`, com seed automático para um Administrador inicial.
- ✅ API expõe `/auth`, `/users`, além de proteger `owners`, `animals` e `services` com middleware de autenticação + permissões.
- ✅ Frontend possui fluxo de login, guarda de rotas, gestão de usuários internos e navegação condicionada por role.
- ✅ Swagger e README documentam variáveis de ambiente, perfis e novos endpoints.
- ✅ Testes com o Node.js Test Runner cobrem login, registro e bloqueios de permissão usando Prisma em memória.
- ⚠️ Pendente: endurecer entrega em produção com cookies `HttpOnly/Secure`, observabilidade e auditoria mais detalhada.

## Requisitos de Back-end
1. **Modelagem de Usuários**
   - Nova entidade `User` com nome, email, senha (hash), status e associação a `Role`.
   - Enum `Role` com perfis: Administrador, Auxiliar Administrativo, Assistente Administrativo, Enfermeiro, Médico e Contador.
   - Migração Prisma e seed inicial para usuário Administrador.

2. **Autenticação**
   - Endpoints `POST /auth/register` (restrito a administradores) e `POST /auth/login`.
   - Validações com Zod, hashing de senha (ex.: bcrypt) e política de complexidade mínima.
   - Geração de tokens JWT com expiração configurável e variáveis de ambiente (`JWT_SECRET`, `JWT_EXPIRES_IN`).
   - Middleware para verificar token, anexar usuário autenticado ao request e atualizar `lastLoginAt`.

3. **Autorização**
   - Mapeamento centralizado de permissões por role.
   - Guards em rotas sensíveis: criação/gestão de usuários apenas para Administradores, registro clínico para Médicos/Enfermeiros, relatórios financeiros para Contadores.
   - Rate limiting em rotas de autenticação.

4. **Segurança Adicional**
   - Cookies `HttpOnly`/`Secure` em produção, suporte a HTTPS.
   - Logs estruturados para eventos de autenticação.

## Requisitos de Front-end
1. **Fluxo de Login e Sessão**
   - Página de login com integração ao backend e armazenamento de sessão via React Query.
   - Tratamento global de respostas 401 para redirecionar ao login.

2. **Proteção de Rotas**
   - Implementar `PrivateRoute`/guard para exigir autenticação.
   - Verificar permissões de acordo com o role para componentes e páginas administrativas.

3. **Experiência do Usuário**
   - Atualizar Header para exibir dados do colaborador logado e botão de logout.
   - Páginas de gestão de usuários: listagem, criação, edição e ativação/desativação (restritas a Administradores).
   - Resumo das permissões por perfil.

## Documentação e Qualidade
- Atualizar Swagger e README com novos endpoints, variáveis de ambiente e fluxos.
- Adicionar testes unitários/integrados para login, logout, expiração de token e acessos negados.
- Monitorar auditoria de ações críticas.

## Próximos Passos
1. Entregar cookies `HttpOnly`/`Secure` e suporte explícito a HTTPS nas rotas de autenticação (produção).
2. Adicionar trilhas de auditoria e logs estruturados para ações críticas (login, criação de usuário, mudanças de papel/status).
3. Monitorar métricas (taxa de falhas de login, bloqueios por rate limiting) e enviar para observabilidade central.
4. Expandir testes e2e cobrindo logout explícito, expiração de token e experiência offline do frontend.
