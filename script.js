/* =============================================================
   Engagement Microsite Script (Vanilla JS)
   Lakshmikanth & Maanya
   -------------------------------------------------------------
   Features Implemented:
   - Drift-corrected countdown with flip digits & radial rings
   - Status line rotation
   - Timeline rendering (data-driven)
   - Scroll reveal animations (IntersectionObserver)
   - Alternating celebrations (confetti / petals) + replay
   - Accessible modal (focus trap, ESC, restore focus)
   - Interactive terminal with commands: help, clear, reveal marriage
   - Particle system (DOM spans) cleaned after lifetime
   - Reduced motion fallbacks (skip animations, particles)
   - Graceful degradation (no IntersectionObserver)

   Testing (Quick Manual):
   1. Serve: python -m http.server (open http://localhost:8000)
   2. Observe countdown digits flipping & rings animating per unit.
   3. Terminal: help, clear, reveal marriage, reveal.marriage, show marriage, unknown.
   4. Scroll: sections reveal + celebrations alternating.
   5. Click 'Replay Celebrations' to reset & burst.
   6. Toggle prefers-reduced-motion and reload -> simplified.
   7. After target time, countdown replaced with message.

   NOTE: No external dependencies. Wrapped in IIFE to avoid globals.
   ============================================================= */
