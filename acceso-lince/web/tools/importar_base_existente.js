'use strict';
// Importación segura de una copia SQLite existente sin mezclar las instalaciones.
// Los servidores de origen y destino deben estar detenidos.
const fs=require('node:fs'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const source=path.resolve(process.argv[2]||''),destination=path.resolve(__dirname,'..','lince-data.sqlite');
const dir=path.dirname(destination);
if(!process.argv[2]||!fs.existsSync(source)||path.extname(source).toLowerCase()!=='.sqlite'){
 console.error('ERROR: arrastra a IMPORTAR_BASE_EXISTENTE.bat el archivo lince-data.sqlite de tu servidor V0.3.1.');process.exit(2);
}
if(source===destination){console.error('ERROR: ya estás usando la base de esta versión.');process.exit(2);}
let old;
try{
 old=new DatabaseSync(source,{readOnly:true});
 if(!old.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='people'").get()) throw new Error('La base origen no es LINCE ACCESS.');
 const sourceCount=old.prepare('SELECT COUNT(*) n FROM people').get().n;
 const stamp=new Date().toISOString().replace(/[:.]/g,'-');
 const temporary=path.join(dir,`lince-importando-${stamp}.sqlite`);
 try{old.prepare('VACUUM INTO ?').run(temporary);}finally{old.close();old=null;}
 const backup=path.join(dir,'RESPALDO_ANTES_DE_IMPORTAR_'+stamp);
 const sourceFiles=[destination,destination+'-wal',destination+'-shm'].filter(fs.existsSync);
 if(sourceFiles.length){fs.mkdirSync(backup,{recursive:true});for(const file of sourceFiles)fs.renameSync(file,path.join(backup,path.basename(file)));}
 try{fs.renameSync(temporary,destination);}
 catch(e){if(fs.existsSync(temporary))fs.rmSync(temporary,{force:true});for(const file of sourceFiles)fs.renameSync(path.join(backup,path.basename(file)),file);throw e;}
 console.log('\nIMPORTACIÓN CORRECTA: '+sourceCount+' personas y sus movimientos preservados.');
 console.log('Base nueva: '+destination);
 if(sourceFiles.length)console.log('Respaldo de la base anterior en: '+backup);
 console.log('La base original de V0.3.1 no fue modificada.\n');
}catch(e){if(old)old.close();console.error('NO SE IMPORTÓ: '+e.message);process.exitCode=1;}
