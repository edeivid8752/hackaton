/* LinceAccess V0.2 — UI del menú lateral. No modifica APIs, permisos ni eventos de acceso. */
(() => {
  const app = document.getElementById('appScreen');
  const trigger = document.getElementById('sidebarCollapseToggle');
  const sidebar = document.getElementById('sidebar');
  if (!app || !trigger || !sidebar) return;

  // Solo en PC con ratón: el menú es flotante y no ocupa espacio cuando está oculto.
  // En móvil se conserva el cajón original controlado por app.js.
  const hoverMode = window.matchMedia('(min-width: 741px) and (hover: hover) and (pointer: fine)');
  const setOpen = (open) => {
    if (!hoverMode.matches) return;
    app.classList.toggle('sidebar-hover-open', open);
    trigger.setAttribute('aria-expanded', String(open));
    trigger.setAttribute('aria-label', open ? 'Ocultar menú lateral' : 'Mostrar menú lateral');
    sidebar.inert = !open; // No tabular hacia enlaces invisibles.
  };

  const syncMode = () => {
    app.classList.remove('sidebar-hover-open', 'sidebar-collapsed');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-label', 'Mostrar menú lateral');
    sidebar.inert = hoverMode.matches;
  };
  syncMode();
  hoverMode.addEventListener('change', syncMode);

  // Abrir al acercarse al borde izquierdo; cerrar al salir del panel.
  trigger.addEventListener('pointerenter', () => setOpen(true));
  trigger.addEventListener('pointerleave', (event) => {
    if (event.relatedTarget !== sidebar && !sidebar.contains(event.relatedTarget)) setOpen(false);
  });
  sidebar.addEventListener('pointerenter', () => setOpen(true));
  sidebar.addEventListener('pointerleave', (event) => {
    if (event.relatedTarget !== trigger) setOpen(false);
  });
  trigger.addEventListener('click', () => setOpen(true));

  // Alternativa accesible con teclado (Tab hasta el control lateral).
  trigger.addEventListener('focus', () => setOpen(true));
  sidebar.addEventListener('focusout', (event) => {
    const next = event.relatedTarget;
    if (hoverMode.matches && (!next || !sidebar.contains(next)) && !sidebar.matches(':hover')) {
      setOpen(false);
    }
  });
  app.addEventListener('keydown', (event) => {
    if (hoverMode.matches && event.key === 'Escape' && app.classList.contains('sidebar-hover-open')) {
      event.preventDefault();
      setOpen(false);
      const main = app.querySelector('main');
      if (main) {
        main.setAttribute('tabindex', '-1');
        main.focus({preventScroll:true});
      }
    }
  });

  // La circunferencia del aforo es solo presentación y lee los contadores existentes.
  const total=document.getElementById('statTotal');
  const cap=document.getElementById('statCapacity');
  const ring=document.getElementById('occupancyRing');
  const pct=document.getElementById('occupancyPercent');
  if(total && cap && ring && pct){
    const update=()=>{
      const n=Number((total.textContent||'').replace(/[^0-9]/g,''));
      const found=(cap.textContent||'').match(/[\d.,]+/);
      const capacity=found ? Number(found[0].replace(/[^0-9]/g,'')) : 0;
      const value=capacity>0 ? Math.min(100,Math.max(0,Math.round(n/capacity*100))) : 0;
      ring.style.setProperty('--occupied',String(value));
      pct.textContent=value+'%';
    };
    new MutationObserver(update).observe(total,{childList:true,subtree:true,characterData:true});
    new MutationObserver(update).observe(cap,{childList:true,subtree:true,characterData:true});
    update();
  }
  // En móvil se mantiene el menú existente de la versión original.
})();
