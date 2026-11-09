'use strict';
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {mkdtempSync,rmSync}=require('node:fs');
const {DatabaseSync}=require('node:sqlite');
const os=require('node:os'),path=require('node:path');
(async()=>{
 const tmp=mkdtempSync(path.join(os.tmpdir(),'acceso-lince-shifts-'));
 const port=33000+Math.floor(Math.random()*26000),base='http://127.0.0.1:'+port;
 const child=spawn(process.execPath,[path.join(__dirname,'../server.js')],{env:{...process.env,LINCE_DB:path.join(tmp,'test.sqlite'),LINCE_DEMO:'1',PORT:String(port)},stdio:'pipe'});
 let log='',tests=0;child.stdout.on('data',x=>log+=x);child.stderr.on('data',x=>log+=x);
 async function req(url,method='GET',body,cookie){
  const options={method,headers:cookie?{Cookie:cookie}:{}};
  if(body!==undefined){options.headers['Content-Type']='application/json';options.body=JSON.stringify(body);}
  const res=await fetch(base+url,options),contentType=res.headers.get('content-type')||'';
  return {status:res.status,data:contentType.includes('application/json')?await res.json():await res.text(),cookie:res.headers.get('set-cookie')?.split(';')[0]};
 }
 async function login(name,pw){const r=await req('/api/login','POST',{username:name,password:pw});assert.equal(r.status,200,JSON.stringify(r.data));tests++;return r.cookie;}
 const ok=(r,status=200)=>{assert.equal(r.status,status,JSON.stringify(r.data));tests++;return r.data;};
 try{
  let ready=false;for(let i=0;i<110;i++){try{if((await fetch(base+'/')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,60));}assert(ready,log);tests++;
  const director=await login('direccion','Direccion123!');
  const admin=await login('admin','Admin123!');
  const guard=await login('guardia','Guardia123!');
  const gCreated=ok(await req('/api/accounts','POST',{role:'guardia',name:'Guardia Entrante Prueba',institutional_id:'SEG-ENTRANTE'},admin),201);
  const incoming=await login('SEG-ENTRANTE',gCreated.initialPassword);
  const stud=ok(await req('/api/people','POST',{type:'alumno',name:'Estudiante Control',first_surname:'Control',institutional_id:'25059988'},admin),201);
  const student=await login('25059988',stud.initialPassword);
  ok(await req('/api/shifts','GET',undefined,student),403);
  ok(await req('/api/shifts/mine','GET',undefined,admin),403);
  const initial=ok(await req('/api/shifts','GET',undefined,director));
  assert.equal(initial.shifts.length,0);tests++;
  const g=initial.guards.find(x=>x.login==='guardia'),h=initial.guards.find(x=>x.login==='SEG-ENTRANTE');
  assert(g&&h);tests++;
  const ts=Date.now(),dt=n=>new Date(ts+n*60_000).toISOString();
  const a={guard_account_id:g.id,location:'Acceso principal',starts_at:dt(-10),ends_at:dt(20)};
  const b={guard_account_id:h.id,location:'Acceso principal',starts_at:dt(10),ends_at:dt(250)};
  ok(await req('/api/shifts','POST',a,student),403);
  const shiftA=ok(await req('/api/shifts','POST',a,director),201).id;
  const shiftB=ok(await req('/api/shifts','POST',b,admin),201).id;
  ok(await req('/api/shifts','POST',{...a,starts_at:dt(-1),ends_at:dt(5)},director),409);
  ok(await req('/api/shifts/'+shiftA+'/start','POST',{},admin),403);
  ok(await req('/api/shifts/'+shiftA+'/start','POST',{},incoming),403);
  const my=ok(await req('/api/shifts/mine','GET',undefined,guard));
  assert.equal(my.shifts.length,1);assert.equal(my.shifts[0].id,shiftA);tests+=2;
  // Guard QR is a physical credential, NOT a valid login password.
  const db=new DatabaseSync(path.join(tmp,'test.sqlite'));
  const gqr=db.prepare('SELECT code FROM people WHERE institutional_id=?').get('SEG-DEMO').code;
  ok(await req('/api/login','POST',{username:gqr,password:gqr}),401);
  db.close();
  ok(await req('/api/shifts/'+shiftA+'/start','POST',{},guard));
  ok(await req('/api/shifts/'+shiftA+'/start','POST',{},guard),409);
  const inProgress=ok(await req('/api/shifts','GET',undefined,admin));
  assert.equal(inProgress.summary.inService,1);assert.equal(inProgress.shifts.find(x=>x.id===shiftA).status,'en_servicio');tests+=2;
  ok(await req('/api/shifts/'+shiftA+'/offer','POST',{to_shift_id:shiftB,notes:'Entrega de acceso principal'},guard),201);
  ok(await req('/api/shifts/'+shiftB+'/accept','POST',{},guard),403);
  const accepted=ok(await req('/api/shifts/'+shiftB+'/accept','POST',{},incoming));
  assert.equal(accepted.previousShiftId,shiftA);tests++;
  const after=ok(await req('/api/shifts','GET',undefined,director));
  assert.equal(after.shifts.find(x=>x.id===shiftA).status,'finalizado');
  assert.equal(after.shifts.find(x=>x.id===shiftB).status,'en_servicio');
  assert.equal(after.handovers[0].accepted_by,'SEG-ENTRANTE');tests+=3;
  ok(await req('/api/shifts/'+shiftB+'/finish','POST',{},guard),403);
  ok(await req('/api/shifts/'+shiftB+'/finish','POST',{},incoming));
  ok(await req('/api/shifts/'+shiftB+'/finish','POST',{},incoming),409);
  const future={guard_account_id:g.id,location:'Acceso norte',starts_at:dt(600),ends_at:dt(750)};
  const futureId=ok(await req('/api/shifts','POST',future,director),201).id;
  ok(await req('/api/shifts/'+futureId+'/cancel','POST',{reason:'x'},admin),400);
  ok(await req('/api/shifts/'+futureId+'/cancel','POST',{reason:'Cambio de guardia confirmado'},admin));
  ok(await req('/api/shifts/'+futureId+'/start','POST',{},guard),409);
  const inspect=new DatabaseSync(path.join(tmp,'test.sqlite'));
  assert(inspect.prepare('SELECT COUNT(*) n FROM guard_shift_events').get().n>=7);tests++;
  assert.equal(inspect.prepare('SELECT COUNT(*) n FROM guard_handovers WHERE accepted_at IS NOT NULL').get().n,1);tests++;
  assert.equal(inspect.prepare("SELECT COUNT(*) n FROM access_events WHERE action='salida_automatica'").get().n,0);tests++;
  inspect.close();
  console.log('OK Turnos y relevos V0.5.1: '+tests+' verificaciones adicionales de roles, horarios, oferta y recepción, cancelaciones y auditoría.');
 }finally{child.kill('SIGTERM');await new Promise(r=>{child.once('exit',r);setTimeout(r,300)});rmSync(tmp,{recursive:true,force:true});}
})().catch(e=>{console.error('FALLO turnos:',e);process.exitCode=1});
