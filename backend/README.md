# Backend (Flask)

API do opencontabil (veja `docs/api-contract.md`). Usa o banco SQLite indicado em `DB_PATH` e o `.env` da raiz do projeto.

## Ambiente

```bash
cd backend
py -3.12 -m venv .venv
.venv\Scripts\activate          # Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
```

## Comandos

| Comando | O que faz |
|---|---|
| `python run.py` | Servidor de desenvolvimento (`PORT`, `HOST` e `DB_PATH` do `.env`). Também entrega a tela já gerada (`frontend/dist`) |
| `flask user list` / `add` / `passwd` / `remove <usuario>` | Usuários do sistema (a senha é pedida no terminal) |
| `flask db-backup` | Cópia consistente do banco agora |
| `flask intel run` | Coleta do módulo Publicações agora |
| `flask intel scheduled` | Coleta diária, se estiver na hora (chamado pelo timer do systemd a cada 5 minutos) |
| `flask intel reclassify` | Reaplica as regras de classificação às publicações guardadas |
| `flask intel check` | Testa o acesso às 9 fontes oficiais, sem gravar nada |
| `flask reforma run` / `scheduled` / `status` / `events [--rebuild]` / `reread-pages` | Calendário: sincroniza as fontes agora; sincroniza se estiver na hora (timer do systemd); mostra a situação das fontes; extrai as datas do calendário (`--rebuild` refaz todas depois de mudar as regras); relê as páginas dos itens (CGIBS, Receita) mantendo as tabelas |
| `flask intel fulltext [--all]` | Busca o texto completo das publicações que ainda não o têm ou cuja busca falhou (a coleta já faz isso para as novas); `--all` busca de novo todas |
| `pytest` | Testes internos do backend |
| `node tests/run-contract.js` (na raiz) | Testes de contrato da API |
| `ruff check <arquivos>` e `ruff format <arquivos>` | Lint e formatação |

## Estrutura

```
app/
  core/            banco, usuários, sessões, regras HTTP, backup e comandos
  modules/
    projects/      Portal de Projetos (tabelas projects_)
    intelligence/  Publicações (tabelas intel_): catálogo, coletores,
                   classificador, texto completo e pontos principais (fulltext,
                   keypoints), monitor, agendamento, rotas e comandos
    reforma/       Calendário (tabelas reforma_): fontes da
                   Reforma Tributária, documentos e versões, PDFs oficiais e sincronização
run.py             servidor de desenvolvimento e testes
wsgi.py            entrada de produção (gunicorn, configurado em gunicorn.conf.py)
```

Módulo novo: uma pasta em `app/modules/` com `models.py` (e, se tiver, um `blueprint` com as rotas e um `cli_group` com os comandos) e uma linha em `MODULES` (`app/modules/__init__.py`). No frontend, o equivalente é uma pasta em `frontend/src/modules/` e uma linha em `MODULES` (`frontend/src/modules/index.tsx`).

## Migrations (Alembic)

As migrations são **geradas e aplicadas manualmente pela equipe**. O servidor nunca as aplica sozinho: sem as tabelas, ele se recusa a iniciar e pede `flask db upgrade`.

Os bancos já existentes (o local e o da VPS) foram criados pela versão anterior, em Node. Eles têm uma tabela `schema_migrations`, daquela época, que fica fora do Alembic. O teste `tests/test_schema.py` garante que os models descrevem exatamente essas tabelas.

### Migrations existentes

| Revisão | O que faz |
|---|---|
| `a92784c200a9` (baseline) | As tabelas da época do Node, como estão nos bancos já existentes |
| `db5ed58d529d` | `intel_publication_texts`: texto completo das publicações |
| `ea72123dc9fa` | Calendário: documentos, versões e log de sincronização (`reforma_*`) |
| `7deeca8a7820` | Calendário: eventos do calendário e histórico (`reforma_events`, `reforma_event_history`) |

- **Banco que já existe** (o seu local e o da VPS), criado pelo Node: marque **só a baseline** como aplicada (sem rodá-la) e aplique as seguintes. Não use `stamp head`, que marcaria também as migrations novas sem criar as tabelas delas:
  ```bash
  flask db stamp a92784c200a9
  flask db upgrade
  flask intel fulltext                  # texto completo das publicações já guardadas
  ```
- **Instalação nova:** `flask db upgrade`.

O teste `tests/test_schema.py` confere as duas coisas: a baseline sozinha cria as tabelas do Node, e banco do Node + baseline + `upgrade` resulta exatamente nos models.

### Migration nova

Altere os models e gere a migration contra um banco já atualizado (`flask db upgrade`); confira o arquivo gerado em `migrations/versions/` antes de usar:

```bash
flask db migrate -m "descrição"
```
