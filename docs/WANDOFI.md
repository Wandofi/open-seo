# Camada Wandofi

Este repositório é um fork de [every-app/open-seo](https://github.com/every-app/open-seo). A camada Wandofi fica, sempre que possível, em ficheiros novos. As alterações a ficheiros do núcleo estão listadas abaixo para facilitar o merge com o upstream.

Sincronizar com o upstream:

```sh
git fetch upstream
git merge upstream/main
```

Em caso de conflito, comparar com a tabela de alterações ao núcleo desta página.

## Tecto de gasto e registo de chamadas DataForSEO

O OpenSEO em self-host não mede nem limita o gasto na DataForSEO. A medição existe só no modo alojado, através do Autumn. Esta camada acrescenta:

- **Registo:** cada pedido cobrado pela DataForSEO fica numa linha de `wandofi_dataforseo_calls`, com data (ISO, UTC), endpoint, custo em USD devolvido pela DataForSEO, projecto e organização. Os pedidos com custo zero não são registados.
- **Tecto global:** a variável `WANDOFI_DATAFORSEO_MONTHLY_CAP_USD` define o máximo mensal, em USD, para toda a instalação. Sem a variável não há tecto.
- **Tecto por projecto:** uma linha em `wandofi_project_spend_caps` (`project_id`, `monthly_cap_usd`). Por agora cada cliente é um projecto. Quando existirem espaços por cliente, o tecto passa para o cliente.
- **Aviso a 80%:** a partir de 80% de qualquer tecto, cada pedido escreve `wandofi.spend-cap-warning` nos registos do Worker.
- **Bloqueio a 100%:** atingido o tecto, os pedidos POST à DataForSEO são recusados com o código `INSUFFICIENT_CREDITS` antes de chegarem à DataForSEO. Os GET (recolha de tarefas já pagas, localizações) continuam a passar.

O mês conta-se em UTC, desde o dia 1.

É um tecto suave: pedidos em simultâneo são verificados contra o gasto registado antes deles, por isso um lote grande pode passar um pouco além do tecto.

### Como funciona

- `src/server/lib/dataforseo/core.ts` é o único `fetch` por onde passam todos os pedidos à DataForSEO. Antes de cada POST chama `beforeBilledDataforseoRequest()`; depois de cada resposta chama `afterDataforseoResponse()` com o `cost` devolvido.
- `src/server/wandofi/spendHooks.ts` é um módulo sem dependências, com os ganchos e um `AsyncLocalStorage` que guarda o projecto do pedido. Assim `core.ts` continua a poder ser testado sem base de dados.
- `src/server/wandofi/spendGuard.ts` tem a lógica (somas do mês, tectos, escrita do registo) e instala os ganchos com `registerDataforseoSpendGuard()`, chamado no arranque dos dois Workers.
- `src/server/lib/dataforseo/client.ts` abre o contexto do projecto à volta de cada chamada medida. Os pedidos feitos fora do cliente (`DashboardSiteService`, `websiteResearch`) ficam registados sem projecto e contam só para o tecto global.

### Consultar e configurar em local

```sh
# Gasto do mês por projecto
pnpm exec wrangler d1 execute DB --local --command \
  "select project_id, round(sum(cost_usd), 4) as usd, count(*) as pedidos from wandofi_dataforseo_calls where created_at >= strftime('%Y-%m-01', 'now') group by project_id"

# Tecto de 10 USD por mês num projecto
pnpm exec wrangler d1 execute DB --local --command \
  "insert into wandofi_project_spend_caps (project_id, monthly_cap_usd) values ('<project-id>', 10) on conflict(project_id) do update set monthly_cap_usd = excluded.monthly_cap_usd"
```

Em produção, trocar `--local` por `--remote`.

### Limitações conhecidas

- Quando o tecto bloqueia, a interface mostra a mensagem genérica do OpenSEO para créditos insuficientes, em inglês, com um botão para a página de faturação. A mensagem em português do tecto só aparece nos registos e nas respostas MCP.
- Ainda não há ecrã para ver o gasto nem para definir tectos.

## Alterações ao núcleo

| Ficheiro                                                                                         | Alteração                                                                                                                       |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `src/server/lib/dataforseo/core.ts`                                                              | Chamadas a `beforeBilledDataforseoRequest()` e `afterDataforseoResponse()` em `requestDataforseo`                               |
| `src/server/lib/dataforseo/client.ts`                                                            | `meterDataforseoCalls` passa a abrir o contexto do projecto; a função original passa a chamar-se `meterDataforseoCallsUnscoped` |
| `src/server.ts`, `src/audit-worker.ts`                                                           | Chamada a `registerDataforseoSpendGuard()` no arranque                                                                          |
| `src/db/schema.ts`, `src/db/d1/schema.ts`, `src/db/pg/schema.ts`, `src/db/schema-parity.test.ts` | Registo das tabelas novas nos índices de esquema                                                                                |
| `drizzle/sqlite/0060_*`, `drizzle/pg/0038_*` e os respectivos `meta/`                            | Migrações das tabelas novas. Num merge com migrações novas do upstream, regenerar com `pnpm db:generate`                        |
| `deploy/alchemy/alchemy.run.ts`, `deploy/.env.selfhost.example`                                  | Variável `WANDOFI_DATAFORSEO_MONTHLY_CAP_USD` no deploy self-host, nos dois Workers                                             |

Ficheiros novos: `src/db/wandofi.schema.ts`, `src/db/pg/wandofi.schema.ts`, `src/server/wandofi/spendHooks.ts`, `src/server/wandofi/spendGuard.ts`, `docs/WANDOFI.md`.
