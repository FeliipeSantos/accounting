// Default projects list defined locally (replaces defaultData.js)
const DEFAULT_PROJECTS_LIST = [
  {
    id: "caete-ne",
    name: "Projeto Caeté NE",
    reportDate: "04 / 05 / 2026",
    percentPlanned: 17,
    percentActual: 26.99,
    startDate: "13/04/2026",
    endDate: "29/06/2026",
    description: "Implantação Intelup nas plantas Matriz e Marituba – integração com PIMS e parametrização de módulos.",
    team: "GP Intelup: Luis F. de Souza GP Caeté: José Ailton das Chagas Líder técnico: Felipe Camossi",
    activities: [
      { 
        id: 1, 
        name: "Abertura do projeto", 
        progress: 100, 
        status: "Concluído",
        subActivities: [
          { id: 1, name: "Elaboração do Termo de Abertura", completed: true },
          { id: 2, name: "Aprovação do orçamento do projeto", completed: true }
        ],
        attentionPoints: [
          "Representantes locais: Italaine (Matriz) e Benedito (Marituba)"
        ],
        projectImpacts: [
          "Sem impactos identificados no período"
        ],
        actionPlans: [
          "Nenhum plano de ação em curso no período"
        ]
      },
      { 
        id: 2, 
        name: "Provisionamento de infraestrutura", 
        progress: 100, 
        status: "Concluído",
        subActivities: [
          { id: 1, name: "Provisionamento de servidores na nuvem", completed: true },
          { id: 2, name: "Configuração dos acessos de rede e VPN", completed: true }
        ],
        attentionPoints: [],
        projectImpacts: [],
        actionPlans: []
      },
      { 
        id: 3, 
        name: "Instalação e configuração do coletor OPC", 
        progress: 75, 
        status: "Atrasado",
        subActivities: [
          { id: 1, name: "Instalação física do coletor OPC", completed: true },
          { id: 2, name: "Configuração das portas de rede", completed: true },
          { id: 3, name: "Mapeamento inicial de Tags OPC", completed: true },
          { id: 4, name: "Teste de ping e conectividade de rede externa", completed: false }
        ],
        attentionPoints: [
          "Instalação física pendente em Marituba por falta de liberação de área",
          "Necessário confirmar liberação de rede com a TI da planta"
        ],
        projectImpacts: [
          "Risco de atrasar homologação do PIMS em Marituba"
        ],
        actionPlans: [
          "Reunião de alinhamento com a TI agendada para amanhã às 14:00"
        ]
      },
      { 
        id: 4, 
        name: "Configuração integração Intelup x PIMS - Laboratório", 
        progress: 20, 
        status: "Em andamento",
        subActivities: [
          { id: 1, name: "Homologação do PIMS local", completed: true },
          { id: 2, name: "Mapeamento das tabelas de dados laboratoriais", completed: false },
          { id: 3, name: "Instalação do agente de integração Intelup", completed: false },
          { id: 4, name: "Validação de escrita no banco centralizado", completed: false },
          { id: 5, name: "Configuração de contingência local", completed: false }
        ],
        attentionPoints: [],
        projectImpacts: [],
        actionPlans: []
      },
      { 
        id: 5, 
        name: "Parametrização MEPO", 
        progress: 55, 
        status: "Em andamento",
        subActivities: [
          { id: 1, name: "Definição de regras de parada de máquina", completed: true },
          { id: 2, name: "Configuração do módulo de eficiência global (OEE)", completed: true },
          { id: 3, name: "Parametrização das justificativas de paradas", completed: true },
          { id: 4, name: "Criação dos dashboards de OEE em tempo real", completed: true },
          { id: 5, name: "Configuração dos turnos operacionais", completed: true },
          { id: 6, name: "Testes de integridade de dados operacionais", completed: true },
          { id: 7, name: "Treinamento básico para operadores de sala", completed: false },
          { id: 8, name: "Validação de relatórios consolidados por turno", completed: false },
          { id: 9, name: "Configuração de alertas e alarmes de OEE", completed: false },
          { id: 10, name: "Parametrização de metas diárias de produção", completed: false },
          { id: 11, name: "Homologação do módulo com a diretoria", completed: false }
        ],
        attentionPoints: [],
        projectImpacts: [],
        actionPlans: []
      },
      { 
        id: 6, 
        name: "Parametrização ICF", 
        progress: 0, 
        status: "Não iniciado",
        subActivities: [
          { id: 1, name: "Mapeamento das tags de processo ICF", completed: false },
          { id: 2, name: "Parametrização das regras de alarmes ICF", completed: false }
        ],
        attentionPoints: [],
        projectImpacts: [],
        actionPlans: []
      },
      { 
        id: 7, 
        name: "Parametrização CEP", 
        progress: 0, 
        status: "Não iniciado",
        subActivities: [
          { id: 1, name: "Coleta de amostras de dados estatísticos (CEP)", completed: false },
          { id: 2, name: "Configuração dos limites de controle estatístico", completed: false }
        ],
        attentionPoints: [],
        projectImpacts: [],
        actionPlans: []
      },
      { 
        id: 8, 
        name: "Parametrização GMC", 
        progress: 0, 
        status: "Não iniciado",
        subActivities: [
          { id: 1, name: "Mapeamento dos motores e equipamentos GMC", completed: false },
          { id: 2, name: "Parametrização das rotinas de manutenção", completed: false }
        ],
        attentionPoints: [],
        projectImpacts: [],
        actionPlans: []
      },
      { 
        id: 9, 
        name: "Treinamentos e Operação Assistida", 
        progress: 0, 
        status: "Não iniciado",
        subActivities: [
          { id: 1, name: "Preparação do material didático de treinamento", completed: false },
          { id: 2, name: "Agendamento das turmas de operação assistida", completed: false },
          { id: 3, name: "Execução dos testes assistidos em campo", completed: false }
        ],
        attentionPoints: [
          "Operação assistida necessária no início da safra (set/26)"
        ],
        projectImpacts: [],
        actionPlans: []
      }
    ],
    kanban: {
      done: [
        "Conexão com servidor OPC na Unidade Matriz realizado com sucesso;"
      ],
      doing: [
        "Levantamento de TAGs (automação + laboratório) em Marituba",
        "Validação conectividade em Marituba"
      ],
      todo: [
        "Iniciar cadastramento dos TAGs no coletor Matriz",
        "Avançar com configuração dos dashbords Matriz"
      ]
    }
  },
  {
    id: "solar-nordeste",
    name: "Projeto Solar Nordeste",
    reportDate: "08 / 06 / 2026",
    percentPlanned: 30,
    percentActual: 60.00,
    startDate: "01/05/2026",
    endDate: "30/08/2026",
    description: "Instalação de painéis solares fotovoltaicos e cabeamento estruturado da subestação de energia.",
    team: "GP Intelup: Mariana Santos GP Solar: Ricardo Silva Líder técnico: André Pinheiro",
    activities: [
      {
        id: 1,
        name: "Licenciamento ambiental",
        progress: 100,
        status: "Concluído",
        subActivities: [
          { id: 1, name: "Obtenção da Licença de Instalação", completed: true },
          { id: 2, name: "Aprovação do relatório de impacto ambiental", completed: true }
        ],
        attentionPoints: [],
        projectImpacts: [],
        actionPlans: []
      },
      {
        id: 2,
        name: "Montagem dos suportes de solo",
        progress: 80,
        status: "Em andamento",
        subActivities: [
          { id: 1, name: "Fundação das estacas metálicas", completed: true },
          { id: 2, name: "Fixação das travessas de alumínio", completed: true },
          { id: 3, name: "Alinhamento das estruturas dos trackers", completed: false }
        ],
        attentionPoints: [
          "Atraso na entrega das travessas de alumínio pela distribuidora"
        ],
        projectImpacts: [
          "Risco de atraso nas etapas subsequentes de fixação de placas"
        ],
        actionPlans: [
          "Contato direto com fornecedor local para lote emergencial"
        ]
      },
      {
        id: 3,
        name: "Fixação de módulos fotovoltaicos",
        progress: 0,
        status: "Não iniciado",
        subActivities: [
          { id: 1, name: "Descarregamento dos contêineres de painéis", completed: false },
          { id: 2, name: "Instalação física dos painéis nas estruturas", completed: false }
        ],
        attentionPoints: [],
        projectImpacts: [],
        actionPlans: []
      }
    ],
    kanban: {
      done: [
        "Licença de Instalação aprovada;"
      ],
      doing: [
        "Fixação estrutural das estacas metálicas de sustentação"
      ],
      todo: [
        "Aguardar chegada do lote de painéis solares para fixação"
      ]
    }
  }
];

