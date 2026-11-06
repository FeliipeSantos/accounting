// Daily scheduler: due logic, catch-up after downtime, retries and busy handling.
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { isDue, computeNextRunAt, startScheduler } = require('../intelligence/scheduler');
const { MonitorBusyError } = require('../intelligence/monitor');
const { createStore } = require('../intelligence/store');

// horários locais, como o servidor os enxerga
const at = (day, time) => new Date(`2026-11-${day}T${time}:00`);
const run = (trigger, startedAt, status, finishedAt = startedAt) => ({
  id: `run-${startedAt.getTime()}`,
  trigger,
  status,
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  sources: [],
});
const data = (runs, runTime = '06:00') => ({ settings: { runTime }, runs });

describe('isDue', () => {
  test('not before the configured time', () => {
    assert.equal(isDue(data([]), at('06', '05:59')), false);
  });

  test('due at or after the configured time when no scheduled run happened today', () => {
    assert.equal(isDue(data([]), at('06', '06:00')), true);
    // servidor ligado só às 14h: recupera a execução perdida
    assert.equal(isDue(data([run('scheduled', at('05', '06:00'), 'success')]), at('06', '14:00')), true);
  });

  test('runs only once a day', () => {
    assert.equal(isDue(data([run('scheduled', at('06', '06:00'), 'success')]), at('06', '18:00')), false);
    assert.equal(isDue(data([run('scheduled', at('06', '06:00'), 'partial')]), at('06', '18:00')), false, 'partial counts as done');
  });

  test('manual and CLI runs do not replace the daily scheduled run', () => {
    assert.equal(isDue(data([run('manual', at('06', '07:00'), 'success'), run('cli', at('06', '07:30'), 'success')]), at('06', '08:00')), true);
  });

  test('a fully failed run is retried after an hour, up to 3 attempts', () => {
    const first = run('scheduled', at('06', '06:00'), 'failed', at('06', '06:01'));
    assert.equal(isDue(data([first]), at('06', '06:30')), false);
    assert.equal(isDue(data([first]), at('06', '07:01')), true);

    const three = [first, run('scheduled', at('06', '07:01'), 'failed', at('06', '07:02')), run('scheduled', at('06', '08:02'), 'failed', at('06', '08:03'))];
    assert.equal(isDue(data(three), at('06', '12:00')), false);
  });

  test('respects a changed run time', () => {
    assert.equal(isDue(data([], '20:30'), at('06', '14:00')), false);
    assert.equal(isDue(data([], '20:30'), at('06', '20:30')), true);
  });
});

describe('computeNextRunAt', () => {
  test('today, tomorrow, now or retry time', () => {
    assert.equal(computeNextRunAt(data([]), at('06', '05:00')), at('06', '06:00').toISOString());
    assert.equal(computeNextRunAt(data([run('scheduled', at('06', '06:00'), 'success')]), at('06', '09:00')), at('07', '06:00').toISOString());
    assert.equal(computeNextRunAt(data([]), at('06', '09:00')), at('06', '09:00').toISOString());
    const failed = run('scheduled', at('06', '06:00'), 'failed', at('06', '06:01'));
    assert.equal(computeNextRunAt(data([failed]), at('06', '06:30')), at('06', '07:01').toISOString());
  });
});

describe('startScheduler', () => {
  let tmpDir;
  let store;
  let handle;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intel-scheduler-'));
    store = createStore(path.join(tmpDir, 'intelligence-db.json'));
  });

  afterEach(() => {
    if (handle) handle.stop();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('catches up on start and then waits for the next day', async () => {
    const calls = [];
    const fakeRun = async (options) => {
      calls.push(options.trigger);
      store.update((d) => d.runs.push(run('scheduled', at('06', '14:00'), 'success')));
    };
    handle = startScheduler({ store, runMonitoring: fakeRun, now: () => at('06', '14:00'), intervalMs: 60000, log: () => {} });
    await handle.check();
    await handle.check();
    assert.deepEqual(calls, ['scheduled'], 'one run, then nothing more today');
  });

  test('postpones when another collection is running', async () => {
    const logs = [];
    const busyRun = async () => {
      throw new MonitorBusyError('busy');
    };
    handle = startScheduler({ store, runMonitoring: busyRun, now: () => at('06', '14:00'), intervalMs: 60000, log: (m) => logs.push(m) });
    await handle.check();
    assert.ok(logs.some((m) => m.includes('adiada')));
    assert.equal(isDue(store.read(), at('06', '14:01')), true, 'still due on the next check');
  });
});
