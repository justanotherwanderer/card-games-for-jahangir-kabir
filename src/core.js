/* Card Room core: cards, screens, dialogs, settings, storage, timers. Written for Safari 12 (no ?. or ??). */
(function () {
  'use strict';
  var CG = (window.CG = {});

  CG.RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  CG.RANK_NAMES = ['', 'Ace', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Jack', 'Queen', 'King'];
  CG.SUIT_NAMES = { s: 'Spades', h: 'Hearts', d: 'Diamonds', c: 'Clubs', j: 'Jokers' };
  CG.SUIT_ONE = { s: 'Spade', h: 'Heart', d: 'Diamond', c: 'Club', j: 'Joker' };

  CG.red = function (c) { return c.s === 'h' || c.s === 'd'; };
  CG.hi = function (c) { return c.r === 1 ? 14 : c.r; }; // ace high value

  CG.deck = function (decks, jokers, suits) {
    var out = [], ss = suits || ['s', 'h', 'd', 'c'];
    for (var d = 0; d < (decks || 1); d++)
      for (var i = 0; i < ss.length; i++)
        for (var r = 1; r <= 13; r++) out.push({ id: out.length, r: r, s: ss[i] });
    for (var j = 0; j < (jokers || 0); j++) out.push({ id: out.length, r: 0, s: 'j' });
    return out;
  };
  CG.shuffle = function (a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };
  CG.clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  CG.byId = function (arr, id) {
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return i;
    return -1;
  };

  /* ---------- Card HTML ---------- */
  CG.suitSvg = function (s, cls) {
    return '<svg class="' + (cls || 'si') + '"><use xlink:href="#s-' + s + '"></use></svg>';
  };
  CG.cardText = function (c) {
    if (c.s === 'j') return '<b class="ct s-j">Joker</b>';
    return '<b class="ct s-' + c.s + '">' + CG.RANKS[c.r] + CG.suitSvg(c.s, '') + '</b>';
  };
  CG.cardName = function (c) {
    return c.s === 'j' ? 'Joker' : CG.RANK_NAMES[c.r] + ' of ' + CG.SUIT_NAMES[c.s];
  };
  function inner(c) {
    if (c.s === 'j')
      return '<div class="ix">' + CG.suitSvg('j', 'jks') + '</div><div class="ctr jk">' + CG.suitSvg('j', '') + '<span>JOKER</span></div>';
    var rk = CG.RANKS[c.r];
    var h = '<div class="ix"><span class="rk' + (c.r === 10 ? ' ten' : '') + '">' + rk + '</span>' + CG.suitSvg(c.s, '') + '</div>';
    if (c.r >= 11) h += '<div class="ctr fc"><span>' + rk + '</span>' + CG.suitSvg(c.s, '') + '</div>';
    else h += '<div class="ctr">' + CG.suitSvg(c.s, '') + '</div>';
    return h;
  }
  function attrs(o) {
    var a = '';
    if (o.act) a += ' data-act="' + o.act + '"';
    if (o.data) for (var k in o.data) a += ' data-' + k + '="' + o.data[k] + '"';
    return a;
  }
  /* c: card or null (face down). o: {act,data,sel,dim,hint,cls,z,w,down,inline,label} */
  CG.card = function (c, x, y, o) {
    o = o || {};
    var cls = 'card', style = '', body = '';
    if (!o.inline) style += 'left:' + Math.round(x) + 'px;top:' + Math.round(y) + 'px;';
    else cls += ' inl';
    if (o.z != null) style += 'z-index:' + o.z + ';';
    if (o.w) style += '--cw:' + Math.round(o.w) + 'px;';
    if (o.style) style += o.style;
    if (!c || o.down || c.up === false) {
      cls += ' back';
      if (o.label != null) body = '<div class="cnt">' + o.label + '</div>';
    } else {
      cls += ' s-' + c.s;
      body = inner(c);
    }
    if (o.sel) cls += ' sel';
    if (o.dim) cls += ' dim';
    if (o.hint) cls += ' hint';
    if (o.cls) cls += ' ' + o.cls;
    return '<div class="' + cls + '" style="' + style + '"' + attrs(o) + '>' + body + '</div>';
  };
  CG.slot = function (x, y, label, o) {
    o = o || {};
    var cls = 'slot' + (o.hint ? ' hint' : '') + (o.sel ? ' sel' : '') + (o.cls ? ' ' + o.cls : '');
    var style = 'left:' + Math.round(x) + 'px;top:' + Math.round(y) + 'px;' + (o.w ? '--cw:' + Math.round(o.w) + 'px;' : '');
    return '<div class="' + cls + '" style="' + style + '"' + attrs(o) + '><span>' + (label || '') + '</span></div>';
  };
  CG.inlineCards = function (cards, w) {
    var h = '';
    for (var i = 0; i < cards.length; i++)
      h += CG.card(cards[i], 0, 0, { inline: true, w: w || 56, style: i ? 'margin-left:' + Math.round(-(w || 56) * 0.42) + 'px' : '' });
    return h;
  };

  /* Vertical offsets for a stacked column. Shrinks gaps when the column would not fit. */
  CG.stackYs = function (cards, cw, avail, o) {
    o = o || {};
    var downF = o.down || 0.17, upF = o.up || 0.42, minUp = o.minUp || 0.2, minDown = o.minDown || 0.07;
    var n = cards.length, ch = cw * 1.4, ys = [];
    if (!n) return ys;
    var nDown = 0, nUp = 0, i;
    for (i = 0; i < n - 1; i++) { if (cards[i].up === false) nDown++; else nUp++; }
    var down = downF * cw, up = upF * cw;
    if (ch + nDown * down + nUp * up > avail) {
      if (nUp) up = Math.max(minUp * cw, (avail - ch - nDown * down) / nUp);
      if (ch + nDown * down + nUp * up > avail && nDown) down = Math.max(minDown * cw, (avail - ch - nUp * up) / nDown);
    }
    var y = 0;
    for (i = 0; i < n; i++) { ys.push(y); y += cards[i].up === false ? down : up; }
    return ys;
  };
  /* How tall a column wants to be (in card widths) at normal spacing. */
  CG.stackFactor = function (cards, o) {
    o = o || {};
    var downF = o.down || 0.17, upF = o.up || 0.42, f = 1.4;
    for (var i = 0; i < cards.length - 1; i++) f += cards[i].up === false ? downF : upF;
    return f;
  };

  /* ---------- Storage ---------- */
  var PREFIX = 'cardroom1_';
  CG.store = {
    get: function (k, d) {
      try {
        var v = window.localStorage.getItem(PREFIX + k);
        return v == null ? d : JSON.parse(v);
      } catch (e) { return d; }
    },
    set: function (k, v) {
      try { window.localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ }
    },
    del: function (k) {
      try { window.localStorage.removeItem(PREFIX + k); } catch (e) { /* ignore */ }
    }
  };

  /* ---------- Settings ---------- */
  var SPEED = { slow: 1.7, normal: 1, fast: 0.45 };
  CG.settings = { fourColor: false, speed: 'normal', oneTap: false };
  function loadSettings() {
    var s = CG.store.get('settings', null);
    if (s) for (var k in CG.settings) if (s[k] != null) CG.settings[k] = s[k];
  }
  function applySettings() {
    var b = document.body;
    if (CG.settings.fourColor) b.className = (b.className.replace(/\bfourc\b/g, '') + ' fourc').trim();
    else b.className = b.className.replace(/\bfourc\b/g, '').trim();
  }
  CG.wait = function (ms) {
    if (CG.testFast) return 1;
    return Math.round(ms * (SPEED[CG.settings.speed] || 1));
  };

  /* ---------- Timers (cleared when leaving a game) ---------- */
  var timers = [];
  CG.later = function (fn, ms) {
    var id = setTimeout(function () {
      timers = timers.filter(function (t) { return t !== id; });
      try { fn(); } catch (err) { CG.reportError(err); }
    }, ms);
    timers.push(id);
    return id;
  };
  CG.clearTimers = function () {
    timers.forEach(function (t) { clearTimeout(t); });
    timers = [];
  };
  CG.reportError = function (err) {
    if (window.console) console.error(err);
    CG.errors = (CG.errors || 0) + 1;
  };

  /* ---------- Shell ---------- */
  var els = {};
  CG.games = {};
  CG.order = [];
  CG.cur = null;
  CG.register = function (g) { CG.games[g.id] = g; CG.order.push(g.id); };
  function $(id) { return document.getElementById(id); }

  CG.W = function () { return els.stage.clientWidth; };
  CG.H = function () { return els.stage.clientHeight; };
  CG.paint = function (html) { els.stage.innerHTML = html; };
  CG.status = function (left, right) {
    els.stl.innerHTML = left || '';
    els.str.innerHTML = right || '';
  };
  CG.save = function (g) {
    g = g || CG.cur;
    if (g && g.S) CG.store.set('state_' + g.id, g.S);
  };
  CG.addWin = function (id) {
    var st = CG.store.get('wins', {});
    st[id] = (st[id] || 0) + 1;
    CG.store.set('wins', st);
  };

  var BACK = '<svg viewBox="0 0 24 24"><path d="M15.5 3.5 7 12l8.5 8.5 2.1-2.1L11.2 12l6.4-6.4z"/></svg>';

  CG.showMenu = function () {
    CG.clearTimers();
    CG.hideToast();
    CG.closeDialog();
    CG.cur = null;
    CG.store.set('screen', null);
    els.game.hidden = true;
    els.menu.hidden = false;
    var wins = CG.store.get('wins', {});
    var groups = [
      { key: 'solo', title: 'Solitaire: play on your own' },
      { key: 'vs', title: 'Play against the computer' }
    ];
    var h = '<div class="mwrap"><div class="mhead"><div><div class="eyebrow">Large print card room</div><h1>Card Games for Jahangir Kabir</h1></div>' +
      '<button class="hbtn" data-act="settings">Settings</button></div>';
    groups.forEach(function (gr) {
      h += '<div class="msec">' + gr.title + '</div><div class="tiles">';
      CG.order.forEach(function (id) {
        var g = CG.games[id];
        if (g.group !== gr.key) return;
        var saved = g.S || CG.store.get('state_' + id, null);
        var meta = '';
        if (saved && g.menuMeta) meta = '<span class="tmeta">' + g.menuMeta(saved) + '</span>';
        else if (saved && !saved.over) meta = '<span class="tmeta">Game in progress</span>';
        else if (wins[id]) meta = '<span class="tmeta">Wins: ' + wins[id] + '</span>';
        var emb = '';
        (g.emblem || []).forEach(function (c, i) {
          emb += CG.card(c, i * 30, i * 8, { w: 62, z: i + 1 });
        });
        h += '<button class="tile" data-act="open" data-g="' + id + '"><div class="temb">' + emb + '</div><div class="ttxt"><div class="tname">' +
          g.name + '</div><div class="tdesc">' + g.blurb + '</div>' + meta + '</div></button>';
      });
      h += '</div>';
    });
    h += '</div>';
    els.menu.innerHTML = h;
    els.menu.scrollTop = 0;
  };

  CG.open = function (id) {
    var g = CG.games[id];
    if (!g) return CG.showMenu();
    CG.clearTimers();
    CG.hideToast();
    CG.closeDialog();
    CG.cur = g;
    els.menu.hidden = true;
    els.game.hidden = false;
    els.title.textContent = g.short || g.name;
    var hb = '';
    (g.tools || []).forEach(function (t) {
      hb += '<button class="hbtn" data-act="' + t.act + '">' + t.label + '</button>';
    });
    hb += '<button class="hbtn" data-act="new">New game</button><button class="hbtn" data-act="rules">Rules</button>';
    els.hbtns.innerHTML = hb;
    CG.status('', '');
    CG.paint('');
    CG.store.set('screen', id);
    if (!g.S) g.S = CG.store.get('state_' + id, null);
    if (g.S && !g.S.over) {
      try { g.resume(); return; } catch (err) { CG.reportError(err); g.S = null; }
    }
    g.newGame(true);
  };

  CG.showRules = function () {
    var g = CG.cur;
    if (!g) return;
    CG.dialog({ title: 'How to play ' + g.name, body: g.rules, buttons: [{ label: 'Back to the game', primary: true }] });
  };

  function settingsBody() {
    var s = CG.settings;
    function seg(k, opts) {
      var h = '<div class="seg">';
      opts.forEach(function (o) {
        h += '<button class="bigbtn' + (String(s[k]) === String(o[0]) ? ' on' : '') + '" data-act="set" data-k="' + k + '" data-v="' + o[0] + '">' + o[1] + '</button>';
      });
      return h + '</div>';
    }
    return '<h4>Card colors</h4>' + seg('fourColor', [['false', 'Red and black'], ['true', 'Four colors']]) +
      '<p style="font-size:20px;margin-top:-10px">Four colors makes Diamonds blue and Clubs green, so every suit looks different.</p>' +
      '<h4>Computer speed</h4>' + seg('speed', [['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']]) +
      '<h4>Playing a card from your hand</h4>' + seg('oneTap', [['false', 'Tap twice (safer)'], ['true', 'Tap once']]);
  }
  CG.showSettings = function () {
    CG.dialog({ title: 'Settings', body: settingsBody(), buttons: [{ label: 'Done', primary: true }] });
  };
  function changeSetting(k, v) {
    if (k === 'speed') CG.settings.speed = v;
    else CG.settings[k] = v === 'true';
    CG.store.set('settings', CG.settings);
    applySettings();
    var body = els.dlg.querySelector('.dbody');
    if (body) body.innerHTML = settingsBody();
  }

  /* ---------- Dialog & toast ---------- */
  var dlgButtons = [];
  CG.dialog = function (o) {
    dlgButtons = o.buttons || [{ label: 'OK', primary: true }];
    var h = '<div class="dbox' + (o.cls ? ' ' + o.cls : '') + '">' + (o.title ? '<h2>' + o.title + '</h2>' : '') +
      '<div class="dbody scroll">' + (o.body || '') + '</div><div class="dbtns">';
    dlgButtons.forEach(function (b, i) {
      h += '<button class="bigbtn' + (b.primary ? ' primary' : '') + '" data-act="dlg" data-i="' + i + '">' + b.label + '</button>';
    });
    h += '</div></div>';
    els.dlg.innerHTML = h;
    els.dlg.hidden = false;
  };
  CG.closeDialog = function () {
    els.dlg.hidden = true;
    els.dlg.innerHTML = '';
    dlgButtons = [];
  };
  CG.dialogOpen = function () { return !els.dlg.hidden; };
  var toastTimer = null;
  CG.toast = function (msg, ms) {
    els.toast.innerHTML = msg;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.hidden = true; }, ms || 2600);
  };
  CG.hideToast = function () { clearTimeout(toastTimer); els.toast.hidden = true; };

  /* Confirm before throwing away a game in progress. */
  CG.confirmNew = function (g, start, extra) {
    var btns = (extra || []).slice();
    if (!btns.length) btns.push({ label: 'Start a new game', primary: true, fn: start });
    if (g.S && !g.S.over) btns.push({ label: 'Keep playing' });
    CG.dialog({ title: 'New game?', body: g.S && !g.S.over ? '<p>Your current game will end.</p>' : '', buttons: btns });
  };

  /* ---------- Input ---------- */
  function onClick(e) {
    var t = e.target;
    var el = t && t.closest ? t.closest('[data-act]') : null;
    if (!el) {
      if (CG.cur && els.board.contains(t) && CG.cur.bgTap && !CG.dialogOpen()) CG.cur.bgTap();
      return;
    }
    if (el.disabled) return;
    var act = el.getAttribute('data-act');
    var d = el.dataset;
    try {
      switch (act) {
        case 'menu': CG.showMenu(); return;
        case 'open': CG.open(d.g); return;
        case 'settings': CG.showSettings(); return;
        case 'rules': CG.showRules(); return;
        case 'set': changeSetting(d.k, d.v); return;
        case 'dlg':
          var b = dlgButtons[+d.i];
          if (!b) return;
          if (!b.keep) CG.closeDialog();
          if (b.fn) b.fn();
          return;
        case 'new':
          if (CG.cur) CG.cur.newGame(false);
          return;
      }
      if (CG.cur && CG.cur.act && !CG.dialogOpen()) CG.cur.act(act, d, el);
    } catch (err) {
      CG.reportError(err);
    }
  }

  var resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (CG.cur && CG.cur.S && !els.game.hidden) {
        try { CG.cur.render(); } catch (err) { CG.reportError(err); }
      }
    }, 120);
  }

  CG.init = function () {
    els.menu = $('menu'); els.game = $('game'); els.board = $('board'); els.stage = $('stage');
    els.stl = $('stl'); els.str = $('str'); els.title = $('htitle'); els.hbtns = $('hbtns');
    els.dlg = $('dlg'); els.toast = $('toast');
    $('hmenu').innerHTML = BACK + 'Menu';
    loadSettings();
    applySettings();
    document.addEventListener('click', onClick, false);
    window.addEventListener('resize', onResize, false);
    window.addEventListener('orientationchange', onResize, false);
    // Stop the page from rubber-banding on iPad, except inside scrolling areas.
    document.addEventListener('touchmove', function (e) {
      var t = e.target;
      if (!(t && t.closest && t.closest('.scroll, #menu'))) e.preventDefault();
    }, { passive: false });
    var last = CG.store.get('screen', null);
    if (last && CG.games[last]) CG.open(last);
    else CG.showMenu();
  };
})();
