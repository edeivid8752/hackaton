'use strict';
// Regression tests focused on ADMIN V0.4 role isolation and shared Android API.
const assert=require('node:assert/strict');
const {mkdtempSync,rmSync,readFileSync,existsSync}=require('node:fs');
const {spawn}=require('node:child_process');
const os=require('node:os'),path=require('node:path');
(async()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'lince-admin-v04-'));
 const port=48000+Math.floor(Math.random()*9000),base=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,[path.join(__dirname,'..','server.js')],{env:{...process.env,PORT:String(port),HOST:'127.0.0.1',LINCE_DB:path.join(dir,'check.sqlite'),LINCE_DEMO:'1'},stdio:'pipe'});
 let n=0;
 try{
  let started=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/')).ok){started=true;break;}}catch{}await new Promise(r=>setTimeout(r,50));}assert(started,'Sin servidor');n++;
  const html=await(await fetch(base+'/')).text();
  for(const required of ['view-dashboard','view-visitors','view-history','view-people','view-reports','view-settings','appearanceSettings','uadeo-logo.png','sidebarCollapseToggle']){assert(html.includes(required),required);n++;}
  for(const retired of ['data-view="kiosk"','id="scanForm"','id="cameraBtn"','data-demo="guardia"','href="/guard.html"']){assert(!html.includes(retired),'Todavía aparece '+retired);n++;}
  assert.equal((await fetch(base+'/guard.html')).status,404);n++;
  async function req(route,method='GET',body=null,cookie=''){
   const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(cookie?{'Cookie':cookie}:{})},body:body?JSON.stringify(body):undefined});let obj;try{obj=await r.json()}catch{obj={}};return {status:r.status,obj,cookie:r.headers.get('set-cookie')?.split(';')[0]};
  }
  async function login(username,password){const r=await req('/api/login','POST',{username,password});assert.equal(r.status,200);n++;return r.cookie;}
  const admin=await login('admin','Admin123!'),direction=await login('direccion','Direccion123!'),guard=await login('guardia','Guardia123!');
  let r=await req('/api/scan','POST',{code:'LIN-1001'},admin);assert.equal(r.status,403);n++;
  r=await req('/api/scan','POST',{code:'LIN-1001'},direction);assert.equal(r.status,403);n++;
  r=await req('/api/scan','POST',{code:'LIN-1001'},guard);assert.equal(r.status,200);assert.equal(r.obj.action,'entrada');n+=2;
  r=await req('/api/settings','POST',{capacity:501,special_until:''},direction);assert.equal(r.status,200);n++;
  r=await req('/api/settings','POST',{capacity:501,special_until:''},admin);assert.equal(r.status,200);n++;
  r=await req('/api/stats','GET',null,direction);assert.equal(r.obj.total,1);assert.equal(r.obj.capacity,501);n+=2;
  r=await req('/api/people','POST',{code:'LIN-4560',name:'Estudiante de pruebas',type:'alumno',institutional_id:'25054560',status:'activo'},admin);assert.equal(r.status,201);n++;
  let people=await req('/api/people?q=LIN-4560','GET',null,admin);const id=people.obj[0].id;assert(id>0);n++;
  r=await req('/api/people/'+id,'PATCH',{status:'inactivo'},direction);assert.equal(r.status,200);n++;
  r=await req('/api/people/'+id,'PATCH',{status:'inactivo'},admin);assert.equal(r.status,200);n++;
  r=await req('/api/people?q=LIN-4560','GET',null,direction);assert.equal(r.obj[0].status,'inactivo');n++;
  r=await req('/api/visitors','POST',{name:'Visitante ficticio para pruebas',type:'visitante',reason:'Prueba de acceso',host_name:'Laboratorio',hours:2},admin);assert.equal(r.status,201);n++;
  r=await req('/api/visitors','GET',null,direction);assert.equal(r.status,200);assert(r.obj.some(x=>x.type==='visitante'));n+=2;
  r=await req('/api/visitors','GET',null,guard);assert.equal(r.status,403);n++;
  // Prevent silent deactivation while physically present.
  r=await req('/api/people','POST',{code:'LIN-5550',name:'Persona presente de prueba',type:'alumno',institutional_id:'25055550',status:'activo'},admin);assert.equal(r.status,201);n++;
  r=await req('/api/scan','POST',{code:'LIN-5550'},guard);assert.equal(r.status,200);n++;
  people=await req('/api/people?q=LIN-5550','GET',null,admin);
  r=await req('/api/people/'+people.obj[0].id,'PATCH',{status:'inactivo'},admin);assert.equal(r.status,409);n++;
  assert(!existsSync(path.join(__dirname,'..','public','guard.html')));n++;
  console.log(`OK: ${n} verificaciones adicionales ADMIN V0.4.`);
 }finally{child.kill('SIGTERM');await new Promise(r=>{child.once('exit',r);setTimeout(r,300)});rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
