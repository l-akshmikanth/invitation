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
    { id:0, title:'Classmates', date:'', description:'Hardly spoke; parallel tracks', status:'PARALLEL' },
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
    'theme': { desc: 'List color tokens' }
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
      container.innerHTML = "<p class='expired'>It’s Engagement Time! 🎉</p>";
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
      statusEl.textContent = STATUS_LINES[statusIndex];
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
    if(input === 'theme') {
      printLine('--indigo #2F4B8A, --saffron #F5B642, --green #4B7F52, --off #FAF7F2, --dark #2B2B2E');
      return;
    }
    if(input === 'help') {
      Object.entries(COMMANDS).forEach(([k,v])=> printLine(`${k} - ${v.desc}`));
      return;
    }
    if(COMMANDS[input]) { // fallback for defined non-handled alias (none extra now)
      printLine(COMMANDS[input].desc || '');
      return;
    }
    printLine("command not found — try 'help'");
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
    createParticles(mode, mode==='confetti'? 40: 30);
  }

  /** Create particle nodes */
  function createParticles(mode,count) {
    const layer = document.getElementById('celebrations-layer');
    if(!layer) return;
    const frag = document.createDocumentFragment();
    const colors = ['var(--indigo)','var(--saffron)','var(--green)','var(--white)'];
    for(let i=0;i<count;i++) {
      const span = document.createElement('span');
      span.className = 'particle ' + (mode==='confetti'? 'confetti':'petal');
      const size = mode==='confetti'? (6 + Math.random()*10) : (10 + Math.random()*14);
      span.style.width = size+'px';
      span.style.height = (mode==='confetti'? (4 + Math.random()*8): (size * (0.6+Math.random()*0.4))) + 'px';
      if(mode==='confetti') span.style.background = colors[i%colors.length]; else span.style.background = 'var(--petal)';
      const startX = Math.random()*100; // vw
      span.style.left = startX + 'vw';
      span.style.top = '-10px';
      const duration = 1000 + Math.random()*600;
      const driftX = (Math.random()*40 - 20);
      const rotate = Math.random()*720;
      const translateY = 100 + Math.random()*60;
      span.style.transition = `transform ${duration}ms ease-out, opacity ${duration}ms linear`;
      span.style.transform = `translate(${driftX}vw, ${translateY}vh) rotate(${rotate}deg)`;
      span.style.opacity = '0';
      // Start state
      requestAnimationFrame(()=> {
        span.style.opacity = '1';
        span.style.transform = `translate(${driftX}vw, ${translateY}vh) rotate(${rotate}deg)`;
      });
      setTimeout(()=> { span.style.opacity='0'; }, duration*0.7);
      setTimeout(()=> { span.remove(); }, duration + 400);
      frag.appendChild(span);
    }
    layer.appendChild(frag);
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
