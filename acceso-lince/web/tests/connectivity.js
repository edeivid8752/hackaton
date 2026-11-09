'use strict';
// Verifica la funcionalidad clave que el usuario probó: admin crea alumno,
// guardia lo registra y admin ve inmediatamente el cambio de aforo.
const assert=require('node:assert/strict');
const {mkdtempSync,rmSync}=require('node:fs');
const {spawn}=require('node:child_process');
const path=require('node:path');
const os=require('node:os');
(async()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'lince-conn-'));
 const port=42000+Math.floor(Math.random()*18000), url=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,[path.join(__dirname,'../server.js')],{env:{...process.env,PORT:String(port),HOST:'127.0.0.1',LINCE_DB:path.join(dir,'test.sqlite'),LINCE_DEMO:'1'},stdio:'pipe'});
 try{
  let ready=false;for(let i=0;i<100;i++){try{if((await fetch(url+'/')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,60));}assert(ready,'No inició el servidor');
  async function request(route,method='GET',data=null,cookie=''){
    const r=await fetch(url+route,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:data?JSON.stringify(data):undefined});
    return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};
  }
  const admin=await request('/api/login','POST',{username:'admin',password:'Admin123!'});
  const guard=await request('/api/login','POST',{username:'guardia',password:'Guardia123!'});
  assert.equal(admin.status,200);assert.equal(guard.status,200);
  const name='Alumno nuevo probado desde la administración',code='ISOF-7890';
  let r=await request('/api/people','POST',{name,code,institutional_id:'25057890',type:'alumno',career:'Ingeniería en Software',group_name:'4A',status:'activo'},admin.cookie);
  assert.equal(r.status,201);
  r=await request('/api/stats','GET',null,admin.cookie);assert.equal(r.body.total,0);
  r=await request('/api/scan','POST',{code},guard.cookie);assert.equal(r.status,200);assert.equal(r.body.person.name,name);assert.equal(r.body.action,'entrada');
  r=await request('/api/stats','GET',null,admin.cookie);assert.equal(r.body.total,1);
  r=await request('/api/scan','POST',{code},guard.cookie);assert.equal(r.status,422);assert.equal(r.body.rebound,true);
  r=await request('/api/history','GET',null,admin.cookie);assert.equal(r.body.length,1);assert.equal(r.body[0].code,code);
  console.log('OK: 10 comprobaciones ADMIN→GUARD→aforo para un alumno nuevo.');
 } finally {child.kill('SIGTERM');await new Promise(res=>{child.once('exit',res);setTimeout(res,300)});rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