// Initialize State
let projectsList = [];
let activeProjectId = null;
let projectData = {}; // Pointer to the selected project object inside projectsList
let selectedActivityId = null; // Currently selected activity ID within the active project
let isEditMode = false;
let projectDataBackup = null;

// Screen Navigation Utility
function showScreen(screenId) {
  const screens = ['login-screen', 'project-selector-screen', 'app-layout', 'intelligence-screen'];
  screens.forEach(s => {
    const el = document.getElementById(s);
    if (el) {
      if (s === screenId) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    }
  });

  // O shell (menu lateral) só aparece fora da tela de login
  const shell = document.getElementById('app-shell');
  if (shell) {
    shell.classList.toggle('hidden', screenId === 'login-screen');
  }

  // Destaca no menu o módulo dono da tela atual
  const activeModule = SCREEN_MODULES[screenId];
  if (activeModule) {
    document.querySelectorAll('.side-nav-item[data-module]').forEach(item => {
      item.classList.toggle('active', item.dataset.module === activeModule);
    });
  }
}

// Maps each authenticated screen to its side menu module
const SCREEN_MODULES = {
  'project-selector-screen': 'projects',
  'app-layout': 'projects',
  'intelligence-screen': 'intelligence',
};

// A sessão real fica no servidor (cookie HttpOnly); estes valores só servem para exibição
const SESSION_KEY = 'project_manager_session';
const SESSION_USER_KEY = 'project_manager_user';

/**
 * Returns the user name of the current session (display only), or null when logged out.
 */
function getCurrentUser() {
  return localStorage.getItem(SESSION_USER_KEY);
}

function clearLocalSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_USER_KEY);
}

/**
 * Called whenever the server answers 401: the session expired or was closed.
 */
function handleSessionExpired() {
  clearLocalSession();
  showScreen('login-screen');
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = 'Sua sessão expirou. Entre novamente.';
  errorEl.classList.remove('hidden');
}

/**
 * fetch for the app APIs: on 401 it returns to the login screen and rejects
 * with an error flagged as sessionExpired.
 */
function apiFetch(url, options) {
  return fetch(url, options).then((res) => {
    if (res.status === 401) {
      handleSessionExpired();
      throw Object.assign(new Error('Sessão expirada'), { sessionExpired: true });
    }
    return res;
  });
}

const SIDE_NAV_COLLAPSED_KEY = 'side_nav_collapsed';

/**
 * Restores the side navigation collapsed state and binds its controls.
 */
function setupSideNav() {
  const nav = document.getElementById('side-nav');
  const collapseBtn = document.getElementById('btn-collapse-nav');
  if (!nav || !collapseBtn) return;

  try {
    if (localStorage.getItem(SIDE_NAV_COLLAPSED_KEY) === 'true') {
      nav.classList.add('collapsed');
    }
  } catch (e) {
    // storage indisponível: segue com o menu expandido
  }

  collapseBtn.addEventListener('click', () => {
    const collapsed = nav.classList.toggle('collapsed');
    const label = collapsed ? 'Expandir menu' : 'Recolher menu';
    collapseBtn.title = label;
    collapseBtn.setAttribute('aria-label', label);
    try {
      localStorage.setItem(SIDE_NAV_COLLAPSED_KEY, String(collapsed));
    } catch (e) {
      // ignora falha ao persistir preferência
    }
  });

  document.querySelectorAll('.side-nav-item[data-module]').forEach(item => {
    item.addEventListener('click', () => {
      const inEditor = !document.getElementById('app-layout').classList.contains('hidden');
      const inProjectList = !document.getElementById('project-selector-screen').classList.contains('hidden');

      if (item.dataset.module === 'projects') {
        // Portal de Projetos sempre volta para a lista de projetos
        if (inEditor) {
          showProjectSelectorScreen();
        } else if (!inProjectList) {
          loadProjects(() => {
            renderProjectsGrid();
            showScreen('project-selector-screen');
          });
        }
      } else if (item.dataset.module === 'intelligence') {
        if (inEditor) saveToStorage(); // não perder edições do projeto aberto
        showIntelligenceScreen();
      }
    });
  });

  document.getElementById('btn-logout-nav').addEventListener('click', handleLogout);
}

// Opens the app when the server still has a valid session; otherwise shows login
function initData() {
  fetch('/api/auth/session')
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null)
    .then((session) => {
      if (!session) {
        clearLocalSession();
        showScreen('login-screen');
        return;
      }
      localStorage.setItem(SESSION_KEY, 'logged-in');
      localStorage.setItem(SESSION_USER_KEY, session.user);
      loadProjects(() => {
        renderProjectsGrid();
        showScreen('project-selector-screen');
      });
    });
}

function loadProjects(callback) {
  apiFetch('/api/projects')
    .then(res => res.json())
    .then(data => {
      projectsList = data;
      
      // If server database is empty, perform local storage migrations or fallback
      if (!projectsList || projectsList.length === 0) {
        const browserSaved = localStorage.getItem('projects_list_data');
        const browserOldSaved = localStorage.getItem('project_status_report_data');
        
        if (browserSaved) {
          projectsList = JSON.parse(browserSaved);
          console.log("Migrado localStorage.projects_list_data para db.json");
        } else if (browserOldSaved) {
          const oldProject = JSON.parse(browserOldSaved);
          oldProject.id = "caete-ne";
          projectsList = [oldProject];
          const defaultList = JSON.parse(JSON.stringify(DEFAULT_PROJECTS_LIST));
          const secondProject = defaultList.find(p => p.id === "solar-nordeste");
          if (secondProject) projectsList.push(secondProject);
          console.log("Migrado localStorage.project_status_report_data para db.json");
        } else {
          projectsList = JSON.parse(JSON.stringify(DEFAULT_PROJECTS_LIST));
        }
        saveToStorage();
      }
      
      // Clean migration: normalize IDs and arrays for all projects
      projectsList.forEach(p => {
        if (!p.id) p.id = 'proj-' + Date.now() + Math.random().toString(36).substr(2, 5);
        if (!p.activities) p.activities = [];
        p.activities.forEach((activity, idx) => {
          activity.id = parseInt(activity.id) || (idx + 1);
          if (!activity.subActivities) activity.subActivities = [];
          if (!activity.attentionPoints) activity.attentionPoints = [];
          if (!activity.projectImpacts) activity.projectImpacts = [];
          if (!activity.actionPlans) activity.actionPlans = [];
        });
      });
      
      if (callback) callback();
    })
    .catch(err => {
      // sessão expirada: já voltou para o login; não carrega a lista padrão
      if (err.sessionExpired) return;
      console.error("Erro ao carregar dados do servidor:", err);
      // Fallback to local default list just in case
      projectsList = JSON.parse(JSON.stringify(DEFAULT_PROJECTS_LIST));
      if (callback) callback();
    });
}

function saveToStorage() {
  apiFetch('/api/projects', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(projectsList)
  })
  .then(res => res.json().then(data => ({ ok: res.ok, data })))
  .then(({ ok, data }) => {
    if (ok) {
      console.log('Dados salvos no servidor local.', data);
    } else {
      // o servidor recusou (ex.: dados inválidos): nada foi gravado
      console.error('O servidor recusou os dados:', data.error);
      alert(`Não foi possível salvar: ${data.error}`);
    }
  })
  .catch(err => {
    if (err.sessionExpired) return;
    console.error('Erro ao salvar no servidor local:', err);
  });
}

