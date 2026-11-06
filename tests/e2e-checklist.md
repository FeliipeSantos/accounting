# Browser regression checklist

Run after every step, on `npm run dev` (http://localhost:8080).
Back up `db.json` before and compare it afterwards: the flows below must leave it unchanged.

## Auth (server-side session)
- [ ] Logged out: only the login card shows; the side menu is hidden; placeholders do not reveal credentials.
- [ ] Wrong credentials show "Usuário ou senha incorretos."; 5 failures from the same IP show "Muitas tentativas…".
- [ ] A configured user (locally without AUTH_USERS: `admin` / `admin`, dev only) opens the Portal de Projetos with the side menu.
- [ ] Reloading the page keeps the session (cookie `sid`, not readable by `document.cookie`).
- [ ] Session ended on the server (logout elsewhere / restart): the next action returns to login with "Sua sessão expirou" and the projects are NOT replaced by the default list.
- [ ] "Sair" returns to login; `/api/projects` then answers 401.
- [ ] Without login: `/db.json`, `/server.js`, `/lib/auth.js` → 403; `/api/projects`, `/api/intelligence/*` → 401.
- [ ] No "Content Security Policy" errors in the console.

## Side menu
- [ ] "Portal de Projetos" is highlighted as active.
- [ ] Collapse button shrinks the menu to icons; reload keeps the state; expand restores it.

## Portal de Projetos
- [ ] Project cards render with name, date, progress and activity count.
- [ ] Search filters cards by name.
- [ ] "Editar" opens the dashboard with activities, subactivities, attention lists and kanban.
- [ ] Clicking an activity row lists its subactivities.
- [ ] "Editar" toggles edit mode; "Cancelar" reverts the session changes.
- [ ] "Projetos" header button and the side menu item both return to the list.
- [ ] "Novo Projeto" creates a card; deleting it removes the card (db.json back to original).
- [ ] Mobile (375 px, reload after resizing): the project list has no horizontal scroll; desktop keeps 2 columns of 360 px at 1024 px.

## Inteligência Contábil
- [ ] Side menu item opens the module and becomes the only active item (also from inside the project editor).
- [ ] Dashboard shows the 5 indicators, recent publications and the 17 categories.
- [ ] Each indicator opens the matching list: Total (all), Críticas (relevance), Recentes (last 7 days), Reforma Tributária (IBS/CBS/IS group), Última execução (Histórico).
- [ ] Each tab loads: Publicações (6 filters: assunto, fonte, relevância, de, até, busca + clear), Categorias (click opens Publicações filtered), Favoritos, Histórico, Configurações.
- [ ] Search ignores accents ("tributaria" finds "Tributária"); "Carregar mais" appears only with more than 50 results.
- [ ] Histórico: "Ver publicações" on a run opens the list of what it stored, with a banner and "Ver todas".
- [ ] Configurações lists 9 sources, all collectable, with the method (JSON/API/Página oficial) and last success; saving the time shows "Configurações salvas." (restore 06:00 afterwards).
- [ ] Mobile (375 px): no horizontal scroll in any module tab; detail panel uses the full width.
- [ ] Publication card opens the detail panel with date, type, classification, organ, relevance, subjects and official link; ☆ toggles favorite; Esc / ✕ closes it and the card star updates.
- [ ] Detail panel shows "Por que a relevância é …?" (act weight, reform bonus, score) and "Por que estes assuntos?" (terms found or subject of the source); hovering the relevance badge on a card shows the same reasoning.
- [ ] No stray "null"/"undefined" text in any tab or detail panel.
- [ ] Favorites tab lists the saved item; removing it from the card empties the tab (leave no test favorites behind).
- [ ] Histórico shows the runs with origin, status, new and duplicate counts.
- [ ] "Atualizar agora" disables itself and shows "Coleta em andamento…"; on success the line disappears and the "Última execução" card updates; on failure a yellow line lists the failed sources. The run appears as "Manual" in Histórico.
- [ ] Clicking it again within 60 s shows "Aguarde N s para executar novamente".

- [ ] Dashboard "Última execução" shows "próxima automática: <data> às <hora>"; Configurações shows the same next run.

## Monitoring (terminal)
- [ ] On `npm run dev`, the log shows "agendamento ativo: diariamente às HH:MM; próxima execução ...". If today's scheduled run was missed, it runs right away ("execução agendada iniciada").
- [ ] `npm run intel:run` finishes with every source OK; running it again right after gives 0 new items.
- [ ] "Portal de Projetos" in the menu returns to the project list.

## Print
- [ ] Print preview (Ctrl+P / 🖨️) shows only the report pages, without the side menu or header.

## Console
- [ ] No errors in the browser console during the whole flow.
