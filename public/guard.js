'use strict';
// LINCE GUARD V0.2 — cliente móvil accesible. Solo datos ficticios.
const $=id=>document.getElementById(id);
const state={user:null,stats:null,events:null,cameraStream:null,scanning:false,streaming:false,pollTimer:null,voice:true,visitorCode:null,videoTimer:null,liveBusy:false};
function statusConnection(online){const e=$('connection');e.classList.toggle('online',online);e.classList.toggle('offline',!online);$('connectionText').textContent=online?'Conectado':'Sin conexión';}
async function api(route,opts={}){
 const response=await fetch(route,{credentials:'same-origin',...opts,headers:{'Content-Type':'application/json',...(opts.headers||{})}});
 let data={};try{data=await response.json();}catch{}
 if(!response.ok){const error=new Error(data.error||data.reason||'No se pudo completar la solicitud');error.response=data;error.status=response.status;throw error;}
 return data;
}
const post=(url,data)=>api(url,{method:'POST',body:JSON.stringify(data)});
function setBusy(busy){state.scanning=busy;for(const id of ['cameraButton','manualCode','visitorEnter'])$(id).disabled=busy;$('manualForm').querySelector('button').disabled=busy;}
function chime(ok){try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;const ctx=new C();const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.value=ok?740:260;osc.connect(gain);gain.connect(ctx.destination);gain.gain.setValueAtTime(.075,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.22);osc.start();osc.stop(ctx.currentTime+.23);osc.onended=()=>ctx.close();}catch{}}
function announce(message,okay){if(!state.voice)return;try{window.speechSynthesis.cancel();const phrase=new SpeechSynthesisUtterance(message);phrase.lang='es-MX';phrase.rate=.92;phrase.volume=.9;window.speechSynthesis.speak(phrase);}catch{}if(navigator.vibrate)navigator.vibrate(okay?65:[120,90,120]);}
function showResult(data){const card=$('resultCard'),icon=card.querySelector('.result-symbol'),title=card.querySelector('h2'),paragraph=card.querySelector('p');
 const ok=!!data.ok,warn=!!data.rebound||!!data.unreadable;card.className='result-card surface '+(ok?'ok':warn?'warn':'danger');
 const action=ok?(data.action==='entrada'?'ENTRADA AUTORIZADA':'SALIDA REGISTRADA'):data.unreadable?'NO SE PUDO LEER':warn?'ESCANEO REPETIDO':'ACCESO DENEGADO';
 icon.textContent=ok?'✓':warn?'!':'✕';title.textContent=action;
 const p=data.person;
 paragraph.replaceChildren();
 if(p){const name=document.createElement('strong');name.textContent=p.name;paragraph.append(name);const info=document.createElement('small');info.textContent=[p.type,p.career,p.group_name].filter(Boolean).join(' · ');paragraph.append(info);}
 const explanation=document.createElement('span');explanation.textContent=ok?(data.action==='entrada'?'Ingreso registrado correctamente.':'Salida registrada correctamente.'):(data.reason||'No se puede autorizar el acceso.');paragraph.append(explanation);
 chime(ok);announce(ok?(data.action==='entrada'?'Entrada autorizada':'Salida registrada'):data.unreadable?'No se pudo leer el código':warn?'Escaneo repetido':'Acceso denegado',ok);
 $('lastUpdate').textContent=new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
}
async function scan(code){code=String(code||'').trim().toUpperCase();if(state.scanning||!code)return;setBusy(true);
 try{const result=await post('/api/scan',{code});showResult(result);$('manualCode').value='';await loadStats();}
 catch(e){statusConnection(!!e.status);showResult(e.status===422?e.response:{ok:false,unreadable:true,reason:e.message});}
 finally{setBusy(false);}
}
async function loadStats(){if(!state.user)return;try{const s=await api('/api/stats');state.stats=s;$('insideCount').textContent=Number(s.total||0).toLocaleString('es-MX');$('capacityCount').textContent=Number(s.capacity||0).toLocaleString('es-MX');}catch(e){statusConnection(false);}}
function connectEvents(){if(state.events)state.events.close();const ev=new EventSource('/api/stream');state.events=ev;
 ev.addEventListener('ready',()=>statusConnection(true));ev.addEventListener('changed',()=>{statusConnection(true);loadStats();});ev.addEventListener('error',()=>statusConnection(false));
 if(state.pollTimer)clearInterval(state.pollTimer);state.pollTimer=setInterval(loadStats,12000);
}
function showApp(user){if(user.role!=='guardia'&&user.role!=='admin'){location.replace('/');return;}state.user=user;$('loginView').hidden=true;$('workView').hidden=false;connectEvents();loadStats();}
function signOutUI(){state.user=null;stopCamera();state.events?.close();state.events=null;if(state.pollTimer)clearInterval(state.pollTimer);$('workView').hidden=true;$('loginView').hidden=false;$('loginPassword').value='';statusConnection(false);}
async function login(e){e.preventDefault();$('loginButton').disabled=true;$('loginError').hidden=true;try{const user=await post('/api/login',{username:$('loginUser').value,password:$('loginPassword').value});showApp(user);}catch(e){$('loginError').hidden=false;$('loginError').textContent=e.message;}finally{$('loginButton').disabled=false;}}
function changeTab(which){const v=which==='visitor';$('scanSection').hidden=v;$('visitorSection').hidden=!v;$('tabScan').classList.toggle('active',!v);$('tabVisitor').classList.toggle('active',v);$('tabScan').toggleAttribute('aria-current',!v);$('tabVisitor').toggleAttribute('aria-current',v);$('workHeading').textContent=v?'Registro de visitantes':'Control de acceso';if(v)stopCamera();}
async function decodeImage(source,close){try{const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
 const maxWidth=1400,scale=Math.min(1,maxWidth/Math.max(source.width,source.height));canvas.width=Math.max(1,Math.round(source.width*scale));canvas.height=Math.max(1,Math.round(source.height*scale));ctx.drawImage(source,0,0,canvas.width,canvas.height);
 const imageData=ctx.getImageData(0,0,canvas.width,canvas.height);
 if(typeof window.jsQR==='function'){const qr=window.jsQR(imageData.data,canvas.width,canvas.height,{inversionAttempts:'attemptBoth'});if(qr?.data)return qr.data.trim();}
 if('BarcodeDetector' in window){const detector=new BarcodeDetector({formats:['qr_code','code_128','code_39']});const result=await detector.detect(canvas);if(result.length)return result[0].rawValue.trim();}
 return null;
 }finally{if(close)close();}}
