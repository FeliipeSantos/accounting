// Core module tables: users and login sessions.
module.exports = {
  name: 'core',
  migrations: [
    {
      version: 1,
      name: 'users and sessions',
      up(db) {
        db.exec(`
          CREATE TABLE core_users (
            username      TEXT PRIMARY KEY,
            password_hash TEXT NOT NULL,
            created_at    TEXT NOT NULL,
            updated_at    TEXT NOT NULL
          );

          -- o token nunca é guardado: só o hash SHA-256 dele
          CREATE TABLE core_sessions (
            token_hash TEXT    PRIMARY KEY,
            username   TEXT    NOT NULL REFERENCES core_users (username) ON DELETE CASCADE ON UPDATE CASCADE,
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL
          );
          CREATE INDEX core_sessions_expires_at ON core_sessions (expires_at);
        `);
      },
    },
  ],
};
