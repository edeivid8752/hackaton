'use strict';
// Pruebas de integración con servidor temporal y base de datos desechable.
const assert=require('node:assert/strict');const {mkdtempSync,rmSync}=require('node:fs');const os=require('node:os');const path=require('node:path');const {spawn}=require('node:child_process');
(async()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'lince-test-'));const db=path.join(dir,'test.sqlite');
 const port=31000+Math.floor(Math.random()*10000),base=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,[path.join(__dirname,'../server.js')],{env:{...process.env,PORT:String(port),LINCE_DB:db,LINCE_DEMO:'1'},stdio:'pipe'});
 let log='';child.stderr.on('data',c=>log+=c.toString());child.stdout.on('data',c=>log+=c.toString());
 try{
  let ready=false;for(let i=0;i<70;i++){try{const r=await fetch(base+'/');if(r.ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,70))}assert(ready,'El servidor no arrancó: '+log);
  let n=0;
  async function req(route,opt={},cookie=''){const result=await fetch(base+route,{...opt,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})}});const json=await result.json().catch(()=>({}));return {status:result.status,body:json,headers:result.headers}}
  async function login(username,password){const r=await req('/api/login',{method:'POST',body:JSON.stringify({username,password})});assert.equal(r.status,200,username+': login');return r.headers.get('set-cookie').split(';')[0]}
  const admin=await login('admin','Admin123!'),guard=await login('guardia','Guardia123!'),director=await login('direccion','Direccion123!');n+=3;
  const bad=await req('/api/login',{method:'POST',body:JSON.stringify({username:'admin',password:'incorrecta'})});assert.equal(bad.status,401);n++;
  let stats=await req('/api/stats',{},admin);assert.equal(stats.body.total,0);n++;
  let scan=await req('/api/scan',{method:'POST',body:JSON.stringify({code:'LIN-1001'})},guard);assert.equal(scan.status,200);assert.equal(scan.body.action,'entrada');n++;
  scan=await req('/api/scan',{method:'POST',body:JSON.stringify({code:'LIN-1001'})},guard);assert.equal(scan.status,422);assert.equal(scan.body.rebound,true);n++;
  stats=await req('/api/stats',{},admin);assert.equal(stats.body.total,1);assert.equal(stats.body.alumnos,1);n++;
  scan=await req('/api/scan',{method:'POST',body:JSON.stringify({code:'LIN-9001'})},guard);assert.equal(scan.status,422);assert.match(scan.body.reason,/inactivo/);n++;
  scan=await req('/api/scan',{method:'POST',body:JSON.stringify({code:'LIN-2001'})},guard);assert.equal(scan.status,200);n++;
  stats=await req('/api/stats',{},admin);assert.equal(stats.body.total,2);assert.equal(stats.body.personal,1);n++;
  const denied=await req('/api/people',{},guard);assert.equal(denied.status,403);n++;
  const visitor=await req('/api/visitors',{method:'POST',body:JSON.stringify({name:'Visitante ficticio',type:'proveedor',reason:'Mantenimiento',host_name:'Coordinación',hours:2})},guard);assert.equal(visitor.status,201);assert.match(visitor.body.code,/^VIS-/);n++;
  scan=await req('/api/scan',{method:'POST',body:JSON.stringify({code:visitor.body.code})},guard);assert.equal(scan.status,200);n++;
  stats=await req('/api/stats',{},director);assert.equal(stats.body.total,3);assert.equal(stats.body.externos,1);n++;
  const settingsDenied=await req('/api/settings',{method:'POST',body:JSON.stringify({capacity:400,special_until:''})},director);assert.equal(settingsDenied.status,200);n++;
  const settings=await req('/api/settings',{method:'POST',body:JSON.stringify({capacity:400,special_until:''})},admin);assert.equal(settings.status,200);n++;
  const history=await req('/api/history',{},admin);assert.equal(history.status,200);assert.equal(history.body.length,3);n++;
  const created=await req('/api/people',{method:'POST',body:JSON.stringify({name:'Nueva Persona',type:'alumno',institutional_id:'25057777',code:'LIN-7777',career:'Ingeniería en Software',group_name:'7A',status:'activo'})},admin);assert.equal(created.status,201);n++;
  const peeps=await req('/api/people?q=LIN-7777',{},admin);assert.equal(peeps.body.length,1);n++;
  const noAuth=await req('/api/stats');assert.equal(noAuth.status,401);n++;
  const qr=await fetch(base+'/credenciales.html');assert.equal(qr.status,404);n++; // El catálogo de credenciales DEMO se retira de la edición limpia
  console.log(`OK: ${n} verificaciones de integración superadas.`);
 } finally {child.kill('SIGTERM');await new Promise(r=>{child.once('exit',r);setTimeout(r,300)});rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error('FALLO:',e);process.exitCode=1});
