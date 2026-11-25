// Estrae il blocco MODEL da index.html e lo esegue in Node.
// Variante opzionale per i test: MODVAR='{"K":{"VS":5},"L0":{"vast":0.112}}' cambia costanti e lunghezze ottimali delle fibre (m).
const fs = require('fs'), path = require('path');
module.exports = function load(file = path.join(__dirname, '..', 'index.html')) {
  const html = fs.readFileSync(file, 'utf8');
  const a = html.indexOf('const MODEL = (() => {'), b = html.indexOf("if (typeof module !== 'undefined') module.exports = MODEL;");
  if (a < 0 || b < 0) throw new Error('blocco MODEL non trovato');
  const M = new Function(html.slice(a, b) + '\nreturn MODEL;')();
  if (process.env.MODVAR) { const v = JSON.parse(process.env.MODVAR);
    Object.assign(M.K, v.K || {});
    for (const m of M.MUSCLES) { if (v.A && v.A[m.id]) m.A = v.A[m.id]; if (v.L0 && v.L0[m.id]) m.L0 = v.L0[m.id]; if (v.Ls && v.Ls[m.id]) m.Ls = v.Ls[m.id]; } }
  return M;
};
