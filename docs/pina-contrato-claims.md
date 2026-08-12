# O que o Pina recebe do portal

O portal assina um **custom token do Firebase** com estas claims. Elas chegam
por dois caminhos e têm o mesmo formato nos dois:

| Caminho | Quando |
|---|---|
| `POST /api/pina/sso-token` | quem tem conta no portal e clica em "Abrir o Pina" |
| claims gravadas na conta | quem entra direto no Pina, com a senha dele |

```json
{
  "role": "master" | "professor",
  "escolaId": "uuid",
  "professorId": "uuid | null",
  "somenteLeitura": true | false
}
```

## `somenteLeitura` — o que o Pina precisa fazer

**O portal não consegue impedir a edição.** As APIs daqui são todas de leitura
(`GET`); a escrita das formações acontece dentro do Pina, contra o banco dele.
Esta claim é um pedido assinado, não uma tranca — enquanto o Pina não olhar
para ela, o auxiliar administrativo continua conseguindo editar por lá.

Quando `somenteLeitura` for `true`, o Pina deve:

- abrir tudo que `role: "master"` já abre — a pessoa **precisa** enxergar a
  escola inteira, é o trabalho dela;
- recusar qualquer gravação: mover aluno na formação, criar ou apagar
  coreografia, mexer em personagem, luz ou ordem do espetáculo;
- esconder os controles de edição, em vez de deixá-los e falhar no salvamento
  — botão que existe e não funciona é pior que botão ausente.

**A checagem que vale é a do servidor do Pina.** Esconder botão é conforto;
sem a recusa no backend, basta uma requisição direta para contornar.

## Por que não um `role` novo

Seria tentador mandar `role: "master_leitura"`. Isso quebraria toda checagem
`role === "master"` já existente no Pina e trancaria a equipe fora do que ela
PODE ver — o oposto do pedido. A claim é **adicional**: quem ainda não a lê
continua funcionando como antes, sem ninguém ficar preso do lado de fora.

## Quem recebe o quê

| Papel no portal | `role` | `somenteLeitura` |
|---|---|---|
| Direção (admin) | `master` | `false` |
| Auxiliar administrativo (equipe) | `master` | **`true`** |
| Professor | `professor` | `false` |
