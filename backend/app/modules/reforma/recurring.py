"""Recurring deadlines: obligations whose date repeats every month or every year by a fixed
rule of the legislation, without a new act repeating it (e.g. the option for the SIMEI in
January, the ECD in June). Nothing is stored: the dates are calculated for the period shown.

Every rule keeps, like the other calendar dates, the literal text of an official source and
its address (checked on 2026-11-08). A rule enters here only when that source was found.

Business days: weekends, the national holidays (fixed ones and Good Friday) and the Monday and
Tuesday of Carnaval, when there is no banking business. Corpus Christi and state or municipal
holidays are not considered; when the rule depends on them, the note of the date says so.
"""

import re
from datetime import date, timedelta

from app.modules.reforma.events import CALENDAR_KINDS

SOURCE_ID = "recorrentes"
SOURCE_NAME = "Prazos recorrentes da legislação"
STATUS = "recorrente"
LEGAL_STATUS = "Regra recorrente da legislação"
# o "a seguir" conta as ocorrências dos próximos 12 meses
UPCOMING_DAYS = 365
# dia em que as regras foram conferidas nas fontes oficiais; ao atualizar uma regra, atualize
# o "checkedOn" dela: os atos publicados até esse dia deixam de gerar o alerta
CHECKED_ON = "2026-11-08"

