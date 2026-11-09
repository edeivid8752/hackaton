'use strict';
// LINCE ACCESS V0.5 — una sola web, vistas separadas por rol.
// Se conecta al mismo servidor SQLite que consume LINCE GUARD Android V0.3.1.
const $ = id => document.getElementById(id);
const state={user:null,stats:null,view:'dashboard',stream:null,history:[],visitors:[],people:[],historyVersion:0,peopleVersion:0,visitorVersion:0};
const allowed={admin:['dashboard','visitors','people','history','reports','settings','profile','accounts','import','events','shifts','devices','express'],direccion:['dashboard','visitors','people','history','reports','settings','profile','accounts','import','events','shifts','devices','express'],alumno:['student','profile']};
const names={dashboard:'Panel de control',visitors:'Visitantes',people:'Comunidad universitaria',history:'Historial de accesos',reports:'Reportes institucionales',settings:'Configuración',profile:'Mi credencial',accounts:'Gestión de cuentas',import:'Importar estudiantes',events:'Eventos especiales',shifts:'Turnos y relevos',devices:'Dispositivos Android',express:'Ingresos exprés',student:'Mi espacio universitario'};
function esc(s){return String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function formatDate(s){if(!s)return '—';const d=new Date(s);return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('es-MX',{timeZone:'America/Mazatlan',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true}).format(d);}
function formatTime(s){if(!s)return '—';const d=new Date(s);return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('es-MX',{timeZone:'America/Mazatlan',hour:'2-digit',minute:'2-digit'}).format(d);}
function dayMx(s){if(!s)return '';const d=new Date(s);if(Number.isNaN(d.getTime()))return '';return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mazatlan',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}
async function request(url,options={}){const response=await fetch(url,{...options,credentials:'same-origin',headers:{'Content-Type':'application/json',...(options.headers||{})}});let data={};try{data=await response.json()}catch{}if(response.status===401&&state.user){signOut();throw new Error('Sesión caducada. Inicia sesión de nuevo.');}if(!response.ok){const e=new Error(data.error||data.reason||'Error de conexión.');e.response=data;throw e;}return data;}
const post=(url,body)=>request(url,{method:'POST',body:JSON.stringify(body)});
let toastTimer;function toast(msg,bad=false){const el=$('toast');el.textContent=msg;el.classList.toggle('error',bad);el.classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.add('hidden'),4300);}
function syncStatus(message,kind){const status=$('syncStatus'),dot=$('syncDot');if(status)status.textContent=message;if(dot)dot.className='admin-sync-dot'+(kind?' '+kind:'');}
function resetForms(){const form=$('loginForm');if(form)form.reset();}
async function setLoggedIn(user){
 if(!allowed[user.role]){
   try{await post('/api/logout',{});}catch{}
   const error=$('loginError');error.textContent='El personal de seguridad utiliza LINCE GUARD Android. Este acceso web es para Dirección, Administración y estudiantes.';error.classList.remove('hidden');return;
 }
 state.user=user;
 $('loginScreen').classList.add('hidden');$('appScreen').classList.remove('hidden');
 $('sideUsername').textContent=user.login;$('sideRole').textContent=user.role==='admin'?'Administración':user.role==='direccion'?'Dirección':'Estudiante';
 $('topAvatar').textContent=user.login.slice(0,2).toUpperCase();document.querySelector('.sidebar-avatar').textContent=user.login.slice(0,2).toUpperCase();
 document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('hidden',!allowed[user.role].includes(el.dataset.view)));
 document.querySelectorAll('[data-goto]').forEach(el=>el.classList.toggle('hidden',!allowed[user.role].includes(el.dataset.goto)));
 $('addPersonBtn').classList.toggle('hidden',!['admin','direccion'].includes(user.role));
 $('visitorForm').classList.toggle('hidden',!['admin','direccion'].includes(user.role));
 document.querySelector('.visitor-grid')?.classList.toggle('director-view',!['admin','direccion'].includes(user.role));
 $('visitorGenerated').innerHTML=['admin','direccion'].includes(user.role)?'<div class="visitor-icon">♧</div><h3>Esperando registro</h3><p>Cuando autorices una visita, aquí aparecerá su código temporal y su QR.</p>':'<div class="visitor-icon">◈</div><h3>Sin permisos</h3><p>Esta vista es exclusiva de Dirección y Administración.</p>';
 $('capacityInput').disabled=!['admin','direccion'].includes(user.role);$('specialUntil').disabled=!['admin','direccion'].includes(user.role);$('saveSettingsBtn').classList.toggle('hidden',!['admin','direccion'].includes(user.role));$('settingsReadOnly').classList.add('hidden');
 $('peopleActionsHead').classList.toggle('hidden',!['admin','direccion'].includes(user.role));
 navigate(user.role==='alumno'?'student':'dashboard');connectEvents();if(user.role!=='alumno')loadStats();
}
function signOut(){state.stream?.close();state.stream=null;state.user=null;state.stats=null;state.history=[];state.people=[];state.visitors=[];$('appScreen').classList.add('hidden');$('loginScreen').classList.remove('hidden');$('loginPassword').value='';$('loginError').classList.add('hidden');syncStatus('Sin sesión','disconnected');}
async function login(e){e.preventDefault();const user=$('loginUser').value.trim(),pass=$('loginPassword').value;const btn=$('loginForm').querySelector('button[type=submit]');btn.disabled=true;try{const result=await post('/api/login',{username:user,password:pass});await setLoggedIn(result);}catch(err){$('loginError').textContent=err.message;$('loginError').classList.remove('hidden');}finally{btn.disabled=false;}}
function navigate(view){
 if(!state.user||!allowed[state.user.role].includes(view))return;
 state.view=view;document.querySelectorAll('.view').forEach(el=>el.classList.toggle('hidden',el.id!==`view-${view}`));
 document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.view===view));
 $('pageTitle').textContent=names[view];$('breadcrumb').textContent=names[view].toUpperCase();$('sidebar').classList.remove('open');$('sidebarOverlay').classList.add('hidden');
 if(view==='dashboard'||view==='history'||view==='reports')loadHistory();
 if(view==='people')loadPeople();if(view==='visitors')loadVisitors();
 if(view==='reports')loadStats();if(view==='settings')fillSettings();if(typeof v05Navigate==='function')v05Navigate(view);if(view==='shifts'&&typeof shiftLoad==='function')shiftLoad();if(view==='devices'&&typeof deviceLoad==='function')deviceLoad();if(view==='express'&&typeof expressLoad==='function')expressLoad();
}
function connectEvents(){
 state.stream?.close();syncStatus('Conectando con el servidor…');
 state.stream=new EventSource('/api/stream');
 state.stream.addEventListener('ready',()=>syncStatus('Conectado · actualizaciones en vivo','connected'));
 state.stream.addEventListener('changed',()=>{syncStatus('Conectado · actualizaciones en vivo','connected');loadStats();if(['dashboard','history','reports'].includes(state.view))loadHistory();if(state.view==='people')loadPeople();if(state.view==='visitors')loadVisitors();if(typeof v05OnChange==='function')v05OnChange();if(state.view==='shifts'&&typeof shiftLoad==='function')shiftLoad();if(state.view==='devices'&&typeof deviceLoad==='function')deviceLoad();if(state.view==='express'&&typeof expressLoad==='function')expressLoad();});
 state.stream.addEventListener('error',()=>syncStatus('Reconectando al servidor…','disconnected'));
}
async function loadStats(){
 if(!state.user||state.user.role==='alumno')return;
 try{
  const s=await request('/api/stats');state.stats=s;
  for(const [id,key] of [['statTotal','total'],['statStudents','alumnos'],['statStaff','personal'],['statVisitors','externos'],['reportToday','todayEntries'],['reportInside','total']]){
   const el=$(id);if(el)el.textContent=Number(s[key]||0).toLocaleString('es-MX');
  }
  $('statCapacity').textContent=`de ${Number(s.capacity||0).toLocaleString('es-MX')} plazas`;
  $('reportPct').textContent=(s.capacity>0?Math.round(s.total/s.capacity*100):0)+'%';
  drawBars('careerBars',s.career,'estudiantes');drawBars('reportCareers',s.career,'estudiantes');drawBars('reportGroups',s.groups,'estudiantes');fillSettings();
 }catch(err){if(state.user)toast('No se pudo actualizar el panel: '+err.message,true);}
}
function drawBars(elementId,rows=[],unit='personas'){
 const el=$(elementId);if(!el)return;
 if(!rows.length){el.className='bars-container empty-chart';el.innerHTML='<span>No hay registros de presencia en este momento.</span>';return;}
 el.className='bars-container';const max=Math.max(1,...rows.map(x=>Number(x.total)||0));
 el.innerHTML=rows.slice(0,8).map(r=>`<div class="bar-group"><div class="bar-label"><span>${esc(r.name||'Sin grupo')}</span><span>${Number(r.total)||0} ${unit}</span></div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(4,Math.min(100,Number(r.total)/max*100))}%"></div></div></div>`).join('');
}
async function loadHistory(){
 if(!state.user)return;const version=++state.historyVersion;
 try{const data=await request('/api/history');if(version!==state.historyVersion||!state.user)return;
  state.history=data;renderHistory();
  $('recentActivity').innerHTML=data.length?data.slice(0,5).map(ev=>{const out=ev.action!=='entrada',auto=ev.action==='salida_automatica';return `<div class="activity-item"><span class="activity-icon ${auto?'auto':out?'out':''}">${auto?'◷':out?'↗':'↙'}</span><div class="activity-main"><strong>${esc(ev.name)}</strong><small>${auto?'Cierre automático':out?'Salida registrada':'Ingreso registrado'} · ${esc(ev.type)}</small></div><span class="activity-time">${formatTime(ev.happened_at)}</span></div>`;}).join(''):'<div class="empty-state">Sin movimientos registrados todavía.</div>';
 }catch(err){if(state.user&&state.view==='history')toast(err.message,true);}
}
function filteredHistory(){
 const search=$('historySearch').value.toLocaleLowerCase('es-MX').trim(),action=$('historyAction').value,date=$('historyDate').value;
 return state.history.filter(ev=>(!search||[ev.name,ev.code,ev.operator,ev.type].some(x=>String(x||'').toLocaleLowerCase('es-MX').includes(search)))&&(!action||ev.action===action)&&(!date||dayMx(ev.happened_at)===date));
}
function renderHistory(){
 const data=filteredHistory();$('historyCount').textContent=`${data.length} de ${state.history.length} movimientos disponibles (máximo 250).`;
 $('historyTable').innerHTML=data.length?data.map(ev=>`<tr><td>${esc(formatDate(ev.happened_at))}</td><td><strong>${esc(ev.name)}</strong><small>${esc(ev.type)}</small></td><td><span class="code-pill">${esc(ev.code)}</span></td><td><span class="state-pill ${ev.action==='entrada'?'yes':ev.action==='salida'?'no':'off'}">${esc(ev.action.replaceAll('_',' '))}</span></td><td>${esc(ev.operator)}</td></tr>`).join(''):'<tr><td class="table-empty" colspan="5">No hay movimientos con esos filtros.</td></tr>';
}
async function loadPeople(){
 if(!state.user)return;const version=++state.peopleVersion;
 try{const q=$('peopleSearch').value;const data=await request('/api/people?q='+encodeURIComponent(q));if(version!==state.peopleVersion||!state.user)return;state.people=data;
  $('peopleTable').innerHTML=data.length?data.map(p=>`<tr><td><strong>${esc(p.name)}</strong></td><td><span class="code-pill">${esc(p.code)}</span></td><td>${esc(p.type)}</td><td>${esc(p.career||'—')}<small>${esc(p.group_name||'')}</small></td><td><span class="state-pill ${p.status==='activo'?'yes':'off'}">${esc(p.status)}</span></td><td><span class="state-pill ${p.inside?'yes':'no'}">${p.inside?'Dentro':'Fuera'}</span></td>${['admin','direccion'].includes(state.user.role)?`<td><div class="v05-row-actions"><a class="btn-admin-state" href="/api/qr/${p.id}.svg?download=1" title="Descargar QR">↓ QR</a><button type="button" class="btn-admin-state" data-person-rotate="${p.id}">Reponer QR</button><button type="button" class="btn-admin-state" data-person-status="${p.id}" ${p.inside&&p.status==='activo'?'disabled title="Primero registra la salida en LINCE GUARD"':''}>${p.status==='activo'?'Desactivar':'Activar'}</button>${p.type==='alumno'?`<button type="button" class="btn-admin-state" data-student-reset="${p.id}">Reponer clave</button>`:''}${p.inside?`<button type="button" class="btn-admin-state" data-person-correct="${p.id}">Corregir salida</button>`:''}</div></td>`:''}</tr>`).join(''):`<tr><td class="table-empty" colspan="${['admin','direccion'].includes(state.user.role)?7:6}">No hay personas que coincidan.</td></tr>`;
 }catch(err){if(state.user)toast(err.message,true);}
}
async function togglePersonStatus(id){
 if(!['admin','direccion'].includes(state.user?.role))return;const person=state.people.find(p=>p.id===id);if(!person)return;
 const status=person.status==='activo'?'inactivo':'activo';if(!confirm(`¿Deseas ${status==='activo'?'activar':'desactivar'} la credencial de ${person.name}?`))return;
 try{await request('/api/people/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({status})});toast('Estado de credencial actualizado.');loadPeople();}catch(err){toast(err.message,true);}
}
async function loadVisitors(){
 if(!state.user)return;const version=++state.visitorVersion;
 try{const data=await request('/api/visitors');if(version!==state.visitorVersion||!state.user)return;state.visitors=data;const now=Date.now();
 $('visitorsTable').innerHTML=data.length?data.map(p=>{const expired=p.expires_at&&Date.parse(p.expires_at)<now;return `<tr><td><strong>${esc(p.name)}</strong><small>${esc(p.type)}</small></td><td><span class="code-pill">${esc(p.code)}</span></td><td>${esc(p.host_name||'—')}<small>${esc(p.reason||'')}</small></td><td>${esc(formatDate(p.expires_at))}</td><td><span class="state-pill ${expired?'off':p.inside?'yes':'no'}">${expired?'Vencido':p.inside?'Dentro':'Autorizado'}</span></td><td><a class="btn-admin-state" href="/api/qr/${p.id}.svg?download=1">↓ QR</a></td></tr>`;}).join(''):'<tr><td colspan="6" class="table-empty">Todavía no hay autorizaciones.</td></tr>';
 }catch(err){if(state.user)toast('No se pudieron cargar los visitantes: '+err.message,true);}
}
async function saveVisitor(e){
 e.preventDefault();if(!['admin','direccion'].includes(state.user?.role))return;
 const b=Object.fromEntries(new FormData(e.currentTarget));try{const data=await post('/api/visitors',b);
  $('visitorGenerated').innerHTML=`<div class="visitor-success">✓</div><h3>Autorización creada</h3><p>Entrega el código al visitante. El guardia confirmará su identidad y registrará el acceso desde Android.</p><span class="generated-code">${esc(data.code)}</span><p class="visitor-meta">Válido hasta el <strong>${esc(formatDate(data.expires_at))}</strong></p><button class="btn btn-outline" id="copyVisitor" type="button">Copiar código</button> <a class="btn btn-orange" href="/api/qr/${data.id}.svg?download=1">↓ Descargar QR</a>`;
  $('copyVisitor').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(data.code);toast('Código copiado.');}catch{toast('Selecciona y copia el código mostrado.');}});
  e.currentTarget.reset();toast('Autorización temporal creada.');loadVisitors();
 }catch(err){toast(err.message,true);}
}
async function savePerson(e){
 e.preventDefault();if(!['admin','direccion'].includes(state.user?.role))return;
 const b=Object.fromEntries(new FormData(e.currentTarget));delete b.code;
 try{
  const photo=$('personPhoto').files?.[0];
  if(photo)b.photo_data=await v05ResizePhoto(photo);
  else delete b.photo_data;
  const result=await post('/api/people',b);
  $('personDialog').close();e.currentTarget.reset();loadPeople();toast('Integrante creado. QR asignado.');
  const details='Identificación: '+result.institutional_id+'\nCódigo QR: '+result.code+(result.createdAccount?'\nContraseña inicial (mostrar solo al alumno): '+result.initialPassword:'');
  alert('¡Registro creado correctamente!\n\n'+details+'\n\nEsta contraseña se muestra una sola vez. Entrégala de forma privada.');
 }catch(err){toast(err.message,true);}
}
function fillSettings(){if(!state.stats)return;const cap=$('capacityInput'),time=$('specialUntil');if(document.activeElement!==cap)cap.value=state.stats.capacity;if(document.activeElement===time)return;
 if(state.stats.specialUntil){const d=new Date(state.stats.specialUntil),p=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Mazatlan',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(d).replace(' ','T');time.value=p;}else time.value='';
}
async function saveSettings(e){e.preventDefault();if(!['admin','direccion'].includes(state.user?.role))return toast('Sin permiso para cambiar estos parámetros.',true);const cap=Number($('capacityInput').value),time=$('specialUntil').value;try{await post('/api/settings',{capacity:cap,special_until:time?new Date(time).toISOString():''});toast('Configuración guardada.');loadStats();}catch(err){toast(err.message,true);}}
function safeCsv(x){let v=String(x??'');if(/^[=+@\-\t\r]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"';}
function downloadCsv(rows){if(!rows.length)return toast('No hay movimientos para exportar.',true);const cols=['Fecha ISO','Fecha local','Persona','Código','Categoría','Carrera','Grupo','Movimiento','Operador','Acceso','Nota'];const data=[cols,...rows.map(e=>[e.happened_at,formatDate(e.happened_at),e.name,e.code,e.type,e.career,e.group_name,e.action,e.operator,e.gate,e.note])];const csv='\uFEFF'+data.map(row=>row.map(safeCsv).join(',')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`lince-historial-${dayMx(new Date().toISOString())}.csv`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('CSV descargado (últimos 250 movimientos como máximo).');}
function clock(){const el=$('clock');if(el)el.textContent=new Intl.DateTimeFormat('es-MX',{timeZone:'America/Mazatlan',weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date());}
function bind(){
 $('loginForm').addEventListener('submit',login);
 $('showPassword').addEventListener('click',()=>{const el=$('loginPassword');el.type=el.type==='password'?'text':'password';});
 // No publicamos contraseñas de ejemplo dentro del JavaScript del navegador.
 document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.view)));
 document.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.goto)));
 $('logoutBtn').addEventListener('click',async()=>{try{await post('/api/logout',{});}catch{}signOut();});
 $('refreshBtn').addEventListener('click',()=>{loadStats();loadHistory();toast('Panel actualizado.');});
 $('historyBack').addEventListener('click',()=>navigate('dashboard'));$('historyRefresh').addEventListener('click',loadHistory);$('reportsRefresh').addEventListener('click',()=>{loadStats();loadHistory();toast('Reportes actualizados.');});
 $('historySearch').addEventListener('input',renderHistory);$('historyDate').addEventListener('change',renderHistory);$('historyAction').addEventListener('change',renderHistory);
 $('historyClear').addEventListener('click',()=>{$('historySearch').value='';$('historyDate').value='';$('historyAction').value='';renderHistory();});
 $('exportHistory').addEventListener('click',()=>downloadCsv(filteredHistory()));$('reportsExport').addEventListener('click',async()=>{await loadHistory();downloadCsv(state.history);});
 $('peopleSearch').addEventListener('input',()=>loadPeople());
 $('peopleTable').addEventListener('click',async e=>{const btn=e.target.closest('[data-person-status]');if(btn)togglePersonStatus(Number(btn.dataset.personStatus));const rotate=e.target.closest('[data-person-rotate]');if(rotate){const reason=prompt('Motivo para reponer QR (ej. credencial extraviada):');if(!reason)return;try{const r=await post('/api/people/'+rotate.dataset.personRotate+'/rotate-qr',{reason});toast('QR reemplazado y anterior revocado.');loadPeople();alert('Código QR nuevo: '+r.code+'\nDescárgalo desde la tabla.');}catch(err){toast(err.message,true);}}const restore=e.target.closest('[data-student-reset]');if(restore){if(!confirm('¿Restablecer la contraseña personal de este alumno?'))return;try{const r=await post('/api/students/'+restore.dataset.studentReset+'/reset',{});alert('Contraseña nueva para '+r.login+': '+r.initialPassword+'\nEntrégala únicamente al estudiante.');}catch(err){toast(err.message,true);}}const correct=e.target.closest('[data-person-correct]');if(correct){const reason=prompt('Explica la salida omitida (mínimo 12 caracteres):');if(!reason)return;try{await post('/api/corrections/exit',{person_id:Number(correct.dataset.personCorrect),reason});toast('Salida corregida con auditoría.');loadPeople();loadHistory();loadStats();}catch(err){toast(err.message,true);}}});
 $('settingsForm').addEventListener('submit',saveSettings);$('visitorForm').addEventListener('submit',saveVisitor);$('visitorsRefresh').addEventListener('click',loadVisitors);
 $('addPersonBtn').addEventListener('click',()=>$('personDialog').showModal());$('personForm').addEventListener('submit',savePerson);
 $('menuToggle').addEventListener('click',()=>{$('sidebar').classList.add('open');$('sidebarOverlay').classList.remove('hidden');});
 $('sidebarOverlay').addEventListener('click',()=>{$('sidebar').classList.remove('open');$('sidebarOverlay').classList.add('hidden');});
 clock();setInterval(clock,30000);
}
async function boot(){bind();try{const user=await request('/api/me');await setLoggedIn(user);}catch{/* Sesión no iniciada */}}
boot();
