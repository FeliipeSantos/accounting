// Inteligência Contábil module tables (prefix intel_).
module.exports = {
  name: 'intelligence',
  migrations: [
    {
      version: 1,
      name: 'publications, favorites, runs and settings',
      up(db) {
        db.exec(`
          -- configurações do módulo (valores em JSON): runTime, enabledSources, knownSources, enabledSubjects
          CREATE TABLE intel_settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
          );

          CREATE TABLE intel_source_status (
            source_id       TEXT PRIMARY KEY,
            last_success_at TEXT,
            last_error      TEXT,
            last_error_at   TEXT
          );

          CREATE TABLE intel_runs (
            id              TEXT PRIMARY KEY,
            trigger         TEXT NOT NULL,
            requested_by    TEXT,
            started_at      TEXT NOT NULL,
            finished_at     TEXT,
            status          TEXT NOT NULL,
            new_count       INTEGER NOT NULL DEFAULT 0,
            duplicate_count INTEGER NOT NULL DEFAULT 0,
            error           TEXT,
            sources         TEXT NOT NULL DEFAULT '[]'
          );
          CREATE INDEX intel_runs_started_at ON intel_runs (started_at);

          CREATE TABLE intel_publications (
            id                    TEXT PRIMARY KEY,
            source_id             TEXT NOT NULL,
            external_id           TEXT NOT NULL,
            hash                  TEXT,
            title                 TEXT NOT NULL,
            url                   TEXT NOT NULL,
            published_at          TEXT,
            published_time        TEXT,
            excerpt               TEXT NOT NULL DEFAULT '',
            act_type              TEXT NOT NULL DEFAULT '',
            organ                 TEXT NOT NULL DEFAULT '',
            subjects              TEXT NOT NULL DEFAULT '[]',
            relevance             TEXT NOT NULL,
            norm_type             TEXT,
            effective_date        TEXT,
            classification_reason TEXT,
            collected_at          TEXT NOT NULL,
            -- execução que guardou a publicação (sem FK: execuções antigas são podadas)
            run_id                TEXT,
            -- título + trecho + órgão sem acentos e em minúsculas, para a busca
            search_text           TEXT NOT NULL DEFAULT '',
            UNIQUE (source_id, external_id)
          );
          CREATE INDEX intel_publications_published ON intel_publications (published_at, published_time);
          CREATE INDEX intel_publications_relevance ON intel_publications (relevance);
          CREATE INDEX intel_publications_run ON intel_publications (run_id);
          CREATE INDEX intel_publications_hash ON intel_publications (hash);

          -- assuntos em tabela própria para filtrar e contar por categoria
          CREATE TABLE intel_publication_subjects (
            publication_id TEXT NOT NULL REFERENCES intel_publications (id) ON DELETE CASCADE,
            subject_id     TEXT NOT NULL,
            PRIMARY KEY (publication_id, subject_id)
          );
          CREATE INDEX intel_publication_subjects_subject ON intel_publication_subjects (subject_id);

          CREATE TABLE intel_favorites (
            username       TEXT NOT NULL REFERENCES core_users (username) ON DELETE CASCADE ON UPDATE CASCADE,
            publication_id TEXT NOT NULL REFERENCES intel_publications (id) ON DELETE CASCADE,
            created_at     TEXT NOT NULL,
            PRIMARY KEY (username, publication_id)
          );
        `);
      },
    },
  ],
};
