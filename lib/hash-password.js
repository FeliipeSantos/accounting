// Generates a password hash for AUTH_USERS.
// Usage: npm run auth:hash -- <usuario>   (the password is read from the terminal, not from the command line)
const readline = require('readline');
const { hashPassword } = require('./auth');

const user = process.argv[2];
if (!user || !/^[\w.@-]{1,64}$/.test(user)) {
  console.error('Uso: npm run auth:hash -- <usuario>');
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
// oculta a senha digitada
rl._writeToOutput = (text) => {
  if (text.includes('Senha')) rl.output.write(text);
};
rl.question('Senha (mín. 10 caracteres): ', (password) => {
  rl.close();
  process.stdout.write('\n');
  if (password.length < 10) {
    console.error('Senha muito curta: use pelo menos 10 caracteres.');
    process.exit(1);
  }
  console.log('\nAdicione ao .env (vários usuários separados por vírgula):\n');
  console.log(`AUTH_USERS=${user}:${hashPassword(password)}`);
});
