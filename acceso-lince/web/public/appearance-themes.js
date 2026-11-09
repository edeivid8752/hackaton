/* LINCE ACCESS — Apariencia y paleta personalizada (sin dependencias ni backend). */
(() => {
  'use strict';
  const key = 'linceaccess.appearance.v1';
  const paletteKey = 'linceaccess.customPalette.v1';
  const presets = {
    borgona: { name: 'Borgoña Imperial', background: '#481d2b' },
    esmeralda: { name: 'Esmeralda Real', background: '#153f36' },
    grafito: { name: 'Grafito & Oro', background: '#292a2b' },
    azul: { name: 'Azul Medianoche', background: '#18283e' },
    ciruela: { name: 'Ciruela Imperial', background: '#352338' },
    terracota: { name: 'Terracota Noble', background: '#754b43' },
    personalizado: { name: 'Paleta personalizada' }
  };
  const defaults = { background: '#481d2b', sidebar: '#351520', card: '#dfc397' };
  const channels = ['background', 'sidebar', 'card'];
  const buttons = [...document.querySelectorAll('[data-appearance]')];
  const status = document.getElementById('appearanceStatus');
  const meta = document.querySelector('meta[name="theme-color"]');
  const root = document.documentElement;
  const customDetails = document.getElementById('customThemeEditor');
  const targetButtons = [...document.querySelectorAll('[data-custom-target]')];
  const area = document.getElementById('customColorArea');
  const marker = document.getElementById('customColorMarker');
  const hue = document.getElementById('customHue');
  const hexInput = document.getElementById('customHexInput');
  const pickStatus = document.getElementById('customColorStatus');
  const preview = document.getElementById('customThemePreview');
  let custom = { ...defaults };
  let selected = 'borgona';
  let target = 'background';
  let picker = { h: 0, s: 1, v: 1 };

  const validHex = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
  const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
  const rgb = hex => [1,3,5].map(i => parseInt(hex.slice(i,i+2),16));
  const toHex = values => '#' + values.map(v => Math.round(clamp(v,0,255)).toString(16).padStart(2,'0')).join('');
  const blend = (a, b, ratio) => toHex(rgb(a).map((v,i) => v * (1-ratio) + rgb(b)[i]*ratio));
  function luminance(hex) {
    const channels = rgb(hex).map(x => { const v = x/255; return v <= .04045 ? v/12.92 : Math.pow((v+.055)/1.055,2.4); });
    return .2126*channels[0] + .7152*channels[1] + .0722*channels[2];
  }
  function hexToHsv(hex) {
    const [r,g,b] = rgb(hex).map(v=>v/255);
    const hi=Math.max(r,g,b), lo=Math.min(r,g,b), d=hi-lo;
    let h=0;
    if(d) {
      if(hi===r) h=((g-b)/d)%6;
      else if(hi===g) h=(b-r)/d+2;
      else h=(r-g)/d+4;
      h=(h*60+360)%360;
    }
    return {h, s:hi===0?0:d/hi, v:hi};
  }
  function hsvToHex(h,s,v) {
    h=((h%360)+360)%360;s=clamp(s);v=clamp(v);
    const c=v*s, x=c*(1-Math.abs((h/60)%2-1)), m=v-c;
    let r=0,g=0,b=0;
    if(h<60){r=c;g=x;}else if(h<120){r=x;g=c;}else if(h<180){g=c;b=x;}
    else if(h<240){g=x;b=c;}else if(h<300){r=x;b=c;}else{r=c;b=x;}
    return toHex([r+m,g+m,b+m].map(n=>n*255));
  }
  // Load only complete, valid six-digit HEX values; never trust arbitrary saved CSS.
  try {
    const stored = JSON.parse(window.localStorage.getItem(paletteKey) || 'null');
    if(stored && typeof stored==='object') {
      channels.forEach(channel => { if(validHex(stored[channel])) custom[channel]=stored[channel].toLowerCase(); });
    }
    const saved = window.localStorage.getItem(key);
    if(Object.prototype.hasOwnProperty.call(presets,saved)) selected=saved;
  } catch (_) { /* localStorage may be unavailable, e.g. private browsing */ }

  function setCustomVars() {
    const {background:bg, sidebar:side, card} = custom;
    const lightBg = luminance(bg) > .28;
    const lightSide = luminance(side) > .28;
    const lightCard = luminance(card) > .28;
    const cardInk = lightCard ? '#342620' : '#fff0d9';
    const navInk = lightSide ? '#231c18' : '#f5e6d0';
    const bgInk = lightBg ? '#2d2420' : '#f0deb8';
    const sideAccent = lightSide ? blend(side,'#000000',.54) : blend(side,'#ffffff',.15);
    const action = lightSide ? blend(side,'#000000',.60) : side;
    const vars = {
      'background':bg, 'sidebar':side, 'card':card,
      'card-ink':cardInk, 'nav-ink':navInk,
      'header-ink':bgInk,
      'header-muted':lightBg ? blend(bg,'#000000',.66) : blend(bg,'#ffffff',.72),
      'nav-muted':lightSide ? blend(side,'#000000',.65) : blend(side,'#ffffff',.70),
      'nav-active': lightSide ? blend(side,'#000000',.15) : blend(side,'#ffffff',.15),
      'nav-hover': lightSide ? blend(side,'#000000',.09) : blend(side,'#ffffff',.09),
      'action':action, 'action-hover':lightSide ? blend(action,'#ffffff',.17) : blend(action,'#ffffff',.20),
      'focus':lightCard ? blend(card,'#000000',.30) : blend(card,'#ffffff',.37),
      'accent-ink':lightCard ? blend(card,'#000000',.72) : blend(card,'#ffffff',.75),
      'option-border':lightCard ? blend(card,'#000000',.39) : blend(card,'#ffffff',.35),
      'card-control':lightCard ? blend(card,'#ffffff',.19) : blend(card,'#ffffff',.12),
      'table-hover':lightCard ? blend(card,'#000000',.10) : blend(card,'#ffffff',.10),
      'card-muted':lightCard ? blend(cardInk,card,.27) : blend(cardInk,card,.23),
      'sidebar-accent':sideAccent
    };
    Object.entries(vars).forEach(([k,v])=>root.style.setProperty('--lince-custom-'+k,v));
    if(preview){
      preview.style.setProperty('--preview-bg',bg);
      preview.style.setProperty('--preview-side',side);
      preview.style.setProperty('--preview-card',card);
    }
    targetButtons.forEach(b => {
      const chip=b.querySelector('.custom-target-swatch');
      if(chip) chip.style.backgroundColor=custom[b.dataset.customTarget];
    });
    const opt = document.getElementById('customThemeUse');
    if(opt){
      opt.style.setProperty('--preview-bg',bg);
      opt.style.setProperty('--preview-side',side);
      opt.style.setProperty('--preview-card',card);
    }
  }
  function storePalette() {
    try {window.localStorage.setItem(paletteKey,JSON.stringify(custom));}
    catch (_) { if(pickStatus) pickStatus.textContent='Los cambios se aplican, pero este navegador no permite guardarlos.'; }
  }
  function apply(theme, save=false) {
    if(!Object.prototype.hasOwnProperty.call(presets,theme)) return;
    selected=theme;
    root.dataset.linceTheme=theme;
    const activeColor=theme==='personalizado'?custom.background:presets[theme].background;
    if(meta)meta.setAttribute('content',activeColor);
    buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.appearance===theme)));
    if(status)status.textContent=`Tema actual: ${presets[theme].name}`;
    if(theme==='personalizado' && customDetails) customDetails.open=true;
    if(save){try{window.localStorage.setItem(key,theme);}catch(_){if(status)status.textContent+=' (no se pudo guardar)';}}
  }
  function updatePicker() {
    if(area){
      area.style.setProperty('--picker-hue',String(picker.h));
      area.setAttribute('aria-valuenow',String(Math.round(picker.v*100)));
      area.setAttribute('aria-valuetext',`Saturación ${Math.round(picker.s*100)}%, brillo ${Math.round(picker.v*100)}%`);
    }
    if(marker){marker.style.left=(picker.s*100)+'%';marker.style.top=((1-picker.v)*100)+'%';}
    if(hue)hue.value=String(Math.round(picker.h));
    if(hexInput){hexInput.value=custom[target].toUpperCase();hexInput.setCustomValidity('');}
    targetButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.customTarget===target)));
    if(pickStatus)pickStatus.textContent='Seleccionando: '+({background:'fondo',sidebar:'menú lateral',card:'tarjetas'}[target]);
  }
  function changeColor(newHex) {
    if(!validHex(newHex))return;
    custom[target]=newHex.toLowerCase();
    setCustomVars();
    storePalette();
    if(selected==='personalizado' && meta && target==='background')meta.setAttribute('content',custom.background);
    updatePicker();
  }
  function switchTarget(next){
    if(!channels.includes(next))return;
    target=next;
    picker=hexToHsv(custom[target]);
    updatePicker();
  }
  function updateFromPoint(clientX,clientY){
    if(!area)return;
    const rect=area.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    picker.s=clamp((clientX-rect.left)/rect.width);
    picker.v=1-clamp((clientY-rect.top)/rect.height);
    changeColor(hsvToHex(picker.h,picker.s,picker.v));
  }
  if(area){
    let dragging=false;
    area.addEventListener('pointerdown',event=>{
      if(event.button!==0 && event.pointerType==='mouse')return;
      dragging=true;
      area.setPointerCapture?.(event.pointerId);
      updateFromPoint(event.clientX,event.clientY);
      event.preventDefault();
    });
    area.addEventListener('pointermove',event=>{if(dragging)updateFromPoint(event.clientX,event.clientY);});
    const end=()=>{dragging=false;};
    area.addEventListener('pointerup',end);
    area.addEventListener('pointercancel',end);
    area.addEventListener('lostpointercapture',end);
    area.addEventListener('keydown',event=>{
      const step=event.shiftKey?.10:.02;
      if(event.key==='ArrowLeft')picker.s=clamp(picker.s-step);
      else if(event.key==='ArrowRight')picker.s=clamp(picker.s+step);
      else if(event.key==='ArrowUp')picker.v=clamp(picker.v+step);
      else if(event.key==='ArrowDown')picker.v=clamp(picker.v-step);
      else return;
      event.preventDefault();
      changeColor(hsvToHex(picker.h,picker.s,picker.v));
    });
  }
  if(hue)hue.addEventListener('input',()=>{
    picker.h=Number(hue.value);
    changeColor(hsvToHex(picker.h,picker.s,picker.v));
  });
  if(hexInput){
    const updateHex=()=>{
      let value=hexInput.value.trim();
      if(/^[0-9a-f]{6}$/i.test(value))value='#'+value;
      if(validHex(value)){changeColor(value);}
      else{hexInput.setCustomValidity('Introduce un color hexadecimal de 6 dígitos.');hexInput.reportValidity?.();}
    };
    hexInput.addEventListener('change',updateHex);
    hexInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();updateHex();}});
  }
  targetButtons.forEach(button=>button.addEventListener('click',()=>switchTarget(button.dataset.customTarget)));
  buttons.forEach(button=>button.addEventListener('click',()=>apply(button.dataset.appearance,true)));
  const reset = document.getElementById('customThemeReset');
  if(reset)reset.addEventListener('click',()=>{
    custom={...defaults};
    setCustomVars();storePalette();switchTarget(target);
    if(selected==='personalizado' && meta)meta.setAttribute('content',custom.background);
    if(pickStatus)pickStatus.textContent='Colores personalizados restablecidos.';
  });
  setCustomVars();switchTarget('background');apply(selected);
})();
