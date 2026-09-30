// Toont de pilot-aanduiding naast het logo als data/config.json "pilot": true heeft (SI-8).
(async () => {
  try {
    const r = await fetch(new URL('../data/config.json', import.meta.url));
    const cfg = await r.json();
    if (cfg.pilot) {
      const b = document.createElement('span');
      b.id = 'pilot-banner';
      b.className = 'pilot-chip';
      b.textContent = 'pilot';
      const logo = document.querySelector('.han-logo');
      if (logo) logo.after(b); else document.body.prepend(b);
    }
  } catch (e) { /* zonder config geen aanduiding */ }
})();

// Markeert in het hoofdmenu waar je bent (aria-current). Op een leerblokpagina is dat „Leerblokken" (SX-1).
const pagina = location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('nav[aria-label="Hoofdmenu"] a').forEach((a) => {
  const sectie = a.dataset.sectie === 'leerblokken' && /^leerblok-\d\.html$/.test(pagina);
  if (sectie || a.getAttribute('href') === pagina) a.setAttribute('aria-current', 'page');
});
