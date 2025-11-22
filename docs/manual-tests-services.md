# Testes manuais: serviços e atendimentos

Use este roteiro rápido para validar o fluxo de catálogo de serviços, registro de atendimentos e prontuário.

## 1) Catálogo de serviços
- Abrir **Catálogo de serviços**.
- Tentar salvar com nome vazio e valor sugerido com letras: deve bloquear no cliente conforme schema (mensagem do campo ou toast).
- Informar preço negativo ou quebrado: deve exibir mensagem de validação local.
- Enviar payload válido (com e sem profissional) e confirmar criação; em caso de conflito 409, conferir mensagem "Erro 409" vinda do backend.

## 2) Registro de atendimento com serviços
- Acessar **Registrar Atendimento** e selecionar pet + responsável.
- Adicionar um serviço do catálogo com quantidade decimal/zerada para ver validação e impedir envio.
- Registrar múltiplos serviços distintos e conferir total geral calculado.
- Submeter e, se o backend retornar 4xx, verificar alerta vermelho com mensagem detalhada e opção de reenvio usando o payload exibido.

## 3) Produtos/insumos do atendimento
- Adicionar produto com quantidade maior que o estoque para ver bloqueio.
- Alterar preço unitário para valores negativos ou vazios e confirmar que o formulário impede o envio.
- Finalizar atendimento com produtos e confirmar atualização do estoque quando a mutation de criação for bem-sucedida.

## 4) Prontuário e rascunhos
- Adicionar notas ao prontuário e garantir que aparecem ordenadas por data.
- Salvar atendimento sem preencher o término para validar que o formulário permite rascunhos.
- Ao receber erro da mutation de atualização/criação, abrir o **payload enviado** no alerta para comparar com o schema esperado antes de reenviar.
