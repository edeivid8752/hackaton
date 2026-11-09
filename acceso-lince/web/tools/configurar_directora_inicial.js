'use strict';
const readline=require('node:readline/promises');
const {randomBytes}=require('node:crypto');
async function main(){
 const rl=readline.createInterface({input:process.stdin,output:process.stdout});
 try{
  process.env.LINCE_DEMO='0';
  const {DatabaseSync}=require('node:sqlite');const path=require('node:path');
  const file=process.env.LINCE_DB||path.join(__dirname,'..','lince-institucional.sqlite');
  // Check only if this database already has an initialized accounts table.
  let existing=false;
  try{const current=new DatabaseSync(file);const has=current.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='accounts'").get();existing=!!has&&current.prepare("SELECT COUNT(*) n FROM accounts WHERE role='direccion'").get().n>0;current.close();}catch(e){if(!/no such table/.test(e.message))throw e;}
  if(existing){console.log('La base ya tiene una cuenta de Dirección. No se recreará ni cambiará la contraseña.');return;}
  console.log('=== ACCESO LINCE V0.5.2: CONFIGURACIÓN INICIAL ===');
  console.log('Base de datos:',file);console.log('No ingreses datos personales reales sin autorización y medidas de protección.');
  const id=(await rl.question('Identificación directiva (ej. DIR-0001): ')).trim().toUpperCase();
  const name=(await rl.question('Nombre de Dirección (ficticio para demo): ')).trim();
  if(!/^[A-Z0-9-]{4,48}$/.test(id)||name.length<3)throw Error('Identificación o nombre inválido.');
  const password=randomBytes(16).toString('base64url');
  process.env.LINCE_BOOTSTRAP_DIRECTOR_ID=id;
  process.env.LINCE_BOOTSTRAP_DIRECTOR_NAME=name;
  process.env.LINCE_BOOTSTRAP_DIRECTOR_PASSWORD=password;
  const {db}=require('../server.js');
  const acc=db.prepare("SELECT login FROM accounts WHERE role='direccion' AND active=1").get();
  if(!acc)throw Error('No se pudo configurar la cuenta de Dirección.');
  db.close();
  console.log('\nCUENTA DIRECTIVA CREADA:');
  console.log('Usuario institucional:',id);
  console.log('Contraseña inicial:',password);
  console.log('Guárdala en un lugar privado: esta es la única vez que se muestra.');
 }finally{rl.close();}
}
main().catch(e=>{console.error('ERROR:',e.message);process.exitCode=1});
