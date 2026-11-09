'use strict';
const {randomBytes,scryptSync,timingSafeEqual}=require('node:crypto');
const {qrSvg}=require('./qr-svg');
const {parseBulk,zipFiles}=require('./bulk-import');
const uploads=new Map();
const TYPES=['alumno','docente','administrativo','visitante','proveedor'];
const ROLES=['direccion','admin','guardia','alumno'];
function makeCode(){return 'LIN-'+randomBytes(7).toString('hex').toUpperCase();}
function randomPassword(){return randomBytes(15).toString('base64url');}
const passHash=(password,salt)=>scryptSync(password,salt,32).toString('hex');
const clean=(s,len=120)=>String(s??'').trim().slice(0,len);
function setup(db,demo){
 const cols=db.prepare('PRAGMA table_info(people)').all().map(x=>x.name);
 for(const [col,def] of [['institutional_id','TEXT'],['photo_data','TEXT'],['staff_role',"TEXT NOT NULL DEFAULT ''"],['first_surname',"TEXT NOT NULL DEFAULT ''"]])if(!cols.includes(col))db.exec(`ALTER TABLE people ADD COLUMN ${col} ${def}`);
 db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ux_people_institutional ON people(institutional_id) WHERE institutional_id IS NOT NULL AND institutional_id<>'';
 CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  login TEXT NOT NULL COLLATE NOCASE UNIQUE,
  role TEXT NOT NULL CHECK(role IN ('direccion','admin','guardia','alumno')),
  person_id INTEGER UNIQUE REFERENCES people(id),
  salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL DEFAULT 'sistema',
  created_at TEXT NOT NULL
 );
 CREATE TABLE IF NOT EXISTS day_closures (
  day TEXT PRIMARY KEY, closed_at TEXT NOT NULL, inside_pending INTEGER NOT NULL DEFAULT 0,
  special_event TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT ''
 );
 CREATE TABLE IF NOT EXISTS special_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
  starts_at TEXT NOT NULL, ends_at TEXT NOT NULL,
  created_by TEXT NOT NULL, created_at TEXT NOT NULL,
  cancelled_at TEXT, cancelled_by TEXT, cancel_reason TEXT
 );
 CREATE TABLE IF NOT EXISTS event_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, event_id INTEGER NOT NULL REFERENCES special_events(id),
  actor TEXT NOT NULL, action TEXT NOT NULL, previous TEXT NOT NULL, current TEXT NOT NULL, changed_at TEXT NOT NULL
 );
 CREATE TABLE IF NOT EXISTS access_corrections (
  id INTEGER PRIMARY KEY AUTOINCREMENT, person_id INTEGER NOT NULL REFERENCES people(id),
  event_id INTEGER NOT NULL REFERENCES access_events(id),
  actor TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL
 );
 CREATE TABLE IF NOT EXISTS qr_rotations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL REFERENCES people(id),
  old_code TEXT NOT NULL, new_code TEXT NOT NULL,
  actor TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL
 );
 CREATE INDEX IF NOT EXISTS idx_accounts_roles ON accounts(role,active);
 `);
 function demoAccount(login,role,password,id,name){
  if(db.prepare('SELECT id FROM accounts WHERE login=?').get(login))return;
  const salt=randomBytes(16).toString('hex');let person=db.prepare('SELECT id FROM people WHERE institutional_id=?').get(id);
  if(!person){const code=makeCode();const result=db.prepare('INSERT INTO people(code,name,type,institutional_id,staff_role,created_at) VALUES(?,?,?,?,?,?)').run(code,name,'administrativo',id,role,new Date().toISOString());person={id:Number(result.lastInsertRowid)};}
  db.prepare('INSERT INTO accounts(login,role,person_id,salt,password_hash,created_by,created_at) VALUES(?,?,?,?,?,?,?)').run(login,role,person.id,salt,passHash(password,salt),'demo',new Date().toISOString());
 }
 if(demo){demoAccount('direccion','direccion','Direccion123!','DIR-DEMO','Dirección de prueba');demoAccount('admin','admin','Admin123!','ADM-DEMO','Administración de prueba');demoAccount('guardia','guardia','Guardia123!','SEG-DEMO','Guardia de prueba');}
 const eventColumns=db.prepare('PRAGMA table_info(special_events)').all().map(x=>x.name);
 for(const col of ['cancelled_at','cancelled_by','cancel_reason'])if(!eventColumns.includes(col))db.exec(`ALTER TABLE special_events ADD COLUMN ${col} TEXT`);
 if(!demo && process.env.LINCE_BOOTSTRAP_DIRECTOR_ID && process.env.LINCE_BOOTSTRAP_DIRECTOR_PASSWORD && db.prepare("SELECT COUNT(*) n FROM accounts WHERE role='direccion'").get().n===0){
  const id=clean(process.env.LINCE_BOOTSTRAP_DIRECTOR_ID,48).toUpperCase(),pw=process.env.LINCE_BOOTSTRAP_DIRECTOR_PASSWORD;
  if(id.length>=4&&pw.length>=12){const salt=randomBytes(16).toString('hex');const person=db.prepare("INSERT INTO people(code,name,type,institutional_id,staff_role,created_at) VALUES(?,?,?,?,?,?)").run(makeCode(),clean(process.env.LINCE_BOOTSTRAP_DIRECTOR_NAME||'Dirección institucional'), 'administrativo',id,'direccion',new Date().toISOString());db.prepare('INSERT INTO accounts(login,role,person_id,salt,password_hash,created_by,created_at) VALUES(?,?,?,?,?,?,?)').run(id,'direccion',Number(person.lastInsertRowid),salt,passHash(pw,salt),'bootstrap',new Date().toISOString());}
 }
}
function authenticate(db,login,password){const a=db.prepare('SELECT a.* FROM accounts a LEFT JOIN people p ON p.id=a.person_id WHERE a.active=1 AND (a.login=? COLLATE NOCASE OR p.institutional_id=? COLLATE NOCASE) LIMIT 1').get(clean(login,60),clean(login,60));if(!a)return null;
 const supplied=passHash(String(password||''),a.salt);
 if(!timingSafeEqual(Buffer.from(supplied,'hex'),Buffer.from(a.password_hash,'hex')))return null;
 return {login:a.login,role:a.role,accountId:a.id,personId:a.person_id};
}
function createAccount(db,{login,role,personId,password,creator}){
 const salt=randomBytes(16).toString('hex');return db.prepare('INSERT INTO accounts(login,role,person_id,salt,password_hash,created_by,created_at) VALUES(?,?,?,?,?,?,?)').run(login,role,personId,salt,passHash(password,salt),creator,new Date().toISOString());
}
function studentPassword(name,firstSurname,matricula,demo){
 if(!demo)return randomPassword();
 // Educational only: recognizable institution pattern, not suitable for real identities.
 const pieces=clean(name).split(/\s+/),last=clean(firstSurname);
 const first=(pieces[0]||'L').normalize('NFD').replace(/[\u0300-\u036f]/g,'').charAt(0).toUpperCase();
 const surname=last.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().slice(0,3).padEnd(3,'x');
 return last&&/^\d{4,}$/.test(matricula)?first+surname+'.'+matricula.slice(-4):randomPassword();
}
function newPerson(db,body,user,{demo=true}={}){
 const type=clean(body.type),name=clean(body.name),id=clean(body.institutional_id||body.matricula||body.code,48).toUpperCase(),staff=clean(body.staff_role,24);
 if(!['alumno','docente','administrativo'].includes(type)||name.length<3||id.length<4||!(/^[\p{L}0-9 .\-]+$/u.test(id)))throw Object.assign(new Error('Faltan nombre, categoría o identificación válida.'),{status:400});
 if(type==='alumno'&&!/^\d{4,20}$/.test(id))throw Object.assign(new Error('La matrícula debe contener de 4 a 20 dígitos.'),{status:400});
 if(staff&&!['','admin','direccion','guardia'].includes(staff))throw Object.assign(new Error('Cargo no válido.'),{status:400});
 const code=clean(body.code,48).toUpperCase()||makeCode(),status=clean(body.status)||'activo';
 if(!/^[A-Z0-9-]{3,48}$/.test(code)||!['activo','inactivo'].includes(status))throw Object.assign(new Error('Código o estado inválido.'),{status:400});
 const career=clean(body.career),group=clean(body.group_name,35),surname=clean(body.first_surname),photo=clean(body.photo_data,160000);
 if(photo&&!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(photo))throw Object.assign(new Error('Fotografía inválida.'),{status:400});
 const result=db.prepare('INSERT INTO people(code,name,type,career,group_name,status,institutional_id,staff_role,first_surname,photo_data,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(code,name,type,career,group,status,id,staff,surname,photo||null,new Date().toISOString());
 const personId=Number(result.lastInsertRowid);let initialPassword=null;
 if(type==='alumno'){
  initialPassword=studentPassword(name,surname,id,demo);
  createAccount(db,{login:id,role:'alumno',personId,password:initialPassword,creator:user.login});
 }
 return {ok:true,id:personId,code,institutional_id:id,createdAccount:type==='alumno',initialPassword};
}
function canSee(user,personId){return ['admin','direccion'].includes(user.role)||Number(user.personId)===Number(personId);}
function publicAccount(a){return {id:a.id,login:a.login,role:a.role,active:!!a.active,person_id:a.person_id,name:a.name,code:a.code,institutional_id:a.institutional_id};}
async function handle({req,res,url,user,db,send,fail,jsonBody,runTransaction,emitChange,getStats,dayOf,TZ,DEMO}){
 const route=url.pathname;
 if(!user)return false;
 const admin=['admin','direccion'].includes(user.role),director=user.role==='direccion';
 if(req.method==='GET'&&route==='/api/profile'){
  const p=user.personId?db.prepare('SELECT p.*,COALESCE(pr.inside,0) inside FROM people p LEFT JOIN presence pr ON pr.person_id=p.id WHERE p.id=?').get(user.personId):null;
  if(!p)return send(res,200,{login:user.login,role:user.role,profile:null});
  return send(res,200,{login:user.login,role:user.role,profile:{id:p.id,name:p.name,code:p.code,type:p.type,institutional_id:p.institutional_id,career:p.career,group_name:p.group_name,staff_role:p.staff_role,photo_data:p.photo_data,inside:!!p.inside,status:p.status}});
 }
 if(req.method==='GET'&&route==='/api/my-attendance'){
  if(!user.personId)return fail(res,404,'Sin expediente vinculado.');
  const events=db.prepare('SELECT id,action,happened_at,gate,note FROM access_events WHERE person_id=? ORDER BY id DESC LIMIT 500').all(user.personId);
  const days=[...new Set(events.filter(e=>e.action==='entrada').map(e=>dayOf(new Date(e.happened_at))))];
  return send(res,200,{daysWithAccess:days.length,days,events,notice:'Sin acceso no equivale automáticamente a falta académica.'});
 }
 if(req.method==='GET'&&/^\/api\/qr\/\d+\.svg$/.test(route)){
  const id=Number(route.match(/\d+/)[0]);if(!canSee(user,id))return fail(res,403,'No puedes descargar esta credencial.');
  const p=db.prepare('SELECT code,status FROM people WHERE id=?').get(id);if(!p)return fail(res,404,'Persona no encontrada.');
  if(p.status!=='activo')return fail(res,409,'La credencial está desactivada.');
  res.writeHead(200,{'Content-Type':'image/svg+xml; charset=utf-8','Content-Disposition':`${url.searchParams.has('download')?'attachment':'inline'}; filename="lince-qr-${id}.svg"`,'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store','Content-Security-Policy':"default-src 'none'; img-src 'none'"});res.end(qrSvg(p.code));return true;
 }
 if(req.method==='POST'&&/^\/api\/people\/\d+\/rotate-qr$/.test(route)){
  if(!admin)return fail(res,403,'Sin permiso.');const id=Number(route.match(/\d+/)[0]);
  const reason=clean((await jsonBody(req)).reason,250);
  if(reason.length<8)return fail(res,400,'Escribe el motivo de reposición del QR (8 caracteres mínimo).');
  const p=db.prepare('SELECT id,code FROM people WHERE id=?').get(id);
  if(!p)return fail(res,404,'Persona no encontrada.');
  if(db.prepare('SELECT inside FROM presence WHERE person_id=?').get(id)?.inside)return fail(res,409,'Registra la salida antes de reemplazar una credencial.');
  const code=makeCode();runTransaction(()=>{
   db.prepare('UPDATE people SET code=? WHERE id=?').run(code,id);
   db.prepare('INSERT INTO qr_rotations(person_id,old_code,new_code,actor,reason,created_at) VALUES(?,?,?,?,?,?)').run(id,p.code,code,user.login,reason,new Date().toISOString());
  });emitChange();return send(res,200,{ok:true,id,code,note:'El QR anterior queda revocado. El historial de movimientos se conserva.'});
 }
 if(req.method==='GET'&&route==='/api/accounts'){
  if(!admin)return fail(res,403,'Sin permiso.');const role=clean(url.searchParams.get('role'),20);
  if(role==='admin'&&!director)return fail(res,403,'Solo Dirección puede gestionar administradores.');
  if(!['admin','guardia'].includes(role))return fail(res,400,'Selecciona administradores o guardias.');
  const rows=db.prepare('SELECT a.id,a.login,a.role,a.active,a.person_id,p.name,p.code,p.institutional_id FROM accounts a LEFT JOIN people p ON p.id=a.person_id WHERE a.role=? ORDER BY a.id DESC').all(role);
  return send(res,200,rows.map(publicAccount));
 }
 if(req.method==='POST'&&route==='/api/accounts'){
  const b=await jsonBody(req);const role=clean(b.role),id=clean(b.institutional_id,48).toUpperCase(),name=clean(b.name);
  if(!(role==='admin'&&director)&&!(role==='guardia'&&admin))return fail(res,403,'No tienes permiso para crear este rol.');
  if(name.length<3||!(/^[A-Z0-9-]{4,48}$/.test(id)))return fail(res,400,'Nombre o identificador institucional inválido.');
  const password=randomPassword();let created;
  try{created=runTransaction(()=>{
   const person=db.prepare('INSERT INTO people(code,name,type,status,institutional_id,staff_role,created_at) VALUES(?,?,?,?,?,?,?)').run(makeCode(),name,'administrativo','activo',id,role,new Date().toISOString());const pid=Number(person.lastInsertRowid);
   const account=createAccount(db,{login:id,role,personId:pid,password,creator:user.login});return {id:Number(account.lastInsertRowid),personId:pid};
  });}catch(e){if(/UNIQUE/.test(e.message))return fail(res,409,'Identificación ya registrada.');throw e;}
  emitChange();return send(res,201,{ok:true,login:id,initialPassword:password,...created});
 }
 if(req.method==='POST'&&/^\/api\/accounts\/\d+\/reset$/.test(route)){
  if(!admin)return fail(res,403,'Sin permiso.');
  const id=Number(route.match(/\d+/)[0]);const account=db.prepare('SELECT id,role,login FROM accounts WHERE id=?').get(id);
  if(!account)return fail(res,404,'Cuenta no encontrada.');
  if(account.role==='direccion'||(account.role==='admin'&&!director))return fail(res,403,'No puedes restablecer esta cuenta.');
  const password=randomPassword(),salt=randomBytes(16).toString('hex');
  db.prepare('UPDATE accounts SET salt=?,password_hash=? WHERE id=?').run(salt,passHash(password,salt),id);
  return send(res,200,{ok:true,login:account.login,initialPassword:password});
 }
 if(req.method==='POST'&&/^\/api\/students\/\d+\/reset$/.test(route)){
  if(!admin)return fail(res,403,'Sin permiso.');
  const id=Number(route.match(/\d+/)[0]);const account=db.prepare("SELECT id,login FROM accounts WHERE role='alumno' AND person_id=?").get(id);
  if(!account)return fail(res,404,'Alumno sin cuenta vinculada.');
  const password=randomPassword(),salt=randomBytes(16).toString('hex');
  db.prepare('UPDATE accounts SET salt=?,password_hash=? WHERE id=?').run(salt,passHash(password,salt),account.id);
  return send(res,200,{ok:true,login:account.login,initialPassword:password});
 }
 if(req.method==='PATCH'&&/^\/api\/accounts\/\d+$/.test(route)){
  const id=Number(route.split('/').at(-1)),a=db.prepare('SELECT * FROM accounts WHERE id=?').get(id);
  if(!a)return fail(res,404,'Cuenta no encontrada.');
  if(!(a.role==='admin'&&director)&&!(a.role==='guardia'&&admin))return fail(res,403,'No tienes permiso.');
  if(a.id===user.accountId)return fail(res,409,'No puedes desactivar tu propia cuenta desde esta sección.');
  const b=await jsonBody(req);if(!['activo','inactivo'].includes(b.status))return fail(res,400,'Estado inválido.');
  const active=b.status==='activo'?1:0;
  if(!active&&a.role==='direccion'&&db.prepare("SELECT COUNT(*) n FROM accounts WHERE role='direccion' AND active=1").get().n<=1)return fail(res,409,'Debe permanecer una cuenta directiva activa.');
  if(!active&&a.person_id&&db.prepare('SELECT inside FROM presence WHERE person_id=?').get(a.person_id)?.inside)return fail(res,409,'Primero registra la salida del campus.');
  runTransaction(()=>{db.prepare('UPDATE accounts SET active=? WHERE id=?').run(active,id);if(a.person_id)db.prepare('UPDATE people SET status=? WHERE id=?').run(active?'activo':'inactivo',a.person_id);});emitChange();return send(res,200,{ok:true});
 }
 if(req.method==='POST'&&route==='/api/import/preview'){
  if(!admin)return fail(res,403,'Sin permiso para importar estudiantes.');
  const b=await jsonBody(req,8*1024*1024);let students;
  try{students=parseBulk(clean(b.filename,160),b.content_base64);}catch(e){return fail(res,400,e.message);}
  const seen=new Set();let ok=0;
  const rows=students.map(s=>{
   let error='';if(!/^\d{4,20}$/.test(s.institutional_id))error='Matrícula inválida';
   else if(s.name.length<3)error='Nombre incompleto';
   else if(!s.first_surname)error='Falta el primer apellido';
   else if(seen.has(s.institutional_id))error='Matrícula duplicada en el archivo';
   else if(db.prepare('SELECT id FROM people WHERE institutional_id=?').get(s.institutional_id))error='Matrícula ya registrada';
   seen.add(s.institutional_id);if(!error)ok++;return {...s,error};
  });
  const token=randomBytes(20).toString('hex');uploads.set(token,{rows,by:user.accountId,created:Date.now(),exported:[]});
  for(const [key,value] of uploads)if(Date.now()-value.created>20*60_000)uploads.delete(key);
  return send(res,200,{token,total:rows.length,valid:ok,invalid:rows.length-ok,rows:rows.slice(0,1000)});
 }
 if(req.method==='POST'&&route==='/api/import/commit'){
  if(!admin)return fail(res,403,'Sin permiso.');const b=await jsonBody(req);const saved=uploads.get(clean(b.token,60));
  if(!saved||saved.by!==user.accountId||Date.now()-saved.created>20*60_000)return fail(res,404,'Vista previa caducada. Vuelve a subir el Excel.');
  if(saved.committed)return fail(res,409,'Esta importación ya se ejecutó.');
  const good=saved.rows.filter(r=>!r.error);let imported=[];
  try{imported=runTransaction(()=>good.map(r=>newPerson(db,{...r,type:'alumno'},user,{demo:DEMO})));}
  catch(e){if(/UNIQUE/.test(e.message))return fail(res,409,'Hay matrículas duplicadas. Vuelve a generar la vista previa.');throw e;}
  saved.committed=true;saved.exported=imported.map((p,i)=>({id:p.id,code:p.code,matricula:p.institutional_id,name:good[i].name}));
  emitChange();return send(res,201,{ok:true,total:saved.rows.length,imported:imported.length,rejected:saved.rows.length-imported.length,exportToken:b.token,note:'Las contraseñas no se incluyen en exportaciones compartidas.'});
 }
 if(req.method==='GET'&&route==='/api/import/export'){
  if(!admin)return fail(res,403,'Sin permiso.');const token=clean(url.searchParams.get('token'),60),saved=uploads.get(token);
  if(!saved||saved.by!==user.accountId||!saved.committed)return fail(res,404,'Exportación no encontrada.');
  const escapeCsv=s=>{const a=String(s??'');return '"'+(/^[=+\-@\t\r]/.test(a)?"'":'')+a.replaceAll('"','""')+'"';};
  const rows=[['matricula','nombre','codigo_qr'],...saved.exported.map(p=>[p.matricula,p.name,p.code])];
  const files=[['matriculas_y_codigos.csv','\uFEFF'+rows.map(r=>r.map(escapeCsv).join(',')).join('\r\n')]];
  for(const p of saved.exported)files.push([`codigos/${p.matricula}.svg`,qrSvg(p.code)]);
  const zip=zipFiles(files);res.writeHead(200,{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="lince-qr-estudiantes.zip"','Cache-Control':'private,no-store','X-Content-Type-Options':'nosniff','Content-Length':zip.length});res.end(zip);return true;
 }
 if(req.method==='GET'&&route==='/api/events'){
  if(!admin)return fail(res,403,'Sin permiso.');return send(res,200,db.prepare('SELECT * FROM special_events ORDER BY starts_at DESC LIMIT 50').all());
 }
 if(req.method==='POST'&&route==='/api/events'){
  if(!admin)return fail(res,403,'Sin permiso.');const b=await jsonBody(req),name=clean(b.name,100),start=new Date(b.starts_at),end=new Date(b.ends_at);
  if(name.length<3||!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start||end-start>7*86400_000||end.getTime()<Date.now())return fail(res,400,'Evento inválido. Duración máxima de siete días.');
  const overlap=db.prepare('SELECT id FROM special_events WHERE cancelled_at IS NULL AND ends_at>? AND starts_at<?').get(start.toISOString(),end.toISOString());if(overlap)return fail(res,409,'Ya existe un evento en ese horario.');
  const result=db.prepare('INSERT INTO special_events(name,starts_at,ends_at,created_by,created_at) VALUES(?,?,?,?,?)').run(name,start.toISOString(),end.toISOString(),user.login,new Date().toISOString());emitChange();return send(res,201,{ok:true,id:Number(result.lastInsertRowid)});
 }
 if(req.method==='PATCH'&&/^\/api\/events\/\d+$/.test(route)){
  if(!admin)return fail(res,403,'Sin permiso.');const id=Number(route.split('/').at(-1));
  const old=db.prepare('SELECT * FROM special_events WHERE id=?').get(id);
  if(!old)return fail(res,404,'Evento no encontrado.');if(old.cancelled_at)return fail(res,409,'Este evento ya fue cancelado.');
  const b=await jsonBody(req);const now=new Date().toISOString();let changes,action;
  if(b.action==='cancel'){
   const reason=clean(b.reason,250);if(reason.length<8)return fail(res,400,'Escribe el motivo de cancelación.');
   action='cancelar';changes={...old,cancelled_at:now,cancelled_by:user.login,cancel_reason:reason};
   runTransaction(()=>{db.prepare('UPDATE special_events SET cancelled_at=?,cancelled_by=?,cancel_reason=? WHERE id=?').run(now,user.login,reason,id);db.prepare('INSERT INTO event_changes(event_id,actor,action,previous,current,changed_at) VALUES(?,?,?,?,?,?)').run(id,user.login,action,JSON.stringify(old),JSON.stringify(changes),now);});
  }else{
   const name=clean(b.name,100),start=new Date(b.starts_at),end=new Date(b.ends_at);
   if(name.length<3||!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start||end-start>7*86400_000||end.getTime()<Date.now())return fail(res,400,'Fechas o nombre del evento inválidos.');
   const overlap=db.prepare('SELECT id FROM special_events WHERE cancelled_at IS NULL AND id<>? AND ends_at>? AND starts_at<?').get(id,start.toISOString(),end.toISOString());if(overlap)return fail(res,409,'La jornada se superpone a otro evento.');
   action='editar';changes={...old,name,starts_at:start.toISOString(),ends_at:end.toISOString()};
   runTransaction(()=>{db.prepare('UPDATE special_events SET name=?,starts_at=?,ends_at=? WHERE id=?').run(name,start.toISOString(),end.toISOString(),id);db.prepare('INSERT INTO event_changes(event_id,actor,action,previous,current,changed_at) VALUES(?,?,?,?,?,?)').run(id,user.login,action,JSON.stringify(old),JSON.stringify(changes),now);});
  }
  emitChange();return send(res,200,{ok:true,action});
 }
 if(req.method==='POST'&&route==='/api/corrections/exit'){
  if(!admin)return fail(res,403,'Sin permiso.');const b=await jsonBody(req),id=Number(b.person_id),reason=clean(b.reason,300);
  if(reason.length<12)return fail(res,400,'La justificación debe tener al menos 12 caracteres.');
  const person=db.prepare('SELECT id FROM people WHERE id=?').get(id);if(!person)return fail(res,404,'Persona no encontrada.');
  if(!db.prepare('SELECT inside FROM presence WHERE person_id=?').get(id)?.inside)return fail(res,409,'La persona no figura dentro del campus.');
  const at=new Date().toISOString();runTransaction(()=>{
   const ev=db.prepare("INSERT INTO access_events(person_id,action,happened_at,operator,note) VALUES(?,'salida',?,?,?)").run(id,at,user.login,'Corrección manual: '+reason);
   db.prepare('INSERT INTO access_corrections(person_id,event_id,actor,reason,created_at) VALUES(?,?,?,?,?)').run(id,Number(ev.lastInsertRowid),user.login,reason,at);
   db.prepare('UPDATE presence SET inside=0,entered_at=NULL,last_scan_at=NULL WHERE person_id=?').run(id);
  });emitChange();return send(res,201,{ok:true});
 }
 return false;
}
module.exports={setup,authenticate,newPerson,makeCode,handle};
