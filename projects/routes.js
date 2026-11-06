// HTTP routes of the Portal de Projetos, mounted at /api/projects.
//   GET    /api/projects       -> all projects, in display order
//   PUT    /api/projects/:id   -> creates or updates ONE project
//   DELETE /api/projects/:id   -> removes one project
// Saving one project at a time means two people editing different projects
// never overwrite each other.
const repo = require('./repository');

const PREFIX = '/api/projects';
const MAX_BODY_BYTES = 2 * 1024 * 1024;

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Projeto muito grande'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('JSON inválido'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Builds the /api/projects handler (the user comes from the validated session).
 * @param {{ db: import('node:sqlite').DatabaseSync }} deps
 */
function createProjectsHandler({ db }) {
  return async function handle(req, res) {
    const pathname = req.url.split('?')[0];
    const idMatch = pathname.match(/^\/api\/projects\/([^/]+)$/);
    const id = idMatch ? decodeURIComponent(idMatch[1]) : null;

    try {
      if (pathname === PREFIX && req.method === 'GET') {
        sendJson(res, 200, repo.listProjects(db));
        return;
      }

      if (id && req.method === 'PUT') {
        const project = await readJsonBody(req);
        if (project && typeof project === 'object' && !Array.isArray(project) && project.id === undefined) project.id = id;
        const error = repo.validateProject(project);
        if (error) {
          sendJson(res, 400, { error });
          return;
        }
        if (project.id !== id) {
          sendJson(res, 400, { error: 'O identificador do projeto não confere com o endereço' });
          return;
        }
        const result = repo.saveProject(db, project, req.authUser || null);
        sendJson(res, result === 'created' ? 201 : 200, { success: true, id, result });
        return;
      }

      if (id && req.method === 'DELETE') {
        // lê (e descarta) um eventual corpo inteiro antes de responder: responder antes
        // dele chegar faz o Node derrubar a conexão
        await new Promise((resolve) => {
          req.on('end', resolve);
          req.on('error', resolve);
          req.resume();
        });
        if (!repo.deleteProject(db, id)) {
          sendJson(res, 404, { error: 'Projeto não encontrado' });
          return;
        }
        sendJson(res, 200, { success: true, id });
        return;
      }

      sendJson(res, 404, { error: 'Rota não encontrada' });
    } catch (err) {
      if (err.status) {
        sendJson(res, err.status, { error: err.message });
        return;
      }
      console.error('[projects] erro na rota', req.method, pathname, err);
      sendJson(res, 500, { error: 'Erro interno do Portal de Projetos' });
    }
  };
}

module.exports = { PREFIX, createProjectsHandler };