# watch: palavras que identificam a obrigação num ato novo (texto sem acentos, minúsculo)
# frequency: "monthly", or "annual" with "month" (one month) or "months" (quarterly, semiannual)
# rule: ("last_business_day",) | ("last_day",) | ("business_day", n): the n-th business day |
#       ("day", n) | ("day", n, "before"|"after") for a non-business day
RULES: list[dict] = [
    {
        "id": "simei-opcao",
        "watch": r"\bsimei\b",
        "title": "Opção pelo SIMEI (MEI já inscrito no CNPJ)",
        "kind": "prazo",
        "subjects": ["simples-nacional"],
        "frequency": "annual",
        "month": 1,
        "rule": ("last_business_day",),
        "quote": (
            "Se você já era um empresário individual, inscrito no CNPJ, você pode optar pelo Simei no mês de janeiro, "
            "até o último dia útil."
        ),
        "url": "https://www.gov.br/pt-br/servicos/optar-pelo-sistema-de-recolhimento-do-mei",
        "sourceName": "gov.br — Optar pelo sistema de recolhimento do MEI (SIMEI)",
        "basis": "Resolução CGSN nº 140, de 2018",
    },
    {
        "id": "dasn-simei",
        "watch": r"\bdasn-?simei\b|declaracao anual simplificada do microempreendedor",
        "title": "DASN-SIMEI (declaração anual do MEI)",
        "kind": "prazo",
        "subjects": ["simples-nacional", "obrigacoes-acessorias"],
        "frequency": "annual",
        "month": 5,
        "rule": ("day", 31),
        "quote": (
            "O prazo para a entrega da Declaração Anual Simplificada do Microempreendedor Individual (DASN-Simei), "
            "referente ao ano-calendário de 2025, encerra-se no dia 31 de maio de 2026."
        ),
        "url": "https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2026/maio/microempreendedor-individual-mei-tem-ate-31-de-maio-para-entregar-declaracao-anual",
        "sourceName": "Receita Federal — MEI tem até 31 de maio para entregar declaração anual",
        "basis": "Resolução CGSN nº 140, de 2018",
    },
    {
        "id": "defis",
        "watch": r"\bdefis\b|declaracao de informacoes socioeconomicas e fiscais",
        "title": "DEFIS (declaração anual do Simples Nacional)",
        "kind": "prazo",
        "subjects": ["simples-nacional", "obrigacoes-acessorias"],
        "frequency": "annual",
        "month": 3,
        "rule": ("last_day",),
        "quote": (
            "O prazo mensal para entregar a Declaração de Informações Socioeconômicas e Fiscais (DEFIS) é o último dia "
            "do mês de março de cada ano, relativa aos fatos ocorridos no ano-calendário anterior."
        ),
        "url": "https://www.gov.br/pt-br/servicos/declarar-apuracoes-e-informacoes-anuais-do-simples-nacional",
        "sourceName": "gov.br — Declarar apurações e informações anuais do Simples Nacional",
        "basis": "Resolução CGSN nº 140, de 2018",
    },
    {
        "id": "ecd",
        "watch": r"\becd\b|escrituracao contabil digital",
        "title": "ECD (Escrituração Contábil Digital)",
        "kind": "prazo",
        "subjects": ["sped", "obrigacoes-acessorias"],
        "frequency": "annual",
        "month": 6,
        "rule": ("last_business_day",),
        "quote": (
            "A ECD deve ser transmitida ao Sistema Público de Escrituração Digital (Sped) até o último dia útil do mês "
            "de junho do ano subsequente ao ano-calendário a que se refere a escrituração."
        ),
        "url": "https://www.gov.br/pt-br/servicos/entregar-escrituracao-contabil-digital",
        "sourceName": "gov.br — Entregar Escrituração Contábil Digital (ECD)",
        "basis": "Instrução Normativa RFB nº 2.003, de 2021",
    },
    {
        "id": "ecf",
        "watch": r"\becf\b|escrituracao contabil fiscal",
        "title": "ECF (Escrituração Contábil Fiscal)",
        "kind": "prazo",
        "subjects": ["sped", "irpj-csll", "obrigacoes-acessorias"],
        "frequency": "annual",
        "month": 7,
        "rule": ("last_business_day",),
        "quote": (
            "a ECF deve ser transmitida ao Sistema Público de Escrituração Digital (Sped) até o último dia útil do mês "
            "de julho do ano subsequente ao ano-calendário a que se refere a escrituração."
        ),
        "url": "https://www.gov.br/pt-br/servicos/entregar-escrituracao-contabil-fiscal",
        "sourceName": "gov.br — Entregar Escrituração Contábil Fiscal (ECF)",
        "basis": "Instrução Normativa RFB nº 2.004, de 2021",
    },
    {
        "id": "das",
        "watch": r"documento de arrecadacao do simples|\b(?:pagamento|vencimento|recolhimento) do das\b|\bdas(?:-| do )mei\b",
        "title": "DAS do Simples Nacional (apuração do mês anterior)",
        "kind": "prazo",
        "subjects": ["simples-nacional"],
        "frequency": "monthly",
        "rule": ("day", 20, "after"),
        "quote": (
            "Quando não houver expediente bancário no dia 20, o DAS deverá ser pago até o dia útil imediatamente "
            "posterior (para prazos normais, sem prorrogação)"
        ),
        "url": "https://www8.receita.fazenda.gov.br/SimplesNacional/ConteudoApoio/agenda/agenda.aspx",
        "sourceName": "Portal do Simples Nacional — Agenda",
        "basis": "Resolução CGSN nº 140, de 2018",
    },
    {
        "id": "dctfweb",
        "watch": r"\bdctf ?web\b",
        "title": "DCTFWeb (fatos geradores do mês anterior)",
        "kind": "prazo",
        "subjects": ["previdenciaria", "obrigacoes-acessorias"],
        "frequency": "monthly",
        "rule": ("day", 15, "after"),
        "quote": (
            "A partir da publicação da Instrução Normativa RFB nº 2.162, de 4 de outubro de 2023 , que alterou a IN RFB "
            "nº 2.005, de 2021, quando o dia 15 cair em dia não útil para fins fiscais, o prazo de entrega será "
            "postergado para o primeiro dia útil após o dia 15."
        ),
        "url": "https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2023/outubro/postergado-prazo-de-entrega-da-dctfweb",
        "sourceName": "Receita Federal — Postergado prazo de entrega da DCTFWeb",
        "basis": "Instrução Normativa RFB nº 2.005, de 2021, art. 10 (redação da IN RFB nº 2.162, de 2023)",
    },
    {
        "id": "efd-reinf",
        "watch": r"\befd-? ?reinf\b",
        "title": "EFD-Reinf (eventos do mês anterior)",
        "kind": "prazo",
        "subjects": ["sped", "obrigacoes-acessorias"],
        "frequency": "monthly",
        "rule": ("day", 15, "before"),
        "quote": (
            "O prazo de envio dos eventos da EFD-Reinf, salvo do evento R-3010, é o dia 15 do mês seguinte, antecipando-se "
            "o vencimento para o dia útil imediatamente anterior, em caso de não haver expediente bancário."
        ),
        "url": "https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/perguntas-frequentes/sped/efd-reinf/efdr/1-geral/1-12-qual-e-o",
        "sourceName": "Receita Federal — Perguntas frequentes da EFD-Reinf (1.12)",
        "basis": "Instrução Normativa RFB nº 2.043, de 2021",
    },
    {
        "id": "esocial",
        "watch": r"\besocial\b",
        "title": "eSocial: eventos periódicos (folha do mês anterior)",
        "kind": "prazo",
        "subjects": ["esocial", "trabalhista", "obrigacoes-acessorias"],
        "frequency": "monthly",
        "rule": ("day", 15, "after"),
        "quote": (
            "Prazo de envio: este evento deve ser transmitido até o dia 15 (quinze) do mês subsequente ao mês de referência "
            "do evento, postergando-se essa data para o dia útil imediatamente posterior, caso caia em dia não útil para fins fiscais."
        ),
        "url": "https://www.gov.br/esocial/pt-br/documentacao-tecnica/manuais/mos-s-1-3-consolidada-ate-a-no-s-1-3-07-2026.pdf",
        "sourceName": "eSocial — Manual de Orientação do eSocial (S-1.3, consolidada até a NO S-1.3 07/2026)",
        "basis": "Manual de Orientação do eSocial, evento S-1200 e demais periódicos",
    },
    {
        "id": "fgts",
        "watch": r"\bfgts\b",
        "title": "FGTS Digital: guia do FGTS mensal (competência anterior)",
        "kind": "prazo",
        "subjects": ["trabalhista"],
        "frequency": "monthly",
        "rule": ("day", 20, "before"),
        "quote": (
            "A verificação da regularidade da competência (mês) será realizada pelo FGTS Digital apenas após o vencimento do "
            "débito mensal, que ocorre até o dia 20 do mês seguinte. [...] Quanto à data de vencimento, observará os feriados "
            "nacionais e bancários*, antecipando-se o vencimento para o dia útil imediatamente anterior."
        ),
        "url": "https://www.gov.br/trabalho-e-emprego/pt-br/servicos/empregador/fgtsdigital/perguntas-frequentes",
        "sourceName": "Ministério do Trabalho e Emprego — Perguntas frequentes do FGTS Digital",
        "basis": "Lei nº 8.036, de 1990, art. 15 (redação da Lei nº 14.438, de 2022)",
    },
    {
        "id": "inss",
        "watch": r"contribuic(?:ao|oes) previdenciaria|\binss\b",
        "title": "Contribuições previdenciárias (DARF da DCTFWeb)",
        "kind": "prazo",
        "subjects": ["previdenciaria"],
        "frequency": "monthly",
        "rule": ("day", 20, "before"),
        "quote": "O vencimento das contribuições continua o mesmo, ou seja, até o dia 20 do mês seguinte à ocorrência dos fatos geradores.",
        "url": "https://www.gov.br/esocial/pt-br/noticias/receita-federal/dctfweb-entra-em-producao-e-substituira-a-gfip",
        "sourceName": "eSocial — DCTFWeb entra em produção e substituirá a GFIP",
        "basis": "Lei nº 8.212, de 1991, art. 30, I, b; sem expediente bancário, antecipa para o dia útil anterior (art. 30, § 2º, II)",
    },
    {
        "id": "irrf",
        "watch": r"\birrf\b|imposto (?:sobre a renda|de renda) retido na fonte",
        "title": "IRRF (salários e demais retenções do mês anterior)",
        "kind": "prazo",
        "subjects": ["trabalhista"],
        "frequency": "monthly",
        "rule": ("day", 20, "before"),
        "quote": (
            "PRAZO DE RECOLHIMENTO Até o último dia útil do 2º (segundo) decêndio do mês subsequente ao mês de ocorrência "
            "dos fatos geradores."
        ),
        "url": "https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/manuais/irrf/mafon-2024.pdf",
        "sourceName": "Receita Federal — Manual do Imposto sobre a Renda Retido na Fonte (Mafon 2024)",
        "basis": "Lei nº 11.196, de 2005, art. 70, I, d (o 2º decêndio termina no dia 20)",
    },
    {
        "id": "pis-cofins",
        "watch": r"\bpis(?:/pasep)?\b|\bcofins\b",
        "title": "PIS/Pasep e Cofins (faturamento do mês anterior)",
        "kind": "prazo",
        "subjects": ["pis-cofins"],
        "frequency": "monthly",
        "rule": ("day", 25, "before"),
        "quote": (
            "O pagamento da Contribuição para o PIS/Pasep e da Cofins, incidentes sobre a receita ou o faturamento, deve ser "
            "realizado até o até o 25º (vigésimo quinto) dia do mês subsequente ao de ocorrência do fato gerador. [...] Se o dia "
            "do vencimento não for dia útil, considerar-se-á antecipado o prazo para o primeiro dia útil que o anteceder."
        ),
        "url": (
            "https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/declaracoes-e-demonstrativos/ecf/"
            "perguntas-e-respostas-pessoa-juridica-2021-arquivos/"
            "capitulo-xxii-contribuicao-para-o-pis-pasep-e-cofins-incidentes-sobre-a-receita-ou-o-faturamento-2021.pdf"
        ),
        "sourceName": "Receita Federal — Perguntas e Respostas PJ, PIS/Pasep e Cofins (pergunta 111)",
        "basis": "Lei nº 10.637, de 2002, art. 10; Lei nº 10.833, de 2003, art. 11; MP nº 2.158-35, de 2001, art. 18",
    },
    {
        "id": "ipi",
        "watch": r"\bipi\b|imposto sobre produtos industrializados",
        "title": "IPI (fatos geradores do mês anterior)",
        "kind": "prazo",
        "subjects": ["ipi"],
        "frequency": "monthly",
        "rule": ("day", 25, "before"),
        "quote": (
            "III - até o vigésimo quinto dia do mês subsequente ao de ocorrência dos fatos geradores, no caso dos demais "
            "produtos; [...] Se o dia do vencimento de que tratam os incisos II e III não for dia útil, considerar-se-á "
            "antecipado o prazo para o primeiro dia útil que o anteceder."
        ),
        "url": "https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/tributos/ipi",
        "sourceName": "Receita Federal — IPI, Imposto sobre Produtos Industrializados",
        "basis": "Lei nº 8.850, de 1994, art. 1º (redação da Lei nº 11.933, de 2009); regra geral, exceto cigarros (2402.20.00)",
    },
    {
        "id": "efd-contribuicoes",
        "watch": r"\befd-? ?contribuicoes\b",
        "title": "EFD-Contribuições (escrituração de dois meses antes)",
        "kind": "prazo",
        "subjects": ["pis-cofins", "sped", "obrigacoes-acessorias"],
        "frequency": "monthly",
        "rule": ("business_day", 10),
        "quote": (
            "A periodicidade de apresentação do arquivo da EFD-Contribuições é mensal, devendo ser transmitido, após a sua "
            "validação e assinatura digital, até o 10º (décimo) dia útil do segundo mês subsequente ao de referência da escrituração."
        ),
        "url": "http://sped.rfb.gov.br/pagina/show/284",
        "sourceName": "SPED — EFD-Contribuições",
        "basis": "Instrução Normativa RFB nº 1.252, de 2012, art. 7º",
    },
    {
        "id": "dme",
        "watch": r"\bdme\b|operacoes liquidadas com moeda em especie",
        "title": "DME (valores em espécie recebidos no mês anterior, se houver)",
        "kind": "prazo",
        "subjects": ["obrigacoes-acessorias"],
        "frequency": "monthly",
        "rule": ("last_business_day",),
        "quote": (
            "A DME deverá ser enviada à Receita Federal até as 23h59min59s (vinte e três horas, cinquenta e nove minutos e "
            "cinquenta e nove segundos), horário de Brasília, do último dia útil do mês subsequente ao mês de recebimento dos "
            "valores em espécie."
        ),
        "url": "https://www.gov.br/pt-br/servicos/declarar-operacoes-liquidadas-com-moeda-em-especie",
        "sourceName": "gov.br — Declarar operações liquidadas com moeda em espécie (DME)",
        "basis": "Instrução Normativa RFB nº 1.761, de 2017, art. 5º",
    },
    {
        "id": "irpj-csll-estimativa",
        "watch": r"\birpj\b|\bcsll\b|estimativa mensal",
        "title": "IRPJ e CSLL por estimativa mensal (Lucro Real anual)",
        "kind": "prazo",
        "subjects": ["irpj-csll", "lucro-real"],
        "frequency": "monthly",
        "rule": ("last_business_day",),
        "quote": (
            "O imposto apurado, juntamente com o adicional (se for o caso), deve ser recolhido até o último dia útil do mês "
            "subsequente ao da apuração."
        ),
        "url": (
            "https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/declaracoes-e-demonstrativos/ecf/"
            "perguntas-e-respostas-pessoa-juridica-2021-arquivos/capitulo-xv-irpj-pagamento-2021.pdf"
        ),
        "sourceName": "Receita Federal — Perguntas e Respostas PJ, IRPJ: Pagamento (pergunta 019)",
        "basis": "Lei nº 9.430, de 1996, art. 6º; a CSLL segue o mesmo prazo",
    },
    {
        "id": "irpj-csll-trimestral",
        "watch": r"\birpj\b|\bcsll\b|apuracao trimestral",
        "title": "IRPJ e CSLL trimestrais (quota única ou 1ª quota)",
        "kind": "prazo",
        "subjects": ["irpj-csll", "lucro-presumido", "lucro-real"],
        "frequency": "annual",
        "months": [1, 4, 7, 10],
        "rule": ("last_business_day",),
        "quote": (
            "A CSLL, apurada trimestralmente, deve ser paga em quota única, até o último dia útil do mês subseqüente ao do "
            "encerramento do período de apuração."
        ),
        "url": "https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/tributos/CSLL",
        "sourceName": "Receita Federal — CSLL, Contribuição Social sobre o Lucro Líquido",
        "basis": "Lei nº 9.430, de 1996, art. 5º; o IRPJ trimestral segue o mesmo prazo",
    },
    {
        "id": "irpj-csll-ajuste",
        "watch": r"\birpj\b|\bcsll\b|ajuste anual",
        "title": "IRPJ e CSLL: saldo do ajuste anual (Lucro Real por estimativa)",
        "kind": "prazo",
        "subjects": ["irpj-csll", "lucro-real"],
        "frequency": "annual",
        "month": 3,
        "rule": ("last_business_day",),
        "quote": (
            "Se, na declaração de ajuste final, a pessoa jurídica verificar que deve mais IRPJ e CSLL do que o recolhido nas "
            "estimativas mensais pagas durante o ano de 2025, ela deve realizar o pagamento do restante até o último dia útil "
            "do mês de março de 2026 em quota única."
        ),
        "url": "https://www.gov.br/pgfn/pt-br/cidadania-tributaria/por-assunto/irpj-csll/recolhimento-por-estimativa",
        "sourceName": "PGFN — Recolhimento por estimativa (IRPJ e CSLL)",
        "basis": "Lei nº 9.430, de 1996, art. 6º, § 1º, I",
    },
    {
        "id": "e-financeira",
        "watch": r"\be-?financeira\b",
        "title": "e-Financeira (semestre anterior)",
        "kind": "prazo",
        "subjects": ["obrigacoes-acessorias"],
        "frequency": "annual",
        "months": [2, 8],
        "rule": ("last_business_day",),
        "quote": (
            "a e-financeira será transmitida semestralmente: a) até o último dia útil do mês de fevereiro, contendo as "
            "informações relativas ao segundo semestre do ano anterior; b) até o último dia útil do mês de agosto, contendo as "
            "informações relativas ao primeiro semestre do ano em curso."
        ),
        "url": (
            "http://sped.rfb.gov.br/estatico/1A/9045BAD7E07B6ACEF9B8B911CCA59CBDF1E599/"
            "Versao%201.2%20-%2020250909%20-%20e-Financeira%20-%20Manual%20de%20Preenchimentol.pdf"
        ),
        "sourceName": "SPED — Manual de Preenchimento da e-Financeira (versão 1.2, 09/09/2025)",
        "basis": "Instrução Normativa RFB nº 1.571, de 2015, art. 10",
    },
    {
        "id": "destda",
        "watch": r"\bdestda\b|declaracao de substituicao tributaria, diferencial de aliquota e antecipacao",
        "title": "DeSTDA (ICMS-ST, DIFAL e antecipação do Simples Nacional)",
        "kind": "prazo",
        "subjects": ["icms", "simples-nacional", "obrigacoes-acessorias"],
        "frequency": "monthly",
        "rule": ("day", 28, "after"),
        "quote": (
            "Cláusula décima primeira O arquivo digital da DeSTDA deverá ser enviado até o dia 28 (vinte e oito) do mês "
            "subsequente ao encerramento do período de apuração, ou quando for o caso, até o primeiro dia útil imediatamente seguinte."
        ),
        "url": "https://www.confaz.fazenda.gov.br/legislacao/ajustes/2015/AJ_012_15",
        "sourceName": "CONFAZ — Ajuste SINIEF 12/15",
        "basis": "Ajuste SINIEF 12/15, cláusula décima primeira (redação do Ajuste SINIEF 15/16); vale nos estados que adotam a DeSTDA",
    },
    {
        "id": "gia-st",
        "watch": r"\bgia-? ?st\b",
        "title": "GIA-ST (ICMS retido por substituição tributária para outro estado)",
        "kind": "prazo",
        "subjects": ["icms", "obrigacoes-acessorias"],
        "frequency": "monthly",
        "rule": ("day", 10),
        "quote": (
            "A GIA-ST deverá ser remetida pelo sujeito passivo por substituição tributária para local a ser indicado pela unidade "
            "federada favorecida, até o dia 10 (dez) do mês subseqüente ao da apuração do imposto, ainda que no período não tenham "
            "ocorrido operações sujeitas à substituição tributária"
        ),
        "url": "https://www.confaz.fazenda.gov.br/legislacao/ajustes/1993/AJ_004_93",
        "sourceName": "CONFAZ — Ajuste SINIEF 04/93",
        "basis": "Ajuste SINIEF 04/93, cláusula oitava",
    },
]

