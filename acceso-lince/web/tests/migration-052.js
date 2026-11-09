'use strict';
// Prueba autónoma: abre una base con el esquema de V0.5.1 y verifica que V0.5.2
// agrega sus tablas sin perder matrícula, contraseña, QR y el registro existente.
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {mkdtempSync,rmSync}=require('node:fs');
const {DatabaseSync}=require('node:sqlite');
const {scryptSync,randomBytes}=require('node:crypto');
const path=require('node:path'),os=require('node:os');
const {createServer}=require('node:net');
(async()=>{
 const tmp=mkdtempSync(path.join(os.tmpdir(),'lince-migrate-'));
 const dbfile=path.join(tmp,'existing.sqlite');
 const db=new DatabaseSync(dbfile);
 db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE people(id INTEGER PRIMARY KEY AUTOINCREMENT,code TEXT UNIQUE NOT NULL,name TEXT NOT NULL,type TEXT NOT NULL,career TEXT NOT NULL DEFAULT '',group_name TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'activo',expires_at TEXT,reason TEXT NOT NULL DEFAULT '',host_name TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,institutional_id TEXT,photo_data TEXT,staff_role TEXT NOT NULL DEFAULT '',first_surname TEXT NOT NULL DEFAULT '');
 CREATE TABLE accounts(id INTEGER PRIMARY KEY AUTOINCREMENT,login TEXT UNIQUE COLLATE NOCASE NOT NULL,role TEXT NOT NULL,person_id INTEGER UNIQUE REFERENCES people(id),salt TEXT NOT NULL,password_hash TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,created_by TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE presence(person_id INTEGER PRIMARY KEY REFERENCES people(id),inside INTEGER NOT NULL DEFAULT 0,entered_at TEXT,last_scan_at TEXT);
 CREATE TABLE access_events(id INTEGER PRIMARY KEY AUTOINCREMENT,person_id INTEGER NOT NULL REFERENCES people(id),action TEXT NOT NULL,happened_at TEXT NOT NULL,gate TEXT NOT NULL DEFAULT 'Acceso principal',operator TEXT NOT NULL DEFAULT 'sistema',note TEXT NOT NULL DEFAULT '');
 CREATE TABLE config(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 `);
 const salt=randomBytes(16).toString('hex'),pw='ClaveDePrueba123!';
 const person=db.prepare("INSERT INTO people(code,name,type,career,group_name,status,created_at,institutional_id,first_surname) VALUES(?,?,?,?,?,?,?,?,?)").run('LIN-MIGRA-3333','Alumno Migración','alumno','Ingeniería en Software','3A','activo',new Date().toISOString(),'26555333','Migracion');
 db.prepare('INSERT INTO accounts(login,role,person_id,salt,password_hash,active,created_by,created_at) VALUES(?,?,?,?,?,1,?,?)').run('26555333','alumno',Number(person.lastInsertRowid),salt,scryptSync(pw,salt,32).toString('hex'),'v0.5.1',new Date().toISOString());
 db.close();
 const port=await new Promise((resolve,reject)=>{const n=createServer();n.once('error',reject);n.listen(0,'127.0.0.1',()=>{const p=n.address().port;n.close(()=>resolve(p));});});
 const base='http://127.0.0.1:'+port;
 const child=spawn(process.execPath,[path.resolve(__dirname,'../server.js')],{env:{...process.env,LINCE_DB:dbfile,LINCE_DEMO:'0',PORT:String(port),LINCE_EXPRESS_PHOTO_KEY_FILE:path.join(tmp,'key')},stdio:'pipe'});
 let log='',checks=0;child.stdout.on('data',x=>log+=x);child.stderr.on('data',x=>log+=x);
 try{
  let ready=false;for(let i=0;i<180;i++){try{if((await fetch(base+'/')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,55));}assert(ready,log);checks++;
  const login=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'26555333',password:pw})});assert.equal(login.status,200);checks++;
  const cookie=login.headers.get('set-cookie').split(';')[0];
  const profile=await (await fetch(base+'/api/profile',{headers:{Cookie:cookie}})).json();assert.equal(profile.profile.code,'LIN-MIGRA-3333');checks++;
  const inspect=new DatabaseSync(dbfile);
  assert.equal(inspect.prepare("SELECT password_hash FROM accounts WHERE login='26555333'").get().password_hash,scryptSync(pw,salt,32).toString('hex'));checks++;
  assert.equal(inspect.prepare("SELECT COUNT(*) n FROM people WHERE institutional_id='26555333'").get().n,1);checks++;
  for(const name of ['guard_devices','guard_device_pairs','express_entries','guard_shifts']){assert(inspect.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name));checks++;}
  inspect.close();console.log('OK migración V0.5.1 → V0.5.2: '+checks+' verificaciones; cuenta, contraseña, QR y datos intactos.');
 }finally{child.kill('SIGTERM');await new Promise(r=>{child.once('exit',r);setTimeout(r,300)});rmSync(tmp,{recursive:true,force:true});}
})().catch(e=>{console.error('FALLO migración:',e);process.exitCode=1});
