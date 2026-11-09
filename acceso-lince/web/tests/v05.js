'use strict';
const assert=require('node:assert/strict');
const {mkdtempSync,rmSync,readFileSync}=require('node:fs');
const {DatabaseSync}=require('node:sqlite');
const path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process');
(async()=>{
 const temp=mkdtempSync(path.join(os.tmpdir(),'lince-v05-')),port=30000+Math.floor(Math.random()*26000),base=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,[path.join(__dirname,'../server.js')],{env:{...process.env,PORT:String(port),LINCE_DB:path.join(temp,'test.sqlite'),LINCE_DEMO:'1'},stdio:'pipe'});
 let logs='',n=0;child.stdout.on('data',x=>logs+=x);child.stderr.on('data',x=>logs+=x);
 async function req(url,method='GET',payload,token){const opts={method,headers:{...(token?{Cookie:token}:{})}};if(payload!==undefined){opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(payload);}const r=await fetch(base+url,opts);let data;const content=r.headers.get('content-type')||'';if(content.includes('application/json'))data=await r.json();else data=await r.text();return {status:r.status,data,headers:r.headers};}
 async function login(name,password){const r=await req('/api/login','POST',{username:name,password});assert.equal(r.status,200,'Login '+name+': '+JSON.stringify(r.data));n++;return r.headers.get('set-cookie').split(';')[0]}
 try{
  let ready=false;for(let i=0;i<90;i++){try{if((await fetch(base+'/')).status===200){ready=true;break;}}catch{}await new Promise(x=>setTimeout(x,65));}assert(ready,logs);n++;
  const director=await login('DIR-DEMO','Direccion123!');const admin=await login('admin','Admin123!');const guard=await login('SEG-DEMO','Guardia123!');
  // Privileged roles and protection from escalation.
  let r=await req('/api/accounts','POST',{role:'admin',institutional_id:'ADM-NEW2',name:'Administrador Nuevo'},admin);assert.equal(r.status,403);n++;
  r=await req('/api/accounts','POST',{role:'admin',institutional_id:'ADM-NEW2',name:'Administrador Nuevo'},director);assert.equal(r.status,201,JSON.stringify(r.data));assert(r.data.initialPassword.length>=12);n+=2;
  const newAdminPass=r.data.initialPassword,newAdmin=await login('ADM-NEW2',newAdminPass);
  r=await req('/api/accounts?role=admin','GET',undefined,newAdmin);assert.equal(r.status,403);n++;
  r=await req('/api/accounts','POST',{role:'guardia',institutional_id:'SEG-NEW2',name:'Guardia Nuevo'},newAdmin);assert.equal(r.status,201,JSON.stringify(r.data));n++;
  const newGuard=await login('SEG-NEW2',r.data.initialPassword);
  // Student accounts and automatically generated QR.
  r=await req('/api/people','POST',{type:'alumno',institutional_id:'25051234',name:'Daniela López',first_surname:'López',career:'Ingeniería en Software',group_name:'3A',status:'activo'},admin);
  assert.equal(r.status,201,JSON.stringify(r.data));const studentId=r.data.id,code=r.data.code;
  assert.equal(r.data.initialPassword,'Dlop.1234');assert.match(code,/^LIN-[A-Z0-9-]+$/);n+=3;
  const student=await login('25051234','Dlop.1234');
  r=await req('/api/people','GET',undefined,student);assert.equal(r.status,403);n++;
  r=await req('/api/stats','GET',undefined,student);assert.equal(r.status,403);n++;
  r=await req('/api/profile','GET',undefined,student);assert.equal(r.data.profile.name,'Daniela López');n++;
  r=await req('/api/qr/'+studentId+'.svg','GET',undefined,student);assert.equal(r.status,200);assert.match(r.data,/viewBox="0 0 37 37"/);n+=2;
  r=await req('/api/qr/1.svg','GET',undefined,student);assert.equal(r.status,403);n++;
  r=await req('/api/qr/'+studentId+'.svg?download=1','GET',undefined,admin);assert.equal(r.status,200);assert.match(r.headers.get('content-disposition'),/attachment/);n+=2;
  r=await req('/api/scan','POST',{code},newGuard);assert.equal(r.status,200);assert.equal(r.data.action,'entrada');n+=2;
  r=await req('/api/my-attendance','GET',undefined,student);assert.equal(r.data.daysWithAccess,1);assert.equal(r.data.events[0].action,'entrada');n+=2;
  // Simulate rollover from an old day: no fictional physical exit.
  const inspection=new DatabaseSync(path.join(temp,'test.sqlite'));inspection.prepare("UPDATE config SET value='2000-01-01' WHERE key='last_day'").run();
  r=await req('/api/stats','GET',undefined,admin);assert.equal(r.data.total,1);n++;
  assert(inspection.prepare("SELECT day FROM day_closures WHERE day='2000-01-01'").get());n++;
  assert.equal(inspection.prepare("SELECT COUNT(*) n FROM access_events WHERE action='salida_automatica'").get().n,0);n++;inspection.close();
  r=await req('/api/people/'+studentId,'PATCH',{status:'inactivo'},admin);assert.equal(r.status,409);n++;
  r=await req('/api/corrections/exit','POST',{person_id:studentId,reason:'Olvidaron registrar la salida del estudiante'},admin);assert.equal(r.status,201);n++;
  r=await req('/api/my-attendance','GET',undefined,student);assert.equal(r.data.events.length,2);assert.match(r.data.events[0].note,/Corrección manual/);n+=2;
  r=await req('/api/people/'+studentId+'/rotate-qr','POST',{reason:'Reposición por credencial extraviada'},admin);assert.equal(r.status,200);assert.notEqual(r.data.code,code);n+=2;
  const replacementCode=r.data.code;
  r=await req('/api/scan','POST',{code},guard);assert.equal(r.status,422);n++;
  r=await req('/api/scan','POST',{code:replacementCode},guard);assert.equal(r.status,200);n++;
  r=await req('/api/corrections/exit','POST',{person_id:studentId,reason:'Salida registrada manualmente en la oficina'},admin);assert.equal(r.status,201);n++;
  r=await req('/api/people/'+studentId,'PATCH',{status:'inactivo'},admin);assert.equal(r.status,200);n++;
  r=await req('/api/login','POST',{username:'25051234',password:'Dlop.1234'});assert.equal(r.status,401);n++;
  // Admin cannot deactivate Director through general-person endpoint.
  const rows=(await req('/api/people','GET',undefined,admin)).data;
  const d=rows.find(x=>x.staff_role==='direccion');assert(d);n++;
  r=await req('/api/people/'+d.id,'PATCH',{status:'inactivo'},admin);assert.equal(r.status,403);n++;
  // Special events: 24-hour windows spanning midnight; Director can authorize.
  const now=Date.now(),future=new Date(now+3600_000),end=new Date(now+25*3600_000);
  r=await req('/api/events','POST',{name:'Hackatón 24 horas',starts_at:future.toISOString(),ends_at:end.toISOString()},director);assert.equal(r.status,201,JSON.stringify(r.data));n++;
  const eventId=r.data.id;
  r=await req('/api/events','GET',undefined,admin);assert(r.data.some(x=>x.name==='Hackatón 24 horas'));n++;
  r=await req('/api/events/'+eventId,'PATCH',{name:'Hackatón reprogramado',starts_at:future.toISOString(),ends_at:new Date(now+26*3600_000).toISOString()},admin);assert.equal(r.status,200);n++;
  r=await req('/api/events/'+eventId,'PATCH',{action:'cancel',reason:'Cambio de calendario académico'},director);assert.equal(r.status,200);n++;
  r=await req('/api/events','GET',undefined,director);assert(r.data.some(x=>x.id===eventId&&x.cancelled_at));n++;
  r=await req('/api/events','POST',{name:'Evento no autorizado',starts_at:future.toISOString(),ends_at:end.toISOString()},newGuard);assert.equal(r.status,403);n++;
  // Bulk CSV: 500 unique fake students and one duplicate invalid row.
  const lines=['matricula,nombre_completo,apellido_paterno,carrera,grupo'];for(let i=0;i<500;i++)lines.push(`${String(26000000+i)},Estudiante Prueba${i} López,López,Ingeniería en Software,3A`);
  lines.push('26000000,Estudiante Repetido López,López,Ingeniería en Software,3A');
  const csv=Buffer.from(lines.join('\n')).toString('base64');
  r=await req('/api/import/preview','POST',{filename:'500-alumnos.csv',content_base64:csv},director);assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.valid,500);assert.equal(r.data.invalid,1);n+=3;
  const token=r.data.token;
  r=await req('/api/import/commit','POST',{token},director);assert.equal(r.status,201,JSON.stringify(r.data));assert.equal(r.data.imported,500);n+=2;
  r=await req('/api/import/commit','POST',{token},director);assert.equal(r.status,409);n++;
  const zipResponse=await fetch(base+'/api/import/export?token='+token,{headers:{Cookie:director}});assert.equal(zipResponse.status,200);const zipped=Buffer.from(await zipResponse.arrayBuffer());assert.equal(zipped.readUInt32LE(0),0x04034b50);assert(zipped.length>500000);n+=3;
  r=await req('/api/import/export?token='+token,'GET',undefined,student);assert.equal(r.status,401);n++;
  // XLSX preview works with a real Excel workbook, without npm dependencies.
  const excel=readFileSync(path.join(__dirname,'fixtures/alumnos-ejemplo.xlsx')).toString('base64');
  r=await req('/api/import/preview','POST',{filename:'alumnos-ejemplo.xlsx',content_base64:excel},admin);assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.valid,2);n+=2;
  console.log(`OK V0.5: ${n} verificaciones de roles, cuentas, QR, Android, calendario, correcciones, eventos e importación masiva de 500 alumnos.`);
 }finally{child.kill('SIGTERM');await new Promise(r=>{child.once('exit',r);setTimeout(r,320)});rmSync(temp,{recursive:true,force:true});}
})().catch(e=>{console.error('FALLO V0.5:',e);process.exitCode=1});
