// Estrae il blocco MODEL da banco-biomeccanico.html e lo esegue in Node
const fs = require('fs'), path = require('path');
module.exports = function load(file = path.join(__dirname, '..', 'index.html')) {
  const html = fs.readFileSync(file, 'utf8');
  const a = html.indexOf('const MODEL = (() => {'), b = html.indexOf("if (typeof module !== 'undefined') module.exports = MODEL;");
  if (a < 0 || b < 0) throw new Error('blocco MODEL non trovato');
  return new Function(html.slice(a, b) + '\nreturn MODEL;')();
};
