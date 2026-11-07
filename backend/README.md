# Backend (Flask)

API do Project Accounting (veja `docs/api-contract.md`). Usa o banco SQLite indicado em `DB_PATH` e o `.env` da raiz do projeto.

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
| `flask intel run` | Coleta da Inteligência Contábil agora |
| `flask intel scheduled` | Coleta diária, se estiver na hora (chamado pelo timer do systemd a cada 5 minutos) |
| `flask intel reclassify` | Reaplica as regras de classificação às publicações guardadas |
| `flask intel check` | Testa o acesso às 9 fontes oficiais, sem gravar nada |
| `pytest` | Testes internos do backend |
| `node tests/run-contract.js` (na raiz) | Testes de contrato da API |
| `ruff check <arquivos>` e `ruff format <arquivos>` | Lint e formatação |

## Estrutura

```
app/
  core/            banco, usuários, sessões, regras HTTP, backup e comandos
  modules/
    projects/      Portal de Projetos (tabelas projects_)
    intelligence/  Inteligência Contábil (tabelas intel_): catálogo, coletores,
                   classificador, monitor, agendamento, rotas e comandos
run.py             servidor de desenvolvimento e testes
wsgi.py            entrada de produção (gunicorn, configurado em gunicorn.conf.py)
```

Módulo novo: uma pasta em `app/modules/` com `models.py` (e, se tiver, um `blueprint` com as rotas e um `cli_group` com os comandos) e uma linha em `MODULES` (`app/modules/__init__.py`). No frontend, o equivalente é uma pasta em `frontend/src/modules/` e uma linha em `MODULES` (`frontend/src/modules/index.tsx`).

## Migrations (Alembic)

As migrations são **geradas e aplicadas manualmente pela equipe**. O servidor nunca as aplica sozinho: sem as tabelas, ele se recusa a iniciar e pede `flask db upgrade`.

Os bancos já existentes (o local e o da VPS) foram criados pela versão anterior, em Node. Eles têm uma tabela `schema_migrations`, daquela época, que fica fora do Alembic. O teste `tests/test_schema.py` garante que os models descrevem exatamente essas tabelas.

### Migration inicial (baseline), feita uma vez

A baseline precisa ser gerada contra um banco **vazio**, para conter a criação de todas as tabelas:

```bash
cd backend
.venv\Scripts\activate
flask db init
set DB_PATH=%TEMP%\baseline.db          # Linux: export DB_PATH=/tmp/baseline.db
flask db migrate -m "baseline"
```

Confira o arquivo gerado em `migrations/versions/` antes de usar.

- **Banco que já existe** (o seu local e o da VPS), que já tem as tabelas: marque a baseline como aplicada, sem rodá-la:
  ```bash
  set DB_PATH=                          # volta ao banco do .env
  flask db stamp head
  ```
- **Instalação nova:** `flask db upgrade`.
