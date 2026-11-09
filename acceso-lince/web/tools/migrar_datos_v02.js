'use strict';
// Copia consistente mediante SQLite VACUUM INTO, sin alterar la V0.2.
// Deben estar cerrados AMBOS servidores antes de ejecutarlo.
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const oldPath = path.resolve(process.argv[2] || '');
const target = path.resolve(__dirname, '..', 'lince-data.sqlite');
if (!process.argv[2] || !fs.existsSync(oldPath) || path.extname(oldPath).toLowerCase() !== '.sqlite') {
  console.error('ERROR: Indica la ruta completa del archivo lince-data.sqlite de V0.2.');
  process.exit(2);
}
if (oldPath === target) { console.error('ERROR: no se permite usar como origen la propia base V0.3.'); process.exit(2); }
let old = null, backup = null;
try {
  old = new DatabaseSync(oldPath, {readOnly:true});
  const found = old.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='people'").get();
  if (!found) throw new Error('La base origen no contiene la tabla people.');
  const count = old.prepare('SELECT COUNT(*) AS total FROM people').get().total;
  if (fs.existsSync(target)) {
    backup = path.join(path.dirname(target), 'lince-data-respaldo-'+new Date().toISOString().replace(/[:.]/g,'-')+'.sqlite');
    fs.renameSync(target,backup);
  }
  try {
    old.prepare('VACUUM INTO ?').run(target);
  } catch (e) {
    if (fs.existsSync(target)) fs.rmSync(target,{force:true});
    if (backup) fs.renameSync(backup,target);
    throw e;
  }
  console.log('IMPORTACIÓN CORRECTA: '+count+' personas de V0.2 conservadas.');
  console.log('Nueva copia V0.3: '+target);
  if (backup) console.log('Respaldo anterior V0.3: '+backup);
  console.log('La base V0.2 original no fue modificada.');
} catch(e) {
  console.error('ERROR AL MIGRAR: '+e.message);
  process.exitCode=1;
} finally { if (old) old.close(); }
