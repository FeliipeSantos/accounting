# Backend Flask

Novo backend do Project Accounting, em migração a partir do servidor Node (veja `docs/api-contract.md`). Usa o mesmo banco SQLite e o mesmo `.env` da raiz do projeto.

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
| `python run.py` | Servidor de desenvolvimento (`PORT`, `HOST` e `DB_PATH` do `.env`) |
| `flask user list` / `add` / `passwd` / `remove <usuario>` | Usuários do sistema (a senha é pedida no terminal) |
| `flask db-backup` | Cópia consistente do banco agora |
| `flask intel run` | Coleta da Inteligência Contábil agora |
| `flask intel scheduled` | Coleta diária, se estiver na hora (chamado pelo timer do systemd a cada poucos minutos) |
| `flask intel reclassify` | Reaplica as regras de classificação às publicações guardadas |
| `flask intel check` | Testa o acesso às 9 fontes oficiais, sem gravar nada |
| `pytest` | Testes internos do backend |
| `npm run test:contract:flask` (na raiz) | Testes de contrato da API contra este backend |
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
wsgi.py            entrada de produção (gunicorn)
```

Módulo novo: uma pasta em `app/modules/` com `models.py` (e um `blueprint` quando tiver rotas) e uma linha em `MODULES` (`app/modules/__init__.py`).

## Migrations (Alembic)

As migrations são **geradas e aplicadas manualmente pela equipe**. O servidor nunca as aplica sozinho: sem as tabelas, ele se recusa a iniciar e pede `flask db upgrade`.

A tabela `schema_migrations` do servidor Node fica fora do Alembic enquanto as duas versões convivem.

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

- **Banco que já existe** (o seu local e o da VPS, criados pelo Node), que já tem as tabelas: marque a baseline como aplicada, sem rodá-la:
  ```bash
  set DB_PATH=                          # volta ao banco do .env
  flask db stamp head
  ```
- **Instalação nova:** `flask db upgrade`.