_FIXED_HOLIDAYS = [(1, 1), (4, 21), (5, 1), (9, 7), (10, 12), (11, 2), (11, 15), (11, 20), (12, 25)]
_LIMITATION = "Dias úteis sem Corpus Christi e feriados estaduais ou municipais"


def easter(year: int) -> date:
    """Easter Sunday (Gregorian calendar, anonymous algorithm)."""
    a, b, c = year % 19, year // 100, year % 100
    d, e = b // 4, b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = c // 4, c % 4
    m = (32 + 2 * e + 2 * i - h - k) % 7
    n = (a + 11 * h + 22 * m) // 451
    month = (h + m - 7 * n + 114) // 31
    day = (h + m - 7 * n + 114) % 31 + 1
    return date(year, month, day)


def national_holidays(year: int) -> set[date]:
    """National holidays plus the Monday and Tuesday of Carnaval (no banking business)."""
    sunday = easter(year)
    movable = {sunday - timedelta(days=2), sunday - timedelta(days=48), sunday - timedelta(days=47)}
    return {date(year, m, d) for m, d in _FIXED_HOLIDAYS} | movable


def is_business_day(day: date) -> bool:
    return day.weekday() < 5 and day not in national_holidays(day.year)


def _last_day(year: int, month: int) -> date:
    return (date(year + (month == 12), month % 12 + 1, 1)) - timedelta(days=1)


