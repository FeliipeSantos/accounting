// User management in the database.
//   npm run user -- list
//   npm run user -- add <usuario>       (asks the password in the terminal)
//   npm run user -- passwd <usuario>    (also ends the user's open sessions)
//   npm run user -- remove <usuario>
// Passwords are never taken from the command line, so they stay out of the shell history.
const readline = require('readline');
const { getDatabase } = require('./db');
const users = require('./users');

/**
 * Reads a line without echoing it when attached to a terminal.
 */
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
    if (process.stdin.isTTY) {
      // oculta a senha digitada
      rl._writeToOutput = (text) => {
        if (text.includes(question)) rl.output.write(text);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (process.stdin.isTTY) process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function askNewPassword() {
  const password = await askHidden(`Senha (mín. ${users.MIN_PASSWORD_LENGTH} caracteres): `);
  const confirm = process.stdin.isTTY ? await askHidden('Repita a senha: ') : password;
  if (password !== confirm) throw new Error('As senhas não conferem.');
  return password;
}

async function main() {
  const [command, username] = process.argv.slice(2);
  const db = getDatabase();

  switch (command) {
    case 'list': {
      const rows = users.listUsers(db);
      if (!rows.length) console.log('Nenhum usuário cadastrado.');
      rows.forEach((u) => console.log(`${u.username}  (criado em ${u.created_at.slice(0, 10)}, alterado em ${u.updated_at.slice(0, 10)})`));
      return;
    }
    case 'add':
      if (!username) throw new Error('Uso: npm run user -- add <usuario>');
      users.createUser(db, username, { password: await askNewPassword() });
      console.log(`Usuário "${username}" criado.`);
      return;
    case 'passwd':
      if (!username) throw new Error('Uso: npm run user -- passwd <usuario>');
      users.setPassword(db, username, await askNewPassword());
      console.log(`Senha de "${username}" alterada; as sessões abertas dele foram encerradas.`);
      return;
    case 'remove':
      if (!username) throw new Error('Uso: npm run user -- remove <usuario>');
      users.removeUser(db, username);
      console.log(`Usuário "${username}" removido.`);
      return;
    default:
      throw new Error('Comandos: list | add <usuario> | passwd <usuario> | remove <usuario>');
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
