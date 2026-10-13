(() => {
  'use strict';
  const root = document.documentElement.style;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let x = .5, y = .45, targetX = x, targetY = y, frame = 0;
  function draw() {
    frame = 0;
    if (reduced.matches || document.hidden) return;
    x += (targetX - x) * .12;
    y += (targetY - y) * .12;
    root.setProperty('--scene-x', `${(x * 100).toFixed(2)}%`);
    root.setProperty('--scene-y', `${(y * 100).toFixed(2)}%`);
    root.setProperty('--scene-gold', `hsla(${40 + x * 10 - y * 4}, 98%, 68%, .40)`);
    root.setProperty('--scene-peach', `hsla(${22 + y * 12}, 96%, 78%, .38)`);
    root.setProperty('--scene-rose', `hsla(${346 + x * 12}, 88%, 85%, .20)`);
    if (Math.abs(targetX - x) + Math.abs(targetY - y) > .001) frame = requestAnimationFrame(draw);
  }
  function start() { if (!frame && !reduced.matches && !document.hidden) frame = requestAnimationFrame(draw); }
  window.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    targetX = Math.max(0, Math.min(1, event.clientX / Math.max(1, window.innerWidth)));
    targetY = Math.max(0, Math.min(1, event.clientY / Math.max(1, window.innerHeight)));
    start();
  }, {passive: true});
  document.documentElement.addEventListener('pointerleave', () => { targetX = .5; targetY = .45; start(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && frame) { cancelAnimationFrame(frame); frame = 0; }
    else start();
  });
  reduced.addEventListener('change', () => {
    if (frame) { cancelAnimationFrame(frame); frame = 0; }
    if (reduced.matches) ['--scene-x','--scene-y','--scene-gold','--scene-peach','--scene-rose'].forEach(key => root.removeProperty(key));
    else start();
  });
})();
