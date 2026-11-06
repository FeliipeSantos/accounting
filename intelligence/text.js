// Text helpers shared by collectors and classifier. Output is plain text only.

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ordm: 'º', ordf: 'ª', sect: '§', ndash: '–', mdash: '—',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…', deg: '°',
};

function decodeEntities(text) {
  return String(text)
    .replace(/&#(\d+);/g, (_, n) => safeCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => safeCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => {
      const lower = name.toLowerCase();
      if (NAMED_ENTITIES[lower] !== undefined) return NAMED_ENTITIES[lower];
      // letras acentuadas: &aacute; &ccedil; &atilde; ...
      const accent = name.match(/^([a-z])(acute|grave|circ|tilde|uml|cedil)$/i);
      if (accent) return `${accent[1]}${{ acute: '́', grave: '̀', circ: '̂', tilde: '̃', uml: '̈', cedil: '̧' }[accent[2].toLowerCase()]}`.normalize('NFC');
      return m;
    });
}

function safeCodePoint(n) {
  return Number.isInteger(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
}

/**
 * Converts an HTML fragment into clean plain text (scripts/styles dropped).
 * @param {string} html
 * @param {number} [maxLength] Output cap; pass Infinity to parse whole pages.
 */
function htmlToText(html, maxLength = 2000) {
  return cleanText(
    decodeEntities(
      String(html)
        .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|h\d)>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
    ),
    maxLength
  );
}

/**
 * Collapses whitespace, strips control characters and caps the length.
 */
function cleanText(text, maxLength = 2000) {
  const cleaned = String(text || '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 1).trimEnd()}…` : cleaned;
}

/**
 * Lowercase, accent-free text used for keyword matching.
 */
function normalizeForMatch(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[º°ª]/g, ' ')
    .replace(/\s+/g, ' ');
}

const MONTHS = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

function toIsoDate(year, month, day) {
  const y = Number(year < 100 ? 2000 + Number(year) : year);
  const m = Number(month);
  const d = Number(day);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

/**
 * Parses "dd/mm/yyyy", "dd.mm.yy" or "dd de <mês> de yyyy" into yyyy-mm-dd.
 */
function parseBrDate(text) {
  if (!text) return null;
  const numeric = String(text).match(/(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})/);
  if (numeric) return toIsoDate(numeric[3], numeric[2], numeric[1]);
  const written = normalizeForMatch(text).match(/(\d{1,2})\s*(?:o\s*)?de\s+([a-z]+)\s+de\s+(\d{4})/);
  if (written && MONTHS[written[2]]) return toIsoDate(written[3], MONTHS[written[2]], written[1]);
  return null;
}

/**
 * Local calendar date (yyyy-mm-dd) of a Date, avoiding UTC day shifts.
 */
function localIsoDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

module.exports = { decodeEntities, htmlToText, cleanText, normalizeForMatch, parseBrDate, localIsoDate, addDays, MONTHS };