function selectProject(id) {
  activeProjectId = id;
  const project = projectsList.find(p => p.id === id);
  if (project) {
    projectData = project; // Reference pointer
    
    // Auto calculate project progress
    recalculateProjectProgress();
    
    // Default selected activity to the first one
    if (projectData.activities && projectData.activities.length > 0) {
      selectedActivityId = projectData.activities[0].id;
    } else {
      selectedActivityId = null;
    }
    
    showScreen('app-layout');
    renderAll();
    populateSidebar();
  }
}

function resetToDefault() {
  if (confirm("Deseja realmente restaurar os dados originais deste projeto? Todas as suas subatividades e alterações serão perdidas.")) {
    const defaultProject = DEFAULT_PROJECTS_LIST.find(p => p.id === activeProjectId);
    const idx = projectsList.findIndex(p => p.id === activeProjectId);
    
    if (defaultProject && idx !== -1) {
      projectsList[idx] = JSON.parse(JSON.stringify(defaultProject));
      projectData = projectsList[idx];
    } else if (idx !== -1) {
      // For user-created projects, clear all progress to initial
      projectData.activities = [
        {
          id: 1,
          name: "Fase de Planejamento",
          progress: 0,
          status: "Não iniciado",
          subActivities: [
            { id: 1, name: "Definição do escopo inicial", completed: false }
          ],
          attentionPoints: [],
          projectImpacts: [],
          actionPlans: []
        }
      ];
      projectData.attentionPoints = [];
      projectData.projectImpacts = [];
      projectData.actionPlans = [];
      projectData.kanban = { done: [], doing: [], todo: [] };
    }
    
    if (projectData.activities.length > 0) {
      selectedActivityId = projectData.activities[0].id;
    } else {
      selectedActivityId = null;
    }
    
    recalculateProjectProgress();
    saveToStorage();
    renderAll();
    populateSidebar();
  }
}

// Progress recalculation logic
function recalculateActivityProgress(activity) {
  if (!activity.subActivities || activity.subActivities.length === 0) {
    return; // Leave progress manual if no sub-activities are present
  }
  const completedCount = activity.subActivities.filter(sub => sub.completed).length;
  activity.progress = Math.round((completedCount / activity.subActivities.length) * 100);
  
  // Dynamic status updates
  if (activity.progress === 100) {
    activity.status = 'Concluído';
  } else if (activity.progress === 0) {
    activity.status = 'Não iniciado';
  } else {
    if (activity.status !== 'Atrasado') {
      activity.status = 'Em andamento';
    }
  }
}

function recalculateProjectProgress() {
  if (!projectData.activities || projectData.activities.length === 0) {
    projectData.percentActual = 0;
    return;
  }
  const sum = projectData.activities.reduce((acc, act) => acc + act.progress, 0);
  projectData.percentActual = parseFloat((sum / projectData.activities.length).toFixed(2));
}

// Render All Parts
function renderAll() {
  renderHeader();
  renderInfoCards();
  renderActivitiesTable();
  renderSubActivities();
  renderAttentionLists();
  renderKanbanBoard();
  renderPrintOnlyDetails();
}

// Generates print-only pages for all activities containing checklists/attention cards to include in exported report
function renderPrintOnlyDetails() {
  let container = document.getElementById('print-only-details-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'print-only-details-container';
    container.className = 'print-only-details';
    document.body.appendChild(container);
  }
  
  container.innerHTML = '';
  
  if (!projectData.activities) return;
  
  projectData.activities.forEach(activity => {
    const hasSubs = activity.subActivities && activity.subActivities.length > 0;
    const hasAtt = activity.attentionPoints && activity.attentionPoints.length > 0;
    const hasImp = activity.projectImpacts && activity.projectImpacts.length > 0;
    const hasAct = activity.actionPlans && activity.actionPlans.length > 0;
    
    // Skip empty details activities to avoid printing blank pages
    if (!hasSubs && !hasAtt && !hasImp && !hasAct) return;
    
    const page = document.createElement('div');
    page.className = 'activity-print-page';
    
    let subactivitiesHtml = '';
    if (hasSubs) {
      subactivitiesHtml = `
        <div class="print-section">
          <h3>Subatividades</h3>
          <ul class="print-subactivities-list">
            ${activity.subActivities.map(sub => `
              <li class="print-subactivity-item ${sub.completed ? 'completed' : ''}">
                <span class="print-checkbox">${sub.completed ? '☑' : '☐'}</span>
                <span class="print-text">${sub.name}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    }
    
    let attentionHtml = '';
    if (hasAtt) {
      attentionHtml = `
        <div class="print-section-card attention-blue">
          <h4>Pontos de Atenção</h4>
          <ul>
            ${activity.attentionPoints.map(item => `<li>${item}</li>`).join('')}
          </ul>
        </div>
      `;
    }
    
    let impactsHtml = '';
    if (hasImp) {
      impactsHtml = `
        <div class="print-section-card attention-green">
          <h4>Impactos no Projeto</h4>
          <ul>
            ${activity.projectImpacts.map(item => `<li>${item}</li>`).join('')}
          </ul>
        </div>
      `;
    }
    
    let actionsHtml = '';
    if (hasAct) {
      actionsHtml = `
        <div class="print-section-card attention-orange">
          <h4>Planos de Ação</h4>
          <ul>
            ${activity.actionPlans.map(item => `<li>${item}</li>`).join('')}
          </ul>
        </div>
      `;
    }
    
    page.innerHTML = `
      <div class="print-page-header">
        <div class="print-header-left">
          <h2>${projectData.name}</h2>
          <p class="print-header-subtitle">DETALHAMENTO DA ATIVIDADE</p>
        </div>
        <div class="print-header-right">
          <span class="print-activity-badge">${activity.name}</span>
          <span class="print-status-badge ${getStatusClass(activity.status)}">${activity.status} (${activity.progress}%)</span>
        </div>
      </div>
      
      <div class="print-page-body">
        ${subactivitiesHtml}
        
        <div class="print-attention-grid">
          ${attentionHtml}
          ${impactsHtml}
          ${actionsHtml}
        </div>
      </div>
    `;
    
    container.appendChild(page);
  });
}

// Render Header Metrics
function renderHeader() {
  const projNameEl = document.getElementById('db-proj-name');
  const reportDateEl = document.getElementById('db-report-date');
  const startDateEl = document.getElementById('db-start-date');
  const endDateEl = document.getElementById('db-end-date');
  
  projNameEl.innerText = projectData.name;
  reportDateEl.innerText = projectData.reportDate;
  startDateEl.innerText = projectData.startDate;
  endDateEl.innerText = projectData.endDate;
  
  if (isEditMode) {
    projNameEl.setAttribute('contenteditable', 'true');
    projNameEl.classList.add('editable-text');
    
    reportDateEl.setAttribute('contenteditable', 'true');
    reportDateEl.classList.add('editable-text');
    
    startDateEl.setAttribute('contenteditable', 'true');
    startDateEl.classList.add('editable-text');
    
    endDateEl.setAttribute('contenteditable', 'true');
    endDateEl.classList.add('editable-text');
  } else {
    projNameEl.removeAttribute('contenteditable');
    projNameEl.classList.remove('editable-text');
    
    reportDateEl.removeAttribute('contenteditable');
    reportDateEl.classList.remove('editable-text');
    
    startDateEl.removeAttribute('contenteditable');
    startDateEl.classList.remove('editable-text');
    
    endDateEl.removeAttribute('contenteditable');
    endDateEl.classList.remove('editable-text');
  }
}

// Render info cards
function renderInfoCards() {
  const descEl = document.getElementById('db-description');
  const teamEl = document.getElementById('db-team');
  
  descEl.innerText = projectData.description;
  teamEl.innerText = projectData.team;
  
  if (isEditMode) {
    descEl.setAttribute('contenteditable', 'true');
    descEl.classList.add('editable-text');
    
    teamEl.setAttribute('contenteditable', 'true');
    teamEl.classList.add('editable-text');
  } else {
    descEl.removeAttribute('contenteditable');
    descEl.classList.remove('editable-text');
    
    teamEl.removeAttribute('contenteditable');
    teamEl.classList.remove('editable-text');
  }
}

