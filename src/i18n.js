// English is written inline in the code; Lithuanian lives in lt.js, keyed by the English text.
import { LT } from './lt.js';

const KEY = 'namuciai-lang';
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
export let lang = read() || ((navigator.language || '').toLowerCase().startsWith('lt') ? 'lt' : 'en');
export function setLang(l) { lang = l; try { localStorage.setItem(KEY, l); } catch {} document.documentElement.lang = l; }
document.documentElement.lang = lang;
export const locale = () => (lang === 'lt' ? 'lt-LT' : 'en-GB');

const fill = (s, v) => (v ? s.replace(/\{(\w+)\}/g, (_, k) => (v[k] ?? '')) : s);

/* t('Hello {name}', { name }) */
export function t(en, vars) {
  if (lang === 'lt') { const x = LT[en]; if (typeof x === 'string') return fill(x, vars); }
  return fill(en, vars);
}

/* tn(n, '{n} card', '{n} cards') — Lithuanian keeps three forms under the English plural */
export function tn(n, one, other, vars = {}) {
  const v = { n, ...vars };
  if (lang === 'lt') {
    const x = LT[other];
    if (Array.isArray(x)) {
      const m10 = n % 10, m100 = n % 100;
      const form = m10 === 1 && m100 !== 11 ? 0 : m10 >= 2 && m10 <= 9 && !(m100 >= 11 && m100 <= 19) ? 1 : 2;
      return fill(x[form], v);
    }
  }
  return fill(n === 1 ? one : other, v);
}
