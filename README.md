# opencontabil

Sistema interno com seis módulos. Na barra de navegação do topo, Publicações e Calendário ficam no menu **Inteligência Contábil**, e Clientes, Recebimentos e Geração de DAS no menu **Gestão Contábil**:
- **Portal de Projetos:** status report dos projetos, com atividades, subatividades, pontos de atenção e kanban, e impressão em A4.
- **Publicações:** coleta diária de atualizações fiscais, tributárias e trabalhistas em 12 fontes oficiais (inclusive Convênios e Protocolos ICMS do CONFAZ, Notas Técnicas e avisos do Portal da NF-e, resoluções, comunicados e notícias do Comitê Gestor do IBS e avisos da Conformidade Fácil), classificadas por regras.
- **Calendário**: mostra as obrigatoriedades, os prazos e o início de vigência de legislações e de alterações (ex.: início da emissão de NFS-e na locação, prazo de opção pelo Simples Nacional, exclusão de produtos da substituição tributária), de qualquer assunto. Lê tudo o que o módulo Publicações coleta (inclusive os Protocolos ICMS), e lê direto das fontes o que precisa de versões e PDFs (Notas Técnicas da NF-e, resoluções do Comitê Gestor do IBS, Conformidade Fácil), além da seção da Reforma e das notícias antigas da Receita, das páginas da Fazenda e da NFS-e, guarda o histórico de versões e os PDFs oficiais. As datas vêm por regras e só de atos oficiais, sempre com o trecho do ato, mais 22 prazos recorrentes da legislação (Simples Nacional e MEI, SPED, folha: eSocial, FGTS, contribuições e IRRF, PIS/Cofins, IPI, IRPJ/CSLL, DME, e-Financeira, DeSTDA e GIA-ST), calculados com dias úteis, feriados nacionais e Carnaval e com a fonte oficial de cada regra (um ato novo que fale em mudar um desses prazos marca a regra como "Pode ter mudado", para revisão); notícias e comunicados não geram datas, servem para achar no DOU o ato que citam. Além do calendário, tem um Painel (prazos dos próximos 14 dias e atos publicados na semana) e uma Linha do tempo mês a mês. A análise por IA (impacto, quem é afetado, providência) é a próxima etapa.
- **Clientes** (Gestão Contábil): cadastro dos clientes do escritório, com CPF ou CNPJ (inclusive o CNPJ alfanumérico) validado pelos dígitos verificadores, regime tributário, endereço fiscal, inscrições, contato, honorário mensal, data de início e situação (ativo/inativo).
- **Recebimentos** (Gestão Contábil): lançamento do que cada cliente pagou, com o trabalho realizado (honorário mensal, geração de guias, emissão de nota fiscal, imposto de renda... em uma lista que você mesmo amplia, renomeia e desativa), a competência, o valor cobrado e o valor recebido. O saldo de cada cliente soma tudo o que foi recebido menos o que foi cobrado: o que é pago a mais fica como crédito e é usado nos próximos serviços, e o que falta pagar aparece como em aberto. Cliente com recebimentos não pode ser excluído (só marcado como inativo), para não perder o histórico.
- **Geração de DAS** (Gestão Contábil): controle mensal do DAS dos clientes MEI. O botão Gerar copia o CNPJ e abre o PGMEI, onde a guia é emitida à mão (o site tem captcha invisível); o PDF baixado é enviado ao sistema, que confere o CNPJ e a competência, guarda o arquivo e lê o valor, o vencimento e a linha digitável. Quando o cliente pagar, a guia é marcada como paga. Mostra o vencimento de cada competência (dia 20 do mês seguinte, adiado para o dia útil seguinte) e as guias vencidas sem pagamento. A emissão automática exigiria a API Integra Contador do Serpro, que só pode ser contratada com e-CNPJ.

| Pasta | Conteúdo |
|---|---|
| `backend/` | API em Python (Flask, SQLAlchemy, SQLite). Veja `backend/README.md` |
| `frontend/` | Tela em React + TypeScript + Ant Design (Vite) |
| `deploy/` | Configuração de produção: Nginx, serviço e timers do systemd |
| `docs/api-contract.md` | Contrato da API entre a tela e o backend |
| `DEPLOY.md` | Publicação numa VPS Linux |
| `DOCKER.md` | Publicação com Docker (`Dockerfile`, `docker-compose.yml`, pasta `docker/`) |

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
