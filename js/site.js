// Toont de pilot-banner als data/config.json "pilot": true heeft (SI-8).
(async () => {
  try {
    const r = await fetch(new URL('../data/config.json', import.meta.url));
    const cfg = await r.json();
    if (cfg.pilot) {
      const b = document.createElement('div');
      b.id = 'pilot-banner';
      b.textContent = 'pilot';
      document.body.prepend(b);
    }
  } catch (e) { /* zonder config geen banner */ }
})();

// Markeert in het hoofdmenu de pagina waar je bent (aria-current).
document.querySelectorAll('nav[aria-label="Hoofdmenu"] a').forEach((a) => {
  const pagina = location.pathname.split('/').pop() || 'index.html';
  if (a.getAttribute('href') === pagina) a.setAttribute('aria-current', 'page');
});
