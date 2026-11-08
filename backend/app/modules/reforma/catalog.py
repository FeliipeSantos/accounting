"""Monitored sources of the Calendário module.

Every entry was checked with real requests on 2026-11-07 (method, structure and access
policy). Nothing here is presumed: where an official API was not found, the method says so.
Sources the Publicações module already collects (DOU, Senado, Câmara, CONFAZ
convênios, Receita, Fazenda, Simples) are read from its database instead of fetched again.
"""

# Tipos de documento: definem como a próxima etapa trata o conteúdo (uma notícia nunca vira obrigação)
KINDS = {
    "nota-tecnica": "Nota Técnica",
    "resolucao": "Resolução",
    "protocolo": "Protocolo ICMS",
    "norma": "Norma",
    "proposta": "Proposta legislativa",
    "comunicado": "Comunicado",
    "aviso": "Aviso técnico",
    "noticia": "Notícia",
    "pagina": "Página oficial monitorada",
}

SOURCES: list[dict] = [
    {
        "id": "intel",
        "name": "Publicações (DOU, Senado, Câmara, CONFAZ, Receita, Fazenda, Simples)",
        "url": "/#/inteligencia-contabil/publicacoes",
        "method": "Banco do módulo Publicações (todas as publicações, de todos os assuntos, com texto completo)",
        "note": "Sem nova requisição às fontes: aproveita a coleta diária do módulo Publicações.",
    },
    {
        "id": "nfe-nt",
        "name": "Portal NF-e — Notas Técnicas",
        "url": "https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=04BIflQt1aY=",
        "method": "Página oficial (sem API ou feed); número, versão e data de cada NT; PDF oficial",
        "note": "Cada nova versão (ex.: v1.52 → v1.53) gera uma versão no histórico.",
    },
    {
        "id": "nfe-avisos",
        "name": "Portal NF-e — Avisos",
        "url": "https://www.nfe.fazenda.gov.br/portal/informe.aspx?ehCTG=false",
        "method": "Página oficial (sem API ou feed)",
        "note": "Inclui alterações de datas de implantação das NTs em produção.",
    },
    {
        "id": "cgibs-resolucoes",
        "name": "Comitê Gestor do IBS — Resoluções",
        "url": "https://www.cgibs.gov.br/resolucoes",
        "method": "Página oficial; PDF oficial de cada resolução",
        "note": "",
    },
    {
        "id": "cgibs-comunicados",
        "name": "Comitê Gestor do IBS — Comunicados Oficiais",
        "url": "https://www.cgibs.gov.br/comunicados-oficiais",
        "method": "Serviço JSON usado pela própria página (/_service/conteudo/pagedlistfilho)",
        "note": "",
    },
    {
        "id": "cgibs-noticias",
        "name": "Comitê Gestor do IBS — Notícias",
        "url": "https://www.cgibs.gov.br/noticias",
        "method": "Serviço JSON usado pela própria página (/_service/conteudo/pagedlistfilho)",
        "note": "",
    },
    {
        "id": "cff-noticias",
        "name": "Portal da Conformidade Fácil (SVRS) — Notícias",
        "url": "https://dfe-portal.svrs.rs.gov.br/CFF/Noticias",
        "method": "Página oficial (sem API ou feed)",
        "note": "Implantações das NTs em homologação e produção.",
    },
    {
        "id": "confaz-protocolos",
        "name": "CONFAZ — Protocolos ICMS (até 08/11/2026)",
        "url": "https://www.confaz.fazenda.gov.br/legislacao/protocolos",
        "method": "Página oficial por ano, lida aqui até 08/11/2026",
        "note": "Os protocolos novos chegam pelo módulo Publicações (fonte CONFAZ); os já guardados continuam aqui, com datas e histórico.",
    },
    {
        "id": "receita-rt",
        "name": "Receita Federal — Reforma Tributária",
        "url": "https://www.gov.br/receitafederal/pt-br/assuntos/reforma-tributaria",
        "method": "Feed RSS oficial da seção (/assuntos/reforma-tributaria/RSS)",
        "note": "",
    },
    {
        "id": "receita-noticias",
        "name": "Receita Federal — Notícias",
        "url": "https://www.gov.br/receitafederal/pt-br/assuntos/noticias",
        "method": "Lista oficial de notícias, desde jan/2025 na primeira coleta; só os assuntos da Reforma",
        "note": "Anúncios da Reforma publicados fora da seção própria (ex.: NFS-e Nacional para o Simples Nacional).",
    },
    {
        "id": "paginas",
        "name": "Páginas oficiais monitoradas",
        "url": "https://www.gov.br/fazenda/pt-br/acesso-a-informacao/acoes-e-programas/reforma-tributaria",
        "method": "Texto da página comparado a cada consulta; mudança gera nova versão",
        "note": "Regulamentação da Reforma (Fazenda), documentação e cronograma da NFS-e Nacional.",
    },
    {
        "id": "atos-citados",
        "name": "Atos oficiais citados (DOU)",
        "url": "https://www.in.gov.br/leiturajornal",
        "method": (
            "Ato do DOU citado por um documento monitorado (Ato Conjunto RFB/CGIBS, IN RFB, Portaria Conjunta, "
            "Resolução CGSN, Decreto), localizado pela data citada"
        ),
        "note": "Confirma no texto oficial as datas que comunicados apenas reproduzem.",
    },
]

SOURCE_IDS = {s["id"] for s in SOURCES}

# Páginas sem lista de publicações, monitoradas pelo próprio conteúdo
WATCHED_PAGES: list[dict] = [
    {
        "id": "fazenda-regulamentacao",
        "title": "Reforma Tributária — Regulamentação (Ministério da Fazenda)",
        "url": "https://www.gov.br/fazenda/pt-br/acesso-a-informacao/acoes-e-programas/reforma-tributaria",
    },
    {
        "id": "nfse-documentacao-atual",
        "title": "NFS-e Nacional — Documentação técnica atual (produção)",
        "url": "https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual",
    },
    {
        "id": "nfse-cronograma",
        "title": "NFS-e Nacional — Plano de implantação",
        "url": "https://www.gov.br/nfse/pt-br/municipios/cronograma-de-implantacao-da-nfs-e",
    },
]
