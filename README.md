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

1. **Backend** (porta 8080): prepare o ambiente conforme `backend/README.md` e rode:
   ```bash
   cd backend
   .venv\Scripts\python run.py
   ```
   Sem usuários no banco, em desenvolvimento ele cria `admin` / `admin`.

2. **Tela**, com recarga automática ao editar (porta 5173, repassa `/api` ao backend):
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Acesse http://localhost:5173.

Para ver a tela como em produção: rode `npm run build` em `frontend/` e acesse http://localhost:8080. O `run.py` entrega o build.

## Verificações do frontend

Na pasta `frontend/`:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```
