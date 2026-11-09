'use strict';
// V0.4: acceso exclusivamente Android, autenticación y aforo compartido.
const assert=require('node:assert/strict');
const {mkdtempSync,rmSync}=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawn}=require('node:child_process');
(async()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'lince-v02-'));
 const port=42000+Math.floor(Math.random()*10000),base=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,[path.join(__dirname,'../server.js')],{env:{...process.env,HOST:'127.0.0.1',PORT:String(port),LINCE_DB:path.join(dir,'test.sqlite'),LINCE_DEMO:'1'},stdio:'pipe'});
 let log='';child.stderr.on('data',d=>log+=d);child.stdout.on('data',d=>log+=d);
 try{
  let ready=false;for(let i=0;i<80;i++){try{const r=await fetch(base+'/');if(r.ok){ready=true;break;}}catch{}await new Promise(x=>setTimeout(x,60));}assert(ready,log);
  let n=0;
  const retired=await fetch(base+'/guard.html');assert.equal(retired.status,404);n++;
  const retiredAlt=await fetch(base+'/guard');assert.equal(retiredAlt.status,404);n++;
  const icon=await fetch(base+'/icon.svg');assert.equal(icon.status,200);n++;
  const adminPage=await(await fetch(base+'/')).text();assert.match(adminPage,/LINCE ADMIN/);assert.doesNotMatch(adminPage,/id=\"view-kiosk\"/);n+=2;
  async function request(route,opts={},cookie=''){const res=await fetch(base+route,{...opts,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})}});let body={};try{body=await res.json();}catch{}return {status:res.status,body,headers:res.headers};}
  const authenticate=async(username,password)=>{const r=await request('/api/login',{method:'POST',body:JSON.stringify({username,password})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
  const g=await authenticate('guardia','Guardia123!'),a=await authenticate('admin','Admin123!');n+=2;
  const scan=await request('/api/scan',{method:'POST',body:JSON.stringify({code:'LIN-1002'})},g);assert.equal(scan.status,200);assert.equal(scan.body.action,'entrada');n++;
  const stats=await request('/api/stats',{},a);assert.equal(stats.body.total,1);n++;
  const bounce=await request('/api/scan',{method:'POST',body:JSON.stringify({code:'LIN-1002'})},g);assert.equal(bounce.status,422);assert.equal(bounce.body.rebound,true);n++;
  const invalid=await request('/api/scan',{method:'POST',body:JSON.stringify({code:'LIN-9001'})},g);assert.equal(invalid.status,422);n++;
  const history=await request('/api/history',{},a);assert.equal(history.body.length,1);n++;
  const deniedHistory=await request('/api/history',{},g);assert.equal(deniedHistory.status,403);n++;
  const create=await request('/api/visitors',{method:'POST',body:JSON.stringify({name:'Proveedora de Prueba',type:'proveedor',reason:'Revisar aire acondicionado',host_name:'Dirección',hours:4})},g);assert.equal(create.status,201);n++;
  const arrival=await request('/api/scan',{method:'POST',body:JSON.stringify({code:create.body.code})},g);assert.equal(arrival.body.action,'entrada');n++;
  const final=await request('/api/stats',{},a);assert.equal(final.body.total,2);assert.equal(final.body.externos,1);n++;
  const stranger=await request('/api/stats');assert.equal(stranger.status,401);n++;
  console.log(`OK: ${n} verificaciones V0.2 superadas.`);
 }finally{child.kill('SIGTERM');await new Promise(resolve=>{child.once('exit',resolve);setTimeout(resolve,300)});rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error('FALLO V0.2:',e);process.exitCode=1;});
