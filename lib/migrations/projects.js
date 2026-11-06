// Portal de Projetos tables (prefix projects_).
module.exports = {
  name: 'projects',
  migrations: [
    {
      version: 1,
      name: 'projects',
      up(db) {
        db.exec(`
          -- cada projeto é um documento JSON (atividades, subatividades, kanban...) no formato da tela
          CREATE TABLE projects_projects (
            id         TEXT PRIMARY KEY,
            name       TEXT NOT NULL,
            data       TEXT NOT NULL,
            position   INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            updated_by TEXT REFERENCES core_users (username) ON DELETE SET NULL ON UPDATE CASCADE
          );
          CREATE INDEX projects_projects_position ON projects_projects (position);
        `);
      },
    },
  ],
};
