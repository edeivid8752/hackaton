/*
  LINCE ADMIN V0.2 — contador exclusivamente VISUAL.
  El valor real permanece en los nodos #statTotal, #statStudents, etc.
  No se hace ninguna petición, actualización de base de datos ni modificación de eventos.
*/
(() => {
  'use strict';
  const ids = ['statTotal', 'statStudents', 'statStaff', 'statVisitors'];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const format = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
  const parseNumber = text => {
    const digits = String(text).replace(/[^\d]/g, '');
    return digits ? Number(digits) : null;
  };
  const animations = [];

  for (const id of ids) {
    const source = document.getElementById(id);
    if (!source) continue;
    let lastValue = parseNumber(source.textContent);
    let frame = 0;
    let frameStart = 0;

    function finish() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      frameStart = 0;
      source.classList.remove('count-tweening');
      source.removeAttribute('data-count-visual');
    }

    function animateTo(current) {
      const previous = lastValue;
      lastValue = current;
      finish();
      if (previous === null || current === null || current === previous || reduced.matches || document.hidden) return;
      // Se conserva el número verdadero y accesible en textContent.
      source.classList.add('count-tweening');
      const duration = 600;
      function tick(timestamp) {
        if (frameStart === 0) frameStart = timestamp;
        const t = Math.min(1, (timestamp - frameStart) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        const shown = Math.round(previous + (current - previous) * eased);
        source.setAttribute('data-count-visual', format.format(shown));
        if (t < 1 && !document.hidden && !reduced.matches) {
          frame = requestAnimationFrame(tick);
        } else {
          finish();
        }
      }
      frame = requestAnimationFrame(tick);
    }

    // Solo detecta cambios reales de texto que realiza app.js.
    const observer = new MutationObserver(() => {
      const now = parseNumber(source.textContent);
      if (now !== lastValue) animateTo(now);
    });
    observer.observe(source, { characterData: true, childList: true, subtree: true });
    animations.push(finish);
  }

  const stop = () => { if (document.hidden || reduced.matches) animations.forEach(fn => fn()); };
  document.addEventListener('visibilitychange', stop);
  reduced.addEventListener?.('change', stop);
})();
