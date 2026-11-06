// Data access of the Portal de Projetos module (table projects_projects).
// Each project is stored as one JSON document, in the same shape the screen uses.
const { transaction } = require('../lib/db');

const ID_PATTERN = /^[\w-]{1,100}$/;

/**
 * Validates one project document.
 * @returns {string|null} Error message, or null when valid.
 */
function validateProject(project) {
  if (!project || typeof project !== 'object' || Array.isArray(project)) return 'Projeto inválido';
  if (typeof project.id !== 'string' || !ID_PATTERN.test(project.id)) return 'Identificador do projeto inválido';
  if (typeof project.name !== 'string' || !project.name.trim() || project.name.length > 300) return 'O projeto precisa de um nome (até 300 caracteres)';
  if (project.activities !== undefined && !Array.isArray(project.activities)) return 'Atividades do projeto inválidas';
  return null;
}

/** All projects in their display order. */
function listProjects(db) {
  return db
    .prepare('SELECT data FROM projects_projects ORDER BY position, created_at')
    .all()
    .map((r) => JSON.parse(r.data));
}

/**
 * Creates or updates one project (new projects go to the end of the list).
 * @returns {'created'|'updated'}
 */
function saveProject(db, project, user = null) {
  const now = new Date().toISOString();
  return transaction(db, () => {
    const exists = db.prepare('SELECT 1 FROM projects_projects WHERE id = ?').get(project.id);
    if (exists) {
      db.prepare('UPDATE projects_projects SET name = ?, data = ?, updated_at = ?, updated_by = ? WHERE id = ?').run(
        project.name,
        JSON.stringify(project),
        now,
        user,
        project.id
      );
      return 'updated';
    }
    const next = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM projects_projects').get().p;
    db.prepare('INSERT INTO projects_projects (id, name, data, position, created_at, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      project.id,
      project.name,
      JSON.stringify(project),
      next,
      now,
      now,
      user
    );
    return 'created';
  });
}

/** @returns {boolean} Whether a project was removed. */
function deleteProject(db, id) {
  return db.prepare('DELETE FROM projects_projects WHERE id = ?').run(id).changes > 0;
}

module.exports = { validateProject, listProjects, saveProject, deleteProject };