def due_date(rule: tuple, year: int, month: int) -> tuple[date, str | None]:
    """The date of one occurrence and, when the business-day rule moved it, why."""
    kind = rule[0]
    if kind == "last_day":
        return _last_day(year, month), None
    if kind == "last_business_day":
        day = _last_day(year, month)
        while not is_business_day(day):
            day -= timedelta(days=1)
        return day, _LIMITATION
    if kind == "business_day":
        day, count = date(year, month, 1), 0
        while True:
            if is_business_day(day):
                count += 1
                if count == rule[1]:
                    return day, f"{rule[1]}º dia útil do mês. {_LIMITATION}"
            day += timedelta(days=1)
    nominal = date(year, month, min(rule[1], _last_day(year, month).day))
    if len(rule) < 3 or is_business_day(nominal):
        return nominal, None
    step = timedelta(days=-1 if rule[2] == "before" else 1)
    day = nominal
    while not is_business_day(day):
        day += step
    direction = "antecipado para o dia útil anterior" if rule[2] == "before" else "adiado para o dia útil seguinte"
    return day, f"Dia {nominal.day:02d}/{nominal.month:02d} não é dia útil: {direction}. {_LIMITATION}"


def _months(start: date, end: date):
    year, month = start.year, start.month
    while (year, month) <= (end.year, end.month):
        yield year, month
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)