function getStatusClass(status) {
  switch (status) {
    case 'Concluído': return 'done';
    case 'Atrasado': return 'delayed';
    case 'Em andamento': return 'ongoing';
    default: return 'todo';
  }
}

// Set selected activity and update UI classes without rebuilding table DOM (preserves focus)
function selectActivity(id) {
  selectedActivityId = parseInt(id) || null;
  
  const rows = document.querySelectorAll('#activities-table-body tr');
  rows.forEach(row => {
    const cell = row.querySelector('.col-activity');
    if (cell) {
      const rowId = parseInt(cell.dataset.activityId);
      if (rowId === selectedActivityId) {
        row.classList.add('selected-row');
      } else {
        row.classList.remove('selected-row');
      }
    }
  });
  
  renderSubActivities();
  renderAttentionLists();
  populateSidebar();
}

// Render Main Activities table
function renderActivitiesTable() {
  const tbody = document.querySelector('#activities-table-body');
  tbody.innerHTML = '';
  
  if (!projectData.activities) return;

  // Adjust table header dynamically
  const theadRow = document.querySelector('.activities-table thead tr');
  if (theadRow) {
    if (isEditMode) {
      theadRow.innerHTML = `
        <th class="col-drag"></th>
        <th class="col-id">ID</th>
        <th class="col-activity">Atividade</th>
        <th class="col-status">Status</th>
        <th class="col-actions" style="width: 70px; text-align: center;">Ações</th>
      `;
    } else {
      theadRow.innerHTML = `
        <th class="col-id">ID</th>
        <th class="col-activity">Atividade</th>
        <th class="col-status">Status</th>
      `;
    }
  }
  
  projectData.activities.forEach(activity => {
    const tr = document.createElement('tr');
    
    if (activity.id === selectedActivityId) {
      tr.className = 'selected-row';
    }
    
    const statusClass = getStatusClass(activity.status);

    // Status color mapping for custom-colored dropdown
    let bgVar = '';
    let textVar = '';
    if (activity.status === 'Concluído') {
      bgVar = 'var(--badge-done-bg)';
      textVar = 'var(--badge-done-text)';
    } else if (activity.status === 'Atrasado') {
      bgVar = 'var(--badge-delayed-bg)';
      textVar = 'var(--badge-delayed-text)';
    } else if (activity.status === 'Em andamento') {
      bgVar = 'var(--badge-ongoing-bg)';
      textVar = 'var(--badge-ongoing-text)';
    } else { // Não iniciado
      bgVar = 'var(--badge-todo-bg)';
      textVar = 'var(--badge-todo-text)';
    }

    const statusHtml = isEditMode ? `
      <select class="inline-status-select" data-id="${activity.id}" style="width: 100%; padding: 3px 20px 3px 6px; font-size: 0.68rem; font-weight: 700; border-radius: 4px; border: 1px solid transparent; background-color: ${bgVar}; color: ${textVar}; cursor: pointer; text-align-last: center; height:24px;">
        <option value="Concluído" style="background-color: var(--badge-done-bg); color: var(--badge-done-text);" ${activity.status === 'Concluído' ? 'selected' : ''}>Concluído</option>
        <option value="Em andamento" style="background-color: var(--badge-ongoing-bg); color: var(--badge-ongoing-text);" ${activity.status === 'Em andamento' ? 'selected' : ''}>Em andamento</option>
        <option value="Atrasado" style="background-color: var(--badge-delayed-bg); color: var(--badge-delayed-text);" ${activity.status === 'Atrasado' ? 'selected' : ''}>Atrasado</option>
        <option value="Não iniciado" style="background-color: var(--badge-todo-bg); color: var(--badge-todo-text);" ${activity.status === 'Não iniciado' ? 'selected' : ''}>Não iniciado</option>
      </select>
    ` : `
      <span class="status-badge ${statusClass}">${activity.status}</span>
    `;

    const actionsHtml = isEditMode ? `
      <td class="col-actions" style="text-align: center; vertical-align: middle; white-space: nowrap;">
        <button class="btn-icon edit-activity-btn-inline" data-id="${activity.id}" title="Editar Nome da Atividade" style="margin: 0 3px; padding: 2px; cursor: pointer; border: none; background: none; display: inline-block;">✏️</button>
        <button class="btn-icon delete-activity-btn-inline" data-id="${activity.id}" title="Excluir Atividade" style="margin: 0 3px; padding: 2px; cursor: pointer; border: none; background: none; display: inline-block;">🗑️</button>
      </td>
    ` : '';

    const dragHandleHtml = isEditMode ? `
      <td class="col-drag">
        <span class="drag-handle" draggable="true" data-id="${activity.id}" title="Arraste para reordenar">⠿</span>
      </td>
    ` : '';

    tr.dataset.activityId = activity.id;

    tr.innerHTML = `
      ${dragHandleHtml}
      <td class="col-id">#${activity.id}</td>
      <td class="col-activity editable-cell-text" data-activity-id="${activity.id}" data-field="name" contenteditable="false">${activity.name}</td>
      <td class="col-status">
        ${statusHtml}
      </td>
      ${actionsHtml}
    `;

    tr.addEventListener('click', (e) => {
      selectActivity(activity.id);
    });

    tbody.appendChild(tr);
  });
  
  // Add Project Total Row
  const totalRow = document.createElement('tr');
  totalRow.className = 'table-summary-row';
  
  totalRow.innerHTML = `
    ${isEditMode ? '<td class="col-drag"></td>' : ''}
    <td class="col-id"></td>
    <td class="col-activity">AVANÇO DO PROJETO</td>
    <td class="col-status">
      <span class="status-badge done" style="border: 1px solid white;">PROJETO</span>
    </td>
    ${isEditMode ? '<td class="col-actions"></td>' : ''}
  `;
  tbody.appendChild(totalRow);

  // Add Inline "+ Adicionar Atividade" row at the very bottom
  if (isEditMode) {
    const addRow = document.createElement('tr');
    addRow.className = 'add-activity-row';
    addRow.innerHTML = `
      <td colspan="5" style="padding: 8px; text-align: center; background-color: white;">
        <button id="btn-add-activity-inline" class="btn-add-item" style="margin: 0 auto; width: auto; display: inline-flex; align-items: center; gap: 6px; padding: 6px 16px;">➕ Adicionar Atividade</button>
      </td>
    `;
    tbody.appendChild(addRow);
    
    addRow.querySelector('#btn-add-activity-inline').addEventListener('click', (e) => {
      e.stopPropagation();
      addActivity();
    });
  }

  // Add listeners to inline table activities edits
  tbody.querySelectorAll('.editable-cell-text').forEach(cell => {
    cell.addEventListener('blur', (e) => {
      e.target.setAttribute('contenteditable', 'false');
      if (!isEditMode) return;
      const actId = parseInt(e.target.dataset.activityId);
      const field = e.target.dataset.field;
      const val = e.target.innerText.trim();
      
      const activeProj = projectsList.find(p => p.id === activeProjectId) || projectData;
      const activity = activeProj.activities.find(a => a.id === actId);
      if (activity) {
        activity[field] = val;
        projectData = activeProj; // Sync global
        populateSidebar();
        
        if (actId === selectedActivityId) {
          const subTitleEl = document.getElementById('db-subactivities-subtitle');
          if (subTitleEl) subTitleEl.innerText = `de: ${val}`;
        }
      }
    });
    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.target.blur();
      }
    });
    cell.addEventListener('click', (e) => {
      if (e.target.getAttribute('contenteditable') === 'true') {
        e.stopPropagation(); // prevent selectActivity row click trigger when clicking contenteditable cell
      }
    });
  });

  // Bind change events to the inline status select dropdowns
  tbody.querySelectorAll('.inline-status-select').forEach(select => {
    select.addEventListener('change', (e) => {
      if (!isEditMode) return;
      const actId = parseInt(e.target.dataset.id);
      const status = e.target.value;
      
      const activeProj = projectsList.find(p => p.id === activeProjectId) || projectData;
      const activity = activeProj.activities.find(a => a.id === actId);
      if (activity) {
        activity.status = status;
        
        // Auto-update progress
        if (status === 'Concluído') {
          activity.progress = 100;
        } else if (status === 'Não iniciado') {
          activity.progress = 0;
        }
        
        projectData = activeProj;
        recalculateProjectProgress();
        renderAll();
        populateSidebar();
      }
    });
    select.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  });

  // Bind click events to the inline edit buttons
  tbody.querySelectorAll('.edit-activity-btn-inline').forEach(btn => {
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Prevents focus from moving to the button
      e.stopPropagation();
    });
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isEditMode) return;
      const tr = btn.closest('tr');
      const cell = tr ? tr.querySelector('.col-activity') : null;
      if (cell) {
        cell.setAttribute('contenteditable', 'true');
        cell.focus();
        
        // Select all text in the cell to make it easy to edit
        const range = document.createRange();
        range.selectNodeContents(cell);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    });
  });

  // Bind click events to the inline delete buttons
  tbody.querySelectorAll('.delete-activity-btn-inline').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isEditMode) return;
      const actId = parseInt(btn.dataset.id);
      const activeProj = projectsList.find(p => p.id === activeProjectId) || projectData;
      const idx = activeProj.activities.findIndex(a => a.id === actId);
      if (idx !== -1) {
        if (confirm(`Deseja realmente excluir a atividade "${activeProj.activities[idx].name}"?`)) {
          activeProj.activities.splice(idx, 1);
          
          // Re-index remaining activities
          activeProj.activities.forEach((act, newIdx) => {
            act.id = newIdx + 1;
          });
          
          // Reset selectedActivityId if deleted
          if (selectedActivityId === actId) {
            selectedActivityId = activeProj.activities.length > 0 ? activeProj.activities[0].id : null;
          } else {
            const found = activeProj.activities.find(a => a.id === selectedActivityId);
            if (!found) {
              selectedActivityId = activeProj.activities.length > 0 ? activeProj.activities[0].id : null;
            }
          }
          
          projectData = activeProj;
          recalculateProjectProgress();
          renderAll();
          populateSidebar();
        }
      }
    });
  });

  // Drag-and-drop reordering of activity rows (edit mode only)
  if (isEditMode) {
    let draggedRow = null;

    tbody.querySelectorAll('.drag-handle').forEach(handle => {
      handle.addEventListener('dragstart', (e) => {
        draggedRow = handle.closest('tr');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', handle.dataset.id);
        draggedRow.classList.add('dragging-row');
      });
      handle.addEventListener('dragend', () => {
        if (draggedRow) draggedRow.classList.remove('dragging-row');
        tbody.querySelectorAll('.drag-over-row').forEach(r => r.classList.remove('drag-over-row'));
        draggedRow = null;
      });
    });

    tbody.querySelectorAll('tr[data-activity-id]').forEach(row => {
      row.addEventListener('dragover', (e) => {
        if (!draggedRow || draggedRow === row) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        row.classList.add('drag-over-row');
      });
      row.addEventListener('dragleave', () => {
        row.classList.remove('drag-over-row');
      });
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.classList.remove('drag-over-row');
        if (!draggedRow || draggedRow === row) return;

        const sourceId = parseInt(draggedRow.dataset.activityId);
        const targetId = parseInt(row.dataset.activityId);

        const activeProj = projectsList.find(p => p.id === activeProjectId) || projectData;
        const selectedActivityObj = activeProj.activities.find(a => a.id === selectedActivityId) || null;

        const fromIdx = activeProj.activities.findIndex(a => a.id === sourceId);
        let toIdx = activeProj.activities.findIndex(a => a.id === targetId);
        if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;

        const [moved] = activeProj.activities.splice(fromIdx, 1);
        if (fromIdx < toIdx) toIdx -= 1; // account for the shift caused by removing the source row
        activeProj.activities.splice(toIdx, 0, moved);

        // IDs mirror display order in this app (see addActivity/delete re-indexing), so keep them in sync
        activeProj.activities.forEach((act, idx) => {
          act.id = idx + 1;
        });

        if (selectedActivityObj) selectedActivityId = selectedActivityObj.id;

        projectData = activeProj;
        renderAll();
        populateSidebar();
      });
    });
  }
}

