// Restricted HTTP client for collectors: official hosts only, timeout and size cap.

const USER_AGENT = 'project-accounting-monitor/1.0 (+Inteligencia Contabil; coleta diaria de fontes oficiais)';
const DEFAULT_TIMEOUT_MS = 20000;
const MAX_BYTES = 5 * 1024 * 1024;

// Domínios oficiais permitidos (Executivo e Legislativo federal)
const OFFICIAL_DOMAINS = ['gov.br', 'leg.br'];

/**
 * True when the URL is http(s) on an official government domain.
 */
function isOfficialUrl(url) {
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== 'https:' && protocol !== 'http:') return false;
    return OFFICIAL_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

class CollectorHttpError extends Error {}

async function readLimited(res) {
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new CollectorHttpError(`Resposta acima do limite de ${MAX_BYTES / 1024 / 1024} MB`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

const RETRY_DELAY_MS = 2000;

/**
 * Fetches a text resource from an official host, retrying once on
 * timeouts, connection errors and 5xx responses.
 * @param {string} url
 * @param {{ timeoutMs?: number, accept?: string }} [options]
 * @returns {Promise<string>}
 */
async function fetchText(url, options = {}) {
  try {
    return await fetchOnce(url, options);
  } catch (err) {
    if (!err.retryable) throw err;
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return fetchOnce(url, options);
  }
}

async function fetchOnce(url, options) {
  if (!isOfficialUrl(url)) throw new CollectorHttpError(`URL fora dos domínios oficiais: ${url}`);

  let res;
  try {
    res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(options.timeoutMs || DEFAULT_TIMEOUT_MS),
      headers: { 'User-Agent': USER_AGENT, Accept: options.accept || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
    });
  } catch (err) {
    const reason = err.name === 'TimeoutError' ? 'tempo limite esgotado' : err.cause?.code || err.message;
    throw Object.assign(new CollectorHttpError(`Falha de conexão (${reason})`), { retryable: true });
  }

  // o redirecionamento não pode levar para fora dos domínios oficiais
  if (!isOfficialUrl(res.url)) throw new CollectorHttpError(`Redirecionado para domínio não oficial: ${res.url}`);
  if (!res.ok) throw Object.assign(new CollectorHttpError(`HTTP ${res.status}`), { retryable: res.status >= 500 });
  return readLimited(res);
}

/**
 * Fetches and parses a JSON resource from an official host.
 */
async function fetchJson(url, options = {}) {
  const text = await fetchText(url, { ...options, accept: 'application/json' });
  try {
    return JSON.parse(text);
  } catch {
    throw new CollectorHttpError('Resposta JSON inválida');
  }
}

module.exports = { fetchText, fetchJson, isOfficialUrl, CollectorHttpError };