def occurrences(date_from: str, date_to: str) -> list[dict]:
    """Calendar events of every rule between two dates (yyyy-mm-dd), in the shape of the API."""
    start, end = date.fromisoformat(date_from), date.fromisoformat(date_to)
    events = []
    # o mês anterior também: um vencimento do dia 28 adiado para o dia útil seguinte cai no mês seguinte
    first = (start.replace(day=1) - timedelta(days=1)).replace(day=1)
    for rule in RULES:
        for year, month in _months(first, end):
            if rule["frequency"] == "annual" and month not in rule.get("months", [rule.get("month")]):
                continue
            day, note = due_date(rule["rule"], year, month)
            if not (start <= day <= end):
                continue
            iso = day.isoformat()
            events.append(
                {
                    "id": f"rec-{rule['id']}-{iso}",
                    "documentId": "",
                    "versionId": None,
                    "kind": rule["kind"],
                    "date": iso,
                    "title": f"{CALENDAR_KINDS[rule['kind']]}: {rule['title']}",
                    "quote": rule["quote"],
                    "dateStatus": STATUS,
                    "dateNote": note,
                    "legalStatus": LEGAL_STATUS,
                    "importance": "alto",
                    "importanceReason": "Prazo recorrente da legislação: pede ação até a data, todo ano ou todo mês.",
                    "dateReason": f"Data calculada pela regra da legislação ({rule['basis']}), conforme a fonte oficial citada.",
                    "subjects": rule["subjects"],
                    "origin": "recorrente",
                    "status": "ativo",
                    "createdAt": None,
                    "updatedAt": None,
                    "document": {
                        "title": rule["sourceName"],
                        "kind": "regra",
                        "sourceId": SOURCE_ID,
                        "url": rule["url"],
                        "versionLabel": None,
                        "summary": rule["basis"],
                    },
                    "alsoIn": [],
                }
            )
    return events


