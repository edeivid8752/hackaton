'use strict';
// ACCESO LINCE V0.5 enhancements. Reuses the original V0.4 SPA and appearance palette.
let v05ImportToken='',v05ImportCommitted=false,v05CurrentProfile=null,v05EventEditId=null;
async function v05Navigate(view){
 try{
  if(view==='profile')await v05Profile(false);
  if(view==='student')await v05Student();
  if(view==='accounts')await v05Accounts();
  if(view==='events')await v05Events();
 }catch(err){toast(err.message,true);}
}
function v05OnChange(){if(state.view==='student')v05Student();if(state.view==='accounts')v05Accounts();if(state.view==='events')v05Events();}
function v05ProfileCard(p,login,role){
 if(!p)return '<div class="v05-note">La cuenta no tiene un expediente vinculado.</div>';
 const photo=p.photo_data&&/^data:image\/(png|jpeg|webp);base64,/.test(p.photo_data)?`<img class="v05-photo" src="${p.photo_data}" alt="Fotografía de la persona"/>`:'<span class="v05-photo v05-photo-empty" aria-hidden="true">♙</span>';
 return `<div class="v05-profile-intro">${photo}<div><span class="eyebrow">IDENTIFICACIÓN ACCESO LINCE</span><h3>${esc(p.name)}</h3><p>${esc(p.institutional_id||login)} · ${esc(p.staff_role||p.type)}</p><p>${esc(p.career||'')}${p.group_name?' · '+esc(p.group_name):''}</p><span class="state-pill ${p.status==='activo'?'yes':'off'}">${esc(p.status)}</span></div></div><div class="v05-credential"><img src="/api/qr/${p.id}.svg" alt="Código QR individual del usuario"/><div><strong>Mi código de acceso</strong><p>Reconocido por LINCE GUARD Android</p><code>${esc(p.code)}</code><p><a class="btn btn-orange" href="/api/qr/${p.id}.svg?download=1">↓ Descargar QR</a> <button type="button" class="btn btn-outline" data-my-card="1">↓ Credencial PNG</button></p></div></div><p class="v05-note">QR para acceso físico. No contiene contraseña ni permisos de la cuenta. No es una identificación oficial de UAdeO.</p>`;
}
async function v05Profile(forStudent){
 const data=await request('/api/profile');v05CurrentProfile=data.profile;const el=forStudent?$('studentCard'):$('profileCard');if(el)el.innerHTML=v05ProfileCard(data.profile,data.login,data.role);
}
async function v05Student(){
 if(state.user?.role!=='alumno')return;
 const [profile,data]=await Promise.all([request('/api/profile'),request('/api/my-attendance')]);v05CurrentProfile=profile.profile;
 $('studentCard').innerHTML=v05ProfileCard(profile.profile,profile.login,profile.role);
 $('studentDays').textContent=data.daysWithAccess;$('studentMoves').textContent=data.events.length;
 const today=new Date(),year=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Mazatlan',year:'numeric'}).format(today)),month=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Mazatlan',month:'numeric'}).format(today));
 const first=new Date(Date.UTC(year,month-1,1));const lead=(first.getUTCDay()+6)%7;const days=new Date(Date.UTC(year,month,0)).getUTCDate();
 let html=`<div class="v05-calendar-title">${esc(new Intl.DateTimeFormat('es-MX',{month:'long',year:'numeric',timeZone:'UTC'}).format(first))}</div><div class="v05-calendar-grid">`;
 for(const d of ['L','M','M','J','V','S','D'])html+=`<strong>${d}</strong>`;
 for(let i=0;i<lead;i++)html+='<span class="v05-empty"></span>';
 const matches=new Set(data.days);
 for(let i=1;i<=days;i++){const key=`${year}-${String(month).padStart(2,'0')}-${String(i).padStart(2,'0')}`;const found=matches.has(key);html+=`<span class="${found?'v05-attended':''}" title="${found?'Entrada registrada':'Sin información confirmada'}">${i}</span>`;}
 $('studentCalendar').innerHTML=html+'</div><p class="v05-note">● Verde: entrada registrada. Los demás días no equivalen a faltas académicas.</p>';
 $('studentEvents').innerHTML=data.events.length?data.events.slice(0,35).map(e=>`<div class="activity-item"><span class="activity-icon">${e.action==='entrada'?'↙':'↗'}</span><div class="activity-main"><strong>${e.action==='entrada'?'Entrada':e.action==='salida'?'Salida':'Cierre histórico'}</strong><small>${esc(formatDate(e.happened_at))}</small></div></div>`).join(''):'<div class="empty-state">Aún no se registran accesos en tu historial.</div>';
}
async function v05Accounts(){
 if(!['admin','direccion'].includes(state.user?.role))return;
 const select=$('accountRole');select.querySelector('option[value="admin"]').disabled=state.user.role!=='direccion';
 if(state.user.role!=='direccion')select.value='guardia';
 const roles=state.user.role==='direccion'?['admin','guardia']:['guardia'];
 const lists=await Promise.all(roles.map(role=>request('/api/accounts?role='+role)));
 const data=lists.flat();
 $('accountsTable').innerHTML=data.length?data.map(a=>`<tr><td><strong>${esc(a.name)}</strong><small>${esc(a.institutional_id||a.login)}</small></td><td>${a.role==='admin'?'Administración':'Guardia'}</td><td><span class="state-pill ${a.active?'yes':'off'}">${a.active?'Activo':'Inactivo'}</span></td><td><div class="v05-row-actions"><a class="btn-admin-state" href="/api/qr/${a.person_id}.svg?download=1">↓ QR</a><button type="button" class="btn-admin-state" data-reset="${a.id}">Reponer clave</button><button type="button" class="btn-admin-state" data-account="${a.id}" data-active="${a.active?1:0}" ${a.login===state.user.login?'disabled':''}>${a.active?'Desactivar':'Activar'}</button></div></td></tr>`).join(''):'<tr><td colspan="4">Sin cuentas registradas.</td></tr>';
}
async function v05Events(){
 if(!['admin','direccion'].includes(state.user?.role))return;
 const list=await request('/api/events');
 $('eventsList').innerHTML=list.length?list.map(e=>`<div class="v05-event-item"><strong>${esc(e.name)}${e.cancelled_at?' · CANCELADO':''}</strong><small>${esc(formatDate(e.starts_at))} → ${esc(formatDate(e.ends_at))}</small><small>Autorizó: ${esc(e.created_by)}</small>${e.cancelled_at?`<small>Canceló: ${esc(e.cancelled_by)} · ${esc(e.cancel_reason)}</small>`:`<div class="v05-row-actions"><button class="btn-admin-state" type="button" data-event-edit="${e.id}" data-name="${esc(e.name)}" data-start="${esc(e.starts_at)}" data-end="${esc(e.ends_at)}">Editar</button><button type="button" class="btn-admin-state" data-event-cancel="${e.id}">Cancelar</button></div>`}</div>`).join(''):'<div class="v05-note">Aún no hay jornadas extendidas programadas.</div>';
}
async function v05ResizePhoto(file){
 if(file.size>6*1024*1024)throw Error('Fotografía máxima: 6 MB.');
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Formato de foto no compatible.');
 const img=await new Promise((resolve,reject)=>{const image=new Image();const url=URL.createObjectURL(file);image.onload=()=>{URL.revokeObjectURL(url);resolve(image);};image.onerror=()=>{URL.revokeObjectURL(url);reject(Error('No se pudo leer la fotografía.'));};image.src=url;});
 const scale=Math.min(1,360/Math.max(img.naturalWidth,img.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',0.70);
}
function v05ReadBase64(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>{const bytes=new Uint8Array(reader.result);let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));resolve(btoa(binary));};reader.onerror=()=>reject(Error('No se pudo leer el archivo.'));reader.readAsArrayBuffer(file);});}
async function v05ImportPreview(e){
 e.preventDefault();const file=$('importFile').files?.[0];if(!file)return toast('Selecciona el archivo.',true);
 if(file.size>5*1024*1024)return toast('Archivo máximo: 5 MB.',true);
 $('importSummary').textContent='Analizando datos…';$('importConfirm').classList.add('hidden');$('importDownload').classList.add('hidden');
 try{const body={filename:file.name,content_base64:await v05ReadBase64(file)};const r=await post('/api/import/preview',body);
  v05ImportToken=r.token;v05ImportCommitted=false;
  $('importSummary').textContent=`${r.total} filas · ${r.valid} listas para importar · ${r.invalid} por corregir. Vista previa de las primeras 80:`;
  $('importTable').innerHTML=r.rows.slice(0,80).map(p=>`<tr><td>${p.line}</td><td>${esc(p.institutional_id)}</td><td>${esc(p.name)}</td><td><span class="state-pill ${p.error?'off':'yes'}">${esc(p.error||'Válido')}</span></td></tr>`).join('');
  $('importConfirm').classList.toggle('hidden',r.valid===0);toast('Vista previa lista; revisa antes de confirmar.');
 }catch(err){$('importSummary').textContent=err.message;toast(err.message,true);}
}
async function v05ImportCommit(){
 if(!v05ImportToken||v05ImportCommitted)return;if(!confirm('¿Confirmas la creación de todas las cuentas válidas de esta importación?'))return;
 const button=$('importConfirm');button.disabled=true;
 try{const r=await post('/api/import/commit',{token:v05ImportToken});v05ImportCommitted=true;
  $('importSummary').textContent=`Importación completada: ${r.imported} estudiantes y cuentas con QR. ${r.rejected} registros rechazados. Las contraseñas no se incluyen en el ZIP.`;
  button.classList.add('hidden');const download=$('importDownload');download.href='/api/import/export?token='+encodeURIComponent(r.exportToken);download.classList.remove('hidden');toast('Estudiantes creados. Puedes descargar sus QR.');
 }catch(err){toast(err.message,true);}finally{button.disabled=false;}
}
async function v05DownloadCard(){
 const p=v05CurrentProfile;if(!p||p.status!=='activo')return toast('No hay credencial activa.',true);
 const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=620;const ctx=canvas.getContext('2d');
 ctx.fillStyle='#fbf8f3';ctx.fillRect(0,0,1000,620);
 ctx.fillStyle='#6a2340';ctx.fillRect(0,0,1000,118);
 ctx.fillStyle='#ffffff';ctx.font='bold 44px Segoe UI,Arial';ctx.fillText('ACCESO LINCE',50,73);
 ctx.font='20px Segoe UI,Arial';ctx.fillText('CREDENCIAL DIGITAL · PROTOTIPO',50,103);
 const imgLoad=src=>new Promise(resolve=>{if(!src)return resolve(null);const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>resolve(null);im.src=src;});
 const [qr,photo,logo]=await Promise.all([imgLoad(`/api/qr/${p.id}.svg`),imgLoad(p.photo_data||''),imgLoad('/assets/uadeo-logo.png')]);
 if(!qr)throw Error('No se pudo dibujar el QR. Comprueba la sesión.');
 if(logo){ctx.fillStyle='#fff';ctx.beginPath();ctx.roundRect(870,10,112,98,12);ctx.fill();ctx.drawImage(logo,877,14,95,90);}
 ctx.fillStyle='#e6dfd7';ctx.beginPath();ctx.roundRect(48,160,196,226,15);ctx.fill();
 if(photo){const ratio=Math.max(196/photo.naturalWidth,226/photo.naturalHeight),w=photo.naturalWidth*ratio,h=photo.naturalHeight*ratio;ctx.save();ctx.beginPath();ctx.roundRect(48,160,196,226,15);ctx.clip();ctx.drawImage(photo,48+(196-w)/2,160+(226-h)/2,w,h);ctx.restore();}
 else {ctx.fillStyle='#75445c';ctx.font='bold 105px Segoe UI,Arial';ctx.textAlign='center';ctx.fillText((p.name||'U').charAt(0).toUpperCase(),147,310);ctx.textAlign='start';}
 ctx.fillStyle='#462638';ctx.font='bold 29px Segoe UI,Arial';
 const full=String(p.name||'').trim();let line='',y=210;
 for(const word of full.split(/\s+/)){const maybe=line?line+' '+word:word;if(ctx.measureText(maybe).width>425&&line){ctx.fillText(line,274,y);y+=37;line=word;}else line=maybe;}
 if(line)ctx.fillText(line,274,y);
 const meta=[String(p.institutional_id||''),String(p.career||p.staff_role||p.type||''),String(p.group_name?'Grupo '+p.group_name:'')].filter(Boolean);
 ctx.font='21px Segoe UI,Arial';ctx.fillStyle='#53495b';let yy=Math.max(295,y+44);
 for(const value of meta){ctx.fillText(value.slice(0,37),274,yy);yy+=33;}
 ctx.fillStyle='#fff';ctx.fillRect(702,156,262,262);ctx.drawImage(qr,712,166,242,242);
 ctx.fillStyle='#462638';ctx.font='bold 22px Segoe UI,Arial';ctx.fillText('QR DE ACCESO',730,450);
 ctx.fillStyle='#6f5969';ctx.font='19px Segoe UI,Arial';ctx.fillText(p.code,705,480);
 ctx.fillStyle='#6a2340';ctx.fillRect(0,535,1000,85);
 ctx.fillStyle='#fff';ctx.font='18px Segoe UI,Arial';ctx.fillText('Campus Mazatlán · Uso exclusivo del prototipo ACCESO LINCE',50,570);
 ctx.font='16px Segoe UI,Arial';ctx.fillText('NO ES IDENTIFICACIÓN OFICIAL DE UAdeO',50,597);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
 if(!blob)throw Error('No se pudo generar la imagen.');
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='LINCE_CREDENCIAL_'+String(p.institutional_id||p.id).replace(/[^A-Za-z0-9-]/g,'')+'.png';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('Credencial digital descargada.');
}
function v05Bind(){
 for(const card of [$('profileCard'),$('studentCard')])card.addEventListener('click',e=>{if(e.target.closest('[data-my-card]'))v05DownloadCard().catch(err=>toast(err.message,true));});
 const roleSelector=document.querySelector('#personForm select[name=type]'),surname=document.querySelector('#personForm input[name=first_surname]');
 const syncSurname=()=>{surname.required=roleSelector.value==='alumno';};roleSelector.addEventListener('change',syncSurname);syncSurname();
 $('accountCreate').addEventListener('submit',async e=>{
  e.preventDefault();const body=Object.fromEntries(new FormData(e.currentTarget));
  try{const r=await post('/api/accounts',body);e.currentTarget.reset();await v05Accounts();alert(`Cuenta creada correctamente.\nIdentificación: ${r.login}\nContraseña inicial: ${r.initialPassword}\n\nEntrega esta contraseña directamente a su titular; no se vuelve a mostrar.`);}
  catch(err){toast(err.message,true);}
 });
 $('accountsTable').addEventListener('click',async e=>{
  const reset=e.target.closest('[data-reset]');if(reset){if(!confirm('¿Restablecer la contraseña de esta cuenta?'))return;try{const r=await post('/api/accounts/'+reset.dataset.reset+'/reset',{});alert('Contraseña nueva para '+r.login+': '+r.initialPassword+'\nComunícala únicamente al titular.');}catch(err){toast(err.message,true);}return;}
  const b=e.target.closest('[data-account]');if(!b)return;const newStatus=b.dataset.active==='1'?'inactivo':'activo';
  if(!confirm(`¿Cambiar la cuenta a ${newStatus}?`))return;
  try{await request('/api/accounts/'+b.dataset.account,{method:'PATCH',body:JSON.stringify({status:newStatus})});toast('Cuenta actualizada.');v05Accounts();}catch(err){toast(err.message,true);}
 });
 $('importForm').addEventListener('submit',v05ImportPreview);$('importConfirm').addEventListener('click',v05ImportCommit);
 const resetEventEdit=()=>{v05EventEditId=null;$('eventForm').reset();$('eventSubmit').textContent='Programar evento →';$('eventCancelEdit').classList.add('hidden');};
 $('eventCancelEdit').addEventListener('click',resetEventEdit);
 $('eventsList').addEventListener('click',async e=>{
  const edit=e.target.closest('[data-event-edit]');const cancel=e.target.closest('[data-event-cancel]');
  if(edit){v05EventEditId=Number(edit.dataset.eventEdit);const form=$('eventForm');form.elements.name.value=edit.dataset.name;
   const toLocal=iso=>{const d=new Date(iso),z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;};
   form.elements.starts_at.value=toLocal(edit.dataset.start);form.elements.ends_at.value=toLocal(edit.dataset.end);$('eventSubmit').textContent='Guardar cambios →';$('eventCancelEdit').classList.remove('hidden');form.scrollIntoView({behavior:'smooth',block:'start'});}
  if(cancel){const reason=prompt('Motivo de cancelación del evento (mínimo 8 caracteres):');if(!reason)return;try{await request('/api/events/'+cancel.dataset.eventCancel,{method:'PATCH',body:JSON.stringify({action:'cancel',reason})});resetEventEdit();toast('Evento cancelado con auditoría.');v05Events();}catch(err){toast(err.message,true);}}
 });
 $('eventForm').addEventListener('submit',async e=>{
  e.preventDefault();const fields=Object.fromEntries(new FormData(e.currentTarget));
  try{const body={name:fields.name,starts_at:new Date(fields.starts_at).toISOString(),ends_at:new Date(fields.ends_at).toISOString()};if(v05EventEditId)await request('/api/events/'+v05EventEditId,{method:'PATCH',body:JSON.stringify(body)});else await post('/api/events',body);toast(v05EventEditId?'Evento actualizado.':'Evento autorizado.');v05EventEditId=null;$('eventSubmit').textContent='Programar evento →';$('eventCancelEdit').classList.add('hidden');e.currentTarget.reset();v05Events();}catch(err){toast(err.message,true);}
 });
}
document.addEventListener('DOMContentLoaded',v05Bind);
