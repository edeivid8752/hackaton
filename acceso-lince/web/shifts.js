'use strict';
// Turnos de guardia: planificación web + API de servicio para la futura aplicación Android.
// El QR personal es para control de acceso físico; NO concede por sí solo una sesión operativa.
const ISO=s=>{const d=new Date(s);return Number.isFinite(d.getTime())?d.toISOString():null;};
const clean=(s,n=200)=>String(s??'').trim().slice(0,n);
const now=()=>new Date().toISOString();
const error=(text,status=400)=>Object.assign(new Error(text),{status});
function setup(db){
 db.exec(`CREATE TABLE IF NOT EXISTS guard_shifts (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 guard_account_id INTEGER NOT NULL REFERENCES accounts(id),
 location TEXT NOT NULL DEFAULT 'Acceso principal',
 starts_at TEXT NOT NULL, ends_at TEXT NOT NULL,
 started_at TEXT, finished_at TEXT,
 created_by TEXT NOT NULL, created_at TEXT NOT NULL,
 cancelled_at TEXT, cancelled_by TEXT, cancel_reason TEXT
 );
 CREATE TABLE IF NOT EXISTS guard_shift_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 shift_id INTEGER NOT NULL REFERENCES guard_shifts(id),
 action TEXT NOT NULL,
 actor TEXT NOT NULL, happened_at TEXT NOT NULL,
 notes TEXT NOT NULL DEFAULT ''
 );
 CREATE TABLE IF NOT EXISTS guard_handovers (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 from_shift_id INTEGER NOT NULL UNIQUE REFERENCES guard_shifts(id),
 to_shift_id INTEGER NOT NULL REFERENCES guard_shifts(id),
 offered_at TEXT NOT NULL, offered_by TEXT NOT NULL,
 accepted_at TEXT, accepted_by TEXT,
 notes TEXT NOT NULL DEFAULT ''
 );
 CREATE INDEX IF NOT EXISTS idx_guard_shift_dates ON guard_shifts(starts_at,ends_at);
 CREATE INDEX IF NOT EXISTS idx_guard_shift_guard ON guard_shifts(guard_account_id,starts_at);
 `);
}
function status(s,time=Date.now()){
 if(s.cancelled_at)return 'cancelado';
 if(s.finished_at)return 'finalizado';
 if(s.started_at)return 'en_servicio';
 if(Date.parse(s.ends_at)<=time)return 'sin_cobertura';
 if(Date.parse(s.starts_at)<=time)return 'relevo_pendiente';
 return 'programado';
}
const rowById=(db,id)=>db.prepare('SELECT * FROM guard_shifts WHERE id=?').get(id);
function guardOf(db,id){return db.prepare(`SELECT a.id,a.active,a.role,a.login,p.name,p.code,p.institutional_id,p.status person_status,
 COALESCE(pr.inside,0) inside FROM accounts a
 JOIN people p ON p.id=a.person_id LEFT JOIN presence pr ON pr.person_id=p.id WHERE a.id=? AND a.role='guardia'`).get(id);}
