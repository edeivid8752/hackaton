// Gestión de dispositivos vinculados y supervisión de entradas fotográficas.
'use strict';
async function deviceLoad(){
 if(!state.user||!['admin','direccion'].includes(state.user.role))return;
 try{
  const r=await request('/api/devices');
  $('devicesMessage').textContent=`${r.devices.filter(d=>d.active).length} Android(s) autorizados · ${r.pending.length} vinculación(es) sin utilizar.`;
  $('devicesTable').innerHTML=r.devices.length?r.devices.map(d=>`<tr><td><strong>${esc(d.name)}</strong><small>${esc(formatDate(d.enrolled_at))}</small></td><td>${esc(d.gate)}</td><td>${esc(formatDate(d.last_seen_at))}<small>Último operador: ${esc(d.last_guard_login||'—')}</small></td><td><span class="shift-pill ${d.active?'active':'problem'}">${d.active?'Autorizado':'Revocado'}</span></td><td>${d.active?`<button type="button" class="btn-admin-state" data-device-revoke="${d.id}">Revocar</button>`:'—'}</td></tr>`).join(''):'<tr><td colspan="5" class="table-empty">Aún no hay Androids autorizados.</td></tr>';
 }catch(e){$('devicesMessage').textContent='No se pudo consultar la lista: '+e.message;}
}
async function expressLoad(){
 if(!state.user||!['admin','direccion'].includes(state.user.role))return;
 try{
  const r=await request('/api/express-entries');
  $('expressMessage').textContent=`${r.entries.length} entrada(s) exprés recientes.`;
  $('expressTable').innerHTML=r.entries.length?r.entries.map(e=>`<tr><td><strong>${e.kind==='proveedor'?'Proveedor':'Visitante'}</strong><small>${esc(e.code)}</small></td><td>${esc(formatDate(e.recorded_at))}</td><td>${esc(e.operator)}</td><td>${esc(e.gate)}</td><td><span class="shift-pill ${e.inside?'active':''}">${e.inside?'Dentro':'Fuera'}</span></td><td>${e.photo_available?`<a target="_blank" rel="noopener" class="btn-admin-state" href="/api/express-entries/${e.id}/photo">Ver foto (temporal)</a>`:'Foto eliminada'}</td></tr>`).join(''):'<tr><td colspan="6" class="table-empty">Aún no hay entradas exprés.</td></tr>';
 }catch(e){$('expressMessage').textContent='No se pudo consultar la bitácora: '+e.message;}
}
function operationsInit(){
 $('devicesRefresh').addEventListener('click',deviceLoad);$('expressRefresh').addEventListener('click',expressLoad);
 $('devicePairForm').addEventListener('submit',async ev=>{
  ev.preventDefault();const f=Object.fromEntries(new FormData(ev.currentTarget));
  try{const r=await post('/api/devices/pair',f);
   $('devicePairResult').innerHTML=`<strong>Vinculación de: ${esc(r.name)}</strong><span class="device-pair-code">${esc(r.pair_code)}</span><span class="device-small">Caduca: ${esc(formatDate(r.expires_at))} · Un solo uso</span><button type="button" id="devicePairCopy" class="btn btn-outline">Copiar código</button>`;
   $('devicePairCopy').addEventListener('click',()=>{if(navigator.clipboard)navigator.clipboard.writeText(r.pair_code).then(()=>toast('Código copiado.')).catch(()=>toast('Selecciona el código y cópialo.'));});
   toast('Vinculación generada.');ev.currentTarget.reset();await deviceLoad();
  }catch(e){toast(e.message,true);}
 });
 $('devicesTable').addEventListener('click',async ev=>{const button=ev.target.closest('[data-device-revoke]');if(!button)return;
  const reason=prompt('Motivo de revocación (mínimo 8 caracteres):');if(!reason)return;
  try{await post('/api/devices/'+button.dataset.deviceRevoke+'/revoke',{reason});toast('Android revocado.');await deviceLoad();}catch(e){toast(e.message,true);}
 });
}
document.addEventListener('DOMContentLoaded',operationsInit);