def matches(event: dict, filters: dict) -> bool:
    """The same filters as the stored events."""
    if filters.get("kind") and event["kind"] != filters["kind"]:
        return False
    if filters.get("importance") and event["importance"] not in filters["importance"]:
        return False
    return not (filters.get("subjects") and not set(filters["subjects"]) & set(event["subjects"]))


# um ato que muda o prazo: prorroga, adia, antecipa, altera, extingue ou dispensa
_CHANGE = re.compile(
    r"prorrog|\badia\b|\badiad|\badiament|antecip|novos? prazos?|\balter(?:a|am|ou|ad[oa]s?|acao|acoes)\b|"
    r"passa(?:m|ra|rao)? a (?:ser|vigorar|vencer)|\bextin|\bdispens|\bsubstitu|\brevog"
)
# o assunto do prazo perto da mudança: o mesmo trecho, não um ato que só cita a obrigação
_DEADLINE = re.compile(r"\bprazo|vencimento|\bentreg|transmi|apresenta|recolhiment|pagament|\bopcao\b|\bdeclar")
_WINDOW = 300
# prorrogações só para municípios atingidos por calamidade: não mudam a regra geral
_REGIONAL = re.compile(r"calamidade|atingid[oa]s? (?:por|pel)|desastre|enchente|fortes chuvas")