// Render Subactivities Card Checklist
function renderSubActivities() {
  const container = document.getElementById('subactivities-container');
  const emptyState = document.getElementById('db-subactivities-empty-state');
  const form = document.getElementById('subactivities-add-form');
  const list = document.getElementById('db-subactivities-list');
  const subtitle = document.getElementById('db-subactivities-subtitle');
  const badge = document.getElementById('badge-subactivities');
  
  if (!selectedActivityId) {
    emptyState.style.display = 'flex';
    form.style.display = 'none';
    list.style.display = 'none';
    badge.style.display = 'none';
    subtitle.innerText = 'Selecione uma atividade para detalhar';
    return;
  }
  
  const activity = projectData.activities.find(a => a.id === selectedActivityId);
  if (!activity) {
    selectedActivityId = null;
    renderSubActivities();
    return;
  }
  
  emptyState.style.display = 'none';
  form.style.display = isEditMode ? 'flex' : 'none';
  list.style.display = 'block';
  
  badge.style.display = 'inline-block';
  
  subtitle.innerText = `de: ${activity.name}`;
  badge.innerText = activity.subActivities ? activity.subActivities.length : 0;
  
  list.innerHTML = '';
  
  if (!activity.subActivities || activity.subActivities.length === 0) {
    list.innerHTML = `<li style="text-align: center; color: var(--text-muted); font-size: 0.75rem; padding: 30px 10px; border: 1px dashed var(--border-light); border-radius: var(--radius-sm);">
      Nenhuma subatividade nesta etapa. Adicione uma acima!
    </li>`;
    return;
  }
  
  activity.subActivities.forEach((sub, index) => {
    const li = document.createElement('li');
    li.className = `subactivity-item ${sub.completed ? 'completed' : ''}`;
    li.innerHTML = `
      <div class="subactivity-item-left">
        <input type="checkbox" class="subactivity-checkbox" ${sub.completed ? 'checked' : ''} data-index="${index}">
        <span class="subactivity-text" contenteditable="${isEditMode}" data-index="${index}">${sub.name}</span>
      </div>
      ${isEditMode ? `<button class="btn-icon delete-subactivity-btn" data-index="${index}" title="Excluir subatividade">🗑️</button>` : ''}
    `;
    
    // Checkbox toggling
    li.querySelector('.subactivity-checkbox').addEventListener('change', (e) => {
      sub.completed = e.target.checked;
      recalculateActivityProgress(activity);
      recalculateProjectProgress();
      renderAll();
      populateSidebar();
      if (!isEditMode) {
        saveToStorage();
      }
    });
    
    // Inline text editing
    const textSpan = li.querySelector('.subactivity-text');
    textSpan.addEventListener('blur', (e) => {
      if (!isEditMode) return;
      const val = e.target.innerText.trim();
      if (val === '') {
        activity.subActivities.splice(index, 1);
      } else {
        sub.name = val;
      }
      recalculateActivityProgress(activity);
      recalculateProjectProgress();
      renderAll();
      populateSidebar();
    });
    
    textSpan.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.target.blur();
      }
    });
    
    // Delete Subactivity button
    const delBtn = li.querySelector('.delete-subactivity-btn');
    if (delBtn) {
      delBtn.addEventListener('click', (e) => {
        if (!isEditMode) return;
        activity.subActivities.splice(index, 1);
        recalculateActivityProgress(activity);
        recalculateProjectProgress();
        renderAll();
        populateSidebar();
      });
    }
    
    list.appendChild(li);
  });
}

