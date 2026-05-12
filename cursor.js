// Custom crosshair cursor with coord readout.
(function(){
  const cur = document.createElement('div');
  cur.className = 'cursor';
  cur.innerHTML = '<div class="ring"></div><div class="readout">0x0000</div>';
  document.body.appendChild(cur);
  const readout = cur.querySelector('.readout');

  let tx = window.innerWidth/2, ty = window.innerHeight/2;
  let cx = tx, cy = ty;

  window.addEventListener('mousemove', e => {
    tx = e.clientX; ty = e.clientY;
  });

  function tick(){
    // small smoothing
    cx += (tx - cx) * 0.6;
    cy += (ty - cy) * 0.6;
    cur.style.transform = `translate(${cx}px, ${cy}px)`;
    const hx = Math.floor(cx).toString(16).padStart(3,'0').toUpperCase();
    const hy = Math.floor(cy).toString(16).padStart(3,'0').toUpperCase();
    readout.textContent = `0x${hx}:${hy}`;
    requestAnimationFrame(tick);
  }
  tick();

  // hover state on interactive elements
  document.addEventListener('mouseover', e => {
    const t = e.target.closest('a,button,[data-hover]');
    if (t) cur.classList.add('over-link');
  });
  document.addEventListener('mouseout', e => {
    const t = e.target.closest('a,button,[data-hover]');
    if (t) cur.classList.remove('over-link');
  });

  // hide if mouse leaves window
  window.addEventListener('mouseout', e => {
    if (!e.relatedTarget) cur.style.opacity = '0';
  });
  window.addEventListener('mouseover', () => { cur.style.opacity = '1'; });
})();
