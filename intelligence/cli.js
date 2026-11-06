// Command line entry points:
//   npm run intel:run         -> runs one monitoring cycle now
//   npm run intel:reclassify  -> re-applies the classification rules to stored publications
//   npm run intel:check       -> tests access to every source without storing anything
const { runMonitoring, reclassifyAll } = require('./monitor');
const { SOURCES } = require('./catalog');
const collectors = require('./collectors');
const http = require('./http');
const { localIsoDate, addDays } = require('./text');

const names = Object.fromEntries(SOURCES.map((s) => [s.id, s.name]));
const command = process.argv[2] || 'run';

async function run() {
  const result = await runMonitoring({ trigger: 'cli' });
  console.log(`\nStatus: ${result.status} | novas: ${result.newCount} | duplicadas: ${result.duplicateCount}`);
  for (const s of result.sources) {
    const detail = s.status === 'error' ? `ERRO: ${s.error}` : `${s.fetched} lidas, ${s.relevant} relevantes, ${s.newCount} novas`;
    console.log(`- ${names[s.sourceId] || s.sourceId}: ${detail} (${(s.durationMs / 1000).toFixed(1)}s)`);
  }
  return result.status === 'failed' ? 1 : 0;
}

function reclassify() {
  const result = reclassifyAll();
  console.log(`Reclassificadas: ${result.updated} | removidas (sem assunto monitorado): ${result.removed} | favoritas mantidas sem assunto: ${result.keptFavorites}`);
  return 0;
}

/**
 * Reads every collectable source (last 7 days) and reports what came back.
 * Nothing is written: safe to run on a new server to confirm the official sites
 * accept requests from its IP.
 */
async function check() {
  const today = localIsoDate();
  const since = addDays(today, -7);
  console.log(`Verificando acesso às fontes oficiais (últimos 7 dias, fuso ${Intl.DateTimeFormat().resolvedOptions().timeZone})...\n`);
  const results = await Promise.all(
    SOURCES.filter((s) => s.collectable).map(async (source) => {
      const started = Date.now();
      try {
        const items = await collectors[source.id].collect({ fetchText: http.fetchText, fetchJson: http.fetchJson, today, since, isKnown: () => true });
        return { source, ok: true, detail: `${items.length} item(ns) lido(s)`, ms: Date.now() - started };
      } catch (err) {
        return { source, ok: false, detail: err.message, ms: Date.now() - started };
      }
    })
  );
  for (const r of results) {
    console.log(`${r.ok ? 'OK  ' : 'ERRO'} ${r.source.name}: ${r.detail} (${(r.ms / 1000).toFixed(1)}s)`);
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} de ${results.length} fontes acessíveis.`);
  return failed ? 1 : 0;
}

const commands = { run, reclassify, check };

if (!commands[command]) {
  console.error(`Comando desconhecido: ${command}. Use "run", "reclassify" ou "check".`);
  process.exitCode = 1;
} else {
  Promise.resolve()
    .then(commands[command])
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      console.error(err.message);
      process.exitCode = 1;
    });
}