function handleAddSubActivity() {
  if (!isEditMode) return;
  const input = document.getElementById('input-new-subactivity');
  const val = input.value.trim();
  if (val === '') return;
  
  const activity = projectData.activities.find(a => a.id === selectedActivityId);
  if (activity) {
    if (!activity.subActivities) activity.subActivities = [];
    const newId = activity.subActivities.length + 1;
    activity.subActivities.push({
      id: newId,
      name: val,
      completed: false
    });
    
    recalculateActivityProgress(activity);
    recalculateProjectProgress();
    input.value = '';
    renderAll();
    populateSidebar();
  }
}

// Render Attention Cards (Pontos de Atenção, Impactos, Planos de Ação)
function renderAttentionLists() {
  const activity = selectedActivityId ? projectData.activities.find(a => a.id === selectedActivityId) : null;
  const attentionPoints = activity ? (activity.attentionPoints || []) : [];
  const projectImpacts = activity ? (activity.projectImpacts || []) : [];
  const actionPlans = activity ? (activity.actionPlans || []) : [];

  const activityNameText = activity ? `de: ${activity.name}` : 'Nenhuma atividade selecionada';
  
  const subtitleAttention = document.getElementById('db-attention-subtitle');
  if (subtitleAttention) subtitleAttention.innerText = activityNameText;

  const subtitleImpacts = document.getElementById('db-impacts-subtitle');
  if (subtitleImpacts) subtitleImpacts.innerText = activityNameText;

  const subtitleActions = document.getElementById('db-actions-subtitle');
  if (subtitleActions) subtitleActions.innerText = activityNameText;

  renderSingleAttentionList('db-attention-list', attentionPoints, 'attentionPoints');
  renderSingleAttentionList('db-impacts-list', projectImpacts, 'projectImpacts');
  renderSingleAttentionList('db-actions-list', actionPlans, 'actionPlans');
}

function renderSingleAttentionList(elementId, itemsList, dataKey) {
  const container = document.getElementById(elementId);
  container.innerHTML = '';
  
  if (!selectedActivityId) {
    container.innerHTML = '<li style="color: var(--text-muted); list-style: none;">Selecione uma atividade para visualizar.</li>';
    return;
  }
  
  if (itemsList.length === 0 && !isEditMode) {
    container.innerHTML = '<li>Nenhum item registrado.</li>';
    return;
  }
  
  itemsList.forEach((item, index) => {
    const li = document.createElement('li');
    li.style.position = 'relative';
    
    if (isEditMode) {
      li.style.display = 'flex';
      li.style.alignItems = 'center';
      li.style.justifyContent = 'space-between';
      li.style.gap = '8px';
      li.style.paddingLeft = '0';
      li.style.marginBottom = '4px';
      li.className = 'editable-item-row-dashboard';
      
      li.innerHTML = `
        <span class="bullet" style="color: inherit; font-weight: bold; margin-right: 4px; flex-shrink: 0;">•</span>
        <span contenteditable="true" class="editable-attention-text" data-key="${dataKey}" data-index="${index}" style="flex: 1; outline: none; border-radius: 4px; padding: 2px 4px; cursor: text; transition: background 0.15s ease;">${item}</span>
        <button class="btn-icon delete-attention-item-inline" data-key="${dataKey}" data-index="${index}" title="Excluir Item" style="padding: 2px; color: var(--text-muted); cursor: pointer; flex-shrink: 0; font-size: 0.75rem; border: none; background: none;">🗑️</button>
      `;
      
      const editableSpan = li.querySelector('.editable-attention-text');
      editableSpan.addEventListener('blur', (e) => {
        if (!isEditMode) return;
        const idx = parseInt(e.target.dataset.index);
        const key = e.target.dataset.key;
        const text = e.target.innerText.trim();
        
        const activeProj = projectsList.find(p => p.id === activeProjectId) || projectData;
        const activity = activeProj.activities.find(a => a.id === selectedActivityId);
        if (activity) {
          if (!activity[key]) activity[key] = [];
          if (text === '') {
            activity[key].splice(idx, 1);
          } else {
            activity[key][idx] = text;
          }
          projectData = activeProj;
          renderAttentionLists();
        }
      });
      
      editableSpan.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.target.blur();
        }
      });
      
      editableSpan.addEventListener('click', (e) => {
        e.stopPropagation();
      });
      
      li.querySelector('.delete-attention-item-inline').addEventListener('click', (e) => {
        e.stopPropagation();
        if (!isEditMode) return;
        const idx = parseInt(e.currentTarget.dataset.index);
        const key = e.currentTarget.dataset.key;
        
        const activeProj = projectsList.find(p => p.id === activeProjectId) || projectData;
        const activity = activeProj.activities.find(a => a.id === selectedActivityId);
        if (activity && activity[key]) {
          activity[key].splice(idx, 1);
          projectData = activeProj;
          renderAttentionLists();
        }
      });
    } else {
      li.innerText = item;
    }
    
    container.appendChild(li);
  });
  
  // Inline "+ Adicionar Item" button
  if (isEditMode) {
    const addLi = document.createElement('li');
    addLi.className = 'no-bullet';
    
    const addBtn = document.createElement('button');
    addBtn.className = 'btn-add-item-inline-card';
    addBtn.innerText = '+ Adicionar Item';
    addBtn.style.cssText = 'background: none; border: 1px dashed var(--primary-blue); color: var(--primary-blue); padding: 4px 8px; width: 100%; border-radius: 4px; font-size: 0.68rem; font-weight: 600; cursor: pointer; text-align: center; display: block;';
    
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isEditMode) return;
      const activeProj = projectsList.find(p => p.id === activeProjectId) || projectData;
      const activity = activeProj.activities.find(a => a.id === selectedActivityId);
      if (activity) {
        if (!activity[dataKey]) activity[dataKey] = [];
        activity[dataKey].push("Novo item...");
        projectData = activeProj;
        renderAttentionLists();
        
        // Auto-focus the newly added item
        setTimeout(() => {
          const items = container.querySelectorAll('.editable-attention-text');
          if (items.length > 0) {
            const newItem = items[items.length - 1];
            newItem.focus();
            // Select all text
            const range = document.createRange();
            range.selectNodeContents(newItem);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }, 50);
      }
    });
    
    addLi.appendChild(addBtn);
    container.appendChild(addLi);
  }
}

// Render Kanban Column Cards
function renderKanbanBoard() {
  if (!projectData.kanban) return;
  renderSingleKanbanColumn('db-kanban-done', 'done', projectData.kanban.done);
  renderSingleKanbanColumn('db-kanban-doing', 'doing', projectData.kanban.doing);
  renderSingleKanbanColumn('db-kanban-todo', 'todo', projectData.kanban.todo);
}