async function readPhoto(file){if(!file)return;const input=$('photoInput');try{const url=URL.createObjectURL(file);const img=new Image();const imageLoaded=new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;});img.src=url;await imageLoaded;const value=await decodeImage(img,()=>URL.revokeObjectURL(url));
 if(value)await scan(value);else showResult({ok:false,unreadable:true,reason:'No se encontró un QR legible. Acércate, mejora la luz o escribe el código manualmente. Si estás sin Internet, el lector de fotografías puede no estar disponible.'});
 }catch(e){showResult({ok:false,unreadable:true,reason:'No se pudo leer la fotografía: '+e.message});}finally{input.value='';}}
async function startCamera(){if(state.cameraStream)return;
 if(!navigator.mediaDevices?.getUserMedia){$('cameraTip').textContent='En esta dirección HTTP el video en vivo no está permitido. Usa TOMAR FOTO DEL QR o el campo manual; para escaneo continuo configuraremos HTTPS.';showResult({ok:false,unreadable:true,reason:'El video en vivo requiere HTTPS o localhost. Utiliza Tomar foto del QR.'});return;}
 if(!('BarcodeDetector' in window)&&typeof window.jsQR!=='function'){showResult({ok:false,unreadable:true,reason:'El lector QR no está disponible. Se necesita conexión a Internet para cargar jsQR o un navegador con lector integrado.'});return;}
 try{const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}});state.cameraStream=stream;$('cameraVideo').srcObject=stream;$('videoWrap').hidden=false;await $('cameraVideo').play();$('cameraButton').textContent='CÁMARA ACTIVA';$('cameraButton').disabled=true;const detector=('BarcodeDetector' in window)?new BarcodeDetector({formats:['qr_code','code_128','code_39']}):null;
 const check=async()=>{if(!state.cameraStream||state.liveBusy)return;state.liveBusy=true;try{const video=$('cameraVideo');if(video.readyState>=2){let found=null;if(detector){const data=await detector.detect(video);found=data[0]?.rawValue?.trim()||null;}else{const canvas=document.createElement('canvas');canvas.width=640;canvas.height=Math.max(1,Math.round(640*video.videoHeight/video.videoWidth));const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(video,0,0,canvas.width,canvas.height);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);found=window.jsQR(pixels.data,canvas.width,canvas.height)?.data?.trim()||null;}if(found){stopCamera();await scan(found);return;}}}catch(e){console.warn('Error del lector en vivo:',e);}finally{state.liveBusy=false;}if(state.cameraStream)state.videoTimer=setTimeout(check,180);};check();
 }catch(e){stopCamera();showResult({ok:false,unreadable:true,reason:'No se pudo abrir la cámara: '+e.message});}}
function stopCamera(){if(state.videoTimer)clearTimeout(state.videoTimer);state.videoTimer=null;state.cameraStream?.getTracks().forEach(t=>t.stop());state.cameraStream=null;$('videoWrap').hidden=true;$('cameraVideo').srcObject=null;$('cameraButton').disabled=false;$('cameraButton').innerHTML='<span class="action-icon" aria-hidden="true">▣</span> ESCANEO EN VIVO';}
async function createVisitor(e){e.preventDefault();const button=$('visitorSave');button.disabled=true;try{const body=Object.fromEntries(new FormData(e.currentTarget).entries());const result=await post('/api/visitors',body);state.visitorCode=result.code;$('visitorCode').textContent=result.code;$('visitorResult').hidden=false;e.currentTarget.reset();$('visitorResult').scrollIntoView({block:'nearest',behavior:'smooth'});announce('Autorización creada',true);}
 catch(err){alert('No se pudo crear la autorización: '+err.message);}finally{button.disabled=false;}}
function bind(){
 $('loginForm').addEventListener('submit',login);$('signOut').addEventListener('click',async()=>{try{await post('/api/logout',{});}catch{}signOutUI();});
 $('tabScan').addEventListener('click',()=>changeTab('scan'));$('tabVisitor').addEventListener('click',()=>changeTab('visitor'));
 $('manualForm').addEventListener('submit',e=>{e.preventDefault();scan($('manualCode').value);});
 $('photoInput').addEventListener('change',e=>readPhoto(e.target.files?.[0]));
 $('cameraButton').addEventListener('click',startCamera);$('stopCamera').addEventListener('click',stopCamera);
 $('voiceToggle').addEventListener('change',e=>state.voice=e.target.checked);
 $('visitorForm').addEventListener('submit',createVisitor);$('visitorEnter').addEventListener('click',async()=>{if(state.visitorCode){changeTab('scan');await scan(state.visitorCode);}});
 window.addEventListener('pagehide',()=>stopCamera());window.addEventListener('online',()=>{if(state.user)loadStats();});
}
async function boot(){bind();try{const user=await api('/api/me');showApp(user);}catch{statusConnection(false);}}
boot();