function safeGuard(db,id){const x=guardOf(db,id);if(!x||!x.active||x.person_status!=='activo')throw error('Guardia inexistente o cuenta desactivada.',409);return x;}
function list(db,personAccountId){
 const shifts=db.prepare(`SELECT s.*,a.login guard_login,a.active guard_active,p.name guard_name,p.institutional_id guard_id,p.code guard_qr,
 COALESCE(pr.inside,0) inside,pr.entered_at guard_entered_at,pr.last_scan_at guard_last_scan_at FROM guard_shifts s
 JOIN accounts a ON a.id=s.guard_account_id JOIN people p ON p.id=a.person_id
 LEFT JOIN presence pr ON pr.person_id=p.id
 ${personAccountId?'WHERE s.guard_account_id=?':''}
 ORDER BY s.starts_at DESC LIMIT 200`).all(...(personAccountId?[personAccountId]:[]));
 const handovers=db.prepare(`SELECT h.*, pf.name from_name,pt.name to_name FROM guard_handovers h
 JOIN guard_shifts fs ON fs.id=h.from_shift_id JOIN guard_shifts ts ON ts.id=h.to_shift_id
 JOIN accounts af ON af.id=fs.guard_account_id JOIN people pf ON pf.id=af.person_id
 JOIN accounts at ON at.id=ts.guard_account_id JOIN people pt ON pt.id=at.person_id
 ${personAccountId?'WHERE fs.guard_account_id=? OR ts.guard_account_id=?':''}
 ORDER BY h.id DESC LIMIT 100`).all(...(personAccountId?[personAccountId,personAccountId]:[]));
 const stamped=shifts.map(x=>({...x,status:status(x),inside:!!x.inside,guard_active:!!x.guard_active}));
 const guardAccess=db.prepare(`SELECT e.action,e.happened_at,e.gate,e.operator,p.name guard_name,p.institutional_id guard_id
 FROM access_events e JOIN people p ON p.id=e.person_id
 JOIN accounts a ON a.person_id=p.id AND a.role='guardia'
 ${personAccountId?'WHERE a.id=?':''}
 ORDER BY e.id DESC LIMIT 100`).all(...(personAccountId?[personAccountId]:[]));
 return {shifts:stamped,handovers,guardAccess,summary:{inService:stamped.filter(x=>x.status==='en_servicio').length,pending:stamped.filter(x=>x.status==='relevo_pendiente').length,uncovered:stamped.filter(x=>x.status==='sin_cobertura').length,pendingHandover:handovers.filter(h=>!h.accepted_at).length},serverTime:now()};
}
function event(db,id,action,actor,notes=''){db.prepare('INSERT INTO guard_shift_events(shift_id,action,actor,happened_at,notes) VALUES(?,?,?,?,?)').run(id,action,actor,now(),notes);}
function assertBelongs(db,s,user){if(user.role!=='guardia'||s.guard_account_id!==user.accountId)throw error('Solo el guardia asignado puede confirmar su turno.',403);safeGuard(db,user.accountId);}
function startService(db,s,user,runTransaction){
 assertBelongs(db,s,user);
 if(s.cancelled_at||s.started_at||s.finished_at)throw error('El turno no está disponible para iniciar.',409);
 const t=Date.now(),begin=Date.parse(s.starts_at),end=Date.parse(s.ends_at);
 if(t<begin-3*3600_000||t>end+3*3600_000)throw error('Turno fuera de la ventana permitida.',409);
 const active=db.prepare('SELECT id FROM guard_shifts WHERE guard_account_id=? AND started_at IS NOT NULL AND finished_at IS NULL AND cancelled_at IS NULL').get(user.accountId);
 if(active)throw error('Ya tienes otro turno en servicio.',409);
 runTransaction(()=>{db.prepare('UPDATE guard_shifts SET started_at=? WHERE id=?').run(now(),s.id);event(db,s.id,'inicio',user.login);});
 return {ok:true,shiftId:s.id,status:'en_servicio'};
}
function finishService(db,s,user,runTransaction){
 assertBelongs(db,s,user);
 if(s.cancelled_at||!s.started_at||s.finished_at)throw error('No hay turno activo para finalizar.',409);
 runTransaction(()=>{
  const t=now();db.prepare('UPDATE guard_shifts SET finished_at=? WHERE id=?').run(t,s.id);
  event(db,s.id,'fin',user.login,'Turno finalizado sin relevo confirmado');
  const h=db.prepare('SELECT id FROM guard_handovers WHERE from_shift_id=? AND accepted_at IS NULL').get(s.id);
  if(h){db.prepare('DELETE FROM guard_handovers WHERE id=?').run(h.id);event(db,s.id,'relevo_cancelado',user.login,'El turno terminó sin recepción confirmada');}
 });
 return {ok:true,shiftId:s.id,status:'finalizado'};
}
async function handle({req,res,url,user,db,send,fail,jsonBody,runTransaction,emitChange}){
 const route=url.pathname,admin=['admin','direccion'].includes(user.role),guard=user.role==='guardia';
 const reply=async(fn)=>{try{return await fn();}catch(e){if(e.status)return fail(res,e.status,e.message);if(/UNIQUE|FOREIGN KEY/.test(e.message||''))return fail(res,409,'Conflicto con otro registro.');throw e;}};
 if(req.method==='GET'&&route==='/api/shifts'){
  if(!admin)return fail(res,403,'Solo Dirección y Administración pueden supervisar turnos.');
  const result=list(db);
  result.guards=db.prepare(`SELECT a.id,a.login,p.name,p.institutional_id FROM accounts a
   JOIN people p ON p.id=a.person_id WHERE a.role='guardia' AND a.active=1 AND p.status='activo' ORDER BY p.name`).all();
  return send(res,200,result);
 }
 if(req.method==='GET'&&route==='/api/shifts/available-replacements'){
  if(!guard)return fail(res,403,'Solo un guardia activo puede consultar posibles relevos.');
  const fromId=Number(url.searchParams.get('from_shift_id'));
  if(!Number.isSafeInteger(fromId)||fromId<1)return fail(res,400,'Indica el turno que entregarás.');
  const current=rowById(db,fromId);
  if(!current||current.guard_account_id!==user.accountId)return fail(res,403,'Este turno no te pertenece.');
  if(!current.started_at||current.finished_at||current.cancelled_at)return fail(res,409,'Primero inicia tu turno antes de ofrecer relevo.');
  const rows=db.prepare(`SELECT s.id,s.starts_at,s.ends_at,s.location,p.name guard_name
   FROM guard_shifts s JOIN accounts a ON a.id=s.guard_account_id
   JOIN people p ON p.id=a.person_id
   WHERE s.guard_account_id<>? AND s.cancelled_at IS NULL AND s.finished_at IS NULL
     AND a.active=1 AND p.status='activo'
   ORDER BY s.starts_at ASC LIMIT 250`).all(user.accountId);
  const candidates=rows.filter(x=>Math.abs(Date.parse(x.starts_at)-Date.parse(current.ends_at))<=6*3600_000);
  return send(res,200,{candidates});
 }
 if(req.method==='GET'&&route==='/api/shifts/mine'){
  if(!guard)return fail(res,403,'Solo el personal de guardia puede consultar sus propios turnos.');
  return send(res,200,list(db,user.accountId));
 }
 if(req.method==='POST'&&route==='/api/shifts')return reply(async()=>{
  if(!admin)return fail(res,403,'Sin permiso para programar turnos.');
  const b=await jsonBody(req),id=Number(b.guard_account_id),location=clean(b.location,90),a=ISO(b.starts_at),z=ISO(b.ends_at);
  if(!Number.isSafeInteger(id)||id<1||!a||!z||Date.parse(z)<=Date.parse(a)||Date.parse(z)-Date.parse(a)>36*3600_000||Date.parse(z)<Date.now()-86400_000||!location)throw error('Guardia, fechas, duración (máximo 36 h) o ubicación inválidos.');
  safeGuard(db,id);
  const overlap=db.prepare('SELECT id FROM guard_shifts WHERE guard_account_id=? AND cancelled_at IS NULL AND ends_at>? AND starts_at<?').get(id,a,z);
  if(overlap)throw error('Ese guardia ya tiene otro turno programado en ese horario.',409);
  const inserted=runTransaction(()=>{const x=db.prepare('INSERT INTO guard_shifts(guard_account_id,location,starts_at,ends_at,created_by,created_at) VALUES(?,?,?,?,?,?)').run(id,location,a,z,user.login,now());event(db,Number(x.lastInsertRowid),'programado',user.login);return Number(x.lastInsertRowid);});
  emitChange();return send(res,201,{ok:true,id:inserted});
 });
 const match=route.match(/^\/api\/shifts\/(\d+)\/(cancel|start|finish|offer|accept)$/);
 if(req.method==='POST'&&match)return reply(async()=>{
  const id=Number(match[1]),action=match[2],s=rowById(db,id);if(!s)throw error('Turno no encontrado.',404);
  const b=await jsonBody(req),note=clean(b.reason||b.notes,300);
  if(action==='cancel'){
   if(!admin)throw error('Sin permiso.',403);
   if(s.cancelled_at||s.started_at)throw error('Solo se puede cancelar un turno aún no iniciado.',409);
   if(note.length<8)throw error('Indica por qué se cancela el turno (mínimo 8 caracteres).');
   runTransaction(()=>{db.prepare('UPDATE guard_shifts SET cancelled_at=?,cancelled_by=?,cancel_reason=? WHERE id=?').run(now(),user.login,note,id);event(db,id,'cancelado',user.login,note);});
   emitChange();return send(res,200,{ok:true});
  }
  if(action==='start'){
   const result=startService(db,s,user,runTransaction);emitChange();return send(res,200,result);
  }
  if(action==='finish'){
   const result=finishService(db,s,user,runTransaction);emitChange();return send(res,200,result);
  }
  if(action==='offer'){
   assertBelongs(db,s,user);
   if(!s.started_at||s.finished_at||s.cancelled_at)throw error('Primero debes iniciar tu turno.',409);
   const targetId=Number(b.to_shift_id),next=rowById(db,targetId);
   if(!next||next.cancelled_at||next.finished_at||next.guard_account_id===s.guard_account_id)throw error('Selecciona un turno entrante válido de otro guardia.',409);
   safeGuard(db,next.guard_account_id);
   if(Math.abs(Date.parse(next.starts_at)-Date.parse(s.ends_at))>6*3600_000)throw error('Los turnos deben estar separados por seis horas o menos.',409);
   if(db.prepare('SELECT id FROM guard_handovers WHERE from_shift_id=?').get(id))throw error('Ya existe una oferta de relevo.',409);
   runTransaction(()=>{db.prepare('INSERT INTO guard_handovers(from_shift_id,to_shift_id,offered_at,offered_by,notes) VALUES(?,?,?,?,?)').run(id,next.id,now(),user.login,note);event(db,id,'relevo_ofrecido',user.login,'Turno entrante #'+next.id+' '+note);});
   emitChange();return send(res,201,{ok:true,fromShiftId:id,toShiftId:next.id});
  }
  if(action==='accept'){
   assertBelongs(db,s,user);
   const h=db.prepare('SELECT * FROM guard_handovers WHERE to_shift_id=? AND accepted_at IS NULL ORDER BY id DESC LIMIT 1').get(id);
   if(!h)throw error('No hay un relevo pendiente dirigido a este turno.',409);
   const prev=rowById(db,h.from_shift_id);if(!prev?.started_at||prev.finished_at||prev.cancelled_at||s.cancelled_at||s.finished_at)throw error('El relevo ya no está disponible.',409);
   if(!s.started_at){const t=Date.now();if(t<Date.parse(s.starts_at)-3*3600_000||t>Date.parse(s.ends_at)+3*3600_000)throw error('No estás en la ventana de tu turno.',409);}
   const other=db.prepare('SELECT id FROM guard_shifts WHERE guard_account_id=? AND started_at IS NOT NULL AND finished_at IS NULL AND cancelled_at IS NULL AND id<>?').get(user.accountId,s.id);
   if(other)throw error('Ya tienes otro turno en servicio.',409);
   runTransaction(()=>{const t=now();if(!s.started_at)db.prepare('UPDATE guard_shifts SET started_at=? WHERE id=?').run(t,id);
    db.prepare('UPDATE guard_shifts SET finished_at=? WHERE id=?').run(t,prev.id);
    db.prepare('UPDATE guard_handovers SET accepted_at=?,accepted_by=? WHERE id=?').run(t,user.login,h.id);
    event(db,prev.id,'relevo_entregado',user.login,'Recibe turno #'+id);
    event(db,id,'relevo_recibido',user.login,'Entrega turno #'+prev.id);
   });emitChange();return send(res,200,{ok:true,previousShiftId:prev.id,currentShiftId:id});
  }
 });
 return false;
}
module.exports={setup,handle,status};