def checked_on(rule: dict) -> str:
    return rule.get("checkedOn", CHECKED_ON)


def touches(rule: dict, text: str) -> bool:
    """A text (normalized) that names the obligation and, near it, a change of its deadline."""
    if _REGIONAL.search(text):
        return False
    for found in re.finditer(rule["watch"], text):
        start, end = max(0, found.start() - _WINDOW), found.end() + _WINDOW
        near = text[start:end]
        # antecipar parcelas de um parcelamento não muda o vencimento
        if _CHANGE.search(near) and _DEADLINE.search(near) and "parcelament" not in near:
            return True
    return False


def reviews(documents: list[dict]) -> dict[str, list[dict]]:
    """The acts published after each rule was checked that may change it, by rule id.

    documents: {id, title, url, date (yyyy-mm-dd), text (normalized title + summary + start)}."""
    found: dict[str, list[dict]] = {}
    for rule in RULES:
        since = checked_on(rule)
        acts = [
            {"documentId": d["id"], "title": d["title"], "url": d["url"], "date": d["date"]}
            for d in documents
            if d["date"] and d["date"] > since and touches(rule, d["text"])
        ]
        if acts:
            found[rule["id"]] = sorted(acts, key=lambda a: a["date"], reverse=True)
    return found


def attach_reviews(events: list[dict], found: dict[str, list[dict]]) -> list[dict]:
    """Marks the occurrences of a rule that may have changed (review: since + acts)."""
    for event in events:
        rule_id = event["id"][len("rec-") : -len("-yyyy-mm-dd")]
        acts = found.get(rule_id)
        rule = next((r for r in RULES if r["id"] == rule_id), None)
        event["review"] = {"since": checked_on(rule), "acts": acts} if acts and rule else None
    return events


def review_list(found: dict[str, list[dict]]) -> list[dict]:
    """The rules to review, for the status (tab Fontes)."""
    return [{"ruleId": r["id"], "title": r["title"], "since": checked_on(r), "acts": found[r["id"]]} for r in RULES if r["id"] in found]
