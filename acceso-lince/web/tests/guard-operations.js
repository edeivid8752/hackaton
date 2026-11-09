'use strict';
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {mkdtempSync,rmSync,readFileSync,existsSync}=require('node:fs');
const {DatabaseSync}=require('node:sqlite');
const {randomBytes}=require('node:crypto');
const path=require('node:path'),os=require('node:os');
(async()=>{
 const tmp=mkdtempSync(path.join(os.tmpdir(),'lince-ops-'));
 const port=37000+Math.floor(Math.random()*20000),base='http://127.0.0.1:'+port;
 const child=spawn(process.execPath,[path.join(__dirname,'../server.js')],{env:{...process.env,LINCE_DB:path.join(tmp,'db.sqlite'),LINCE_EXPRESS_PHOTO_KEY_FILE:path.join(tmp,'photo.key'),LINCE_DEMO:'1',PORT:String(port)},stdio:'pipe'});
 let log='',tests=0;child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d);
 const ok=(r,s=200)=>{if(r.status===500)console.error('SERVER LOG',log.slice(-5000));assert.equal(r.status,s,JSON.stringify(r.data).slice(0,800));tests++;return r.data;};
 async function req(route,method='GET',body,cookie,token){const headers={};if(cookie)headers.Cookie=cookie;if(token)headers['X-Lince-Device-Token']=token;let encoded;
  if(body!==undefined){headers['Content-Type']='application/json';encoded=JSON.stringify(body);}
  const res=await fetch(base+route,{method,headers,body:encoded}),ct=res.headers.get('content-type')||'';
  return {status:res.status,data:ct.includes('application/json')?await res.json():await res.text(),cookie:res.headers.get('set-cookie')?.split(';')[0]};}
 async function login(name,pw){const r=await req('/api/login','POST',{username:name,password:pw});ok(r);return r.cookie;}
 try{
  let ready=false;for(let i=0;i<120;i++){try{if((await fetch(base+'/')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,55));}assert(ready,log);tests++;
  const director=await login('direccion','Direccion123!'),admin=await login('admin','Admin123!');
  const student=ok(await req('/api/people','POST',{type:'alumno',name:'Alumno Para Prueba',institutional_id:'26779911',first_surname:'Para'},admin),201);
  const studentLogin=await login('26779911',student.initialPassword);
  // Admin-controlled pairing. Students/unauthenticated users must not provision devices.
  ok(await req('/api/devices/pair','POST',{name:'Acceso Principal 1',gate:'Puerta 1'},studentLogin),403);
  ok(await req('/api/devices/pair','POST',{name:'Acceso Principal 1',gate:'Puerta 1'}),401);
  const a=ok(await req('/api/devices/pair','POST',{name:'Acceso Principal 1',gate:'Puerta 1'},admin),201);
  assert.match(a.pair_code,/^[A-F0-9]{16}$/);tests++;
  const enrolledA=ok(await req('/api/devices/enroll','POST',{pair_code:a.pair_code}),201);
  const tokenA=enrolledA.device_token;assert.match(tokenA,/^dev_[0-9a-f]{64}$/);tests++;
  ok(await req('/api/devices/enroll','POST',{pair_code:a.pair_code}),401);
  const b=ok(await req('/api/devices/pair','POST',{name:'Acceso Lateral 2',gate:'Puerta 2'},director),201);
  const tokenB=ok(await req('/api/devices/enroll','POST',{pair_code:b.pair_code}),201).device_token;
  const guards=ok(await req('/api/shifts','GET',undefined,director)).guards;
  const g1=guards.find(g=>g.login==='guardia');assert(g1);tests++;
  const g2=ok(await req('/api/accounts','POST',{role:'guardia',name:'Segunda Vigilante',institutional_id:'SEG-8002'},admin),201);
  const db=new DatabaseSync(path.join(tmp,'db.sqlite'));
  const qr1=db.prepare("SELECT p.code FROM people p JOIN accounts a ON a.person_id=p.id WHERE a.login='guardia'").get().code;
  const qr2=db.prepare('SELECT code FROM people WHERE id=?').get(g2.personId).code;
  const studentQR=db.prepare('SELECT code FROM people WHERE id=?').get(student.id).code;
  ok(await req('/api/guard/qr-login','POST',{code:qr1}),403);
  ok(await req('/api/guard/qr-login','POST',{code:studentQR},undefined,tokenA),403);
  ok(await req('/api/guard/qr-login','POST',{code:studentQR},undefined,tokenB),403);
  let guardLoginA=await req('/api/guard/qr-login','POST',{code:qr1},undefined,tokenA);ok(guardLoginA);const cookieA=guardLoginA.cookie;
  let guardLoginB=await req('/api/guard/qr-login','POST',{code:qr2},undefined,tokenB);ok(guardLoginB);const cookieB=guardLoginB.cookie;
  ok(await req('/api/shifts/mine','GET',undefined,cookieA,tokenA));ok(await req('/api/shifts/mine','GET',undefined,cookieB,tokenB));
  ok(await req('/api/shifts/mine','GET',undefined,cookieA),401);
  // Cross-device token must not redeem another device's guard session.
  ok(await req('/api/shifts/mine','GET',undefined,cookieB,tokenA),401);
  const s1=ok(await req('/api/shifts','POST',{guard_account_id:g1.id,location:'Puerta 1',starts_at:new Date(Date.now()-60_000).toISOString(),ends_at:new Date(Date.now()+3600_000).toISOString()},director),201);
  const s2=ok(await req('/api/shifts','POST',{guard_account_id:guards.find(g=>g.id!==g1.id)?.id||db.prepare("SELECT id FROM accounts WHERE role='guardia' ORDER BY id DESC").get().id,location:'Puerta 2',starts_at:new Date(Date.now()-60_000).toISOString(),ends_at:new Date(Date.now()+3600_000).toISOString()},director),201);
  ok(await req('/api/shifts/'+s1.id+'/start','POST',{},cookieA,tokenA));
  ok(await req('/api/shifts/'+s2.id+'/start','POST',{},cookieB,tokenB));
  const current=ok(await req('/api/shifts','GET',undefined,director));assert.equal(current.summary.inService,2);tests++;
  // Two simultaneous Android scans: exactly one physical entry, other is anti-rebound.
  const [scanA,scanB]=await Promise.all([req('/api/scan','POST',{code:studentQR},cookieA,tokenA),req('/api/scan','POST',{code:studentQR},cookieB,tokenB)]);
  assert.equal([scanA,scanB].filter(r=>r.status===200).length,1);assert.equal([scanA,scanB].filter(r=>r.status===422).length,1);tests+=2;
  assert.equal(db.prepare('SELECT COUNT(*) n FROM access_events WHERE person_id=?').get(student.id).n,1);tests++;
  const photo=readFileSync(path.join(__dirname,'../public/assets/uadeo-logo.png'));
  assert(photo.length>2048);tests++;
  const capture={kind:'visitante',photo_type:'ine',photo_data:'data:image/png;base64,'+photo.toString('base64'),document_checked:true,notice_confirmed:true,request_id:randomBytes(16).toString('hex')};
  ok(await req('/api/express-entry','POST',capture,studentLogin),403);
  ok(await req('/api/express-entry','POST',{...capture,document_checked:false},cookieA,tokenA),400);
  const express=ok(await req('/api/express-entry','POST',capture,cookieA,tokenA),201);
  assert.equal(express.gate,'Puerta 1');tests++;
  const duplicated=ok(await req('/api/express-entry','POST',capture,cookieA,tokenA));assert.equal(duplicated.duplicate,true);tests++;
  const provider=ok(await req('/api/express-entry','POST',{...capture,kind:'proveedor',photo_type:'gafete',request_id:randomBytes(16).toString('hex')},cookieB,tokenB),201);
  assert.equal(provider.gate,'Puerta 2');tests++;
  const list=ok(await req('/api/express-entries','GET',undefined,director));assert.equal(list.entries.length,2);tests++;
  ok(await req('/api/express-entries','GET',undefined,studentLogin),403);
  const p=await fetch(base+'/api/express-entries/'+express.id+'/photo',{headers:{Cookie:director}});assert.equal(p.status,200);assert.match(p.headers.get('content-type'),/image\/png/);assert(Buffer.from(await p.arrayBuffer()).equals(photo));tests+=3;
  assert.equal(db.prepare('SELECT COUNT(*) n FROM access_events WHERE action=\'entrada\'').get().n,3);tests++;
  const raw=db.prepare('SELECT photo_cipher FROM express_entries WHERE id=?').get(express.id);assert(!Buffer.from(raw.photo_cipher).includes(photo.subarray(0,64)));tests++;
  assert(existsSync(path.join(tmp,'photo.key')));tests++;
  const devs=ok(await req('/api/devices','GET',undefined,director));assert.equal(devs.devices.length,2);tests++;
  ok(await req('/api/devices/'+enrolledA.device.id+'/revoke','POST',{reason:'Tableta devuelta a informática'},admin));
  ok(await req('/api/shifts/mine','GET',undefined,cookieA,tokenA),401);
  ok(await req('/api/guard/qr-login','POST',{code:qr1},undefined,tokenA),403);
  ok(await req('/api/shifts/mine','GET',undefined,cookieB,tokenB));
  const current2=ok(await req('/api/shifts','GET',undefined,director));assert.equal(current2.summary.inService,2);tests++;
  // Simulate expiration and ensure photo no longer available without deleting audit movement.
  db.prepare('UPDATE express_entries SET photo_expires_at=? WHERE id=?').run(new Date(Date.now()-3600_000).toISOString(),express.id);
  ok(await req('/api/express-entries/'+express.id+'/photo','GET',undefined,director),404);
  assert.equal(db.prepare('SELECT length(photo_cipher) n FROM express_entries WHERE id=?').get(express.id).n,0);tests++;
  assert.equal(db.prepare('SELECT COUNT(*) n FROM access_events WHERE action=\'entrada\'').get().n,3);tests++;
  db.close();console.log('OK ACCESO LINCE V0.5.2: '+tests+' verificaciones de multidispositivo, gafetes sin PIN, permisos, fotografías, privacidad, revocación y anti-duplicados.');
 } finally{child.kill('SIGTERM');await new Promise(r=>{child.once('exit',r);setTimeout(r,300)});rmSync(tmp,{recursive:true,force:true});}
})().catch(e=>{console.error('FALLO nuevas operaciones:',e);process.exitCode=1});
