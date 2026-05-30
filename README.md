# Festa Junina - Controle de Comandas

Aplicação web para enviar número de comandas, atualizar status e finalizar entregas na rede local.

## Funcionalidades

- Cadastro e atualização de status por comanda
- Finalização rápida de entregas (apenas comandas em aberto)
- Página inicial para registrar a data de abertura do sistema
- Campo para informar o valor fixo do lanche
- Encerramento do dia diretamente na página inicial
- Limpeza de dados do dia (botão "Limpar dados")
- Resumo do encerramento com quantidade de pedidos
- Histórico separado para comandas finalizadas
- Exportação do histórico para CSV
- Banco de dados permanente com histórico acumulado
- Painel grande para monitor/visor
- Acesso pelo celular na mesma rede local
- Atualização automática por polling na interface
- Persistência em arquivo JSON

## Como usar

1. Inicie o servidor com Python (use o script `run_server.bat` ou execute):

   ```bash
   python -B -u server.py
   ```
   
   **Nota importante:** Use a flag `-B` para evitar problemas com cache de bytecode compilado.

2. Acesse no computador que está na rede local:

   - Abertura: `http://localhost:3000`
   - Operação: `http://localhost:3000/operacao`
   - Painel do monitor: `http://localhost:3000/painel`
   - Histórico: `http://localhost:3000/historico`

3. Para abrir no celular, use o IP local da máquina que está executando o servidor, por exemplo:

   `http://192.168.0.10:3000`

## Funcionalidades Detalhadas

### Página Inicial (`/`)
- Registra a data/hora de abertura do sistema
- Permite informar o valor fixo do lanche
- Botão "Encerrar dia" que fecha a operação e mostra resumo de pedidos
- Botão "Limpar dados" que reseta tudo e permite abrir um novo dia

### Página de Operação (`/operacao`)
- Formulário para adicionar/atualizar comanda com status
- Formulário rápido para finalizar entrega
- Lista de últimas comandas
- Botão "Finalizar" desabilitado para comandas já entregues

### Painel do Monitor (`/painel`)
- Visualização em tempo real em duas colunas:
  - "Em Preparo": Comandas com status Separando
  - "Prontas": Comandas com status Pronto

### Histórico (`/historico`)
- Lista de todas as comandas finalizadas no dia
- Botão "Exportar para CSV" para baixar relatório

## Arquivos de Dados

- `data/orders.json` - Comandas em aberto
- `data/history.json` - Histórico do dia
- `data/database.json` - Banco de dados permanente com histórico acumulado
- `data/system.json` - Configurações (abertura, encerramento, preço do lanche, resumo)

## Observações

- Ao abrir um novo dia, o histórico é automaticamente limpo
- Apenas comandas com status diferente de "Entregue" podem ser finalizadas
- O banco de dados permanente acumula todos os pedidos de todos os dias
- O CSV é gerado com dados do banco de dados permanente
- A aplicação funciona totalmente offline na rede local
