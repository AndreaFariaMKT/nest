# Financeiro — primeiros passos

Para a Andréa e a Aline. Quinze minutos de cadastro e o módulo passa a valer.

O sistema está no ar em **nest-six-beta.vercel.app**. O menu Financeiro aparece
para quem entra como **founder** ou **contadora** — as outras funções não veem
nada disso, de propósito: é a informação mais sensível do produto.

---

## A ordem importa

Três telas, nesta ordem. Cada uma destrava a seguinte.

### 1. Contas e câmbio · `Diretório → Contas`

Cadastre as contas onde o dinheiro fica. Para cada uma: nome, instituição,
moeda e **tipo**.

O tipo tem uma consequência real. Uma conta marcada como **reserva** fica fora
do capital de giro — ela existe para não ser gasta, e somá-la à operação é
como um estúdio acredita ter quatro meses de fôlego quando tem um.

Provavelmente são três:

| Conta | Moeda | Tipo |
|---|---|---|
| Nubank conta corrente | BRL | Operacional |
| Wise | USD | Operacional |
| Caixinha / RDB | BRL | **Reserva** |

Na mesma tela, embaixo, **registre a taxa do dólar do dia**. Sem ela, nada em
dólar entra em nenhum total — o sistema prefere dizer "sem câmbio" a inventar
um número que parece dinheiro e está errado.

> A taxa é por dia. Cada lançamento em dólar é convertido pela taxa do dia em
> que o dinheiro se moveu, não pela de hoje: o estúdio não é dono da cotação de
> hoje sobre o dinheiro de agosto.

### 2. A receber e a pagar · `Liderança → A receber e a pagar`

Lance o que está em aberto hoje: cada cobrança que o estúdio ainda vai receber
e cada obrigação que ainda vai pagar.

É esta tela que faz a conciliação bancária funcionar. Quando você importa o
extrato, o sistema compara cada linha do banco com o que estava em aberto aqui
— sem isso, o extrato inteiro volta como "sem correspondência".

Quando o dinheiro entrar ou sair, use **Recebi** / **Paguei** na própria linha.
Isso faz duas coisas de uma vez: fecha a cobrança e lança o dinheiro na conta
escolhida.

> Se o valor veio do extrato do banco, confirme pela **Conciliação** em vez
> daqui — ela também faz as duas coisas, e fazer nos dois lugares lança em
> dobro.

### 3. Lançamentos · `Liderança → Lançamentos`

Tudo que se move sem passar por uma cobrança: o PIX feito pelo celular, a
tarifa do banco, o saldo inicial de uma conta que já existia antes do sistema.

---

## As duas datas

É o único conceito do módulo que vale entender antes de usar, porque é o que
explica por que dois números na tela não batem — e não é erro.

Todo lançamento tem **duas datas**:

- **Caixa** — quando o dinheiro se moveu de verdade
- **Competência** — a que mês aquele dinheiro pertence

O retainer de agosto pago em 5 de setembro é **caixa de setembro** e **receita
de agosto**. O balanço sai da primeira data, o lucro sai da segunda. A
contabilidade trabalha por competência, o banco trabalha por caixa, e os dois
estão certos.

Nos formulários, **deixe a competência em branco** quase sempre — ela segue a
data do caixa sozinha. Preencha só quando o mês do dinheiro e o mês do trabalho
forem diferentes.

---

## Depois que estiver rodando

- **Fluxo de caixa** — o mês inteiro numa página, e os doze meses lado a lado
- **Conciliação** — sobe o OFX ou CSV do banco; o sistema separa em conciliado
  automático, sugestão e sem correspondência. Nada entra no livro sem a sua
  confirmação
- **Notas fiscais** — a fila do que já foi recebido e ainda deve nota, com as
  três regras do manual: a nota vem depois do pagamento, cinco dias úteis para
  enviar, e cliente internacional é exportação e não gera nota brasileira
- **Fornecedores** — quem o estúdio paga, com documento, chave PIX e dia

## Se algo parecer errado

- **"Nenhuma conta cadastrada ainda"** no painel → falta o passo 1
- **Valores em dólar fora dos totais** → falta a taxa daquele dia, na tela de
  contas
- **O extrato voltou todo como "sem correspondência"** → falta lançar o que
  estava em aberto, no passo 2
