'use strict';
const assert=require('node:assert/strict'),{mkdtempSync,rmSync}=require('node:fs'),{spawn}=require('node:child_process'),os=require('node:os'),path=require('node:path');
(async()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'lince-clean-')),port=25000+Math.floor(Math.random()*30000),url=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,[path.join(__dirname,'../server.js')],{env:{...process.env,PORT:String(port),LINCE_DB:path.join(dir,'clean.sqlite'),LINCE_DEMO:'0',LINCE_BOOTSTRAP_DIRECTOR_ID:'DIR-INI2',LINCE_BOOTSTRAP_DIRECTOR_PASSWORD:'PruebaInicialSegura123!',LINCE_BOOTSTRAP_DIRECTOR_NAME:'Dirección Ficticia'},stdio:'pipe'});
 let log='';child.stderr.on('data',x=>log+=x);child.stdout.on('data',x=>log+=x);
 try{
  let started=false;for(let i=0;i<100;i++){try{if((await fetch(url+'/')).ok){started=true;break;}}catch{}await new Promise(r=>setTimeout(r,60));}assert(started,log);
  async function req(r,method='GET',b=null,cookie=''){let v=await fetch(url+r,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:b?JSON.stringify(b):undefined});return {status:v.status,body:await v.json(),cookie:v.headers.get('set-cookie')?.split(';')[0]};}
  let r=await req('/api/login','POST',{username:'admin',password:'Admin123!'});assert.equal(r.status,401);
  r=await req('/api/login','POST',{username:'DIR-INI2',password:'PruebaInicialSegura123!'});assert.equal(r.status,200);const direction=r.cookie;
  r=await req('/api/people','GET',null,direction);assert.equal(r.status,200);assert.equal(r.body.length,1); // only initial Director
  r=await req('/api/accounts','POST',{role:'guardia',name:'Guardia de prueba',institutional_id:'SEG-INI2'},direction);assert.equal(r.status,201);assert(r.body.initialPassword.length>=16);
  const guardLogin=await req('/api/login','POST',{username:'SEG-INI2',password:r.body.initialPassword});assert.equal(guardLogin.status,200);
  r=await req('/api/people','POST',{name:'Daniela López',first_surname:'López',institutional_id:'25051234',type:'alumno',group_name:'3A'},direction);assert.equal(r.status,201);
  assert.notEqual(r.body.initialPassword,'Dlop.1234');const pw=r.body.initialPassword;
  r=await req('/api/login','POST',{username:'25051234',password:pw});assert.equal(r.status,200);
  console.log('OK V0.5 LIMPIO: cuenta directiva bootstrap, cero alumnos preexistentes, guardia nuevo y contraseña estudiantil aleatoria.');
 }finally{child.kill('SIGTERM');await new Promise(r=>{child.once('exit',r);setTimeout(r,300)});rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
