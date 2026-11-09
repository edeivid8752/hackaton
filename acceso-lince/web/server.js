'use strict';
// ACCESO LINCE V0.5.2 — web unificada con roles, guardia Android y base compartida.
// Requiere Node.js >= 22.13 (node:sqlite todavía experimental en Node 22).
const http = require('node:http');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, scryptSync, timingSafeEqual } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const v05=require('./v05');
const shifts=require('./shifts');
const guardOps=require('./guard-operations');
const ROOT = __dirname;
const DB_PATH = process.env.LINCE_DB || path.join(ROOT, 'lince-data.sqlite');
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 3000);
const TZ = process.env.LINCE_TZ || 'America/Mazatlan';
const REBOUND_MS = 12000;
const DEMO = process.env.LINCE_DEMO !== '0';
const db = new DatabaseSync(DB_PATH);
db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS people (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 code TEXT UNIQUE NOT NULL,
 name TEXT NOT NULL,
 type TEXT NOT NULL CHECK(type IN ('alumno','docente','administrativo','visitante','proveedor')),
 career TEXT NOT NULL DEFAULT '',
 group_name TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'activo' CHECK(status IN ('activo','inactivo')),
 expires_at TEXT,
 reason TEXT NOT NULL DEFAULT '',
 host_name TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS presence (
 person_id INTEGER PRIMARY KEY REFERENCES people(id),
 inside INTEGER NOT NULL DEFAULT 0 CHECK(inside IN (0,1)),
 entered_at TEXT,
 last_scan_at TEXT
);
CREATE TABLE IF NOT EXISTS access_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 person_id INTEGER NOT NULL REFERENCES people(id),
 action TEXT NOT NULL CHECK(action IN ('entrada','salida','salida_automatica')),
 happened_at TEXT NOT NULL,
 gate TEXT NOT NULL DEFAULT 'Acceso principal',
 operator TEXT NOT NULL DEFAULT 'sistema',
 note TEXT NOT NULL DEFAULT ''
);
CREATE TRIGGER IF NOT EXISTS immutable_events_update BEFORE UPDATE ON access_events
BEGIN SELECT RAISE(ABORT, 'El historial es inmutable'); END;
CREATE TRIGGER IF NOT EXISTS immutable_events_delete BEFORE DELETE ON access_events
BEGIN SELECT RAISE(ABORT, 'El historial es inmutable'); END;
CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_events_time ON access_events(happened_at);
CREATE INDEX IF NOT EXISTS idx_people_type ON people(type);
`);
const getCfg = key => db.prepare('SELECT value FROM config WHERE key=?').get(key)?.value ?? null;
const putCfg = (key, value) => db.prepare('INSERT INTO config(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,String(value));
function dayOf(d=new Date()) { const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).filter(x=>x.type!=='literal').map(x=>[x.type,x.value])); return `${p.year}-${p.month}-${p.day}`; }
function hashPassword(pw,salt) { return scryptSync(pw, salt, 32).toString('hex'); }
const accounts = {};
for (const [login,role,password] of [['guardia','guardia','Guardia123!'],['admin','admin','Admin123!'],['direccion','direccion','Direccion123!']]) {
 const salt='lince-demo-'+login; accounts[login]={role,salt,hash:hashPassword(password,salt)};
}
const sessions = new Map();
const loginFailures=new Map();
const clients = new Set();
const MIME={'.webmanifest':'application/manifest+json; charset=utf-8','.json':'application/json; charset=utf-8','.webp':'image/webp','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.svg':'image/svg+xml','.ico':'image/x-icon','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg'};
const PEOPLE_SEED=[
 ['LIN-1001','Andrea López','alumno','Ingeniería en Software','3A','activo'],
 ['LIN-1002','Diego Morales','alumno','Ingeniería en Software','5B','activo'],
 ['LIN-1003','Valeria Torres','alumno','Psicología','2A','activo'],
 ['LIN-1004','Carlos Ramírez','alumno','Administración','4A','activo'],
 ['LIN-2001','María Castillo','docente','Ingeniería en Software','','activo'],
 ['LIN-3001','Rosa García','administrativo','','','activo'],
 ['LIN-9001','Estudiante Inactivo','alumno','Ingeniería en Software','1A','inactivo']
];
if(DEMO && db.prepare('SELECT COUNT(*) n FROM people').get().n===0){
 const stmt=db.prepare('INSERT INTO people(code,name,type,career,group_name,status,created_at) VALUES(?,?,?,?,?,?,?)');
 for(const r of PEOPLE_SEED) stmt.run(...r,new Date().toISOString());
}
v05.setup(db, DEMO);
shifts.setup(db);
guardOps.setup(db);
if (!getCfg('last_day')) putCfg('last_day',dayOf());
if (!getCfg('capacity')) putCfg('capacity','500');
function payload(person){
 return {...person,inside:!!person.inside};
}
function personByCode(code){return db.prepare(`SELECT p.*, COALESCE(pr.inside,0) inside,pr.last_scan_at,pr.entered_at FROM people p LEFT JOIN presence pr ON pr.person_id=p.id WHERE UPPER(p.code)=?`).get(code.toUpperCase())||null;}
function runTransaction(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result}catch(e){db.exec('ROLLBACK');throw e;}}
function ensureRollover(){
 const current=dayOf(),last=getCfg('last_day'),now=new Date(),minute=new Intl.DateTimeFormat('en-GB',{timeZone:TZ,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
 const active=db.prepare('SELECT name FROM special_events WHERE cancelled_at IS NULL AND starts_at<=? AND ends_at>? ORDER BY id DESC LIMIT 1').get(now.toISOString(),now.toISOString());
 const special=getCfg('special_until');
 const protectedEvent=active?.name||(special&&Date.parse(special)>Date.now()?'Evento especial autorizado':'');
 // El cierre es estadístico y de auditoría; NUNCA se inventa una salida.
 if(protectedEvent)return false;
 const pending=db.prepare('SELECT COUNT(*) n FROM presence WHERE inside=1').get().n;
 let changed=false;
 const closeDay=d=>{if(!d||db.prepare('SELECT day FROM day_closures WHERE day=?').get(d))return;
  db.prepare('INSERT INTO day_closures(day,closed_at,inside_pending,notes) VALUES(?,?,?,?)').run(d,new Date().toISOString(),pending,'Cierre de jornada: ninguna salida física inferida.');changed=true;
 };
 runTransaction(()=>{
  if(last&&last!==current)closeDay(last);
  if(minute>='23:59')closeDay(current);
  if(last!==current){putCfg('last_day',current);changed=true;}
  if(special&&Date.parse(special)<=Date.now())putCfg('special_until','');
 });
 if(changed)emitChange();return changed;
}
function getStats(){
 const total=db.prepare('SELECT COUNT(*) n FROM presence WHERE inside=1').get().n;
 const types=db.prepare('SELECT p.type,COUNT(*) n FROM people p JOIN presence pr ON pr.person_id=p.id WHERE pr.inside=1 GROUP BY p.type').all();
 const career=db.prepare("SELECT COALESCE(NULLIF(p.career,''),'Sin carrera') name,COUNT(*) total FROM people p JOIN presence pr ON pr.person_id=p.id WHERE pr.inside=1 AND p.type='alumno' GROUP BY p.career ORDER BY total DESC").all();
 const groups=db.prepare("SELECT p.group_name name,COUNT(*) total FROM people p JOIN presence pr ON pr.person_id=p.id WHERE pr.inside=1 AND p.type='alumno' AND p.group_name<>'' GROUP BY p.group_name ORDER BY total DESC").all();
 const all=Object.fromEntries(types.map(x=>[x.type,x.n]));
 const today=dayOf();
 const todayEvents=db.prepare("SELECT happened_at FROM access_events WHERE action='entrada' AND happened_at>=?").all(new Date(Date.now()-48*3600_000).toISOString()).filter(e=>dayOf(new Date(e.happened_at))===today).length;
 const event=db.prepare('SELECT id,name,starts_at,ends_at FROM special_events WHERE cancelled_at IS NULL AND starts_at<=? AND ends_at>? ORDER BY id DESC LIMIT 1').get(new Date().toISOString(),new Date().toISOString());
 return {total,alumnos:all.alumno||0,personal:(all.docente||0)+(all.administrativo||0),externos:(all.visitante||0)+(all.proveedor||0),todayEntries:todayEvents,capacity:Number(getCfg('capacity'))||500,career,groups,lastDay:getCfg('last_day'),specialUntil:getCfg('special_until')||'',specialEvent:event||null,pendingAtClosing:db.prepare('SELECT inside_pending FROM day_closures ORDER BY day DESC LIMIT 1').get()?.inside_pending||0};
}
function emitChange(){for(const c of clients){try{c.write(`event: changed\ndata: ${JSON.stringify({at:new Date().toISOString()})}\n\n`)}catch(e){clients.delete(c)}}}
function scan(code,user){
 ensureRollover();
 if(!/^[A-Z0-9-]{3,48}$/i.test(code))return {ok:false,reason:'Código inválido o vacío.'};
 const at=new Date();
 // Operación indivisible en SQLite: para múltiples Android, evita dos entradas seguidas por carreras.
 const outcome=runTransaction(()=>{
  const p=personByCode(code);if(!p)return {ok:false,reason:'Credencial no encontrada.'};
  if(p.status!=='activo')return {ok:false,reason:'Acceso denegado: usuario inactivo.',person:payload(p)};
  if(p.expires_at&&Date.parse(p.expires_at)<at.getTime())return {ok:false,reason:'Acceso denegado: autorización vencida.',person:payload(p)};
  if(p.last_scan_at&&at.getTime()-Date.parse(p.last_scan_at)<REBOUND_MS)return {ok:false,rebound:true,reason:'Escaneo repetido: movimiento ignorado.',person:payload(p)};
  const action=p.inside?'salida':'entrada';
  const dev=user.deviceId?db.prepare('SELECT gate FROM guard_devices WHERE id=?').get(user.deviceId):null;
  const gate=dev?.gate||'Acceso principal';
  db.prepare('INSERT INTO access_events(person_id,action,happened_at,gate,operator) VALUES(?,?,?,?,?)').run(p.id,action,at.toISOString(),gate,user.login);
  db.prepare('INSERT INTO presence(person_id,inside,entered_at,last_scan_at) VALUES(?,?,?,?) ON CONFLICT(person_id) DO UPDATE SET inside=excluded.inside,entered_at=excluded.entered_at,last_scan_at=excluded.last_scan_at').run(p.id,action==='entrada'?1:0,action==='entrada'?at.toISOString():null,at.toISOString());
  return {ok:true,action,person:payload({...p,inside:action==='entrada'?1:0}),at:at.toISOString(),gate};
 });
 if(outcome.ok){emitChange();outcome.stats=getStats();}return outcome;
}
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
function fail(res,status,message){send(res,status,{error:message});}
async function jsonBody(req,maxSize=128*1024){let chunks=[],size=0;for await(const ch of req){size+=ch.length;if(size>maxSize)throw Object.assign(new Error('Solicitud demasiado grande'),{status:413});chunks.push(ch);}let raw=Buffer.concat(chunks).toString('utf8');try{return raw?JSON.parse(raw):{}}catch{throw Object.assign(new Error('JSON inválido'),{status:400});}}
function makeSession(res,data,maxAgeSeconds=28800){
 if(data.deviceId)for(const [key,old] of sessions){if(old.deviceId===data.deviceId)sessions.delete(key);}
 const token=randomBytes(32).toString('hex');sessions.set(token,data);
 res.setHeader('Set-Cookie',`lince_sid=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}`);
 return token;
}
function auth(req){
 const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('lince_sid='))?.slice(10);
 const found=token&&sessions.get(token);if(!found)return null;
 if(found.expiresAt&&Date.now()>found.expiresAt){sessions.delete(token);return null;}
 if(!guardOps.checkDeviceSession(db,req,found))return null;
 if(found.deviceId&&(!found.lastHeartbeat||Date.now()-found.lastHeartbeat>60000)){db.prepare('UPDATE guard_devices SET last_seen_at=? WHERE id=? AND revoked_at IS NULL').run(new Date().toISOString(),found.deviceId);found.lastHeartbeat=Date.now();}
 const current=db.prepare('SELECT a.active,a.role,a.person_id,p.status FROM accounts a LEFT JOIN people p ON p.id=a.person_id WHERE a.id=?').get(found.accountId);
 if(!current?.active||current.status==='inactivo'){sessions.delete(token);return null;}
 return {...found,role:current.role,personId:current.person_id,token};
}
function can(user,...roles){return !!user && roles.includes(user.role);}
function clean(x,max=120){return String(x||'').trim().slice(0,max);}
function publicPerson(p){return {id:p.id,code:p.code,name:p.name,type:p.type,career:p.career,group_name:p.group_name,status:p.status,inside:!!p.inside,reason:p.reason,host_name:p.host_name,expires_at:p.expires_at,institutional_id:p.institutional_id,staff_role:p.staff_role,photo_data:p.photo_data};}
async function api(req,res,url){
 const route=url.pathname;
 if(req.method==='POST' && route==='/api/login'){
  const {username,password}=await jsonBody(req);
  const key=String(req.socket.remoteAddress||'local')+':'+clean(username,60).toLowerCase();
  const attempt=loginFailures.get(key)||{count:0,until:0};
  if(attempt.count>=8&&Date.now()<attempt.until)return fail(res,429,'Demasiados intentos. Intenta más tarde.');
  const acc=v05.authenticate(db,username,password);
  if(!acc){loginFailures.set(key,{count:attempt.count+1,until:Date.now()+5*60_000});return fail(res,401,'Identificación o contraseña incorrecta.');}
  loginFailures.delete(key);
  if(acc.role==='guardia'&&process.env.LINCE_REQUIRE_PAIRED_GUARD==='1')return fail(res,403,'Los guardias deben iniciar sesión con gafete desde un Android vinculado.');
  makeSession(res,acc,28800);
  return send(res,200,{login:acc.login,role:acc.role,personId:acc.personId});
 }
 const user=auth(req);
 if(await guardOps.handle({req,res,url,user,db,send,fail,jsonBody,runTransaction,emitChange,makeSession})!==false)return;
 if(!user)return fail(res,401,'Inicia sesión para continuar.');
 if(req.method==='POST' && route==='/api/logout') {sessions.delete(user.token);if(user.deviceId)emitChange();res.setHeader('Set-Cookie','lince_sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return send(res,200,{ok:true});}
 if(req.method==='GET' && route==='/api/me')return send(res,200,{login:user.login,role:user.role,personId:user.personId});
 if(await v05.handle({req,res,url,user,db,send,fail,jsonBody,runTransaction,emitChange,getStats,dayOf,TZ,DEMO})!==false)return;
 if(await shifts.handle({req,res,url,user,db,send,fail,jsonBody,runTransaction,emitChange})!==false)return;
 if(req.method==='GET' && route==='/api/stats') {if(!can(user,'admin','direccion','guardia'))return fail(res,403,'Sin permiso');ensureRollover();return send(res,200,getStats());}
 if(req.method==='GET' && route==='/api/people'){
  if(!can(user,'admin','direccion'))return fail(res,403,'Sin permiso');
  const q=clean(url.searchParams.get('q'),80);const people=db.prepare(`SELECT p.*,COALESCE(pr.inside,0) inside FROM people p LEFT JOIN presence pr ON pr.person_id=p.id WHERE p.name LIKE ? OR p.code LIKE ? ORDER BY p.id DESC LIMIT 250`).all(`%${q}%`,`%${q}%`);
  return send(res,200,people.map(publicPerson));
 }
 if(req.method==='POST' && route==='/api/people'){
  if(!can(user,'admin','direccion'))return fail(res,403,'Sin permiso para registrar usuarios.');
  const b=await jsonBody(req,320*1024);
  if(b.staff_role)return fail(res,400,'Para crear guardias o administradores utiliza Gestión de cuentas.');
  try{const result=runTransaction(()=>v05.newPerson(db,b,user,{demo:DEMO}));emitChange();return send(res,201,result);}
  catch(e){if(/UNIQUE/.test(e.message))return fail(res,409,'Matrícula o código ya registrado.');if(e.status)return fail(res,e.status,e.message);throw e;}
 }
 if(req.method==='PATCH' && /^\/api\/people\/\d+$/.test(route)){
  if(!can(user,'admin','direccion'))return fail(res,403,'Sin permiso para cambiar credenciales.');
  const id=Number(route.slice('/api/people/'.length));
  const b=await jsonBody(req),status=clean(b.status);
  if(!['activo','inactivo'].includes(status))return fail(res,400,'Estado de credencial inválido.');
  const p=db.prepare('SELECT p.id,p.name,p.status,COALESCE(pr.inside,0) inside FROM people p LEFT JOIN presence pr ON pr.person_id=p.id WHERE p.id=?').get(id);
  if(!p)return fail(res,404,'Credencial no encontrada.');
  const privileged=db.prepare('SELECT role FROM accounts WHERE person_id=?').get(id);
  if(privileged){if(privileged.role==='direccion')return fail(res,403,'Las cuentas de Dirección están protegidas.');if(privileged.role==='admin'&&!can(user,'direccion'))return fail(res,403,'Solo Dirección gestiona administradores.');}
  if(p.inside&&status==='inactivo')return fail(res,409,'La persona aún figura dentro del campus. Primero registra su salida desde LINCE GUARD.');
  runTransaction(()=>{db.prepare('UPDATE people SET status=? WHERE id=?').run(status,id);db.prepare('UPDATE accounts SET active=? WHERE person_id=?').run(status==='activo'?1:0,id);});
  emitChange();return send(res,200,{ok:true,id,status});
 }
 if(req.method==='GET' && route==='/api/visitors'){
  if(!can(user,'admin','direccion'))return fail(res,403,'Sin permiso.');
  const visitors=db.prepare("SELECT p.*,COALESCE(pr.inside,0) inside FROM people p LEFT JOIN presence pr ON pr.person_id=p.id WHERE p.type IN ('visitante','proveedor') ORDER BY p.id DESC LIMIT 200").all();
  return send(res,200,visitors.map(publicPerson));
 }
 if(req.method==='POST' && route==='/api/visitors'){
  if(!can(user,'admin','direccion','guardia'))return fail(res,403,'Sin permiso.');
  const b=await jsonBody(req),name=clean(b.name),type=clean(b.type),reason=clean(b.reason),host=clean(b.host_name);
  if(name.length<3 || !['visitante','proveedor'].includes(type)||reason.length<3||host.length<3)return fail(res,400,'Faltan nombre, tipo, motivo o persona responsable.');
  const expires = new Date(Date.now()+Math.max(1,Math.min(72,Number(b.hours)||8))*3600_000).toISOString();
  let code;do{code='VIS-'+randomBytes(4).toString('hex').toUpperCase()}while(personByCode(code));
  const visitor=db.prepare('INSERT INTO people(code,name,type,status,expires_at,reason,host_name,created_at) VALUES(?,?,?,?,?,?,?,?)').run(code,name,type,'activo',expires,reason,host,new Date().toISOString());emitChange();return send(res,201,{ok:true,id:Number(visitor.lastInsertRowid),code,expires_at:expires});
 }
 if(req.method==='POST' && route==='/api/scan'){
  if(!can(user,'guardia'))return fail(res,403,'Solo LINCE GUARD puede registrar movimientos.');
  const body=await jsonBody(req);const r=scan(clean(body.code,65),user);return send(res,r.ok?200:422,r);
 }
 if(req.method==='GET' && route==='/api/history'){
  if(!can(user,'admin','direccion'))return fail(res,403,'Sin permiso.');
  const history=db.prepare(`SELECT e.id,e.action,e.happened_at,e.gate,e.operator,e.note,p.name,p.code,p.type,p.career,p.group_name FROM access_events e JOIN people p ON p.id=e.person_id ORDER BY e.id DESC LIMIT 250`).all();return send(res,200,history);
 }
 if(req.method==='GET' && route==='/api/stream'){
  res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store','Connection':'keep-alive'});res.write(`event: ready\ndata: {}\n\n`);clients.add(res);req.on('close',()=>clients.delete(res));return;
 }
 if(req.method==='POST' && route==='/api/settings'){
  if(!can(user,'admin','direccion'))return fail(res,403,'Sin permiso para configurar parámetros.');
  const b=await jsonBody(req);
  const cap=Number(b.capacity);if(!Number.isInteger(cap)||cap<1||cap>200000)return fail(res,400,'Capacidad inválida.');
  let special='';if(b.special_until){special=new Date(b.special_until).toISOString();if(Date.parse(special)<=Date.now()||Date.parse(special)>Date.now()+7*86400_000)return fail(res,400,'El evento debe terminar dentro de los siguientes 7 días.');}
  putCfg('capacity',cap);putCfg('special_until',special);emitChange();return send(res,200,{ok:true,capacity:cap,specialUntil:special});
 }
 return fail(res,404,'Ruta no encontrada.');
}
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);
  if (['POST','PATCH','PUT','DELETE'].includes(req.method) && req.headers.origin){const origin=new URL(req.headers.origin);if(origin.host!==req.headers.host) return fail(res,403,'Origen no permitido.');}
  if(url.pathname.startsWith('/api/'))return await api(req,res,url);
  if(req.method!=='GET' && req.method!=='HEAD')return fail(res,405,'Método no permitido.');
  const relative=(url.pathname==='/'||url.pathname==='/admin')?'index.html':url.pathname==='/guard'?'guard.html':decodeURIComponent(url.pathname.slice(1));
  const target=path.resolve(ROOT,'public',relative);const pub=path.resolve(ROOT,'public');
  if(!target.startsWith(pub+path.sep)&&target!==path.join(pub,'index.html'))return fail(res,403,'Acceso no permitido.');
  let st;try{st=fs.statSync(target);}catch{return fail(res,404,'Archivo no encontrado.');}
  if(!st.isFile())return fail(res,404,'Archivo no encontrado.');
  res.writeHead(200,{'Content-Type':MIME[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
  if(req.method==='HEAD')res.end();else fs.createReadStream(target).pipe(res);
 }catch(e){console.error(e);fail(res,e.status||500,e.status?e.message:'Error interno del servidor.');}
});
setInterval(()=>{try{ensureRollover();guardOps.purgePhotos(db);}catch(e){console.error('Error en cierre automático o limpieza',e)}},60_000).unref();
if(require.main===module){server.listen(PORT,HOST,()=>{
 console.log(`ACCESO LINCE V0.5.2: http://localhost:${PORT}/`);
 console.log('LINCE GUARD: usa la app Android nativa (el kiosco web fue retirado).');
 if(HOST==='0.0.0.0'||HOST==='::'){
  for(const [name,list] of Object.entries(os.networkInterfaces())) for(const net of list||[]){
   if(net.family==='IPv4'&&!net.internal)console.log(`ANDROID (misma Wi-Fi, API): http://${net.address}:${PORT}  [${name}]`);
  }
 }
 console.log(DEMO?'DEMO LOCAL: solo red privada, usuarios ficticios, credenciales de prueba; HTTP sin cifrar.':'MODO INSTITUCIONAL LOCAL: datos desde cero; HTTP sin cifrar, no apto para informacion personal real.');
});}
module.exports={server,db,getStats,scan,ensureRollover};
