// Frontend of the Inteligência Contábil module.
// All collected text is rendered with textContent (never innerHTML),
// since it comes from external sites.
(function () {
  const API = '/api/intelligence';

  const RELEVANCE = {
    critica: { label: 'Crítica', className: 'critical' },
    alta: { label: 'Alta', className: 'high' },
    media: { label: 'Média', className: 'medium' },
    baixa: { label: 'Baixa', className: 'low' },
  };

  // Domínios oficiais aceitos para links (Executivo e Legislativo federal)
  const OFFICIAL_DOMAINS = ['gov.br', 'leg.br'];

  const METHOD_LABELS = {
    'dou-json': 'JSON oficial',
    api: 'API oficial',
    html: 'Página oficial',
  };

  const RUN_STATUS = {
    success: 'Concluída',
    partial: 'Concluída com falhas',
    failed: 'Falhou',
    running: 'Em execução',
  };

  const TRIGGER_LABELS = { manual: 'Manual', scheduled: 'Agendada', cli: 'Linha de comando' };

  const EMPTY_FILTERS = { subject: '', source: '', relevance: '', from: '', to: '', q: '', run: '' };
  // Grupo "Reforma Tributária" no filtro de assunto (qualquer um dos três)
  const REFORM_GROUP = 'reforma-tributaria,ibs-cbs,imposto-seletivo';
  const PAGE_SIZE = 50;

  const state = {
    view: 'dashboard',
    filters: { ...EMPTY_FILTERS },
    runLabel: '',
    sources: null,
    subjects: null,
  };

  // ---------- helpers ----------

  /**
   * Creates an element. Props starting with "on" become listeners;
   * strings in children become text nodes (safe against HTML injection).
   */
  function el(tag, props, ...children) {
    const node = document.createElement(tag);
    Object.entries(props || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === false) return;
      if (key.startsWith('on') && typeof value === 'function') {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key === 'className') {
        node.className = value;
      } else if (key === 'dataset') {
        Object.assign(node.dataset, value);
      } else if (key in node && typeof value !== 'string') {
        node[key] = value;
      } else {
        node.setAttribute(key, value === true ? '' : value);
      }
    });
    children.flat().forEach((child) => {
      if (child === null || child === undefined || child === false) return;
      node.appendChild(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child);
    });
    return node;
  }

  // A sessão vai no cookie (enviado automaticamente); 401 devolve para o login
  async function api(path, options = {}) {
    const res = await fetch(API + path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) {
      clearTimeout(pollTimer);
      handleSessionExpired();
    }
    if (!res.ok) throw new Error(body.error || `Erro ${res.status}`);
    return body;
  }

  function formatDate(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }

  function formatDateTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  /**
   * Publication date with the time when the source provides it ("05/11/2026 às 14:20").
   */
  function formatPublished(pub) {
    if (!pub.publishedAt) return null;
    const date = formatDate(pub.publishedAt);
    return pub.publishedTime ? `${date} às ${pub.publishedTime}` : date;
  }

  /** Only official government links (gov.br / leg.br) are rendered as clickable. */
  function safeOfficialUrl(url) {
    try {
      const parsed = new URL(url);
      const okProtocol = parsed.protocol === 'https:' || parsed.protocol === 'http:';
      const host = parsed.hostname;
      const okHost = OFFICIAL_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
      return okProtocol && okHost ? parsed.href : null;
    } catch {
      return null;
    }
  }

  function sourceName(id) {
    const source = (state.sources || []).find((s) => s.id === id);
    return source ? source.name : id;
  }

  function subjectName(id) {
    const subject = (state.subjects || []).find((s) => s.id === id);
    return subject ? subject.name : id;
  }

  async function ensureCatalogs() {
    if (!state.sources || !state.subjects) {
      const [sources, subjects] = await Promise.all([api('/sources'), api('/subjects')]);
      state.sources = sources;
      state.subjects = subjects;
    }
  }

  function viewRoot() {
    return document.getElementById('intel-view');
  }

  function renderInto(...nodes) {
    // replaceChildren converteria null/false em texto ("null"): blocos opcionais são removidos
    viewRoot().replaceChildren(...nodes.filter((node) => node !== null && node !== undefined && node !== false));
  }

  function emptyState(message) {
    return el('div', { className: 'intel-empty' }, message);
  }

  function errorState(err, retry) {
    return el(
      'div',
      { className: 'intel-empty intel-error' },
      el('p', null, `Não foi possível carregar os dados: ${err.message}`),
      el('button', { className: 'btn btn-primary', onClick: retry }, 'Tentar novamente')
    );
  }

  /**
   * Steps that led to the relevance level, from the reason stored at classification.
   * @returns {string[]|null}
   */
  function relevanceSteps(pub) {
    const r = pub.classificationReason;
    if (!r || !RELEVANCE[pub.relevance]) return null;
    return [
      r.weight
        ? `Tipo de ato: ${r.actLabel} → peso ${r.weight}`
        : `Tipo: ${r.actType || 'não informado'} → peso 0 (notícias, comunicados e projetos de lei não têm peso de ato normativo)`,
      r.reformBonus
        ? `Trata da Reforma Tributária (${r.reformSubjects.map(subjectName).join(', ')}) → +1`
        : 'Não trata da Reforma Tributária → +0',
      `Pontuação ${r.score} → ${RELEVANCE[pub.relevance].label}`,
    ];
  }

  function relevanceBadge(pub) {
    const info = RELEVANCE[pub.relevance];
    if (!info) return null;
    const steps = relevanceSteps(pub);
    return el('span', { className: `intel-badge ${info.className}`, title: steps ? `Por que ${info.label}: ${steps.join(' · ')}` : null }, info.label);
  }

  /** "Por que esta relevância?" block of the detail panel. */
  function relevanceExplanation(pub) {
    const steps = relevanceSteps(pub);
    const reason = pub.classificationReason;
    if (!steps) {
      return el('p', { className: 'intel-muted' }, 'Critério não registrado para esta publicação (coletada antes desta informação existir).');
    }
    return el(
      'div',
      { className: 'intel-reason' },
      el('h4', { className: 'intel-section-title' }, `Por que a relevância é "${RELEVANCE[pub.relevance].label}"?`),
      el('ol', { className: 'intel-reason-steps' }, steps.map((step) => el('li', null, step))),
      el('p', { className: 'intel-muted' }, 'Escala: 4 ou mais = Crítica · 3 = Alta · 1–2 = Média · 0 = Baixa. Regras completas em Configurações.'),
      el('h4', { className: 'intel-section-title' }, 'Por que estes assuntos?'),
      el(
        'ul',
        { className: 'intel-reason-steps' },
        reason.subjects.map((s) =>
          el(
            'li',
            null,
            `${subjectName(s.id)}: `,
            s.via === 'source' ? 'assunto da própria fonte' : `termo(s) encontrado(s) no texto: ${s.terms.map((t) => `"${t}"`).join(', ')}`
          )
        )
      )
    );
  }

  // ---------- publication card and detail ----------

  async function toggleFavorite(pub, button) {
    button.disabled = true;
    try {
      if (pub.favorite) {
        await api(`/favorites/${encodeURIComponent(pub.id)}`, { method: 'DELETE' });
      } else {
        await api('/favorites', { method: 'POST', body: JSON.stringify({ publicationId: pub.id }) });
      }
      pub.favorite = !pub.favorite;
      const inDetail = !document.getElementById('intel-detail-overlay').classList.contains('hidden');
      // dentro do detalhe, os cards são atualizados ao fechar o painel
      if (inDetail) state.favoritesChanged = true;
      button.textContent = pub.favorite ? '★' : '☆';
      button.title = pub.favorite ? 'Remover dos favoritos' : 'Salvar nos favoritos';
      button.classList.toggle('active', pub.favorite);
      if (!inDetail && state.view === 'favorites' && !pub.favorite) renderView();
    } catch (err) {
      alert(`Não foi possível atualizar o favorito: ${err.message}`);
    } finally {
      button.disabled = false;
    }
  }

  function favoriteButton(pub) {
    const button = el(
      'button',
      {
        className: `intel-fav${pub.favorite ? ' active' : ''}`,
        title: pub.favorite ? 'Remover dos favoritos' : 'Salvar nos favoritos',
        'aria-label': 'Favorito',
      },
      pub.favorite ? '★' : '☆'
    );
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(pub, button);
    });
    return button;
  }

  function officialLink(pub) {
    const href = safeOfficialUrl(pub.url);
    if (!href) return null;
    return el(
      'a',
      { className: 'intel-link', href, target: '_blank', rel: 'noopener noreferrer', onClick: (e) => e.stopPropagation() },
      'Fonte oficial ↗'
    );
  }

  function publicationCard(pub) {
    return el(
      'article',
      { className: 'intel-card', tabIndex: 0, onClick: () => openDetail(pub), onKeydown: (e) => e.key === 'Enter' && openDetail(pub) },
      el(
        'div',
        { className: 'intel-card-header' },
        el('div', { className: 'intel-card-meta' }, el('span', null, sourceName(pub.sourceId)), pub.actType ? el('span', null, ` · ${pub.actType}`) : null),
        favoriteButton(pub)
      ),
      el('h3', { className: 'intel-card-title' }, pub.title),
      pub.excerpt ? el('p', { className: 'intel-card-excerpt' }, pub.excerpt) : null,
      el(
        'div',
        { className: 'intel-card-footer' },
        el(
          'span',
          { className: 'project-card-date', title: pub.publishedTime ? 'Data e hora de publicação na fonte oficial' : 'A fonte informa apenas a data' },
          formatPublished(pub) || 'Data não informada'
        ),
        relevanceBadge(pub),
        ...(pub.subjects || []).slice(0, 3).map((s) => el('span', { className: 'intel-chip' }, subjectName(s))),
        officialLink(pub)
      )
    );
  }

  function publicationList(items, emptyMessage) {
    if (!items.length) return emptyState(emptyMessage);
    return el('div', { className: 'intel-card-list' }, items.map(publicationCard));
  }

  function detailRow(label, value) {
    if (!value) return null;
    return el('div', { className: 'intel-detail-row' }, el('dt', null, label), el('dd', null, value));
  }

  function openDetail(pub) {
    const href = safeOfficialUrl(pub.url);
    const body = document.getElementById('intel-detail-body');
    // blocos opcionais nulos são removidos (replaceChildren os viraria texto "null")
    const blocks = [
      el('div', { className: 'intel-card-meta' }, sourceName(pub.sourceId)),
      el('h3', { id: 'intel-detail-title', className: 'intel-detail-title' }, pub.title),
      el(
        'dl',
        { className: 'intel-detail-grid' },
        detailRow(
          'Data de publicação',
          pub.publishedAt ? `${formatPublished(pub)}${pub.publishedTime ? '' : ' (a fonte informa só a data)'}` : 'Não informada pela fonte'
        ),
        detailRow('Tipo de ato', pub.actType),
        detailRow('Classificação', pub.normType),
        detailRow('Vigência', pub.effectiveDate ? formatDate(pub.effectiveDate) : null),
        detailRow('Órgão', pub.organ),
        detailRow('Relevância', RELEVANCE[pub.relevance] ? RELEVANCE[pub.relevance].label : null),
        detailRow('Assuntos', (pub.subjects || []).map(subjectName).join(', ')),
        detailRow('Coletado em', formatDateTime(pub.collectedAt))
      ),
      relevanceExplanation(pub),
      pub.excerpt ? el('div', null, el('h4', { className: 'intel-section-title' }, 'Trecho oficial'), el('p', { className: 'intel-detail-excerpt' }, pub.excerpt)) : null,
      el(
        'div',
        { className: 'intel-detail-actions' },
        href ? el('a', { className: 'btn btn-primary', href, target: '_blank', rel: 'noopener noreferrer' }, 'Abrir fonte oficial ↗') : null,
        favoriteButton(pub)
      ),
      el('p', { className: 'intel-disclaimer' }, 'Conteúdo reproduzido da fonte oficial. Não constitui parecer jurídico ou contábil.'),
    ];
    body.replaceChildren(...blocks.filter(Boolean));
    document.getElementById('intel-detail-overlay').classList.remove('hidden');
    document.getElementById('intel-detail-close').focus();
  }

  function closeDetail() {
    const overlay = document.getElementById('intel-detail-overlay');
    if (overlay.classList.contains('hidden')) return;
    overlay.classList.add('hidden');
    if (state.favoritesChanged) {
      state.favoritesChanged = false;
      renderView();
    }
  }

  // ---------- views ----------

  /**
   * Indicator tile; with onClick it becomes a button that opens the matching list.
   */
  function statTile(label, value, hint, onClick) {
    return el(
      onClick ? 'button' : 'div',
      { className: `intel-stat${onClick ? ' clickable' : ''}`, onClick, title: onClick ? `Ver: ${label}` : null },
      el('span', { className: 'intel-stat-label' }, label),
      el('span', { className: 'intel-stat-value' }, value),
      hint ? el('span', { className: 'intel-stat-hint' }, hint) : null
    );
  }

  function localDaysAgo(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function nextRunText(summary) {
    if (!summary.schedulerEnabled) return 'agendamento automático desativado';
    const next = new Date(summary.nextRunAt);
    if (next - Date.now() < 60 * 1000) return 'próxima automática: em instantes';
    const sameDay = next.toDateString() === new Date().toDateString();
    return `próxima automática: ${sameDay ? 'hoje' : next.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${formatTime(summary.nextRunAt)}`;
  }

  function lastRunText(run) {
    if (!run) return 'Nunca executado';
    return formatDateTime(run.finishedAt || run.startedAt);
  }

  async function renderDashboard() {
    const summary = await api('/summary');
    const { totals } = summary;
    const maxCount = Math.max(1, ...summary.byCategory.map((c) => c.count));
    const categories = [...summary.byCategory].sort((a, b) => b.count - a.count);

    renderInto(
      el(
        'div',
        { className: 'intel-stats' },
        statTile('Total de atualizações', totals.publications, null, () => openPublicationsFiltered({})),
        statTile('Críticas', totals.critical, null, () => openPublicationsFiltered({ relevance: 'critica' })),
        statTile('Recentes', totals.recent, `últimos ${summary.recentDays} dias`, () => openPublicationsFiltered({ from: localDaysAgo(summary.recentDays) })),
        statTile('Reforma Tributária', totals.reform, 'IBS, CBS e Imposto Seletivo', () => openPublicationsFiltered({ subject: REFORM_GROUP })),
        statTile(
          'Última execução',
          lastRunText(summary.lastRun),
          `${summary.lastRun ? RUN_STATUS[summary.lastRun.status] || summary.lastRun.status : 'monitoramento ainda não rodou'} · ${nextRunText(summary)}`,
          () => setView('history')
        )
      ),
      el(
        'div',
        { className: 'intel-dashboard-grid' },
        el(
          'section',
          { className: 'intel-panel' },
          el('h3', { className: 'intel-section-title' }, 'Publicações recentes'),
          publicationList(summary.recentItems, 'Nenhuma publicação coletada nos últimos dias.')
        ),
        el(
          'section',
          { className: 'intel-panel' },
          el('h3', { className: 'intel-section-title' }, 'Atualizações por categoria'),
          el(
            'ul',
            { className: 'intel-bars' },
            categories.map((c) =>
              el(
                'li',
                { className: 'intel-bar-row', onClick: () => openPublicationsFiltered({ subject: c.id }), title: `Ver publicações de ${c.name}` },
                el('span', { className: 'intel-bar-label' }, c.name),
                el('span', { className: 'intel-bar-track' }, el('span', { className: 'intel-bar-fill', style: `width: ${(c.count / maxCount) * 100}%` })),
                el('span', { className: 'intel-bar-value' }, c.count)
              )
            )
          )
        )
      )
    );
  }

  function filterField(label, control) {
    return el('div', { className: 'form-group' }, el('label', null, label), control);
  }

  function publicationsQuery(extra = {}) {
    const params = new URLSearchParams(Object.entries(state.filters).filter(([, v]) => v));
    Object.entries(extra).forEach(([k, v]) => params.set(k, String(v)));
    return params;
  }

  async function renderPublications() {
    const f = state.filters;
    const result = await api(`/publications?${publicationsQuery({ limit: PAGE_SIZE })}`);

    const subjectSelect = el(
      'select',
      { onChange: (e) => applyFilter('subject', e.target.value) },
      el('option', { value: '' }, 'Todos os assuntos'),
      el('option', { value: REFORM_GROUP, selected: f.subject === REFORM_GROUP }, 'Reforma Tributária (IBS, CBS e IS)'),
      state.subjects.map((s) => el('option', { value: s.id, selected: s.id === f.subject }, s.name))
    );
    const sourceSelect = el(
      'select',
      { onChange: (e) => applyFilter('source', e.target.value) },
      el('option', { value: '' }, 'Todas as fontes'),
      state.sources.map((s) => el('option', { value: s.id, selected: s.id === f.source }, s.name))
    );
    const relevanceSelect = el('select', { onChange: (e) => applyFilter('relevance', e.target.value) }, el('option', { value: '' }, 'Todas'), Object.entries(RELEVANCE).map(([id, r]) => el('option', { value: id, selected: id === f.relevance }, r.label)));
    const fromInput = el('input', { type: 'date', value: f.from, onChange: (e) => applyFilter('from', e.target.value) });
    const toInput = el('input', { type: 'date', value: f.to, onChange: (e) => applyFilter('to', e.target.value) });
    const searchInput = el('input', { type: 'search', placeholder: 'Buscar no título ou trecho...', value: f.q, maxLength: 120 });
    let searchTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => applyFilter('q', e.target.value.trim(), true), 350);
    });

    const hasFilters = Object.values(f).some(Boolean);
    const list = publicationList(result.items, hasFilters ? 'Nenhuma publicação corresponde aos filtros.' : 'Nenhuma publicação coletada ainda. Use "Atualizar agora" ou aguarde a coleta automática.');
    const countText = el('p', { className: 'intel-result-count' });
    let loaded = result.items.length;
    const updateCount = () => {
      countText.textContent = result.total > loaded ? `Mostrando ${loaded} de ${result.total} publicação(ões)` : `${result.total} publicação(ões) encontrada(s)`;
    };
    updateCount();

    const moreButton = el('button', { className: 'btn intel-btn-light intel-load-more' }, 'Carregar mais');
    moreButton.addEventListener('click', async () => {
      moreButton.disabled = true;
      try {
        const next = await api(`/publications?${publicationsQuery({ limit: PAGE_SIZE, offset: loaded })}`);
        next.items.forEach((item) => list.appendChild(publicationCard(item)));
        loaded += next.items.length;
        updateCount();
        if (loaded >= next.total || !next.items.length) {
          moreButton.remove();
        } else {
          moreButton.disabled = false;
          moreButton.textContent = 'Carregar mais';
        }
      } catch (err) {
        moreButton.disabled = false;
        moreButton.textContent = `Tentar novamente (${err.message})`;
      }
    });

    renderInto(
      el(
        'div',
        { className: 'intel-filters' },
        filterField('Assunto', subjectSelect),
        filterField('Fonte', sourceSelect),
        filterField('Relevância', relevanceSelect),
        filterField('De', fromInput),
        filterField('Até', toInput),
        filterField('Busca', searchInput),
        hasFilters ? el('button', { className: 'btn intel-btn-light', onClick: clearFilters }, 'Limpar filtros') : null
      ),
      f.run
        ? el(
            'div',
            { className: 'intel-run-status info intel-run-filter' },
            el('span', null, `Mostrando as publicações guardadas pela execução de ${state.runLabel || 'histórico'}.`),
            el('button', { className: 'btn intel-btn-light', onClick: () => applyFilter('run', '') }, 'Ver todas')
          )
        : null,
      countText,
      list,
      result.total > loaded ? moreButton : null
    );

    // mantém o foco na busca após re-renderizar
    if (state.focusSearch) {
      const input = viewRoot().querySelector('input[type="search"]');
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      state.focusSearch = false;
    }
  }

  function applyFilter(key, value, keepSearchFocus) {
    state.filters[key] = value;
    state.focusSearch = !!keepSearchFocus;
    renderView();
  }

  function clearFilters() {
    state.filters = { ...EMPTY_FILTERS };
    renderView();
  }

  function openPublicationsFiltered(filters) {
    state.filters = { ...EMPTY_FILTERS, ...filters };
    setView('publications');
  }

  async function renderCategories() {
    state.subjects = await api('/subjects');
    renderInto(
      el(
        'div',
        { className: 'intel-category-grid' },
        state.subjects.map((s) =>
          el(
            'button',
            { className: `intel-category${s.enabled ? '' : ' disabled'}`, onClick: () => openPublicationsFiltered({ subject: s.id }) },
            el('span', { className: 'intel-category-name' }, s.name),
            el('span', { className: 'intel-category-count' }, `${s.count} publicação(ões)`),
            el('span', { className: 'intel-category-keywords' }, `Termos: ${s.keywords.join(', ')}`),
            s.enabled ? null : el('span', { className: 'intel-chip' }, 'Monitoramento desativado')
          )
        )
      )
    );
  }

  async function renderFavorites() {
    const items = await api('/favorites');
    renderInto(publicationList(items, 'Você ainda não salvou nenhuma publicação. Use ☆ nos cards para favoritar.'));
  }

  async function renderHistory() {
    const runs = await api('/runs');
    if (!runs.length) {
      renderInto(emptyState('Nenhuma execução do monitoramento registrada ainda.'));
      return;
    }
    renderInto(
      el(
        'div',
        { className: 'intel-table-wrap' },
        el(
          'table',
          { className: 'intel-table' },
          el('thead', null, el('tr', null, ['Início', 'Fim', 'Origem', 'Status', 'Novas', 'Duplicadas', 'Falhas', ''].map((h) => el('th', null, h)))),
          el(
            'tbody',
            null,
            runs.map((run) => {
              const failures = (run.sources || []).filter((s) => s.status === 'error');
              return el(
                'tr',
                null,
                el('td', null, formatDateTime(run.startedAt)),
                el('td', null, formatDateTime(run.finishedAt)),
                el('td', null, TRIGGER_LABELS[run.trigger] || run.trigger),
                el('td', null, RUN_STATUS[run.status] || run.status),
                el('td', null, run.newCount ?? 0),
                el('td', null, run.duplicateCount ?? 0),
                el('td', { title: failures.map((s) => `${sourceName(s.sourceId)}: ${s.error}`).join('\n') }, failures.length ? failures.map((s) => sourceName(s.sourceId)).join(', ') : '—'),
                el(
                  'td',
                  null,
                  run.newCount
                    ? el(
                        'button',
                        {
                          className: 'btn intel-btn-light intel-btn-small',
                          onClick: () => {
                            state.runLabel = formatDateTime(run.startedAt);
                            openPublicationsFiltered({ run: run.id });
                          },
                        },
                        'Ver publicações'
                      )
                    : null
                )
              );
            })
          )
        )
      )
    );
  }

  async function renderSettings() {
    const [settings, sources, subjects, rules, status] = await Promise.all([api('/settings'), api('/sources'), api('/subjects'), api('/rules'), api('/status')]);
    state.sources = sources;
    state.subjects = subjects;

    const runTimeInput = el('input', { type: 'time', value: settings.runTime, required: true });
    const sourceChecks = new Map();
    const subjectChecks = new Map();
    const feedback = el('span', { className: 'intel-feedback', role: 'status' });

    const sourceRows = sources.map((s) => {
      const check = el('input', { type: 'checkbox', checked: s.enabled, disabled: !s.collectable, 'aria-label': `Monitorar ${s.name}` });
      if (s.collectable) sourceChecks.set(s.id, check);
      const status = s.status;
      return el(
        'tr',
        null,
        el('td', null, check),
        el('td', null, el('strong', null, s.name), el('div', { className: 'intel-muted' }, s.coverage)),
        el('td', null, s.collectable ? el('span', { className: 'intel-badge low' }, METHOD_LABELS[s.method] || 'Coleta direta') : el('span', { className: 'intel-badge critical' }, 'Indisponível')),
        el('td', null, status && status.lastSuccessAt ? formatDateTime(status.lastSuccessAt) : '—'),
        el('td', { className: 'intel-muted' }, status && status.lastError ? status.lastError : '—')
      );
    });

    const subjectItems = subjects.map((s) => {
      const check = el('input', { type: 'checkbox', checked: s.enabled });
      subjectChecks.set(s.id, check);
      return el('label', { className: 'intel-check' }, check, el('span', null, s.name));
    });

    async function save(e) {
      e.preventDefault();
      feedback.textContent = 'Salvando...';
      try {
        await api('/settings', {
          method: 'PUT',
          body: JSON.stringify({
            runTime: runTimeInput.value,
            enabledSources: [...sourceChecks].filter(([, c]) => c.checked).map(([id]) => id),
            enabledSubjects: [...subjectChecks].filter(([, c]) => c.checked).map(([id]) => id),
          }),
        });
        state.sources = null;
        state.subjects = null;
        feedback.textContent = 'Configurações salvas.';
      } catch (err) {
        feedback.textContent = `Erro: ${err.message}`;
      }
    }

    renderInto(
      el(
        'form',
        { className: 'intel-settings', onSubmit: save },
        el(
          'section',
          { className: 'intel-panel' },
          el('h3', { className: 'intel-section-title' }, 'Execução diária'),
          el('div', { className: 'intel-inline' }, filterField('Horário do monitoramento', runTimeInput)),
          el('p', { className: 'intel-muted' }, 'A coleta roda no servidor uma vez por dia neste horário, mesmo sem usuários conectados. Se o servidor estiver desligado no horário, a coleta acontece assim que ele for ligado. Se todas as fontes falharem, ela é repetida a cada hora (até 3 tentativas no dia).'),
          el('p', { className: 'intel-muted' }, nextRunText(status))
        ),
        el(
          'section',
          { className: 'intel-panel' },
          el('h3', { className: 'intel-section-title' }, 'Fontes monitoradas'),
          el(
            'div',
            { className: 'intel-table-wrap' },
            el(
              'table',
              { className: 'intel-table' },
              el('thead', null, el('tr', null, ['Ativa', 'Fonte', 'Coleta', 'Último sucesso', 'Último erro'].map((h) => el('th', null, h)))),
              el('tbody', null, sourceRows)
            )
          )
        ),
        el('section', { className: 'intel-panel' }, el('h3', { className: 'intel-section-title' }, 'Assuntos monitorados'), el('div', { className: 'intel-check-grid' }, subjectItems)),
        el('section', { className: 'intel-panel' }, el('h3', { className: 'intel-section-title' }, 'Regras de classificação'), el('ul', { className: 'intel-rules' }, rules.map((rule) => el('li', null, rule)))),
        el('div', { className: 'intel-form-actions' }, el('button', { type: 'submit', className: 'btn btn-primary' }, 'Salvar configurações'), feedback)
      )
    );
  }

  const VIEWS = {
    dashboard: renderDashboard,
    publications: renderPublications,
    categories: renderCategories,
    favorites: renderFavorites,
    history: renderHistory,
    settings: renderSettings,
  };

  async function renderView() {
    const view = state.view;
    if (!viewRoot().children.length) renderInto(el('div', { className: 'intel-empty' }, 'Carregando...'));
    try {
      await ensureCatalogs();
      await VIEWS[view]();
    } catch (err) {
      if (state.view === view) renderInto(errorState(err, renderView));
    }
  }

  function setView(view) {
    state.view = view;
    document.querySelectorAll('#intel-tabs .intel-tab').forEach((tab) => {
      const active = tab.dataset.view === view;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    viewRoot().replaceChildren();
    renderView();
  }

  /**
   * Opens the module (called from the side menu in app.js).
   */
  // ---------- manual run ("Atualizar agora") ----------

  const POLL_MS = 3000;
  let pollTimer = null;

  function formatTime(iso) {
    return iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
  }

  function setRunStatus(text, tone) {
    const box = document.getElementById('intel-run-status');
    if (!text) {
      box.classList.add('hidden');
      return;
    }
    box.textContent = text;
    box.className = `intel-run-status ${tone || 'info'}`;
  }

  function setRunButton(running) {
    const button = document.getElementById('btn-intel-run');
    button.disabled = running;
    button.replaceChildren(el('span', null, running ? '⏳' : '🔄'), running ? ' Coletando...' : ' Atualizar agora');
  }

  function describeFinishedRun(run) {
    const failed = (run.sources || []).filter((s) => s.status === 'error').map((s) => sourceName(s.sourceId));
    const summary = `${RUN_STATUS[run.status] || run.status} às ${formatTime(run.finishedAt)}: ${run.newCount ?? 0} nova(s) publicação(ões).`;
    return failed.length ? `${summary} Fontes com falha: ${failed.join(', ')} (detalhes no Histórico).` : summary;
  }

  function isModuleVisible() {
    return !document.getElementById('intelligence-screen').classList.contains('hidden');
  }

  /**
   * Syncs the button and status line with the server; keeps polling while a run is active
   * and the module is on screen.
   */
  async function checkRunStatus() {
    clearTimeout(pollTimer);
    let status;
    try {
      status = await api('/status');
    } catch (err) {
      setRunStatus(`Não foi possível consultar a coleta: ${err.message}`, 'warning');
      return;
    }

    if (status.running) {
      state.watchingRun = true;
      setRunButton(true);
      setRunStatus(`Coleta em andamento desde ${formatTime(status.lastRun && status.lastRun.startedAt)}. As fontes oficiais podem levar até um minuto para responder.`, 'info');
      if (isModuleVisible()) pollTimer = setTimeout(checkRunStatus, POLL_MS);
      return;
    }

    setRunButton(false);
    if (state.watchingRun && status.lastRun) {
      state.watchingRun = false;
      // sucesso já aparece no card "Última execução"; a faixa fica só para falhas
      if (status.lastRun.status === 'success') setRunStatus(null);
      else setRunStatus(describeFinishedRun(status.lastRun), 'warning');
      state.sources = null; // atualiza "último sucesso" das fontes
      renderView();
    }
  }

  async function startManualRun() {
    setRunButton(true);
    try {
      await api('/runs', { method: 'POST' });
      state.watchingRun = true;
    } catch (err) {
      // 409 (já em andamento) ou 429 (intervalo mínimo)
      setRunStatus(err.message, 'warning');
    }
    checkRunStatus();
  }

  function showIntelligenceScreen() {
    closeDetail();
    showScreen('intelligence-screen');
    setView(state.view);
    checkRunStatus();
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-intel-run').addEventListener('click', startManualRun);
    document.querySelectorAll('#intel-tabs .intel-tab').forEach((tab) => {
      tab.addEventListener('click', () => setView(tab.dataset.view));
    });
    document.getElementById('intel-detail-close').addEventListener('click', closeDetail);
    document.getElementById('intel-detail-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'intel-detail-overlay') closeDetail();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDetail();
    });
  });

  window.showIntelligenceScreen = showIntelligenceScreen;
})();
