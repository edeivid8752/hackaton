'use strict';
// ACCESO LINCE 0.5.2: dispositivos autorizados, acceso rápido por gafete (sin PIN)
// y registro exprés de visitantes/proveedores. Prototipo en LAN, NO de producción.
const {randomBytes,createHash,createCipheriv,createDecipheriv,timingSafeEqual}=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const str=(s,n=128)=>String(s??'').trim().slice(0,n);
const sha=s=>createHash('sha256').update(s).digest('hex');
const err=(message,status=400)=>Object.assign(new Error(message),{status});
const now=()=>new Date().toISOString();
const permit= u=>u&&['direccion','admin'].includes(u.role);
const enrolFailures=new Map();
const loginFailures=new Map();
function recordAttempt(map,ip,good=false){
 const previous=map.get(ip)||{n:0,until:0};
 if(good){map.delete(ip);return;}
 if(Date.now()>previous.until){previous.n=0;previous.until=Date.now()+15*60_000;}
 previous.n++;map.set(ip,previous);
}
function limited(map,ip){const v=map.get(ip);return !!v&&v.until>Date.now()&&v.n>=10;}
function safeHashCompare(a,b){return typeof a==='string'&&typeof b==='string'&&/^[a-f0-9]{64}$/.test(a)&&/^[a-f0-9]{64}$/.test(b)&&timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));}
function setup(db){
 db.exec(`CREATE TABLE IF NOT EXISTS guard_devices(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, gate TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  enrolled_at TEXT NOT NULL, enrolled_by TEXT NOT NULL,
  last_seen_at TEXT, last_guard_login TEXT, last_guard_at TEXT, revoked_at TEXT, revoked_by TEXT
 );
 CREATE TABLE IF NOT EXISTS guard_device_pairs(
  id INTEGER PRIMARY KEY AUTOINCREMENT, code_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL, gate TEXT NOT NULL,
  created_by TEXT NOT NULL, created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL, used_at TEXT
 );
 CREATE TABLE IF NOT EXISTS express_entries(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL REFERENCES people(id),
  kind TEXT NOT NULL CHECK(kind IN ('visitante','proveedor')),
  photo_cipher BLOB NOT NULL, photo_iv BLOB NOT NULL, photo_tag BLOB NOT NULL,
  photo_mime TEXT NOT NULL DEFAULT 'image/jpeg', request_key TEXT,
  photo_expires_at TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  operator TEXT NOT NULL,
  device_id INTEGER REFERENCES guard_devices(id),
  gate TEXT NOT NULL,
  document_checked INTEGER NOT NULL DEFAULT 0,
  notice_confirmed INTEGER NOT NULL DEFAULT 0
 );
 CREATE INDEX IF NOT EXISTS idx_guard_devices_active ON guard_devices(revoked_at);
 CREATE INDEX IF NOT EXISTS idx_express_date ON express_entries(recorded_at);
 CREATE UNIQUE INDEX IF NOT EXISTS ux_express_idempotency ON express_entries(device_id,request_key) WHERE request_key IS NOT NULL;
 `);
}
function findDevice(db,token){
 if(typeof token!=='string'||!/^dev_[a-f0-9]{64}$/.test(token))return null;
 const h=sha(token);const row=db.prepare('SELECT * FROM guard_devices WHERE token_hash=? AND revoked_at IS NULL').get(h);
 if(!row||!safeHashCompare(h,row.token_hash))return null;
 return row;
}
const publicDevice=x=>({id:x.id,name:x.name,gate:x.gate,enrolled_at:x.enrolled_at,last_seen_at:x.last_seen_at,last_guard_login:x.last_guard_login,last_guard_at:x.last_guard_at,active:!x.revoked_at});
function checkDeviceSession(db,req,session){
 if(!session.deviceId)return true;
 const d=findDevice(db,str(req.headers['x-lince-device-token'],128));return !!d&&d.id===session.deviceId;
}
function keyFile(){return process.env.LINCE_EXPRESS_PHOTO_KEY_FILE||path.join(__dirname,'.lince-photo-key');}
function getKey(){
 if(process.env.LINCE_EXPRESS_PHOTO_KEY){const x=process.env.LINCE_EXPRESS_PHOTO_KEY; if(!/^[0-9a-f]{64}$/i.test(x))throw err('Clave de fotografías mal configurada',503);return Buffer.from(x,'hex');}
 const loc=keyFile();if(fs.existsSync(loc)){const key=fs.readFileSync(loc);if(key.length!==32)throw err('Clave privada de fotografías inválida',503);return key;}
 const key=randomBytes(32);try{fs.writeFileSync(loc,key,{flag:'wx',mode:0o600});}catch(e){if(e.code==='EEXIST')return fs.readFileSync(loc);throw e;}
 return key;
}
function encrypt(bytes){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',getKey(),iv);return {photo_cipher:Buffer.concat([c.update(bytes),c.final()]),photo_iv:iv,photo_tag:c.getAuthTag()};}
function decrypt(row){const d=createDecipheriv('aes-256-gcm',getKey(),row.photo_iv);d.setAuthTag(row.photo_tag);return Buffer.concat([d.update(row.photo_cipher),d.final()]);}
// Privacidad: al vencer la retención, destruimos la imagen y conservamos únicamente la entrada.
function purgePhotos(db){return db.prepare('UPDATE express_entries SET photo_cipher=X\'\',photo_iv=X\'\',photo_tag=X\'\' WHERE photo_expires_at<? AND length(photo_cipher)>0').run(now()).changes;}
async function handle({req,res,url,user,db,send,fail,jsonBody,runTransaction,emitChange,makeSession}){
 const route=url.pathname,method=req.method,ip=String(req.socket.remoteAddress||'local');
 const reply=async fn=>{try{return await fn();}catch(e){if(e.status)return fail(res,e.status,e.message);if(/UNIQUE|FOREIGN KEY/.test(e.message||''))return fail(res,409,'Registro duplicado o referencia inválida.');throw e;}};
 if(method==='POST'&&route==='/api/devices/enroll')return reply(async()=>{
  if(limited(enrolFailures,ip))throw err('Demasiados intentos de vinculación.',429);
  const b=await jsonBody(req),code=str(b.pair_code,32).toUpperCase();
  if(!/^[A-F0-9]{16}$/.test(code)){recordAttempt(enrolFailures,ip);throw err('Código de vinculación inválido.',401);}
  const pair=db.prepare('SELECT * FROM guard_device_pairs WHERE code_hash=? AND used_at IS NULL AND expires_at>?').get(sha(code),now());
  if(!pair){recordAttempt(enrolFailures,ip);throw err('Código expirado, utilizado o inválido.',401);}
  const token='dev_'+randomBytes(32).toString('hex');const enrolled=now();
  const device=runTransaction(()=>{
   const updated=db.prepare('UPDATE guard_device_pairs SET used_at=? WHERE id=? AND used_at IS NULL AND expires_at>?').run(enrolled,pair.id,enrolled);
   if(updated.changes!==1)throw err('El código ya fue utilizado.',409);
   return Number(db.prepare('INSERT INTO guard_devices(name,gate,token_hash,enrolled_at,enrolled_by) VALUES(?,?,?,?,?)').run(pair.name,pair.gate,sha(token),enrolled,pair.created_by).lastInsertRowid);
  });recordAttempt(enrolFailures,ip,true);emitChange();return send(res,201,{ok:true,device:{id:device,name:pair.name,gate:pair.gate},device_token:token,notice:'Guarda el token en Android Keystore. Se muestra solo una vez.'});
 });
 if(method==='POST'&&route==='/api/guard/qr-login')return reply(async()=>{
  if(limited(loginFailures,ip))throw err('Demasiados intentos; contacta a Administración.',429);
  const dev=findDevice(db,str(req.headers['x-lince-device-token'],128));
  if(!dev){recordAttempt(loginFailures,ip);throw err('Android no vinculado o desactivado.',403);}
  const b=await jsonBody(req),code=str(b.code,64).toUpperCase();
  const guard=/^[A-Z0-9-]{3,48}$/.test(code)?db.prepare(`SELECT a.id,a.login,a.role,a.person_id,a.active,p.status,p.expires_at FROM people p JOIN accounts a ON a.person_id=p.id WHERE p.code=? AND a.role='guardia'`).get(code):null;
  if(!guard||!guard.active||guard.status!=='activo'||(guard.expires_at&&Date.parse(guard.expires_at)<Date.now())){recordAttempt(loginFailures,ip);throw err('Gafete no válido para iniciar como vigilante.',403);}
  recordAttempt(loginFailures,ip,true);
  db.prepare('UPDATE guard_devices SET last_seen_at=?,last_guard_login=?,last_guard_at=? WHERE id=?').run(now(),guard.login,now(),dev.id);
  makeSession(res,{accountId:guard.id,personId:guard.person_id,role:'guardia',login:guard.login,deviceId:dev.id,expiresAt:Date.now()+4*3600_000},4*3600);
  return send(res,200,{ok:true,role:'guardia',login:guard.login,personId:guard.person_id,device:{id:dev.id,name:dev.name,gate:dev.gate},expires_in_seconds:4*3600});
 });
 if(!user)return false;
 if(method==='GET'&&route==='/api/devices'){
  if(!permit(user))return fail(res,403,'Sin permiso.');
  return send(res,200,{devices:db.prepare('SELECT * FROM guard_devices ORDER BY id DESC').all().map(publicDevice),pending:db.prepare('SELECT id,name,gate,expires_at,created_by FROM guard_device_pairs WHERE used_at IS NULL AND expires_at>? ORDER BY id DESC LIMIT 20').all(now())});
 }
 if(method==='POST'&&route==='/api/devices/pair')return reply(async()=>{
  if(!permit(user))throw err('Solo Dirección y Administración autorizan dispositivos.',403);
  const b=await jsonBody(req),name=str(b.name,70),gate=str(b.gate,70);
  if(name.length<3||gate.length<3)throw err('Indica nombre y ubicación del Android.');
  const code=randomBytes(8).toString('hex').toUpperCase(),expires=new Date(Date.now()+10*60_000).toISOString();
  db.prepare('INSERT INTO guard_device_pairs(code_hash,name,gate,created_by,created_at,expires_at) VALUES(?,?,?,?,?,?)').run(sha(code),name,gate,user.login,now(),expires);
  return send(res,201,{ok:true,pair_code:code,expires_at:expires,name,gate,notice:'Código de un solo uso; no se puede recuperar posteriormente.'});
 });
 const revoke=route.match(/^\/api\/devices\/(\d+)\/revoke$/);
 if(method==='POST'&&revoke)return reply(async()=>{
  if(!permit(user))throw err('Sin permiso.',403);
  const b=await jsonBody(req);if(str(b.reason,200).length<8)throw err('Indica una justificación de al menos 8 caracteres.');
  const d=db.prepare('UPDATE guard_devices SET revoked_at=?,revoked_by=? WHERE id=? AND revoked_at IS NULL').run(now(),user.login,Number(revoke[1]));
  if(!d.changes)throw err('Dispositivo inexistente o ya revocado.',404);emitChange();return send(res,200,{ok:true});
 });
 if(method==='POST'&&route==='/api/express-entry')return reply(async()=>{
  if(user.role!=='guardia')throw err('Solo LINCE GUARD puede registrar entradas exprés.',403);
  // Esta función requiere un Android enlazado. Las sesiones antiguas de contraseña siguen operando el escáner normal.
  const dev=user.deviceId?db.prepare('SELECT * FROM guard_devices WHERE id=? AND revoked_at IS NULL').get(user.deviceId):null;
  if(!dev)throw err('Vincula este Android para registrar visitantes exprés.',403);
  const b=await jsonBody(req,1400*1024);
  const requestKey=str(b.request_id,80);
  if(!/^[A-Za-z0-9_-]{16,80}$/.test(requestKey))throw err('Se requiere identificador único del intento para evitar doble entrada.',400);
  const existing=db.prepare('SELECT id,person_id FROM express_entries WHERE device_id=? AND request_key=?').get(dev.id,requestKey);
  if(existing)return send(res,200,{ok:true,duplicate:true,...existing,warning:'Esta captura ya se registró; no se creó otra entrada.'});
  const kind=str(b.kind,20),source=str(b.photo_type,30);
  if(!['visitante','proveedor'].includes(kind)||source!==(kind==='visitante'?'ine':'gafete'))throw err('Tipo de documento inválido.');
  if(b.document_checked!==true||b.notice_confirmed!==true)throw err('El guardia debe verificar el documento original e informar del tratamiento de la imagen.');
  const photo=String(b.photo_data||'');
  if(!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo))throw err('Se requiere fotografía JPG, PNG o WEBP.',400);
  const bytes=Buffer.from(photo.split(',')[1],'base64');
  if(bytes.length<2048||bytes.length>900*1024)throw err('Fotografía inválida o demasiado grande (máximo 900 KB).',413);
  const mime=photo.match(/^data:image\/(jpeg|png|webp)/)[1];
  if(!((mime==='jpeg'&&bytes[0]===255&&bytes[1]===216)||(mime==='png'&&bytes.subarray(0,4).toString('hex')==='89504e47')||(mime==='webp'&&bytes.subarray(0,4).toString()==='RIFF')))throw err('El contenido de la imagen no coincide con el formato.');
  // No hacemos OCR de documentos oficiales ni pretendemos verificar su autenticidad.
  const enc=encrypt(bytes),recorded=now(),expiry=new Date(Date.now()+24*3600_000).toISOString();
  const code='EXT-'+randomBytes(9).toString('hex').toUpperCase();
  const label=kind==='visitante'?'Visitante (registro fotográfico)':'Proveedor (registro fotográfico)';
  const result=runTransaction(()=>{
   const p=db.prepare(`INSERT INTO people(code,name,type,status,expires_at,reason,host_name,created_at) VALUES(?,?,?,?,?,?,?,?)`).run(code,label,kind,'activo',new Date(Date.now()+8*3600_000).toISOString(),`Ingreso exprés por fotografía de ${source}`,'Identidad pendiente de registro nominal',recorded);
   const id=Number(p.lastInsertRowid);
   db.prepare('INSERT INTO presence(person_id,inside,entered_at,last_scan_at) VALUES(?,?,?,?)').run(id,1,recorded,recorded);
   db.prepare('INSERT INTO access_events(person_id,action,happened_at,gate,operator,note) VALUES(?,?,?,?,?,?)').run(id,'entrada',recorded,dev.gate,user.login,'Entrada exprés; documento revisado visualmente, sin verificación OCR.');
   const e=db.prepare('INSERT INTO express_entries(person_id,kind,photo_cipher,photo_iv,photo_tag,photo_mime,request_key,photo_expires_at,recorded_at,operator,device_id,gate,document_checked,notice_confirmed) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,1,1)').run(id,kind,enc.photo_cipher,enc.photo_iv,enc.photo_tag,'image/'+mime,requestKey,expiry,recorded,user.login,dev.id,dev.gate);
   return {id:Number(e.lastInsertRowid),person_id:id};
  });
  emitChange();return send(res,201,{ok:true,...result,kind,code,operator:user.login,gate:dev.gate,recorded_at:recorded,photo_expires_at:expiry,warning:'Ingreso registrado. La fotografía NO acredita por sí misma la identidad ni autorización.'});
 });
 if(method==='GET'&&route==='/api/express-entries'){
  if(!permit(user))return fail(res,403,'Solo Dirección y Administración.');
  purgePhotos(db);
  const entries=db.prepare(`SELECT e.id,e.person_id,e.kind,e.photo_expires_at,e.recorded_at,e.operator,e.gate,e.device_id,e.document_checked,p.code,p.name,pr.inside FROM express_entries e JOIN people p ON p.id=e.person_id LEFT JOIN presence pr ON pr.person_id=p.id ORDER BY e.id DESC LIMIT 150`).all();
  return send(res,200,{entries:entries.map(e=>({...e,photo_available:Date.parse(e.photo_expires_at)>Date.now()}))});
 }
 const photo=route.match(/^\/api\/express-entries\/(\d+)\/photo$/);
 if(method==='GET'&&photo)return reply(async()=>{
  if(!permit(user))throw err('Sin permiso para consultar fotografías.',403);
  purgePhotos(db);
  const row=db.prepare('SELECT * FROM express_entries WHERE id=?').get(Number(photo[1]));
  if(!row||Date.parse(row.photo_expires_at)<=Date.now()||!row.photo_cipher.length)throw err('Imagen vencida o no disponible.',404);
  const data=decrypt(row);
  // No incluir datos en reportes/JSON. Se entrega solo bajo sesión administrativa.
  res.writeHead(200,{'Content-Type':row.photo_mime,'Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'",'X-Content-Type-Options':'nosniff','Content-Disposition':'inline'});res.end(data);return;
 });
 return false;
}
module.exports={setup,findDevice,checkDeviceSession,handle,purgePhotos};
