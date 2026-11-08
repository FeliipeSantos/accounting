# Contrato da API

Referência do comportamento HTTP do sistema, que o backend (`backend/`) precisa respeitar e que o frontend (`frontend/`) usa. Os testes em `tests/contract/` (na máquina de desenvolvimento) verificam exatamente isto, fazendo pedidos HTTP ao servidor:

```bash
node tests/run-contract.js
```

Outro servidor qualquer: `TEST_SERVER_CMD` (comando) e `TEST_SERVER_CWD` (pasta).

## 1. Processo

O servidor de testes é iniciado como processo filho. Ele precisa:

| Item | Regra |
|---|---|
| `PORT` | Porta de escuta; `0` = porta livre escolhida pelo sistema |
| `HOST` | Endereço de escuta (vazio = todas as interfaces) |
| `DB_PATH` | Caminho do SQLite. O servidor exige as tabelas já criadas (`flask db upgrade`, aplicado manualmente) e, sem elas, termina com código ≠ 0 pedindo esse comando |
| `INTEL_SCHEDULER=off` | A coleta diária automática fica desligada (`schedulerEnabled: false`) |
| `APP_ENV=production` | Exige usuário real no banco e marca o cookie como `Secure` (`NODE_ENV` ainda é aceito) |
| `SESSION_TTL_HOURS` | Duração da sessão sem uso (padrão 8) |
| `TRUST_PROXY=true` | Usa o primeiro IP do `X-Forwarded-For` no limite de login |
| `COOKIE_SECURE` | `true`/`false` força o atributo `Secure` |
| Saída ao iniciar | Uma linha contendo `localhost:<porta real>` (ex.: `Servidor rodando em http://localhost:8080`) |
| Sem usuários em produção | Termina com código ≠ 0 e a mensagem `Nenhum usuário no banco. Crie o primeiro com: ...` |
| `admin` com senha `admin` em produção | Termina com código ≠ 0 e a mensagem `O usuário de desenvolvimento admin/admin existe neste banco...` |
| Sem usuários em desenvolvimento | Cria `admin`/`admin` |
| `SIGTERM` | Encerra em poucos segundos, esperando até 25 s uma coleta em andamento |

O banco é compartilhado entre as implementações: as tabelas `core_*`, `projects_*` e `intel_*` e o formato dos dados gravados (veja `lib/migrations/`) fazem parte do contrato.

## 2. Regras gerais

