# Integração e dependências: revisão inicial

## Achados principais
- **Endpoint de agendamentos faturáveis ausente:** o frontend usa `GET /appointments/billable` (vide `appointmentsApi.billable`) para listar agendamentos faturáveis, mas o router de agendamentos do backend não expõe essa rota. Resultado: as telas que dependem desse recurso não conseguem carregar dados. Ajustar criando o endpoint no backend ou revisando o consumo no frontend.
- **Configuração de API para builds de produção:** o cliente web exige `VITE_API_URL` definida em tempo de build; caso contrário lança `ApiConfigurationError` e o build falha. Garantir que os pipelines/ambientes de produção definam essa variável.
- **Segredos e host padrão na API:** o backend aceita valores padrão para `DATABASE_URL` e `JWT_SECRET` apenas fora de produção, mas finaliza a aplicação se estiver em produção sem esses valores. Confirmar que os ambientes de produção fornecem explicitamente esses segredos e que o host/porta (`API_HOST`/`API_PORT`) refletem a topologia de deploy.

## Próximas tarefas sugeridas
1. Implementar o endpoint `/appointments/billable` na API (ou ajustar o consumo no frontend) para alinhar as rotas de faturamento entre as aplicações.
2. Validar que os pipelines de build do frontend definem `VITE_API_URL` e que os valores apontam para o ambiente correto (dev/stage/prod).
3. Revisar os manifests de deploy/CI para garantir que `DATABASE_URL` e `JWT_SECRET` estejam sempre definidos em produção e que `API_HOST`/`API_PORT` correspondam à configuração do balanceador/reverse proxy.
