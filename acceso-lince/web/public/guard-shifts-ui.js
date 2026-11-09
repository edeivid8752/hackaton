'use strict';
// Turnos y relevos: vista exclusiva de Dirección y Administración.
const SHIFT_TEXT={programado:'Programado',relevo_pendiente:'Relevo pendiente',sin_cobertura:'Sin cobertura',en_servicio:'En servicio',finalizado:'Finalizado',cancelado:'Cancelado'};
const SHIFT_CSS={en_servicio:'active',relevo_pendiente:'attention',sin_cobertura:'problem',cancelado:'problem'};
let lastShiftLoad=0;
async function shiftLoad(){
 if(!state.user||!['admin','direccion'].includes(state.user.role))return;
 const ticket=++lastShiftLoad;
 try{
  const r=await request('/api/shifts');if(ticket!==lastShiftLoad||!state.user)return;
  for(const [id,key] of [['shiftInService','inService'],['shiftPending','pending'],['shiftUncovered','uncovered'],['shiftHandovers','pendingHandover']])$(id).textContent=r.summary[key]||0;
  const guardSelect=$('shiftGuard'),selected=guardSelect.value;
  guardSelect.innerHTML='<option value="">Selecciona un guardia activo</option>'+r.guards.map(g=>`<option value="${g.id}">${esc(g.name)} · ${esc(g.institutional_id||g.login)}</option>`).join('');
  guardSelect.value=r.guards.some(g=>String(g.id)===selected)?selected:'';
  $('shiftMessage').textContent=`${r.shifts.length} turno(s) registrados · ${r.guards.length} guardia(s) habilitados. Los inicios y relevos se confirmarán desde la próxima versión Android.`;
  $('shiftsTable').innerHTML=r.shifts.length?r.shifts.map(s=>{
    const pill=SHIFT_CSS[s.status]||'';
    return `<tr><td><strong>${esc(s.guard_name)}</strong><small>${esc(s.guard_id||s.guard_login)}</small></td>
    <td>${esc(formatDate(s.starts_at))}<span class="shift-secondary">hasta ${esc(formatDate(s.ends_at))}</span></td>
    <td>${esc(s.location)}</td><td><span class="shift-pill ${pill}">${esc(SHIFT_TEXT[s.status]||s.status)}</span>${s.started_at?`<span class="shift-secondary">Inicio real: ${esc(formatDate(s.started_at))}</span>`:''}${s.finished_at?`<span class="shift-secondary">Fin real: ${esc(formatDate(s.finished_at))}</span>`:''}</td>
    <td>${s.inside?'<span class="shift-pill active">Acceso registrado</span>':'<span class="shift-pill">Sin entrada vigente</span>'}</td>
    <td>${s.status==='programado'||s.status==='relevo_pendiente'||s.status==='sin_cobertura'?`<button type="button" class="btn-admin-state" data-shift-cancel="${s.id}">Cancelar</button>`:'—'}</td></tr>`;
   }).join(''):'<tr><td colspan="6" class="table-empty">Todavía no hay turnos. Programa el primero.</td></tr>';
  $('guardAccessTable').innerHTML=r.guardAccess.length?r.guardAccess.map(a=>`<tr><td><strong>${esc(a.guard_name)}</strong><small>${esc(a.guard_id)}</small></td><td>${esc(formatDate(a.happened_at))}</td><td><span class="shift-pill ${a.action==='entrada'?'active':''}">${a.action==='entrada'?'Entrada':a.action==='salida'?'Salida':esc(a.action)}</span></td><td>${esc(a.gate)}</td><td>${esc(a.operator)}</td></tr>`).join(''):'<tr><td colspan="5" class="table-empty">Aún no hay escaneos de guardias en el historial.</td></tr>';
  $('handoversTable').innerHTML=r.handovers.length?r.handovers.map(h=>`<tr><td>${esc(h.from_name)}</td><td>${esc(h.to_name)}</td><td>${esc(formatDate(h.offered_at))}</td><td><span class="shift-pill ${h.accepted_at?'active':'attention'}">${h.accepted_at?'Confirmado':'Pendiente'}</span></td></tr>`).join(''):'<tr><td colspan="4" class="table-empty">Todavía no hay relevos ofertados.</td></tr>';
 }catch(err){$('shiftMessage').textContent='No fue posible consultar los turnos: '+err.message;toast(err.message,true);}
}
function shiftInit(){
 $('shiftsRefresh').addEventListener('click',shiftLoad);
 $('shiftCreate').addEventListener('submit',async e=>{e.preventDefault();const fields=Object.fromEntries(new FormData(e.currentTarget));
  if(!fields.guard_account_id)return toast('Selecciona un guardia.',true);
  try{await post('/api/shifts',{guard_account_id:Number(fields.guard_account_id),location:fields.location,starts_at:new Date(fields.starts_at).toISOString(),ends_at:new Date(fields.ends_at).toISOString()});
   toast('Turno registrado en la agenda.');e.currentTarget.reset();e.currentTarget.elements.location.value='Acceso principal';await shiftLoad();
  }catch(err){toast(err.message,true);}
 });
 $('shiftsTable').addEventListener('click',async e=>{const b=e.target.closest('[data-shift-cancel]');if(!b)return;
  const reason=prompt('Motivo de cancelación del turno (mínimo 8 caracteres):');if(!reason)return;
  try{await post('/api/shifts/'+b.dataset.shiftCancel+'/cancel',{reason});toast('Turno cancelado con auditoría.');await shiftLoad();}catch(err){toast(err.message,true);}
 });
}
document.addEventListener('DOMContentLoaded',shiftInit);