function renderSingleKanbanColumn(elementId, colKey, itemsList) {
  const container = document.getElementById(elementId);
  container.innerHTML = '';
  
  const badgeId = `badge-kanban-${colKey}`;
  const badge = document.getElementById(badgeId);
  if (badge) {
    badge.innerText = itemsList.length;
  }
  
  if (itemsList.length === 0 && !isEditMode) {
    container.innerHTML = '<li>Nenhum item nesta etapa.</li>';
    return;
  }
  
  itemsList.forEach((item, index) => {
    const li = document.createElement('li');
    li.style.position = 'relative';
    
    if (isEditMode) {
      li.style.display = 'flex';
      li.style.alignItems = 'center';
      li.style.justifyContent = 'space-between';
      li.style.gap = '8px';
      li.style.paddingLeft = '0';
      li.style.marginBottom = '4px';
      li.className = 'editable-item-row-dashboard';
      
      li.innerHTML = `
        <span class="bullet" style="color: inherit; font-weight: bold; margin-right: 4px; flex-shrink: 0;">•</span>
        <span contenteditable="true" class="editable-kanban-text" data-col="${colKey}" data-index="${index}" style="flex: 1; outline: none; border-radius: 4px; padding: 2px 4px; cursor: text; transition: background 0.15s ease;">${item}</span>
        <button class="btn-icon delete-kanban-item-inline" data-col="${colKey}" data-index="${index}" title="Excluir Cartão" style="padding: 2px; color: var(--text-muted); cursor: pointer; flex-shrink: 0; font-size: 0.75rem; border: none; background: none;">🗑️</button>
      `;
      
      const editableSpan = li.querySelector('.editable-kanban-text');
      editableSpan.addEventListener('blur', (e) => {
        if (!isEditMode) return;
        const idx = parseInt(e.target.dataset.index);
        const col = e.target.dataset.col;
        const text = e.target.innerText.trim();
        
        const activeProj = projectsList.find(p => p.id === activeProjectId) || projectData;
        if (text === '') {
          activeProj.kanban[col].splice(idx, 1);
        } else {
          activeProj.kanban[col][idx] = text;
        }
        projectData = activeProj;
        renderKanbanBoard();
      });
      
      editableSpan.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.target.blur();
        }
      });
      
      editableSpan.addEventListener('click', (e) => {
        e.stopPropagation();
      });
      
      li.querySelector('.delete-kanban-item-inline').addEventListener('click', (e) => {
        e.stopPropagation();
        if (!isEditMode) return;
        const idx = parseInt(e.currentTarget.dataset.index);
        const col = e.currentTarget.dataset.col;
        
        const activeProj = projectsList.find(p => p.id === activeProjectId) || projectData;
        activeProj.kanban[col].splice(idx, 1);
        projectData = activeProj;
        renderKanbanBoard();
      });
    } else {
      li.innerText = item;
    }
    
    container.appendChild(li);
  });
  
  // Inline "+ Adicionar Item" button
  if (isEditMode) {
    const addLi = document.createElement('li');
    addLi.className = 'no-bullet';
    
    const addBtn = document.createElement('button');
    addBtn.className = 'btn-add-item-inline-card';
    addBtn.innerText = '+ Adicionar Item';
    addBtn.style.cssText = 'background: none; border: 1px dashed var(--primary-blue); color: var(--primary-blue); padding: 4px 8px; width: 100%; border-radius: 4px; font-size: 0.68rem; font-weight: 600; cursor: pointer; text-align: center; display: block;';
    
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isEditMode) return;
      const activeProj = projectsList.find(p => p.id === activeProjectId) || projectData;
      if (!activeProj.kanban) activeProj.kanban = { done: [], doing: [], todo: [] };
      if (!activeProj.kanban[colKey]) activeProj.kanban[colKey] = [];
      activeProj.kanban[colKey].push("Novo cartão...");
      projectData = activeProj;
      renderKanbanBoard();
      
      // Auto-focus new kanban item
      setTimeout(() => {
        const items = container.querySelectorAll('.editable-kanban-text');
        if (items.length > 0) {
          const newItem = items[items.length - 1];
          newItem.focus();
          const range = document.createRange();
          range.selectNodeContents(newItem);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }, 50);
    });
    
    addLi.appendChild(addBtn);
    container.appendChild(addLi);
  }
}

function toggleEditMode() {
  const toggleBtn = document.getElementById('btn-toggle-sidebar');
  const cancelBtn = document.getElementById('btn-cancel-edit');
  
  if (!isEditMode) {
    isEditMode = true;
    projectDataBackup = JSON.parse(JSON.stringify(projectData)); // Backup current project data
    toggleBtn.innerHTML = '<span>💾</span> Salvar';
    toggleBtn.classList.remove('btn-secondary');
    toggleBtn.classList.add('btn-success');
    if (cancelBtn) {
      cancelBtn.classList.remove('hidden');
    }
  } else {
    isEditMode = false;
    projectDataBackup = null; // Clear backup
    toggleBtn.innerHTML = '<span>✏️</span> Editar';
    toggleBtn.classList.remove('btn-success');
    toggleBtn.classList.add('btn-secondary');
    if (cancelBtn) {
      cancelBtn.classList.add('hidden');
    }
    saveToStorage();
  }
  
  renderAll();
}

function cancelEditMode() {
  if (isEditMode) {
    if (projectDataBackup) {
      const idx = projectsList.findIndex(p => p.id === activeProjectId);
      if (idx !== -1) {
        projectsList[idx] = JSON.parse(JSON.stringify(projectDataBackup));
        projectData = projectsList[idx];
      }
      projectDataBackup = null;
    }
    isEditMode = false;
    
    // Reset Edit/Save button
    const toggleBtn = document.getElementById('btn-toggle-sidebar');
    if (toggleBtn) {
      toggleBtn.innerHTML = '<span>✏️</span> Editar';
      toggleBtn.classList.remove('btn-success');
      toggleBtn.classList.add('btn-secondary');
    }
    
    // Hide Cancel button
    const cancelBtn = document.getElementById('btn-cancel-edit');
    if (cancelBtn) {
      cancelBtn.classList.add('hidden');
    }
    
    // Re-render
    renderAll();
  }
}

function setupHeaderInlineListeners() {
  const bindInlineField = (elementId, key, blurOnEnter = false) => {
    const el = document.getElementById(elementId);
    if (el) {
      el.addEventListener('blur', (e) => {
        if (!isEditMode) return;
        const text = e.target.innerText.trim();
        
        const activeProj = projectsList.find(p => p.id === activeProjectId) || projectData;
        activeProj[key] = text;
        projectData = activeProj;
      });
      if (blurOnEnter) {
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.target.blur();
          }
        });
      }
    }
  };
  
  bindInlineField('db-proj-name', 'name', true);
  bindInlineField('db-report-date', 'reportDate', true);
  bindInlineField('db-start-date', 'startDate', true);
  bindInlineField('db-end-date', 'endDate', true);
  bindInlineField('db-description', 'description', false);
  bindInlineField('db-team', 'team', false);
}

function addActivity() {
  const newId = projectData.activities.length + 1;
  projectData.activities.push({
    id: newId,
    name: "Nova Atividade",
    progress: 0,
    status: "Não iniciado",
    subActivities: [],
    attentionPoints: [],
    projectImpacts: [],
    actionPlans: []
  });
  
  selectedActivityId = newId; // Select the newly added activity
  recalculateProjectProgress();
  renderAll();
}

// Print trigger
function printDashboard() {
  document.body.classList.add('printing');
  fitAllPrintPages();
  window.print();
  resetPrintPagesZoom();
  document.body.classList.remove('printing');
}

// --- Print scaling: keeps each printed page's content fully visible instead of silently
// clipping it. The layout was designed around a fixed 1440x1020 "page" scaled down to 0.73
// to fit one landscape A4 sheet; with a fixed zoom, any project with enough data (many
// activities, subactivities, attention points, etc.) had its overflow cut off because the
// page box used overflow:hidden. Here we measure each page's real content height at the
// print layout width and shrink the zoom only as much as needed to keep it on one page.
const PRINT_PAGE_WIDTH = 1440;   // logical width used by the print layout (matches CSS)
const PRINT_PAGE_HEIGHT = 1020;  // logical height that maps to one landscape page at PRINT_BASE_ZOOM
const PRINT_BASE_ZOOM = 0.73;    // original scale, used whenever content already fits
const PRINT_MIN_ZOOM = 0.4;      // floor to keep text legible; beyond this the page is allowed to spill onto an extra sheet instead of shrinking further

function computePrintZoom(naturalHeight) {
  if (naturalHeight <= PRINT_PAGE_HEIGHT) return PRINT_BASE_ZOOM;
  return Math.max(PRINT_BASE_ZOOM * (PRINT_PAGE_HEIGHT / naturalHeight), PRINT_MIN_ZOOM);
}

// Measures `page`'s natural content height at the print layout width, then applies the
// smallest zoom needed to keep it on a single printed page (never below PRINT_MIN_ZOOM).
function fitPrintPage(page, { flex = false } = {}) {
  const prevInlineStyle = page.getAttribute('style') || '';

  page.style.width = `${PRINT_PAGE_WIDTH}px`;
  page.style.height = 'auto';
  page.style.overflow = 'visible';
  page.style.zoom = '1';
  if (flex) {
    page.style.display = 'flex';
    page.style.flexDirection = 'column';
  }

  const naturalHeight = page.scrollHeight;

  // Drop the measurement overrides (the real @media print rules take over at print time)
  // and keep only the computed zoom, which CSS no longer hardcodes.
  page.setAttribute('style', prevInlineStyle);
  page.style.zoom = String(computePrintZoom(naturalHeight));
}

