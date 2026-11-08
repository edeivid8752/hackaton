'use strict';
// LINCE ACCESS V0.2 — dos aplicaciones (Admin y Guard) con una base compartida.
// Requiere Node.js >= 22.13 (node:sqlite todavía experimental en Node 22).
const http = require('node:http');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, scryptSync, timingSafeEqual } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
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
if (!getCfg('last_day')) putCfg('last_day',dayOf());
if (!getCfg('capacity')) putCfg('capacity','500');
function payload(person){
 return {...person,inside:!!person.inside};
}
function personByCode(code){return db.prepare(`SELECT p.*, COALESCE(pr.inside,0) inside,pr.last_scan_at,pr.entered_at FROM people p LEFT JOIN presence pr ON pr.person_id=p.id WHERE UPPER(p.code)=?`).get(code.toUpperCase())||null;}
function runTransaction(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result}catch(e){db.exec('ROLLBACK');throw e;}}
function closingTimestamp(previousDay){
 // El timestamp real indica el momento de consolidación; la nota indica el día cerrado.
 return new Date().toISOString();
}
function ensureRollover(){
 const current = dayOf(),last = getCfg('last_day');
 if(current===last) return false;
 const special = getCfg('special_until');
 if(special && Date.parse(special)>Date.now()) return false;
 const when = closingTimestamp(last);
 runTransaction(()=>{
  const inside=db.prepare('SELECT person_id FROM presence WHERE inside=1').all();
  const add=db.prepare("INSERT INTO access_events(person_id,action,happened_at,operator,note) VALUES(?,'salida_automatica',?,'sistema',?)");
  const clear=db.prepare('UPDATE presence SET inside=0,entered_at=NULL WHERE person_id=?');
  for(const item of inside){add.run(item.person_id,when,`Cierre automático del día ${last}; salida no comprobada físicamente`);clear.run(item.person_id);}
  putCfg('last_day',current);
  if(special) putCfg('special_until','');
 });
 emitChange();return true;
}
function getStats(){
 const total=db.prepare('SELECT COUNT(*) n FROM presence WHERE inside=1').get().n;
 const types=db.prepare('SELECT p.type,COUNT(*) n FROM people p JOIN presence pr ON pr.person_id=p.id WHERE pr.inside=1 GROUP BY p.type').all();
 const career=db.prepare("SELECT COALESCE(NULLIF(p.career,''),'Sin carrera') name,COUNT(*) total FROM people p JOIN presence pr ON pr.person_id=p.id WHERE pr.inside=1 AND p.type='alumno' GROUP BY p.career ORDER BY total DESC").all();
 const groups=db.prepare("SELECT p.group_name name,COUNT(*) total FROM people p JOIN presence pr ON pr.person_id=p.id WHERE pr.inside=1 AND p.type='alumno' AND p.group_name<>'' GROUP BY p.group_name ORDER BY total DESC").all();
 const all=Object.fromEntries(types.map(x=>[x.type,x.n]));
 const today=dayOf();
 const todayEvents=db.prepare("SELECT happened_at FROM access_events WHERE action='entrada' AND happened_at>=?").all(new Date(Date.now()-48*3600_000).toISOString()).filter(e=>dayOf(new Date(e.happened_at))===today).length;
 return {total,alumnos:all.alumno||0,personal:(all.docente||0)+(all.administrativo||0),externos:(all.visitante||0)+(all.proveedor||0),todayEntries:todayEvents,capacity:Number(getCfg('capacity'))||500,career,groups,lastDay:getCfg('last_day'),specialUntil:getCfg('special_until')||''};
}
function emitChange(){for(const c of clients){try{c.write(`event: changed\ndata: ${JSON.stringify({at:new Date().toISOString()})}\n\n`)}catch(e){clients.delete(c)}}}
function scan(code,user){
 ensureRollover();
 if(!/^[A-Z0-9-]{3,48}$/i.test(code)) return {ok:false,reason:'Código inválido o vacío.'};
 const p=personByCode(code);
 if(!p)return {ok:false,reason:'Credencial no encontrada.'};
 if(p.status!=='activo')return {ok:false,reason:'Acceso denegado: usuario inactivo.',person:payload(p)};
 if(p.expires_at && Date.parse(p.expires_at)<Date.now())return {ok:false,reason:'Acceso denegado: autorización vencida.',person:payload(p)};
 const now = new Date();
 if(p.last_scan_at && now.getTime()-Date.parse(p.last_scan_at)<REBOUND_MS) return {ok:false,rebound:true,reason:'Escaneo repetido: movimiento ignorado.',person:payload(p)};
 const action=p.inside?'salida':'entrada';
 runTransaction(()=>{
  db.prepare('INSERT INTO access_events(person_id,action,happened_at,operator) VALUES(?,?,?,?)').run(p.id,action,now.toISOString(),user.login);
  db.prepare('INSERT INTO presence(person_id,inside,entered_at,last_scan_at) VALUES(?,?,?,?) ON CONFLICT(person_id) DO UPDATE SET inside=excluded.inside,entered_at=excluded.entered_at,last_scan_at=excluded.last_scan_at').run(p.id,action==='entrada'?1:0,action==='entrada'?now.toISOString():null,now.toISOString());
 });
 emitChange();return {ok:true,action,person:payload({...p,inside:action==='entrada'?1:0}),at:now.toISOString(),stats:getStats()};
}
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
function fail(res,status,message){send(res,status,{error:message});}
async function jsonBody(req){let chunks=[],size=0;for await(const ch of req){size+=ch.length;if(size>128*1024)throw Object.assign(new Error('Solicitud demasiado grande'),{status:413});chunks.push(ch);}let raw=Buffer.concat(chunks).toString('utf8');try{return raw?JSON.parse(raw):{}}catch{throw Object.assign(new Error('JSON inválido'),{status:400});}}
function auth(req){const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('lince_sid='))?.slice(10); const found = token && sessions.get(token);return found ? {...found,token}:null;}
function can(user,...roles){return !!user && roles.includes(user.role);}
function clean(x,max=120){return String(x||'').trim().slice(0,max);}
function publicPerson(p){return {id:p.id,code:p.code,name:p.name,type:p.type,career:p.career,group_name:p.group_name,status:p.status,inside:!!p.inside,reason:p.reason,host_name:p.host_name,expires_at:p.expires_at};}
async function api(req,res,url){
 const route=url.pathname;
 if(req.method==='POST' && route==='/api/login'){
  const {username,password}=await jsonBody(req);const login=clean(username,40).toLowerCase();const acc=accounts[login];
  const inputHash=hashPassword(String(password||''),acc?.salt||'unknown');
  if(!acc || !timingSafeEqual(Buffer.from(inputHash,'hex'),Buffer.from(acc.hash,'hex')))return fail(res,401,'Usuario o contraseña incorrectos.');
  const token=randomBytes(32).toString('hex');sessions.set(token,{login,role:acc.role});
  res.setHeader('Set-Cookie',`lince_sid=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`);
  return send(res,200,{login,role:acc.role});
 }
 const user=auth(req);
 if(!user)return fail(res,401,'Inicia sesión para continuar.');
 if(req.method==='POST' && route==='/api/logout') {sessions.delete(user.token);res.setHeader('Set-Cookie','lince_sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return send(res,200,{ok:true});}
 if(req.method==='GET' && route==='/api/me')return send(res,200,{login:user.login,role:user.role});
 if(req.method==='GET' && route==='/api/stats') {if(!can(user,'admin','direccion','guardia'))return fail(res,403,'Sin permiso');ensureRollover();return send(res,200,getStats());}
 if(req.method==='GET' && route==='/api/people'){
  if(!can(user,'admin','direccion'))return fail(res,403,'Sin permiso');
  const q=clean(url.searchParams.get('q'),80);const people=db.prepare(`SELECT p.*,COALESCE(pr.inside,0) inside FROM people p LEFT JOIN presence pr ON pr.person_id=p.id WHERE p.name LIKE ? OR p.code LIKE ? ORDER BY p.id DESC LIMIT 250`).all(`%${q}%`,`%${q}%`);
  return send(res,200,people.map(publicPerson));
 }
 if(req.method==='POST' && route==='/api/people'){
  if(!can(user,'admin'))return fail(res,403,'Solo administración puede crear usuarios.');
  const b=await jsonBody(req),type=clean(b.type),status=clean(b.status)||'activo',code=clean(b.code,48).toUpperCase(),name=clean(b.name);
  if(!['alumno','docente','administrativo'].includes(type)||!['activo','inactivo'].includes(status)||!/^[A-Z0-9-]{3,48}$/.test(code)||name.length<3)return fail(res,400,'Verifica nombre, tipo, estado y código.');
  try{
    db.prepare('INSERT INTO people(code,name,type,career,group_name,status,created_at) VALUES(?,?,?,?,?,?,?)').run(code,name,type,clean(b.career),clean(b.group_name,35),status,new Date().toISOString());emitChange();return send(res,201,{ok:true,code});
  }catch(e){if(e.message.includes('UNIQUE'))return fail(res,409,'Ese código ya existe.');throw e;}
 }
 if(req.method==='POST' && route==='/api/visitors'){
  if(!can(user,'admin','guardia'))return fail(res,403,'Sin permiso.');
  const b=await jsonBody(req),name=clean(b.name),type=clean(b.type),reason=clean(b.reason),host=clean(b.host_name);
  if(name.length<3 || !['visitante','proveedor'].includes(type)||reason.length<3||host.length<3)return fail(res,400,'Faltan nombre, tipo, motivo o persona responsable.');
  const expires = new Date(Date.now()+Math.max(1,Math.min(72,Number(b.hours)||8))*3600_000).toISOString();
  let code;do{code='VIS-'+randomBytes(4).toString('hex').toUpperCase()}while(personByCode(code));
  db.prepare('INSERT INTO people(code,name,type,status,expires_at,reason,host_name,created_at) VALUES(?,?,?,?,?,?,?,?)').run(code,name,type,'activo',expires,reason,host,new Date().toISOString());emitChange();return send(res,201,{ok:true,code,expires_at:expires});
 }
 if(req.method==='POST' && route==='/api/scan'){
  if(!can(user,'admin','guardia'))return fail(res,403,'Sin permiso.');
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
  if(!can(user,'admin','direccion'))return fail(res,403,'Sin permiso.');
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
  if (req.method==='POST' && req.headers.origin){const origin=new URL(req.headers.origin);if(origin.host!==req.headers.host) return fail(res,403,'Origen no permitido.');}
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
setInterval(()=>{try{ensureRollover()}catch(e){console.error('Error en cierre automático',e)}},60_000).unref();
if(require.main===module){server.listen(PORT,HOST,()=>{
 console.log(`LINCE ACCESS V0.2 ADMIN: http://localhost:${PORT}/`);
 console.log(`LINCE ACCESS V0.2 GUARD (en esta PC): http://localhost:${PORT}/guard.html`);
 if(HOST==='0.0.0.0'||HOST==='::'){
  for(const [name,list] of Object.entries(os.networkInterfaces())) for(const net of list||[]){
   if(net.family==='IPv4'&&!net.internal)console.log(`ANDROID (misma Wi-Fi): http://${net.address}:${PORT}/guard.html  [${name}]`);
  }
 }
 console.log('DEMO LOCAL: solo red privada, cuentas ficticias. La camara continua exige HTTPS.');
});}
module.exports={server,db,getStats,scan,ensureRollover};
