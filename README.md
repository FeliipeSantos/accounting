# Project Accounting

Sistema interno com três módulos. No menu lateral, Publicações e Calendário ficam dentro do grupo **Inteligência Contábil**:
- **Portal de Projetos:** status report dos projetos, com atividades, subatividades, pontos de atenção e kanban, e impressão em A4.
- **Publicações:** coleta diária de atualizações fiscais, tributárias e trabalhistas em 12 fontes oficiais (inclusive Convênios e Protocolos ICMS do CONFAZ, Notas Técnicas e avisos do Portal da NF-e, resoluções, comunicados e notícias do Comitê Gestor do IBS e avisos da Conformidade Fácil), classificadas por regras.
- **Calendário** (uso pessoal, `REFORMA_USERS`): mostra as obrigatoriedades, os prazos e o início de vigência de legislações e de alterações (ex.: início da emissão de NFS-e na locação, prazo de opção pelo Simples Nacional, exclusão de produtos da substituição tributária), de qualquer assunto. Lê tudo o que o módulo Publicações coleta (inclusive os Protocolos ICMS), e lê direto das fontes o que precisa de versões e PDFs (Notas Técnicas da NF-e, resoluções do Comitê Gestor do IBS, Conformidade Fácil), além da seção da Reforma e das notícias antigas da Receita, das páginas da Fazenda e da NFS-e, guarda o histórico de versões e os PDFs oficiais. As datas vêm por regras e só de atos oficiais, sempre com o trecho do ato, mais os prazos recorrentes da legislação (opção pelo SIMEI, DASN-SIMEI, DEFIS, ECD, ECF, DAS, DCTFWeb, EFD-Reinf), calculados com dias úteis e feriados nacionais e com a fonte oficial de cada regra (um ato novo que fale em mudar um desses prazos marca a regra como "Pode ter mudado", para revisão); notícias e comunicados não geram datas, servem para achar no DOU o ato que citam. A análise por IA (impacto, quem é afetado, providência) é a próxima etapa.

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
