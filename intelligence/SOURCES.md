# Fontes oficiais — viabilidade de coleta

Verificado com requisições reais em 06/11/2026 (Node `fetch`, sem navegador, sem contornar bloqueios).

## Catálogo atual

| Fonte | Método | Endereço | Resultado do teste |
|---|---|---|---|
| Diário Oficial da União | JSON oficial | `in.gov.br/leiturajornal?data=DD-MM-AAAA&secao=do1` | 200; `<script id="params">` com `jsonArray` (309 atos em 05/11/2026). Campos: `title`, `artType`, `hierarchyStr` (órgão), `pubDate`, `content` (trecho), `urlTitle` |
| Receita Federal | HTML | `gov.br/receitafederal/pt-br/assuntos/noticias` | 200; mesmo layout da Fazenda (`ul.noticias` → `h2.titulo`, `span.data`, `span.descricao`) |
| Ministério da Fazenda | HTML | `gov.br/fazenda/pt-br/assuntos/noticias` | 200; links `.../noticias/AAAA/mes/slug` com título no texto do link. `/RSS` retorna 404 |
| Simples Nacional | HTML | `www8.receita.fazenda.gov.br/SimplesNacional/Noticias/TodasNoticias.aspx` | 200; `#listaNoticias` com 29 notícias (`NoticiaCompleta.aspx?id=...`) e datas |
| CONFAZ — Convênios ICMS | HTML | `confaz.fazenda.gov.br/legislacao/convenios/AAAA` | 200; lista `CONVÊNIO ICMS nn/aa` com ementa no `title` do link |
| SPED | HTML | `http://sped.rfb.gov.br/` | 200; `section.destaque` com título, data `(DD/MM/AAAA)` e resumo. HTTPS: timeout |
| eSocial | HTML | `gov.br/esocial/pt-br/noticias` | 200; 30 `article.tileItem` com título, descrição e data. `/RSS` retorna 404 |
| Legislação Federal | API (Senado) | `legis.senado.leg.br/dadosabertos/legislacao/lista?tipo=LEI\|LCP\|DEC\|MPV&ano=AAAA` | 200 JSON; `ListaDocumento.documentos.documento[]` com `tipo`, `numero`, `normaNome`, `ementa`, `dataassinatura` |
| Câmara — Projetos de Lei *(adicional)* | API (Câmara) | `dadosabertos.camara.leg.br/api/v2/proposicoes?siglaTipo=PL\|PLP&ordem=DESC&ordenarPor=id` | 200 JSON; `dados[]` com `siglaTipo`, `numero`, `ano`, `ementa`, `dataApresentacao`. Respostas lentas (~9 s) |

## Endereços descartados

| Endereço | Resultado | Substituto |
|---|---|---|
| Planalto (`www4.planalto.gov.br/legislacao`, `planalto.gov.br/ccivil_03/...`) | Conexão encerrada (ECONNRESET) em todas as páginas | API do Senado |
| LexML (`lexml.gov.br/busca/SRU`) | Página de "Verificação de segurança" (anti-robô) | API do Senado |
| CONFAZ — Ajustes SINIEF (`/legislacao/ajustes/AAAA`) | Redireciona para login | DOU (publicação obrigatória) |
| INLABS (`inlabs.in.gov.br`) | Em "Manutenção Programada"; exige cadastro gratuito | Alternativa futura ao JSON do DOU |
| Receita — feed RSS (`/assuntos/noticias/RSS`) | Desatualizado: notícia mais recente de julho, enquanto a página tinha notícias de novembro | Página de notícias (HTML) |
| Receita Sijut (`normasinternet2.receita.fazenda.gov.br`) | Aplicação web sem API pública documentada (403) | DOU |

**Correção:** o 403 do Simples Nacional no primeiro teste vinha de um endereço de pasta (`/simplesnacional/noticias/`), não de bloqueio. A página `TodasNoticias.aspx` responde normalmente.

## Limitações conhecidas

- CONFAZ: a data vem da linha "Publicado no DOU de dd.mm.aa" de cada convênio; se a página não a trouxer, a data fica em branco ("não informada pela fonte") em vez de ser deduzida.
- Legislação Federal (Senado): a API informa a data de assinatura; a publicação no DOU costuma ocorrer no mesmo dia ou no seguinte.
- A mesma notícia pode aparecer na Receita e na Fazenda; são guardadas como publicações distintas, cada uma com seu link oficial.

## Observações

- Leis, decretos, convênios e ajustes só têm validade após publicação no DOU; a coleta via DOU é a fonte oficial completa desses atos.
- Coletas em HTML dependem do layout dos sites e podem quebrar sem aviso; cada falha é registrada por fonte e não interrompe as demais.
- Nenhum bloqueio (login, conexão recusada, verificação anti-robô) é contornado.
- Somente domínios oficiais são aceitos nos links salvos: `*.gov.br` e `*.leg.br`.
