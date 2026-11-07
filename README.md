# Project Accounting

Sistema interno com dois módulos:
- **Portal de Projetos:** status report dos projetos, com atividades, subatividades, pontos de atenção e kanban, e impressão em A4.
- **Inteligência Contábil:** coleta diária de atualizações fiscais, tributárias e trabalhistas em 9 fontes oficiais, classificadas por regras.

| Pasta | Conteúdo |
|---|---|
| `backend/` | API em Python (Flask, SQLAlchemy, SQLite). Veja `backend/README.md` |
| `frontend/` | Tela em React + TypeScript + Ant Design (Vite) |
| `deploy/` | Configuração de produção: Nginx, serviço e timers do systemd |
| `docs/api-contract.md` | Contrato da API entre a tela e o backend |
| `DEPLOY.md` | Publicação numa VPS Linux |

## Rodar na máquina de desenvolvimento

Na raiz do projeto:

```bash
npm run dev
```

O comando sobe o backend (porta 8080) e a tela com recarga automática ao editar (porta 5173), juntos. Acesse http://localhost:5173. Ctrl+C encerra os dois. Sem usuários no banco, em desenvolvimento o backend cria `admin` / `admin`.

Na primeira vez, prepare as duas partes (o comando avisa se faltar algo):

```bash
cd backend
py -3.12 -m venv .venv
.venv\Scripts\pip install -r requirements-dev.txt
cd ..\frontend
npm install
```

Para rodar cada parte em separado: `.venv\Scripts\python run.py` em `backend/` e `npm run dev` em `frontend/`.

Para ver a tela como em produção: rode `npm run build` em `frontend/` e acesse http://localhost:8080. O `run.py` entrega o build.

## Verificações do frontend

Na pasta `frontend/`:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```