function fitAllPrintPages() {
  // .activity-print-page elements live inside a display:none container outside of print,
  // so they need to be temporarily shown to be measurable.
  const detailsContainer = document.getElementById('print-only-details-container');
  const prevContainerDisplay = detailsContainer ? detailsContainer.style.display : null;
  if (detailsContainer) detailsContainer.style.display = 'block';

  const paper = document.querySelector('.dashboard-paper');
  if (paper) fitPrintPage(paper);

  document.querySelectorAll('.activity-print-page').forEach(page => fitPrintPage(page, { flex: true }));

  if (detailsContainer) detailsContainer.style.display = prevContainerDisplay;
}

function resetPrintPagesZoom() {
  const paper = document.querySelector('.dashboard-paper');
  if (paper) paper.style.zoom = '';
  document.querySelectorAll('.activity-print-page').forEach(page => { page.style.zoom = ''; });
}

/* ==========================================================================
   MULTI-PROJECT CONTROL PANEL
   ========================================================================== */

function renderProjectsGrid() {
  const grid = document.getElementById('projects-grid');
  grid.innerHTML = '';
  
  const searchVal = document.getElementById('project-search-input').value.toLowerCase().trim();
  const filtered = projectsList.filter(p => p.name.toLowerCase().includes(searchVal));
  
  if (filtered.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 40px; border: 1px dashed var(--border-light); border-radius: var(--radius-md); background: white;">
      Nenhum projeto encontrado. Clique em "+ Novo Projeto" para criar um!
    </div>`;
    return;
  }
  
  filtered.forEach(p => {
    // Calculate total project progress dynamically
    let progress = 0;
    if (p.activities && p.activities.length > 0) {
      const sum = p.activities.reduce((acc, act) => acc + act.progress, 0);
      progress = parseFloat((sum / p.activities.length).toFixed(2));
    }
    
    const card = document.createElement('div');
    card.className = 'project-card';
    card.innerHTML = `
      <div class="project-card-header">
        <div class="project-card-title">${p.name}</div>
        <div class="project-card-date">${p.reportDate}</div>
      </div>
      <div class="project-card-desc">${p.description || 'Sem descrição cadastrada.'}</div>
      
      <div class="project-card-progress-section">
        <div class="project-card-progress-info">
          <span>Avanço Geral</span>
          <span>${progress}%</span>
        </div>
        <div class="project-card-progress-bar">
          <div class="project-card-progress-fill" style="width: ${progress}%;"></div>
        </div>
      </div>
      
      <div class="project-card-footer">
        <div class="project-card-stats">
          <span>📋 ${p.activities ? p.activities.length : 0} Ativ.</span>
        </div>
        <div class="project-card-actions">
          <button class="btn-card-edit btn" style="font-size: 0.74rem; padding: 6px 12px; background-color: var(--primary-blue); color: white;">Editar</button>
          <button class="btn-card-delete btn" style="font-size: 0.74rem; padding: 6px 10px; background-color: #fee2e2; color: #dc2626; border: 1px solid #fca5a5;">🗑️</button>
        </div>
      </div>
    `;
    
    card.querySelector('.btn-card-edit').addEventListener('click', (e) => {
      e.stopPropagation();
      selectProject(p.id);
    });
    
    card.querySelector('.btn-card-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteProject(p.id);
    });
    
    grid.appendChild(card);
  });
}

function createProject() {
  const name = prompt("Digite o nome do novo projeto:");
  if (!name || name.trim() === '') return;
  
  const id = 'proj-' + Date.now();
  
  const newProject = {
    id: id,
    name: name.trim(),
    reportDate: new Date().toLocaleDateString('pt-BR'),
    startDate: new Date().toLocaleDateString('pt-BR'),
    endDate: new Date(Date.now() + 60*24*60*60*1000).toLocaleDateString('pt-BR'), // default to 60 days
    description: "Implantação e parametrização inicial do projeto.",
    team: "GP: Usuário",
    activities: [
      {
        id: 1,
        name: "Fase de Planejamento",
        progress: 0,
        status: "Não iniciado",
        subActivities: [
          { id: 1, name: "Definição do escopo inicial", completed: false }
        ],
        attentionPoints: [],
        projectImpacts: [],
        actionPlans: []
      }
    ],
    kanban: {
      done: [],
      doing: [],
      todo: [
        "Definição do escopo inicial da fase de planejamento"
      ]
    }
  };
  
  projectsList.push(newProject);
  saveToStorage();
  renderProjectsGrid();
  selectProject(id);
}

function deleteProject(id) {
  const project = projectsList.find(p => p.id === id);
  if (!project) return;
  
  if (confirm(`Deseja realmente excluir permanentemente o projeto "${project.name}"? Esta ação não pode ser desfeita.`)) {
    projectsList = projectsList.filter(p => p.id !== id);
    saveToStorage();
    renderProjectsGrid();
  }
}

// Credentials are checked by the server; the browser only keeps the session cookie
function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  const submitBtn = document.querySelector('#login-form button[type="submit"]');
  submitBtn.disabled = true;

  fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
    .then((res) => res.json().catch(() => ({})).then((data) => ({ ok: res.ok, data })))
    .then(({ ok, data }) => {
      if (!ok) {
        errorEl.textContent = data.error || 'Não foi possível entrar. Tente novamente.';
        errorEl.classList.remove('hidden');
        return;
      }
      localStorage.setItem(SESSION_KEY, 'logged-in');
      localStorage.setItem(SESSION_USER_KEY, data.user);
      errorEl.classList.add('hidden');
      loadProjects(() => {
        renderProjectsGrid();
        showScreen('project-selector-screen');
      });

      // Reset inputs
      document.getElementById('login-email').value = '';
      document.getElementById('login-password').value = '';
    })
    .catch(() => {
      errorEl.textContent = 'Servidor indisponível. Tente novamente.';
      errorEl.classList.remove('hidden');
    })
    .finally(() => {
      submitBtn.disabled = false;
    });
}

function handleLogout() {
  // encerra a sessão no servidor; a tela volta ao login mesmo se a chamada falhar
  fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
    .catch(() => {})
    .finally(() => {
      clearLocalSession();
      document.getElementById('login-error').classList.add('hidden');
      showScreen('login-screen');
    });
}

function showProjectSelectorScreen() {
  saveToStorage(); // Ensure current editing states are saved
  loadProjects(() => {
    renderProjectsGrid();
    showScreen('project-selector-screen');
  });
}

// Startup Initialization
document.addEventListener('DOMContentLoaded', () => {
  initData();
  
  // Auth Listeners
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  setupSideNav();
  
  // Navigation Listeners
  document.getElementById('btn-back-to-projects').addEventListener('click', showProjectSelectorScreen);
  document.getElementById('btn-create-project').addEventListener('click', createProject);
  
  // Search bar live filter listener
  document.getElementById('project-search-input').addEventListener('input', renderProjectsGrid);
  
  // Bind Header buttons
  document.getElementById('btn-toggle-sidebar').addEventListener('click', toggleEditMode);
  setupHeaderInlineListeners();
  document.getElementById('btn-print').addEventListener('click', printDashboard);
  document.getElementById('btn-cancel-edit').addEventListener('click', cancelEditMode);
  
  // Bind adding sub-activity direct card forms
  document.getElementById('btn-add-subactivity-direct').addEventListener('click', handleAddSubActivity);
  document.getElementById('input-new-subactivity').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleAddSubActivity();
    }
  });
});

function populateSidebar() {
  // Mock function to prevent ReferenceErrors since the sidebar elements were removed from the HTML layout
  console.log("populateSidebar called (no-op)");
}
