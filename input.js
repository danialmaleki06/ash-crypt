/* Runtime shell. Presentation and simulation remain in scene.js and sim.js. */
(function () {
  'use strict';
  const query = new URLSearchParams(location.search);
  const offline = query.has('render');
  const qa = query.has('qa') || offline;
  const cv = document.getElementById('c');
  const stage = document.getElementById('stage');
  const viewport = document.getElementById('viewport');
  const status = document.getElementById('status');
  const pauseOverlay = document.getElementById('pause-overlay');
  const outcomeOverlay = document.getElementById('outcome-overlay');
  const errors = [];
  const clone = value => JSON.parse(JSON.stringify(value));
  let state = null, paused = false, pauseCause = null, acc = 0, last = 0;
  let viewW = 1672, viewH = 941, frameCount = 0, fpsElapsed = 0, fps = 60;
  let version = null, reloading = false, injected = null, stopped = false;
  const keys = new Set();
  const pointer = { x: 835, y: 600, attack: false, block: false };
  const pending = { roll: false, skills: [] };
  const STORAGE = 'ash-crypt-dragon-v2';
  if (qa) document.body.classList.add('qa');

  function report(error) {
    const message = error?.stack || String(error);
    if (!errors.includes(message)) {
      errors.push(message); console.error(error);
    }
    GAME.error = message;
    status.textContent = 'Не удалось отрисовать сцену.\n' + (error?.message || String(error));
    status.classList.add('error'); status.hidden = false;
  }

  function clearInput() {
    window.RUNE_HUD?.setPointer(null,null);
    cv.style.cursor='default';
    keys.clear(); pointer.attack = pointer.block = false;
    pending.roll = false; pending.skills.length = 0; injected = null;
    acc = 0;
  }

  function terminal() {
    if (!state) return null;
    if (state.p && state.p.hp <= 0) return 'dead';
    if (state.boss && state.boss.hp <= 0) return 'victory';
    if (state.outcome && state.outcome !== 'playing' && state.outcome !== 'active') return state.outcome;
    return null;
  }

  function showOverlays() {
    const result = terminal();
    pauseOverlay.hidden = !paused || !!result;
    outcomeOverlay.hidden = !result;
    document.getElementById('pause-button').setAttribute('aria-label', paused ? 'Продолжить игру' : 'Приостановить игру');
    document.getElementById('pause-title').textContent=pauseCause==='ready'?'ПЕПЕЛЬНЫЙ ВЕНЕЦ':'Пауза';
    document.getElementById('resume-button').textContent=pauseCause==='ready'?'Начать бой':'Продолжить';
    if (result) {
      const dead = result === 'dead' || result === 'defeat' || result === 'death' || (state.p && state.p.hp <= 0);
      document.getElementById('outcome-title').textContent = dead ? 'Вы погибли' : 'Цель повержена';
      document.getElementById('outcome-copy').textContent = 'Нажми Enter, чтобы повторить бой.';
    }
  }

  function render(time) {
    if (!state || !window.SCENE) return;
    SCENE.state = state;
    try { SCENE.render(Number.isFinite(time) ? time : state.t || 0); }
    catch (error) { report(error); }
    showOverlays();
  }

  function setPaused(value, cause) {
    paused = !!value; pauseCause = paused ? cause || 'user' : null;
    clearInput(); last = performance.now(); showOverlays();
    if (!paused && !qa) cv.focus({ preventScroll: true });
    return paused;
  }

  function reset() {
    if (!window.SIM) return null;
    state = SIM.spawn ? SIM.spawn(0) : SIM.create();
    clearInput(); paused = false; pauseCause = null; last = performance.now();
    render();
    if (!qa) cv.focus({ preventScroll: true });
    return state;
  }

  function setState(next) {
    if (!next || typeof next !== 'object') throw new TypeError('GAME.setState expects a simulation state');
    const base = SIM.create(), copy = clone(next);
    state = Object.assign(base, copy);
    if (copy.p) state.p = Object.assign({}, SIM.create().p, copy.p);
    if (copy.boss) state.boss = Object.assign({}, SIM.create().boss, copy.boss);
    clearInput(); render(); return state;
  }

  function readInput() {
    if (injected) {
      const result = Object.assign({ moveX: 0, moveY: 0, mx: pointer.x, my: pointer.y, attack: false, block: false, roll: false, skill: 0 }, injected);
      injected.roll = false; injected.skill = 0;
      return result;
    }
    return {
      moveX: Number(keys.has('KeyD')) - Number(keys.has('KeyA')),
      moveY: Number(keys.has('KeyS')) - Number(keys.has('KeyW')),
      mx: pointer.x, my: pointer.y,
      attack: pointer.attack, block: pointer.block,
      roll: pending.roll, skill: pending.skills.shift() || 0
    };
  }

  const GAME = window.GAME = {
    ready: false, error: null, errors,
    get state() { return state; },
    get paused() { return paused; },
    get pauseCause() { return pauseCause; },
    get fps() { return fps; },
    get input() { return { keys: Array.from(keys), pointer: Object.assign({}, pointer), roll: pending.roll, skills: pending.skills.slice() }; },
    reset, setPaused, setState, render, clearInput,
    snapshot: () => state ? clone(state) : null,
    queueSkill: n => { if (!paused && !terminal() && n >= 1 && n <= 3) pending.skills.push(n); },
    setInput: input => { injected = input == null ? null : Object.assign({}, input); },
    step: (input = {}, n = 1) => {
      if (!state) throw new Error('Scene is not ready');
      n = Math.max(0, Math.min(120000, Math.floor(n)));
      for (let i = 0; i < n; i++) {
        const next = typeof input === 'function' ? input(i, state) : Object.assign({}, input, i ? { roll: false, skill: 0 } : {});
        SIM.step(state, next);
      }
      acc = 0; render(); return state;
    }
  };
  window.__setInput = GAME.setInput;
  window.render = render;
  window.__captureFrame = next => {
    if (next && typeof next === 'object') setState(next);
    render(typeof next === 'number' ? next : undefined);
    return cv.toDataURL('image/png');
  };
  window.__renderAt = t => {
    if (typeof SIM.at === 'function') state = SIM.at(t);
    render(t); return cv.toDataURL('image/png');
  };

  function fitStage() {
    const w = viewport.clientWidth, h = viewport.clientHeight;
    if (!w || !h) return;
    const scale = Math.min(w / viewW, h / viewH);
    stage.style.width = Math.floor(viewW * scale) + 'px';
    stage.style.height = Math.floor(viewH * scale) + 'px';
  }

  function viewPoint(event) {
    const r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const x = (event.clientX - r.left) / r.width * viewW;
    const y = (event.clientY - r.top) / r.height * viewH;
    if (x < 0 || y < 0 || x > viewW || y > viewH) return null;
    return { x, y };
  }

  function uiHit(point) {
    return point && typeof window.SCENE?.hitUI === 'function' ? SCENE.hitUI(point.x, point.y) : null;
  }

  const editable = target => target instanceof Element && !!target.closest('button,input,textarea,select,[contenteditable="true"]');
  addEventListener('keydown', event => {
    if(event.code==='Enter'&&GAME.ready&&paused&&pauseCause==='ready'){setPaused(false);event.preventDefault();return;}
    if (event.code === 'Escape' && GAME.ready) {
      if (!event.repeat) setPaused(!paused); event.preventDefault(); return;
    }
    if (event.code === 'Enter' && terminal()) { if (!event.repeat) reset(); event.preventDefault(); return; }
    if (!GAME.ready || paused || terminal() || editable(event.target)) return;
    const code = event.code;
    if (!['KeyW','KeyA','KeyS','KeyD','Space','KeyQ','KeyE','KeyR'].includes(code)) return;
    event.preventDefault();
    if (event.repeat && !keys.has(code)) return;
    if (!event.repeat) {
      if (code === 'Space') pending.roll = true;
      const skill = { KeyQ: 1, KeyE: 2, KeyR: 3 }[code];
      if (skill && pending.skills.length < 4) pending.skills.push(skill);
    }
    keys.add(code);
  });
  addEventListener('keyup', event => { keys.delete(event.code); });
  addEventListener('pointermove', event => {
    const p = viewPoint(event);
    window.RUNE_HUD?.setPointer(p?.x,p?.y);
    if(GAME.ready)cv.style.cursor=p&&window.RUNE_HUD?.slotAt(p.x,p.y)>=0?'pointer':'default';
    if (p && !uiHit(p)) { pointer.x = p.x; pointer.y = p.y; }
  });
  cv.addEventListener('pointerleave',()=>window.RUNE_HUD?.setPointer(null,null));
  cv.addEventListener('pointerdown', event => {
    if (event.button !== 0 && event.button !== 2) return;
    event.preventDefault();
    if (!GAME.ready || paused || terminal()) return;
    const p = viewPoint(event); if (!p) return;
    const hit = uiHit(p);
    if (hit) {
      pointer.attack = pointer.block = false;
      if (event.button === 0) {
        const skill = typeof hit === 'number' ? hit : typeof hit === 'object' ? hit.skill : 0;
        if (skill) GAME.queueSkill(skill);
        if (typeof SCENE.onUIClick === 'function') SCENE.onUIClick(hit, event.button);
      }
      return;
    }
    pointer.x = p.x; pointer.y = p.y;
    cv.focus({ preventScroll: true });
    if (event.button === 0) pointer.attack = true;
    if (event.button === 2) pointer.block = true;
    try { cv.setPointerCapture(event.pointerId); } catch (_) {}
  });
  addEventListener('pointerup', event => {
    if (event.button === 0) pointer.attack = false;
    if (event.button === 2) pointer.block = false;
  });
  cv.addEventListener('pointercancel', clearInput);
  cv.addEventListener('lostpointercapture', () => { pointer.attack = pointer.block = false; });
  cv.addEventListener('contextmenu', event => event.preventDefault());
  addEventListener('blur', () => { clearInput(); if (GAME.ready && !offline && !terminal()) setPaused(true, 'focus'); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); if (GAME.ready && !offline && !terminal()) setPaused(true, 'visibility'); } });
  addEventListener('resize', fitStage);
  document.getElementById('pause-button').addEventListener('click', () => setPaused(!paused));
  document.getElementById('resume-button').addEventListener('click', () => setPaused(false));
  document.getElementById('restart-button').addEventListener('click', reset);
  document.getElementById('retry-button').addEventListener('click', reset);

  function save() {
    if (!state) return;
    try { sessionStorage.setItem(STORAGE, JSON.stringify({ schema: 1, state, paused })); } catch (_) {}
  }
  addEventListener('beforeunload', save);

  function loop(now) {
    if (stopped) return;
    const wall = last ? Math.max(0, Math.min(.1, (now - last) / 1000)) : 0;
    last = now; frameCount++; fpsElapsed += wall;
    if (fpsElapsed >= .75) { fps = frameCount / fpsElapsed; frameCount = fpsElapsed = 0; }
    if (!paused && !terminal()) {
      acc += wall;
      while (acc + 1e-10 >= SIM.DT) {
        const input = readInput(); pending.roll = false;
        SIM.step(state, input); acc -= SIM.DT;
        if (terminal()) { clearInput(); break; }
      }
    } else acc = 0;
    render(); requestAnimationFrame(loop);
  }

  const load = src => new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = src + '?boot=' + Date.now();
    script.onload = resolve; script.onerror = () => reject(new Error('Не загружен ' + src)); document.head.appendChild(script);
  });

  async function poll() {
    if (offline || window.__STATIC__ || stopped) return;
    try {
      const response = await fetch('/__version', { cache: 'no-store' });
      if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
        const data = await response.json();
        if (version && data.version !== version && !reloading) { reloading = true; save(); location.reload(); return; }
        version = data.version;
      }
    } catch (_) {}
    setTimeout(poll, 1000);
  }

  async function boot() {
    for (const file of ['assets.js','gl.js','lib.js','level.js','sim.js','hero-data.js','hero.js','dragon-data.js','dragon.js','battle-fx.js','rune-hud-data.js','rune-hud.js','scene.js']) await load(file);
    if (!window.SIM || !window.SCENE || !window.G) throw new Error('Неполный набор модулей сцены');
    viewW = SIM.VIEW?.W || viewW; viewH = SIM.VIEW?.H || viewH;
    document.documentElement.style.setProperty('--ar', viewW / viewH); fitStage();
    G.init(cv, viewW, viewH);
    const assets = window.ASSETS || {};
    await Promise.all(Object.entries(assets).map(([name, entry]) => {
      const url = typeof entry === 'string' ? entry : entry.url || 'assets/' + name + '.png';
      return G.load(name, url + (url.includes('?') ? '&' : '?') + 'boot=' + Date.now(), { nearest: true });
    }));
    SCENE.programs();
    HERO.init();DRAGON.init();BATTLE_FX.init();RUNE_HUD.init();await Promise.all([HERO.load(),DRAGON.load(),BATTLE_FX.load(),RUNE_HUD.load()]);
    state = SIM.spawn ? SIM.spawn(0) : SIM.create();
    if(!offline){paused=true;pauseCause='ready';}
    if (!offline) {
      try {
        const stored = JSON.parse(sessionStorage.getItem(STORAGE) || 'null');
        sessionStorage.removeItem(STORAGE);
        if (stored?.schema === 1 && stored.state?.p && Number.isFinite(stored.state.p.x)) {
          stored.state.level = SIM.create().level;
          setState(stored.state); paused = !!stored.paused;pauseCause=paused?'restore':null;
        }
      } catch (_) {}
    }
    GAME.ready = window.__ready = true; window.__duration = SIM.L || 20;
    status.hidden = true; render();
    if (!offline) requestAnimationFrame(loop);
  }

  fitStage(); poll(); boot().catch(report);
})();
