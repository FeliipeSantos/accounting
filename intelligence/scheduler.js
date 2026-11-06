// Daily automatic monitoring, running inside the server process (no user needs to
// be connected). The decision is derived from the run history, so it survives
// restarts: if the server was off at the configured time, it catches up on start.
const monitor = require('./monitor');
const { createStore } = require('./store');

const CHECK_INTERVAL_MS = 60 * 1000;
// Execução agendada que falhou por completo (ex.: sem internet) é repetida algumas vezes no dia
const MAX_FAILED_ATTEMPTS_PER_DAY = 3;
const RETRY_AFTER_FAILURE_MS = 60 * 60 * 1000;

/**
 * Today's slot (local time) for the configured "HH:MM".
 */
function slotFor(date, runTime) {
  const [hours, minutes] = runTime.split(':').map(Number);
  const slot = new Date(date);
  slot.setHours(hours, minutes, 0, 0);
  return slot;
}

/**
 * Decides whether a scheduled run is due now, based on today's scheduled runs.
 * @param {{ settings: { runTime: string }, runs: object[] }} data
 * @param {Date} now
 * @returns {boolean}
 */
function isDue(data, now) {
  const slot = slotFor(now, data.settings.runTime);
  if (now < slot) return false;

  const todays = data.runs.filter((r) => r.trigger === 'scheduled' && new Date(r.startedAt) >= slot);
  if (todays.some((r) => r.status === 'success' || r.status === 'partial' || r.status === 'running')) return false;

  const failed = todays.filter((r) => r.status === 'failed');
  if (failed.length >= MAX_FAILED_ATTEMPTS_PER_DAY) return false;
  const lastFailure = failed.length ? new Date(failed[failed.length - 1].finishedAt || failed[failed.length - 1].startedAt) : null;
  return !lastFailure || now - lastFailure >= RETRY_AFTER_FAILURE_MS;
}

/**
 * Next moment a scheduled run will happen (now, when one is due).
 * @returns {string} ISO timestamp.
 */
function computeNextRunAt(data, now = new Date()) {
  if (isDue(data, now)) return now.toISOString();
  const today = slotFor(now, data.settings.runTime);
  const todays = data.runs.filter((r) => r.trigger === 'scheduled' && new Date(r.startedAt) >= today);
  const failed = todays.filter((r) => r.status === 'failed');
  const doneToday = now >= today && (todays.some((r) => r.status !== 'failed') || failed.length >= MAX_FAILED_ATTEMPTS_PER_DAY);

  if (now < today) return today.toISOString();
  if (!doneToday && failed.length) {
    const last = failed[failed.length - 1];
    return new Date(new Date(last.finishedAt || last.startedAt).getTime() + RETRY_AFTER_FAILURE_MS).toISOString();
  }
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString();
}

function isSchedulerEnabled() {
  return process.env.INTEL_SCHEDULER !== 'off';
}

/**
 * Starts the periodic check. Returns a handle to stop it.
 * @param {{ store?: object, runMonitoring?: Function, now?: () => Date, intervalMs?: number, log?: Function }} [options]
 */
function startScheduler(options = {}) {
  const store = options.store || createStore();
  const run = options.runMonitoring || monitor.runMonitoring;
  const now = options.now || (() => new Date());
  const log = options.log || ((msg) => console.log(`[intelligence] ${msg}`));
  let checking = false;

  async function check() {
    if (checking) return;
    checking = true;
    try {
      if (!isDue(store.read(), now())) return;
      log('execução agendada iniciada');
      await run({ trigger: 'scheduled', store });
    } catch (err) {
      // ocupado (coleta manual em andamento): tenta de novo na próxima verificação
      if (err instanceof monitor.MonitorBusyError) log('execução agendada adiada: outra coleta em andamento');
      else log(`falha na execução agendada: ${err.message}`);
    } finally {
      checking = false;
    }
  }

  const timer = setInterval(check, options.intervalMs || CHECK_INTERVAL_MS);
  // primeira verificação logo após iniciar (recupera execução perdida com o servidor desligado)
  const first = setTimeout(check, 0);
  const settings = store.read().settings;
  log(`agendamento ativo: diariamente às ${settings.runTime}; próxima execução ${new Date(computeNextRunAt(store.read(), now())).toLocaleString('pt-BR')}`);

  return {
    check,
    stop() {
      clearInterval(timer);
      clearTimeout(first);
    },
  };
}

module.exports = { startScheduler, isDue, computeNextRunAt, isSchedulerEnabled };
