// Development: starts the backend (python run.py, port 8080) and the screen with live
// reload (Vite, port 5173) together. Usage, from the project root: npm run dev
// Ctrl+C stops both.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const windows = process.platform === 'win32';
const python = join(root, 'backend', '.venv', windows ? 'Scripts/python.exe' : 'bin/python');

const missing = [];
if (!existsSync(python)) {
  missing.push('Backend sem ambiente Python. Rode:\n  cd backend\n  py -3.12 -m venv .venv\n  .venv\\Scripts\\pip install -r requirements-dev.txt');
}
if (!existsSync(join(root, 'frontend', 'node_modules'))) {
  missing.push('Tela sem dependências. Rode:\n  cd frontend\n  npm install');
}
if (missing.length) {
  console.error(`Antes do primeiro "npm run dev":\n\n${missing.join('\n\n')}`);
  process.exit(1);
}

const children = [];

function start(label, command, args, cwd) {
  const child = spawn(command, args, { cwd, shell: windows && command === 'npm', env: { ...process.env, PYTHONUTF8: '1' } });
  const prefix = (stream, target) => {
    let rest = '';
    stream.on('data', (chunk) => {
      const lines = (rest + chunk.toString()).split(/\r?\n/);
      rest = lines.pop();
      lines.forEach((line) => target.write(`[${label}] ${line}\n`));
    });
  };
  prefix(child.stdout, process.stdout);
  prefix(child.stderr, process.stderr);
  child.on('exit', (code) => {
    console.log(`[${label}] encerrado (código ${code ?? 0})`);
    stopAll();
  });
  children.push(child);
}

let stopping = false;
function stopAll() {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null) continue;
    // no Windows, encerra também os processos filhos (o python da venv e o vite)
    if (windows) spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else child.kill();
  }
}

process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);

start('backend', python, ['run.py'], join(root, 'backend'));
start('tela', 'npm', ['run', 'dev'], join(root, 'frontend'));
console.log('Abra http://localhost:5173 (a tela repassa /api ao backend na porta 8080). Ctrl+C encerra os dois.');