- **Respostas:** sempre JSON (`Content-Type: application/json`). Erros têm o formato `{ "error": "mensagem em português" }`.
- **Sessão:** toda rota em `/api/` exige sessão válida, exceto `/api/auth/*`. Sem sessão a resposta é `401 { "error": "Sessão expirada ou inexistente" }`. Cabeçalhos como `X-User` nunca identificam o usuário.
- **Escritas:** `POST`, `PUT` e `DELETE` em `/api/` (fora de `/api/auth/*`) exigem `Content-Type: application/json`. Sem ele: `415 { "error": "Envie o conteúdo como application/json" }`. É a proteção contra CSRF.
- **JSON inválido:** no corpo, responde `400`.
- **Corpo grande demais:** responde `413`. Os limites são 4 KB no login, 2 MB por projeto e 100 KB no módulo Publicações.
- **Rota inexistente:** em `/api/` responde `404 { "error": "Rota não encontrada" }`.
- **Erro inesperado:** responde `500` com mensagem genérica, sem detalhes internos.
- **`OPTIONS`:** responde `204`, sem cabeçalhos CORS. O app é servido pelo mesmo endereço da API.
- **Cabeçalhos de segurança:** em toda resposta: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin` e a `Content-Security-Policy` atual (`script-src 'self'`, Google Fonts liberado em `style-src`/`font-src`).

## 3. Saúde

| Rota | Resposta |
|---|---|
| `GET /healthz` | `200 { "status": "ok" }`, sem login |

## 4. Autenticação: `/api/auth`

| Rota | Corpo | Resposta |
|---|---|---|
| `GET /session` | — | `200 { "user": "nome" }` ou `401` |
| `POST /login` | `{ "username", "password" }` | `200 { "user": "nome" }` e `Set-Cookie`; `401 { "error": "Usuário ou senha incorretos." }`; `429 { "error": "Muitas tentativas. Tente novamente em N min." }` |
| `POST /logout` | — | `200 { "success": true }` e cookie apagado (`Max-Age=0`); remove a sessão do banco |

**Cookie da sessão:**
- **Formato:** `sid=<token>; HttpOnly; SameSite=Strict; Path=/; Max-Age=<segundos>`, mais `; Secure` em produção.
- **Token:** aleatório de 32 bytes em base64url.
- **No banco:** `core_sessions.token_hash` guarda só o SHA-256 (hex) do token, com `expires_at` em milissegundos.
- **Expiração:** a cada uso, a validade é renovada (`SESSION_TTL_HOURS`), no máximo uma vez por minuto.

**Senhas:**
- **Formato:** `scrypt$<salt base64url>$<hash base64url>`, com salt de 16 bytes e hash de 64 bytes.
- **Parâmetros do scrypt:** N=16384, r=8, p=1. Outra implementação precisa usar os mesmos, para as senhas atuais continuarem valendo.

**Limite de tentativas:**
- **Regra:** 5 falhas por IP em 15 minutos bloqueiam o login daquele IP, mesmo com a senha certa.
- **Mensagem:** usuário inexistente e senha errada recebem a mesma.
- **Sucesso:** um login correto zera as falhas daquele IP.

## 5. Portal de Projetos: `/api/projects`

| Rota | Resposta |
|---|---|
| `GET /api/projects` | `200 [projeto, ...]` na ordem de exibição |
| `PUT /api/projects/:id` | Cria (`201`) ou atualiza (`200`): `{ "success": true, "id", "result": "created" \| "updated" }`. Projeto novo vai para o fim da lista |
| `DELETE /api/projects/:id` | `200 { "success": true, "id" }`; `404 { "error": "Projeto não encontrado" }` |

- **Formato do projeto:** cada projeto é um documento JSON livre, devolvido exatamente como foi salvo.
- **Validação (`400`):**
  - **Objeto:** precisa ser um objeto. Lista ou valor solto dão `Projeto inválido`.
  - **`id`:** `^[\w-]{1,100}$`. Se faltar no corpo, vem do endereço. Se diferir do endereço: `O identificador do projeto não confere com o endereço`.
  - **`name`:** obrigatório, até 300 caracteres.
  - **`activities`:** quando existir, precisa ser uma lista.
- **Erro:** nada é gravado.
- **No banco:** `projects_projects(id, name, data, position, created_at, updated_at, updated_by)`, com `updated_by` = usuário da sessão.
- **Não existe:** `POST /api/projects` (salvar a lista inteira) responde `404`.

## 6. Publicações: `/api/intelligence`

### Catálogo e configurações

| Rota | Resposta |
|---|---|
| `GET /sources` | Lista das 12 fontes: `{ id, name, url, method, collectable, coverage, defaultSubjects?, enabled, status, count }`. `status` é `{ lastSuccessAt, lastError, lastErrorAt }` ou `null` |
| `GET /subjects` | Lista dos 17 assuntos: `{ id, name, keywords, enabled, count }` |
| `GET /rules` | Lista de textos que explicam as regras de classificação |
| `GET /settings` | `{ runTime: "HH:MM", enabledSources: [], enabledSubjects: [] }`. O campo interno `knownSources` não aparece |
| `PUT /settings` | Mesmos campos, todos opcionais. Responde as configurações resultantes. `400` para `Horário inválido (use HH:MM)`, `Lista de fontes inválida` ou `Lista de assuntos inválida` |

Fonte que entra no catálogo depois vem ativada. As escolhas do usuário para as fontes que já existiam são mantidas.

### Publicações

| Rota | Resposta |
|---|---|
| `GET /publications` | `{ total, items: [publicação] }` |
| `GET /publications/:id` | Publicação com `fullText` (só nesta rota), ou `404 { "error": "Publicação não encontrada" }` |

**`fullText` de `/publications/:id`:** o texto completo do ato, lido depois da coleta (DOU, Legislação Federal via DOU e CONFAZ).
- **Lido:** `{ status: "ok", url, text, points: [{ ref, text, highlights: [valores] }], basis, effective: { ref, text, items: [texto] } | null }`, extraído por regras. `effective` é o artigo da vigência. `basis` diz o que são os `points`:
  - **`values`:** dispositivos com valores em R$, percentuais, prazos, quantidades e datas.
  - **`provisions`:** o ato não traz valores; são os seus principais dispositivos (caput dos artigos ou cláusulas).
  - **`fields`:** texto sem artigos (ex.: Solução de Consulta); são as linhas "Rótulo: valor".
- **Sem texto:** `{ status: "pending" }` (ainda não buscado), `{ status: "unavailable" }` (notícias, projetos de lei e portais, que não têm texto completo) ou `{ status: "error" }` (falhou; cada coleta refaz até 40, e `flask intel fulltext` refaz todas).
| `GET /summary` | `{ totals: { publications, critical, recent, reform }, recentDays: 7, byCategory: [{ id, name, count }], recentItems: [até 6 publicações], lastRun, schedulerEnabled, nextRunAt }` |

**Filtros de `/publications`:**
- **`subject`:** um id ou vários separados por vírgula (qualquer um deles).
- **Outros:** `relevance` (`critica`, `alta`, `media`, `baixa`), `source`, `from` e `to` (`AAAA-MM-DD`), `run` (id da execução) e `q` (texto, sem diferenciar acentos nem maiúsculas).
- **Paginação:** `limit` (1 a 200, padrão 50) e `offset`.
- **Ordem:** mais recentes primeiro, por `publishedAt`, `publishedTime` e `collectedAt`.
- **Sem data de publicação:** o item fica fora do filtro `from` e dentro do `to`.
- **Erros (`400`):** `Assunto inválido`, `Relevância inválida`, `Fonte inválida`, `Período inválido` ou `Execução não encontrada`.

**Publicação:**
- **Campos:** `{ id, sourceId, externalId, hash, title, url, publishedAt, publishedTime, excerpt, actType, organ, subjects, relevance, normType, effectiveDate, collectedAt, runId, favorite }`.
- **Classificação:** quando existe, inclui `classificationReason: { actType, actLabel, weight, reformBonus, reformSubjects, score, subjects: [{ id, via: "source" | "keywords", terms }] }`.

### Favoritos (por usuário)

| Rota | Resposta |
|---|---|
| `GET /favorites` | Publicações favoritas do usuário da sessão, com `favoritedAt`, das mais recentes para as mais antigas |
| `POST /favorites` | Corpo `{ "publicationId" }`. `201` na primeira vez, `200` se já era favorita: `{ publicationId, favorite: true }`. `404` se a publicação não existe |
| `DELETE /favorites/:id` | `200 { publicationId, favorite: false }` (idempotente) |

### Coletas

| Rota | Resposta |
|---|---|
| `GET /status` | `{ running, lastRun, schedulerEnabled, nextRunAt }` |
| `POST /runs` | `202 { "started": true }`. A coleta roda em segundo plano |
| `GET /runs` | Últimas 50 execuções, das mais recentes para as mais antigas |

**`POST /runs`:**
- **Coleta em andamento (`409`):** `{ "error": "Já existe uma coleta em andamento" }`. Vale para qualquer processo: uma execução `running` iniciada há menos de 15 minutos. Uma mais antiga é considerada interrompida e não bloqueia.
- **Intervalo mínimo (`429`):** `{ "error": "Aguarde N s para executar novamente" }`. São 60 s desde o fim da última execução **manual**. As agendadas e as do comando não contam.
- **Registro:** a execução é gravada com `trigger: "manual"` e `requestedBy` = usuário da sessão.

**Execução:**
- **Campos:** `{ id, trigger: "scheduled" | "manual" | "cli", requestedBy, startedAt, finishedAt, status: "running" | "success" | "partial" | "failed", newCount, duplicateCount, error, sources: [resultado por fonte] }`.
- **Resultado por fonte:** `{ sourceId, status: "success" | "error", fetched, invalid, relevant, newCount, duplicateCount, error, durationMs }`.

**Gravação:** publicações, situação das fontes e o resultado da execução são gravados numa única transação. São mantidas as 200 execuções mais recentes.

## 7. Calendário: `/api/reforma`

Módulo de uso pessoal. Toda rota, exceto `/access`, responde `403 { "error": "Acesso restrito ao usuário do módulo Calendário" }` para quem não está em `REFORMA_USERS` (sem a variável: todos em desenvolvimento, ninguém em produção).

| Rota | Resposta |
|---|---|
| `GET /access` | `{ allowed }` (a tela esconde o item do menu quando `false`) |
| `GET /status` | `{ running, lastRun, schedulerEnabled, runTime, nextRunAt, totals: { documents, versions, newThisMonth, changedThisMonth, pendingAnalysis, pendingFiles }, kinds: { id: nome }, sources: [{ id, name, url, method, note, documents, last }] }` |
| `GET /runs` | Últimas 30 sincronizações: `[{ id, trigger, requestedBy, startedAt, finishedAt, status, newDocuments, newVersions, filesDownloaded, error }]` |
| `GET /runs/:id` | Uma sincronização com `sources: [{ sourceId, checkedAt, status, fetched, newDocuments, newVersions, error, durationMs }]` |
| `POST /runs` | `202 { started: true }`; `409` se já há uma em andamento; `429` se a última manual terminou há menos de 2 minutos |
| `GET /documents` | `{ total, items: [documento] }`; filtros `source`, `kind`, `q`, `changed=versions`; `limit` (até 100) e `offset` |
| `GET /documents/:id` | Documento com `versions: [{ id, label, title, summary, publishedAt, detectedAt, fileUrl, fileStatus, fileError, analysisStatus, textLength }]`, da mais nova para a mais antiga |
| `GET /documents/:id/versions/:vid` | `{ text }`: texto completo da versão |
| `GET /events` | Eventos ativos do calendário entre `from` e `to` (`aaaa-mm-dd`, até 13 meses); filtros `kind`, `importance` (lista separada por vírgula), `subject` (ids de assunto separados por vírgula, os mesmos do módulo Publicações), `officialOnly=true` (sem as datas que o próprio ato chama de previstas) |
| `GET /events/:id` | Um evento com `history: [{ changedAt, change: "criado" \| "atualizado" \| "substituido", versionId, before }]` |

**Evento:** `{ id, documentId, versionId, kind, date, title, quote, dateStatus: "confirmada" | "previsao" | "recorrente", dateNote, legalStatus, importance: "critico" | "alto" | "medio" | "informativo", importanceReason, dateReason, subjects, origin: "regra" | "ia" | "manual" | "recorrente", status, createdAt, updatedAt, document: { title, kind, sourceId, url, versionLabel, summary }, alsoIn: [{ eventId, documentId, title, sourceId, url }] }`. `summary`: a ementa do ato (o que a legislação ou a alteração faz), quando há. `subjects`: assuntos do evento, pelas mesmas palavras-chave do módulo Publicações, pelo assunto da própria fonte (ex.: Protocolos ICMS → ICMS) e pela publicação de origem; IBS/CBS e Imposto Seletivo contam também como `reforma-tributaria`. `importanceReason` e `dateReason` explicam, em uma frase, por que o evento recebeu aquela importância e aquele status de data. Linhas de tabela viram um evento cada, com o assunto da linha no `title` e a linha inteira em `quote`. O mesmo ato vindo de duas fontes (ou o mesmo trecho no mesmo dia) aparece uma vez, com as demais em `alsoIn`. `kind`: `obrigatoriedade` (inclui a entrada em produção de uma Nota Técnica), `prazo` (inclui prazos de opção), `vigencia` (início de vigência de um ato) e `alteracao` (vigência de um ato que altera outro). Toda data vem com `quote`, o trecho literal do ato oficial. Notícias, comunicados e projetos de lei não geram datas; datas de publicação e de ambiente de homologação não entram. Atos individuais de unidades regionais da Receita também não. Uma nova versão do documento refaz seus eventos: os que deixam de aparecer ficam `substituido` (com histórico), nunca apagados. Prazos recorrentes da legislação (opção pelo SIMEI, DASN-SIMEI, DEFIS, ECD, ECF, DAS, DCTFWeb, EFD-Reinf) entram calculados para o período pedido, com `dateStatus` e `origin` `"recorrente"`, `id` `rec-<regra>-<data>`, `documentId` vazio e, em `quote` e `document.url`, o trecho e o endereço da fonte oficial da regra; dias úteis consideram fins de semana e feriados nacionais. Quando um ato publicado depois da data em que a regra foi conferida cita a obrigação e fala em mudar o prazo (prorroga, altera, antecipa, extingue...), as ocorrências levam `review: { since, acts: [{ documentId, title, url, date }] }`; nas demais, `review` é `null`. `/status` traz também `events: { total, upcoming, recurringUpcoming, pendingExtraction }` (os recorrentes contam nos próximos 12 meses), `recurringReviews: [{ ruleId, title, since, acts }]` (as regras a revisar), `eventKinds` e `subjects: [{ id, name }]`.

**Documento:** `{ id, sourceId, externalId, kind, title, url, publishedAt, sourceStatus, versionCount, firstSeenAt, updatedAt, lastCheckedAt, currentVersion: { id, label, summary, fileStatus, analysisStatus, hasText } }`. `kind`: `nota-tecnica`, `resolucao`, `protocolo`, `norma`, `proposta`, `comunicado`, `aviso`, `noticia`, `pagina`. `fileStatus`: `none`, `pending`, `ok`, `error`, `skipped` (publicado antes de 2025, não baixado).

**Versões:** cada mudança no que a fonte mostra (título, resumo, rótulo de versão, arquivo, texto da página) é uma nova versão; as anteriores nunca são alteradas. O texto lido depois (página do item, PDF) completa a versão sem criar outra.

## 8. Fora do contrato

- **Arquivos da tela:** o build do React é servido pelo Nginx em produção (`deploy/nginx.conf`) e pelo `run.py` em desenvolvimento.
- **Detalhes internos:** coletores, classificador, agendamento, backup e o esquema do banco têm testes próprios em pytest (`backend/tests/`). As regras do frontend têm testes em Vitest (`frontend/src/**/*.test.ts`).