(function() {
  'use strict';

  /* ----------------------------- Constants ----------------------------- */
  /** Journey timeline data */
  const JOURNEY_DATA = [
    { id:1, title:'Families Connect', date:'01 Aug 2025 – 2:00 PM', description:"Groom’s family visits Bride’s home", status:'ACKNOWLEDGED' },
    { id:2, title:'Return Visit', date:'15 Aug 2025 – 2:00 PM', description:'Bride’s family visits Groom’s home', status:'SYNCHRONIZED' },
    { id:3, title:'First Outing', date:'31 Aug 2025', description:'A full day discovering shared wavelength', status:'MERGING' },
    { id:4, title:'Engagement Initialization', date:'13 Oct 2025', description:'Formalizing the merge', status:'DEPLOYED' }
  ];

  /** Terminal command metadata */
  const COMMANDS = {
    'help': { desc: 'List available commands' },
    'clear': { desc: 'Clear terminal history' },
    'marriage': { desc: 'Reveal marriage date' },
    'engagement': { desc: 'Show engagement date/time' },
    'venue': { desc: 'Show venue details' },
    'status': { desc: 'Show remaining time (compact)' },
    'journey': { desc: 'List journey milestones' },
  };

  const MARRIAGE_TEXT = 'Marriage • 8 March 2026';
  const COUNTDOWN_TARGET = new Date('2025-10-13T12:30:00+05:30').getTime();
  const STATUS_LINES = [
    'Synchronizing hearts...',
    'Optimizing latency...',
    'Preparing ceremonies...',
    'Caching memories...',
    'Negotiating rituals...',
    'Aligning constellations...'
  ];

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ----------------------------- State ----------------------------- */
  let countdownInterval = null;
  let lastValues = { days:'00', hours:'00', minutes:'00', seconds:'00' };
  let statusIndex = 0;
  let statusInterval = null;
  let celebrationModeIndex = 0; // 0 confetti, 1 petals alternating
  let sectionCelebrated = new WeakSet();
  let celebrationsEnabled = true; // user toggle

  // Terminal state
  let terminalOutputEl, terminalInputEl;
  let history = []; // strings
  let historyIndex = -1;
  const HISTORY_MAX = 20;
  const OUTPUT_MAX_LINES = 8;

  // Modal state
  let modalEl, modalBackdrop, modalCloseBtn, lastFocusedBeforeModal = null;

  /* ----------------------------- Initialization ----------------------------- */
  document.addEventListener('DOMContentLoaded', init);

  /** Entry point */
  function init() {
    initCountdown();
    initStatusLine();
    initJourney();
    initTerminal();
    initModal();
    initScrollReveals();
    initScrollCelebrations();
    applyReducedMotionFallbacks();
    setCurrentYear();
  initPostActions();
  initCelebrationToggle();
  initPlayfulHoverSparkles();
  initBloomReveal();
  }

  function initPostActions(){
    const icsBtn = document.getElementById('btn-ics');
    const shareBtn = document.getElementById('btn-share');
    if(icsBtn) icsBtn.addEventListener('click', downloadICS);
    if(shareBtn) shareBtn.addEventListener('click', shareInvite);
  }

  function initCelebrationToggle(){
    const toggle = document.getElementById('toggleCelebrations');
    if(!toggle) return;
    toggle.addEventListener('click', ()=> {
      celebrationsEnabled = !celebrationsEnabled;
      toggle.setAttribute('aria-pressed', celebrationsEnabled ? 'true':'false');
      toggle.textContent = celebrationsEnabled ? 'Disable Celebrations' : 'Enable Celebrations';
      if(celebrationsEnabled){
        // Re-initialize scroll observer so further sections can trigger again
        sectionCelebrated = new WeakSet();
        celebrationModeIndex = 0;
        initScrollCelebrations();
        triggerCelebration('confetti');
      }
    });
  }

  function initPlayfulHoverSparkles(){
    const buttons = document.querySelectorAll('.action-btn');
    buttons.forEach(btn => {
      const spark = document.createElement('span');
      spark.className='sparkle';
      btn.appendChild(spark);
      let timer=null;
      btn.addEventListener('pointerenter', ()=> {
        if(reduceMotion) return;
        spark.style.left = (15 + Math.random()*70) + '%';
        spark.style.top = (15 + Math.random()*70) + '%';
        btn.classList.add('sparkle-active');
        clearTimeout(timer);
        timer=setTimeout(()=> btn.classList.remove('sparkle-active'), 900);
      });
    });
  }

  function setCurrentYear(){
    const y=document.getElementById('year'); if(y){ y.textContent = new Date().getFullYear(); }
  }

  /* ----------------------------- Countdown ----------------------------- */
  /** Initialize the countdown */
  function initCountdown() {
    const container = document.getElementById('countdown');
    if(!container) return;

    renderCountdown();
    countdownInterval = setInterval(renderCountdown, 1000); // drift corrected inside
  }

  /** Compute and render countdown state with drift correction */
  function renderCountdown() {
    const now = Date.now();
    let diff = COUNTDOWN_TARGET - now;
    const container = document.getElementById('countdown');
    if(!container) return;
    if(diff <= 0) {
      clearInterval(countdownInterval);
      if(!container.dataset.expired){
        container.dataset.expired = 'true';
        container.innerHTML = "<p class='expired'>It’s Engagement Time! 🎉</p>";
        showPostActions();
      }
      return;
    }
    const secondsTotal = Math.floor(diff / 1000);
    const days = Math.floor(secondsTotal / 86400);
    const hours = Math.floor((secondsTotal % 86400) / 3600);
    const minutes = Math.floor((secondsTotal % 3600) / 60);
    const seconds = secondsTotal % 60;

    const parts = {
      days: String(days).padStart(2,'0'),
      hours: String(hours).padStart(2,'0'),
      minutes: String(minutes).padStart(2,'0'),
      seconds: String(seconds).padStart(2,'0')
    };

    updateUnit('days', parts.days, days, days / Math.max(days, 1)); // days ring shrink toward zero
    updateUnit('hours', parts.hours, hours, hours/24);
    updateUnit('minutes', parts.minutes, minutes, minutes/60);
    updateUnit('seconds', parts.seconds, seconds, seconds/60);

    lastValues = parts;
  }

  /** Update a single countdown unit (digits + ring + pulse) */
  function updateUnit(unit, valueStr, rawValue, progressFrac) {
    const unitEl = document.querySelector(`.time-unit[data-unit="${unit}"]`);
    if(!unitEl) return;

    // Update ring stroke progress (1 -> 0 for days if large?) We'll treat progress as fraction of cycle.
    const ring = unitEl.querySelector('.ring .fg');
    if(ring) {
      const circumference = 2 * Math.PI * 45; // matches stroke-dasharray
      let fraction = progressFrac;
      if(unit === 'days') { // For days, show proportion of days remaining relative to initial days snapshot (first call): store initial total days on dataset.
        if(!unitEl.dataset.initialDays) unitEl.dataset.initialDays = String(rawValue);
        const initial = parseInt(unitEl.dataset.initialDays,10) || 1;
        fraction = rawValue / initial;
      }
      const offset = circumference * (1 - fraction);
      ring.style.strokeDasharray = circumference;
      ring.style.strokeDashoffset = Math.min(Math.max(offset,0), circumference);
    }

    // Determine digits mapping per slot prefix
    const prefixMap = { days:'d', hours:'h', minutes:'m', seconds:'s' };
    const prefix = prefixMap[unit];
    if(!prefix) return;

    // If changed, flip each digit slot
    const prev = lastValues[unit];
    if(prev !== valueStr) {
      if(!reduceMotion) pulseUnit(unitEl);
      for(let i=0;i<valueStr.length;i++) {
        const digit = valueStr[i];
        const slot = unitEl.querySelector(`.flip-card[data-slot="${prefix}${i}"]`);
        if(!slot) continue;
        const front = slot.querySelector('.front');
        const back = slot.querySelector('.back');
        if(front && back && front.textContent !== digit) {
          back.textContent = digit; // prepare next value
          if(!reduceMotion) {
            slot.classList.remove('flipping');
            void slot.offsetWidth; // restart animation
            slot.classList.add('flipping');
            slot.addEventListener('animationend', () => {
              front.textContent = digit; // finalize
              slot.classList.remove('flipping');
            }, { once:true });
          } else {
            front.textContent = digit;
            back.textContent = digit;
          }
        }
      }
    }
  }

  /** Add pulse class to unit for glow */
  function pulseUnit(el) {
    el.classList.add('pulse');
    setTimeout(()=>el.classList.remove('pulse'), 900);
  }

  /** Rotate status line */
  function initStatusLine() {
    const statusEl = document.getElementById('countdown-status');
    if(!statusEl) return;
    if(reduceMotion) return; // keep static first line
    statusInterval = setInterval(() => {
      statusIndex = (statusIndex + 1) % STATUS_LINES.length;
  const emoji = ['💫','✨','🎉','🧡','🌟','🥁'][statusIndex % 6];
  statusEl.textContent = `${emoji} ${STATUS_LINES[statusIndex]}`;
    }, 10000);
  }

  /* ----------------------------- Journey (Commit style) ----------------------------- */
  function initJourney() {
    const container = document.getElementById('journey-timeline');
    if(!container) return;
    const frag = document.createDocumentFragment();
    JOURNEY_DATA.forEach(item => {
      const commit = document.createElement('article');
      commit.className = 'commit animate';
      commit.setAttribute('role','listitem');
      commit.dataset.status = item.status;
      const node = document.createElement('div'); node.className='node'; node.textContent = item.id; commit.appendChild(node);
      const body = document.createElement('div'); body.className='commit-body';
      const h = document.createElement('h3'); h.textContent=item.title; body.appendChild(h);
      const p = document.createElement('p'); p.className='muted';
      const dateText = item.date ? (item.date.includes('–')? item.date : item.date) : ''; // keep given formatting
      p.textContent = dateText ? `${dateText} – ${item.description}` : item.description; body.appendChild(p);
      const pre = document.createElement('pre'); pre.className='code-snippet'; pre.textContent = `status: ${item.status}`; body.appendChild(pre);
      commit.appendChild(body);
      frag.appendChild(commit);
    });
    container.appendChild(frag);
  }

  /* ----------------------------- Terminal ----------------------------- */
  function initTerminal() {
    terminalOutputEl = document.getElementById('terminal-output');
    terminalInputEl = document.getElementById('terminal-input');
    if(!terminalOutputEl || !terminalInputEl) return;

    terminalInputEl.addEventListener('keydown', onTerminalKey);
    printLine('Welcome to the engagement terminal. Type "help" to list commands.');
    // Do not focus immediately to avoid page scroll jump.
    // Focus only if hash explicitly targets terminal or user manually clicks inside.
    if(location.hash === '#terminal-section' || location.hash === '#terminal') {
      setTimeout(()=> terminalInputEl.focus(), 150);
    } else {
      const activateFocus = () => { if(document.activeElement !== terminalInputEl) terminalInputEl.focus(); cleanup(); };
      const cleanup = () => { document.removeEventListener('keydown', firstKey); terminalOutputEl.removeEventListener('click', activateFocus); };
      const firstKey = (e) => { if(e.key.length === 1 || e.key === 'Enter') activateFocus(); };
      document.addEventListener('keydown', firstKey, { once:true });
      terminalOutputEl.addEventListener('click', activateFocus, { once:true });
    }
  }

  function onTerminalKey(e) {
    if(e.key === 'Enter') {
      const cmd = terminalInputEl.value.trim();
      if(!cmd) return; // ignore blanks
      executeCommand(cmd);
      addToHistory(cmd);
      terminalInputEl.value = '';
    } else if(e.key === 'ArrowUp') {
      e.preventDefault();
      if(history.length === 0) return;
      if(historyIndex < 0) historyIndex = history.length -1; else historyIndex = Math.max(0, historyIndex -1);
      terminalInputEl.value = history[historyIndex];
      setTimeout(()=>terminalInputEl.setSelectionRange(terminalInputEl.value.length, terminalInputEl.value.length),0);
    } else if(e.key === 'ArrowDown') {
      e.preventDefault();
      if(history.length === 0) return;
      if(historyIndex >= history.length -1) { historyIndex = history.length; terminalInputEl.value=''; return; }
      historyIndex = Math.min(history.length -1, historyIndex +1);
      terminalInputEl.value = history[historyIndex] || '';
    }
  }

  function addToHistory(cmd) {
    if(history[history.length -1] !== cmd) history.push(cmd);
    if(history.length > HISTORY_MAX) history.shift();
    historyIndex = history.length;
  }

  /** Execute a terminal command */
  function executeCommand(raw) {
    const input = raw.toLowerCase();
    printLine('> ' + raw);
    if(input === 'clear') {
      terminalOutputEl.innerHTML='';
      return;
    }

    if(input === 'marriage') {
      printLine(MARRIAGE_TEXT);
      openModal();
      triggerCelebration('confetti');
      return;
    }
    if(input === 'engagement') {
      printLine('Engagement • 13 Oct 2025 at 12:30 PM IST');
      return;
    }
    if(input === 'venue') {
      printLine('Venue: Sampradaya Convention Hall, Near Pandavapura Railway Station');
      return;
    }
    if(input === 'status') {
      const now = Date.now();
      let diff = COUNTDOWN_TARGET - now;
      if(diff <= 0) { printLine('Engagement time reached!'); return; }
      const d = Math.floor(diff/86400000);
      diff%=86400000; const h=Math.floor(diff/3600000); diff%=3600000; const m=Math.floor(diff/60000); const s=Math.floor((diff%60000)/1000);
      printLine(`Remaining: ${d}d ${h}h ${m}m ${s}s`);
      return;
    }
    if(input === 'journey') {
      JOURNEY_DATA.forEach(j=> printLine(`#${j.id} ${j.title} -> ${j.status}`));
      return;
    }
  if(input === 'ics') { downloadICS(); printLine('Downloading ICS...'); return; }
  if(input === 'share') { shareInvite(); printLine('Sharing (or copied link)...'); return; }
    if(input === 'help') {
  Object.entries({ ...COMMANDS }).forEach(([k,v])=> printLine(`${k} - ${v.desc}`));
      return;
    }
    if(COMMANDS[input]) { // fallback for defined non-handled alias (none extra now)
      printLine(COMMANDS[input].desc || '');
      return;
    }
    printLine("command not found — try 'help'");
  }

  /* ---- Post-countdown & sharing utilities ---- */
  function showPostActions(){
    const box = document.getElementById('post-actions');
    if(box){ box.hidden = false; requestAnimationFrame(()=> box.classList.add('visible')); }
  }

  function generateICS(){
    const start = new Date(COUNTDOWN_TARGET);
    const end = new Date(start.getTime() + 2*60*60*1000);
    const fmt = dt => dt.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
    const uid = 'engagement-'+COUNTDOWN_TARGET+'@invite.local';
    return `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Engagement Invite//EN\nCALSCALE:GREGORIAN\nMETHOD:PUBLISH\nBEGIN:VEVENT\nUID:${uid}\nDTSTAMP:${fmt(new Date())}\nDTSTART:${fmt(start)}\nDTEND:${fmt(end)}\nSUMMARY:Engagement & Celebration\nDESCRIPTION:Join us as we begin a lifetime journey together.\nLOCATION:Sampradaya Convention Hall\\, Near Pandavapura Railway Station\nEND:VEVENT\nEND:VCALENDAR`;
  }

  function downloadICS(){
    const data = generateICS();
    const blob = new Blob([data], {type:'text/calendar'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'engagement-invite.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=> URL.revokeObjectURL(url), 0);
  }

  function shareInvite(){
    const shareData = { title:'Engagement Invitation', text:'Join us to celebrate our engagement!', url:location.href };
    if(navigator.share){
      navigator.share(shareData).catch(()=>{});
    } else {
      navigator.clipboard?.writeText(shareData.url);
      printLine('Invite link copied to clipboard ✅');
    }
  }

  /** Print a line to terminal output (with timestamp) */
  function printLine(text) {
    if(!terminalOutputEl) return;
    const time = new Date();
    const ts = `[${String(time.getHours()).padStart(2,'0')}:${String(time.getMinutes()).padStart(2,'0')}:${String(time.getSeconds()).padStart(2,'0')}]`;
    const line = document.createElement('div');
    line.className='terminal-line';
    line.setAttribute('data-timestamp', ts);

    const fullText = `${ts} ${text}`;
    if(!reduceMotion && text.length < 140 && text.startsWith('> ')===false) {
      // Optional small typewriter (skip for very long or prompt lines)
      typewriter(line, fullText, 0);
    } else {
      line.textContent = fullText;
    }
    terminalOutputEl.appendChild(line);
    trimHistory();
    terminalOutputEl.scrollTop = terminalOutputEl.scrollHeight;
  }

  function typewriter(el, text, i) {
    if(reduceMotion) { el.textContent = text; return; }
    if(i === 0) el.textContent = '';
    el.textContent = text.slice(0, i+1);
    if(i < text.length -1) {
      const delay = 25 + Math.random()*35; // 25-60ms
      setTimeout(()=> typewriter(el, text, i+1), delay);
    }
  }

  /** Trim terminal output lines to last OUTPUT_MAX_LINES */
  function trimHistory() {
    while(terminalOutputEl.children.length > OUTPUT_MAX_LINES) {
      terminalOutputEl.removeChild(terminalOutputEl.firstChild);
    }
  }

  /* ----------------------------- Modal ----------------------------- */
  function initModal() {
    modalEl = document.getElementById('secret-reveal');
    modalBackdrop = document.getElementById('modal-backdrop');
    modalCloseBtn = document.getElementById('modal-close');
    if(!modalEl || !modalCloseBtn) return;
    modalCloseBtn.addEventListener('click', closeModal);
    modalBackdrop && modalBackdrop.addEventListener('click', (e)=> { if(e.target.dataset.close) closeModal(); });
    document.addEventListener('keydown', (e)=> { if(e.key==='Escape' && modalEl.getAttribute('aria-hidden')==='false') closeModal(); });
  }

  function openModal() {
    if(!modalEl) return;
    if(modalEl.getAttribute('aria-hidden')==='false') return; // already open
    lastFocusedBeforeModal = document.activeElement;
    modalEl.setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
    trapFocus();
  }

  function closeModal() {
    if(!modalEl) return;
    modalEl.setAttribute('aria-hidden','true');
    document.body.style.overflow='';
    if(lastFocusedBeforeModal && lastFocusedBeforeModal.focus) lastFocusedBeforeModal.focus();
  }

  /** Simple focus trap implementation */
  function trapFocus() {
    if(!modalEl || modalEl.getAttribute('aria-hidden')==='true') return;
    const focusables = modalEl.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if(focusables.length) focusables[0].focus();
    function loop(e){
      if(e.key !== 'Tab') return;
      const list = Array.from(focusables).filter(f=> !f.hasAttribute('disabled'));
      if(!list.length) return;
      const first = list[0], last = list[list.length -1];
      if(e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    modalEl.addEventListener('keydown', loop, { once:true });
  }

  /* ----------------------------- Scroll Reveals ----------------------------- */
  function initScrollReveals() {
    const elements = document.querySelectorAll('.animate');
    if(reduceMotion) {
      elements.forEach(el=> el.classList.add('in-view'));
      return;
    }
    if(!('IntersectionObserver' in window)) {
      elements.forEach(el=> el.classList.add('in-view'));
      return;
    }
    const obs = new IntersectionObserver((entries)=> {
      entries.forEach(entry=> {
        if(entry.isIntersecting) {
          entry.target.classList.add('in-view');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold:0.12 });
    elements.forEach(el=> obs.observe(el));
  }

  /* ----------------------------- Celebrations ----------------------------- */
  function initScrollCelebrations() {
    if(reduceMotion) return;
  if(!celebrationsEnabled) return;
  const sections = ['hero','about','details','journey','terminal-section','gallery','footer']
      .map(id=> document.getElementById(id)).filter(Boolean);
    if(!('IntersectionObserver' in window)) return;
  const obs = new IntersectionObserver((entries)=> {
      entries.forEach(entry=> {
        if(entry.isIntersecting && !sectionCelebrated.has(entry.target)) {
          const mode = celebrationModeIndex % 2 === 0 ? 'confetti' : 'petals';
          triggerCelebration(mode);
          celebrationModeIndex++;
          sectionCelebrated.add(entry.target);
        }
      });
  }, { threshold:0.18 });
    sections.forEach(sec=> obs.observe(sec));

    // Replay button logic
    const replayBtn = document.getElementById('replayCelebrations');
  if(replayBtn) replayBtn.addEventListener('click', () => {
      triggerCelebration('confetti');
      sectionCelebrated = new WeakSet();
      celebrationModeIndex = 0;
    });

  // Initial burst once after load for hero for better feedback
  setTimeout(()=> triggerCelebration('confetti'), 800);
  }

  /** Trigger a celebration burst */
  function triggerCelebration(mode) {
    if(reduceMotion) return;
  if(!celebrationsEnabled) return;
  const base = mode==='confetti'? 80: 60; // more particles for visibility
  createParticles(mode, base, { slow:true });
  if(Math.random()<0.5) createParticles('spark', 18, { slow:true });
  if(mode==='confetti' && Math.random()<0.45) createParticles('ribbon', 16, { slow:true });
  }

  /** Create particle nodes */
  function createParticles(mode,count, opts={}) {
    const layer = document.getElementById('celebrations-layer');
    if(!layer) return;
    const frag = document.createDocumentFragment();
    const colors = ['var(--indigo)','var(--saffron)','var(--green)','var(--white)'];
    for(let i=0;i<count;i++) {
      const span = document.createElement('span');
      let cls;
      if(mode==='spark') cls='spark';
      else if(mode==='ribbon') cls='ribbon';
      else cls = (mode==='confetti'? 'confetti':'petal');
      span.className = 'particle ' + cls;
      let size;
      if(cls==='confetti') size = 10 + Math.random()*16;
      else if(cls==='petal') size = 18 + Math.random()*20;
      else if(cls==='ribbon') size = 14 + Math.random()*24;
      else size = 10 + Math.random()*10; // spark
      span.style.width = (cls==='ribbon'? size*1.6 : size)+'px';
      span.style.height = (cls==='confetti'? (6 + Math.random()*12): cls==='petal'? (size * (0.55+Math.random()*0.35)) : cls==='ribbon'? (8+Math.random()*6): size)+'px';
      if(cls==='confetti' || cls==='ribbon') span.style.background = colors[i%colors.length];
      if(cls==='petal') {
        const petalColors = ['#f2d9a6','#f4cfa0','#f8e2bb','#f6d3a8','#efd1b2'];
        const base = petalColors[Math.floor(Math.random()*petalColors.length)];
        span.style.background = `radial-gradient(circle at 30% 35%, #fff8, ${base})`;
      }
      const startX = Math.random()*100; // vw
      span.style.left = startX + 'vw';
      span.style.top = '-10px';
      const slowFactor = opts.slow ? 2.2 : 1;
      const duration = (1600 + Math.random()*1400) * slowFactor;
      const driftX = (Math.random()*60 - 30);
      const rotate = cls==='spark'? 0 : Math.random()*1080;
      const translateY = 105 + Math.random()*85;
      span.style.willChange = 'transform, opacity';
      span.style.transition = `transform ${duration}ms cubic-bezier(.22,.7,.3,1), opacity ${duration}ms linear`;
      // Distinct initial state (no translation) so transition animates fall
      span.style.transform = `translate(0,0) rotate(0deg)`;
      span.style.opacity = '0';
      const delay = Math.random()*300; // gentle stagger
      setTimeout(()=> {
        requestAnimationFrame(()=> {
          span.style.opacity = '1';
          // add subtle horizontal sway using CSS variable via multiple transforms
          span.style.transform = `translate(${driftX}vw, ${translateY}vh) rotate(${rotate}deg)`;
        });
      }, delay);
      setTimeout(()=> { span.style.opacity='0'; }, duration*0.85);
      setTimeout(()=> { span.remove(); }, duration + 800);
      frag.appendChild(span);
    }
    layer.appendChild(frag);
  }

  /* ----------------------------- Bloom Name Reveal ----------------------------- */
  function initBloomReveal(){
    const wrap = document.getElementById('bloom-reveal');
    if(!wrap) return;
    if(reduceMotion){
      wrap.classList.add('revealed');
  wrap.setAttribute('aria-hidden','false');
      return;
    }
    const PETAL_COUNT = 42;
    const frag = document.createDocumentFragment();
    for(let i=0;i<PETAL_COUNT;i++){
      const p = document.createElement('span');
      p.className='bloom-petal';
      const angle = (Math.PI*2) * (i/PETAL_COUNT);
      const radius = 60 + Math.random()*160; // px spread
      const dx = Math.cos(angle) * radius;
      const dy = Math.sin(angle) * radius * 0.55; // squash vertically a bit
      p.style.setProperty('--dx', dx+'px');
      p.style.setProperty('--dy', dy+'px');
      p.style.setProperty('--rot', (Math.random()*240)+'deg');
      p.style.animationDelay = (Math.random()*0.9)+'s';
      frag.appendChild(p);
    }
    wrap.appendChild(frag);
    // reveal names after short delay
  setTimeout(()=> { wrap.classList.add('revealed'); wrap.setAttribute('aria-hidden','false'); }, 400);
    // cleanup petals after animation (~5.5s)
    setTimeout(()=> {
      wrap.querySelectorAll('.bloom-petal').forEach(p=> p.remove());
    }, 6000);
  }

  /* ----------------------------- Reduced Motion ----------------------------- */
  function applyReducedMotionFallbacks() {
    if(!reduceMotion) return;
    // Ensure all animate elements visible
    document.querySelectorAll('.animate').forEach(el=> el.classList.add('in-view'));
  }

  /* ----------------------------- Export (for debugging only) ----------------------------- */
  // not exposing intentionally to global; could attach to window for tests if needed.
})();
