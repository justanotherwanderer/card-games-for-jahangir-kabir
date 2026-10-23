/* Solitaire games: Klondike, FreeCell, Spider, Pyramid */
(function () {
  'use strict';
  var CG = window.CG;

  /* Shared behaviour for single-player games with undo. */
  var Sol = {
    push: function () {
      this.hist.push(JSON.stringify(this.S));
      if (this.hist.length > 400) this.hist.shift();
    },
    undo: function () {
      if (this.S.over) return;
      if (!this.hist || !this.hist.length) { CG.toast('Nothing to undo yet'); return; }
      this.S = JSON.parse(this.hist.pop());
      this.sel = null;
      this.hintInfo = null;
      this.render();
    },
    bgTap: function () {
      if (this.sel || this.hintInfo) { this.sel = null; this.hintInfo = null; this.render(); }
    },
    showHint: function (h) {
      var self = this;
      this.sel = null;
      this.hintInfo = h;
      this.render();
      CG.later(function () {
        if (self.hintInfo === h) { self.hintInfo = null; self.render(); }
      }, 3000);
    },
    resume: function () {
      this.hist = this.hist || [];
      this.sel = null;
      this.hintInfo = null;
      this.busy = false;
      this.render();
    },
    win: function (msg) {
      var self = this;
      this.S.over = true;
      this.sel = null;
      CG.addWin(this.id);
      this.render();
      CG.later(function () {
        CG.dialog({
          title: 'You won!',
          body: '<p>' + msg + '</p>',
          buttons: [
            { label: 'Play again', primary: true, fn: function () { self.newGame(true); } },
            { label: 'Back to menu', fn: CG.showMenu }
          ]
        });
      }, 500);
    },
    start: function (S) {
      this.S = S;
      this.hist = [];
      this.sel = null;
      this.hintInfo = null;
      this.busy = false;
      this.render();
    },
    isSel: function (p, i) {
      var s = this.sel;
      return !!(s && s.p === p && i >= s.i);
    },
    isHint: function (p, i, len) {
      var h = this.hintInfo;
      if (!h) return false;
      if (h.src && h.src.p === p && i >= h.src.i) return true;
      if (h.dst === p && i === len - 1) return true;
      if (h.also && h.also.p === p && h.also.i === i) return true;
      return false;
    }
  };
  function reg(g) {
    for (var k in Sol) if (!g[k]) g[k] = Sol[k];
    g.hist = [];
    CG.register(g);
  }
  function top(a) { return a[a.length - 1]; }
  function selText(c) { return 'Holding ' + CG.cardText(c) + '. Tap where it should go, or tap it again.'; }

  /* ================= KLONDIKE ================= */
  var K = {
    id: 'klondike', name: 'Klondike Solitaire', short: 'Klondike', group: 'solo',
    blurb: 'The classic. Build each suit up from Ace to King.',
    emblem: [{ r: 13, s: 'h' }, { r: 12, s: 's' }, { r: 1, s: 'd' }],
    tools: [{ act: 'undo', label: 'Undo' }, { act: 'hint', label: 'Hint' }],
    rules:
      '<p><b>Goal:</b> move all 52 cards onto the four foundation piles at the top right, one pile per suit, from Ace up to King.</p>' +
      '<h4>Moving cards</h4><ul><li>Tap a card to pick it up. It glows gold.</li><li>Tap the place where it should go.</li>' +
      '<li>Tap a card twice and it moves to the best spot on its own.</li><li>Tap the empty table to put a card back down.</li></ul>' +
      '<h4>The rules</h4><ul><li>In the seven columns, put a card on one that is one higher and the opposite color: a red 6 on a black 7.</li>' +
      '<li>You can move a group of face-up cards together.</li><li>Only a King can go in an empty column.</li>' +
      '<li>Tap the deck (top left) to turn over new cards. When it runs out, tap it again to start over.</li></ul>' +
      '<p>Stuck? Tap <b>Hint</b>. Made a mistake? Tap <b>Undo</b>.</p>'
  };
  function kPile(S, p) {
    if (p === 'stock') return S.stock;
    if (p === 'waste') return S.waste;
    if (p[0] === 'f') return S.found[+p.slice(1)];
    return S.tab[+p.slice(1)];
  }
  function canFound(c, F) {
    if (!F.length) return c.r === 1;
    var t = top(F);
    return t.s === c.s && c.r === t.r + 1;
  }
  function altOk(c, T) {
    if (!T.length) return c.r === 13;
    var t = top(T);
    return t.up !== false && CG.red(t) !== CG.red(c) && t.r === c.r + 1;
  }
  K.newGame = function (first) {
    var self = this, pref = CG.store.get('klondike_draw', 1);
    if (first) return this.deal(pref);
    var b = [
      { label: 'Turn 1 card (easier)', primary: pref === 1, fn: function () { self.deal(1); } },
      { label: 'Turn 3 cards (classic)', primary: pref === 3, fn: function () { self.deal(3); } }
    ];
    if (this.S && !this.S.over) b.push({ label: 'Keep playing' });
    CG.dialog({ title: 'New game of Klondike', body: '<p>How many cards should turn over from the deck each time you tap it?</p>', buttons: b });
  };
  K.deal = function (n) {
    CG.store.set('klondike_draw', n);
    var deck = CG.shuffle(CG.deck(1));
    var S = { draw: n, stock: [], waste: [], found: [[], [], [], []], tab: [[], [], [], [], [], [], []], moves: 0, over: false };
    for (var row = 0; row < 7; row++)
      for (var col = row; col < 7; col++) {
        var c = deck.pop();
        c.up = col === row;
        S.tab[col].push(c);
      }
    deck.forEach(function (c) { c.up = false; });
    S.stock = deck;
    this.start(S);
  };
  K.selectable = function (p, i) {
    var P = kPile(this.S, p), c = P[i];
    if (!c || c.up === false) return false;
    if (p === 'waste' || p[0] === 'f') return i === P.length - 1;
    return true;
  };
  K.check = function (src, dst) {
    var S = this.S, from = kPile(S, src.p), c = from[src.i], n = from.length - src.i, to = kPile(S, dst);
    if (src.p === dst) return 'The card is already there.';
    if (dst[0] === 'f') {
      if (n > 1) return 'Move one card at a time to the foundations.';
      if (!canFound(c, to)) return to.length ? 'Foundations go up in the same suit: Ace, 2, 3 and so on.' : 'Start a foundation with an Ace.';
      return null;
    }
    if (dst[0] === 't') {
      if (!altOk(c, to)) return to.length ? 'Put a card on one that is one higher and the opposite color.' : 'Only a King can go in an empty column.';
      return null;
    }
    return 'Cards can’t go there.';
  };
  K.doMove = function (src, dst) {
    var S = this.S, from = kPile(S, src.p), to = kPile(S, dst);
    this.push();
    var cards = from.splice(src.i, from.length - src.i);
    for (var i = 0; i < cards.length; i++) to.push(cards[i]);
    if (src.p[0] === 't' && from.length && top(from).up === false) top(from).up = true;
    S.moves++;
    this.sel = null;
    this.after();
  };
  K.autoMove = function (src) {
    var S = this.S, from = kPile(S, src.p), c = from[src.i], single = src.i === from.length - 1, t;
    if (single && src.p[0] !== 'f')
      for (var f = 0; f < 4; f++) if (canFound(c, S.found[f])) { this.doMove(src, 'f' + f); return true; }
    for (t = 0; t < 7; t++)
      if ('t' + t !== src.p && S.tab[t].length && altOk(c, S.tab[t])) { this.doMove(src, 't' + t); return true; }
    if (c.r === 13 && !(src.p[0] === 't' && src.i === 0))
      for (t = 0; t < 7; t++) if (!S.tab[t].length) { this.doMove(src, 't' + t); return true; }
    return false;
  };
  K.after = function () {
    var S = this.S, n = 0;
    S.found.forEach(function (F) { n += F.length; });
    if (n === 52 && !S.over) return this.win('You finished in ' + S.moves + ' moves.');
    this.render();
  };
  K.drawStock = function () {
    var S = this.S;
    if (S.stock.length) {
      this.push();
      for (var k = 0; k < S.draw && S.stock.length; k++) {
        var c = S.stock.pop();
        c.up = true;
        S.waste.push(c);
      }
      S.moves++;
    } else if (S.waste.length) {
      this.push();
      S.stock = S.waste.reverse();
      S.stock.forEach(function (c) { c.up = false; });
      S.waste = [];
      S.moves++;
    } else {
      CG.toast('The deck is empty.');
      return;
    }
    this.render();
  };
  K.findHint = function () {
    var S = this.S, srcs = [], f, t, u, k;
    if (S.waste.length) srcs.push({ p: 'waste', i: S.waste.length - 1 });
    for (t = 0; t < 7; t++) if (S.tab[t].length) srcs.push({ p: 't' + t, i: S.tab[t].length - 1 });
    for (k = 0; k < srcs.length; k++) {
      var c = kPile(S, srcs[k].p)[srcs[k].i];
      for (f = 0; f < 4; f++) if (canFound(c, S.found[f])) return { src: srcs[k], dst: 'f' + f };
    }
    for (t = 0; t < 7; t++) {
      var T = S.tab[t], fi = -1;
      for (k = 0; k < T.length; k++) if (T[k].up !== false) { fi = k; break; }
      if (fi < 0) continue;
      if (fi === 0 && T[0].r === 13) continue;
      for (u = 0; u < 7; u++) {
        if (u === t) continue;
        if (!S.tab[u].length && fi === 0) continue;
        if (altOk(T[fi], S.tab[u])) return { src: { p: 't' + t, i: fi }, dst: 't' + u };
      }
    }
    if (S.waste.length) {
      var w = top(S.waste);
      for (u = 0; u < 7; u++) if (altOk(w, S.tab[u])) return { src: { p: 'waste', i: S.waste.length - 1 }, dst: 't' + u };
    }
    if (S.stock.length || S.waste.length) return { stock: true };
    return null;
  };
  K.hint = function () {
    if (this.S.over) return;
    var h = this.findHint();
    if (!h) { CG.toast('No moves left. Try Undo, or start a new game.'); return; }
    if (h.stock) CG.toast('Tap the deck to turn over more cards.');
    this.showHint(h);
  };
  K.canFinish = function () {
    var S = this.S;
    if (S.over || S.stock.length || S.waste.length) return false;
    for (var t = 0; t < 7; t++) for (var i = 0; i < S.tab[t].length; i++) if (S.tab[t][i].up === false) return false;
    return true;
  };
  K.finish = function () {
    this.push();
    this.busy = true;
    this.sel = null;
    this.finStep();
  };
  K.finStep = function () {
    var S = this.S, self = this, best = null;
    for (var t = 0; t < 7; t++) {
      var T = S.tab[t];
      if (!T.length) continue;
      var c = top(T);
      for (var f = 0; f < 4; f++)
        if (canFound(c, S.found[f]) && (!best || c.r < best.c.r)) best = { t: t, f: f, c: c };
    }
    if (!best) { this.busy = false; this.after(); return; }
    S.found[best.f].push(S.tab[best.t].pop());
    S.moves++;
    var n = 0;
    S.found.forEach(function (F) { n += F.length; });
    if (n === 52) { this.busy = false; this.after(); return; }
    this.render();
    CG.later(function () { self.finStep(); }, CG.wait(120));
  };
  K.act = function (a, d) {
    if (this.S.over || this.busy) return;
    var hadHint = !!this.hintInfo;
    this.hintInfo = null;
    if (a === 'undo') return this.undo();
    if (a === 'hint') return this.hint();
    if (a === 'finish') return this.finish();
    if (a === 'stock') { this.sel = null; return this.drawStock(); }
    var r;
    if (a === 'slot') {
      if (this.sel) {
        r = this.check(this.sel, d.p);
        if (!r) return this.doMove(this.sel, d.p);
        CG.toast(r);
        this.sel = null;
      }
      return this.render();
    }
    if (a !== 'card') return;
    var p = d.p, i = +d.i;
    if (this.sel) {
      if (this.sel.p === p && this.sel.i === i) {
        if (!this.autoMove(this.sel)) { CG.toast('This card has nowhere to go right now.'); this.sel = null; this.render(); }
        return;
      }
      if (this.sel.p !== p) {
        r = this.check(this.sel, p);
        if (!r) return this.doMove(this.sel, p);
        CG.toast(r);
        this.sel = this.selectable(p, i) ? { p: p, i: i } : null;
        return this.render();
      }
    }
    this.sel = this.selectable(p, i) ? { p: p, i: i } : null;
    if (!this.sel && hadHint) CG.hideToast();
    this.render();
  };
  K.render = function () {
    var S = this.S, W = CG.W(), H = CG.H(), self = this;
    var gap = Math.max(8, Math.round(Math.min(W, H) * 0.014));
    var wb = (W - gap * 6) / 7, maxF = 0;
    S.tab.forEach(function (T) { maxF = Math.max(maxF, CG.stackFactor(T)); });
    var fit = (H - gap * 1.5) / (1.4 + maxF);
    var cw = Math.floor(Math.min(wb, Math.max(fit, wb * 0.72), H / 3.3));
    var ch = cw * 1.4, x0 = Math.round((W - (7 * cw + 6 * gap)) / 2);
    function X(i) { return x0 + i * (cw + gap); }
    var hi = this.hintInfo, h = '', f, t;
    if (S.stock.length) h += CG.card(null, X(0), 0, { act: 'stock', label: S.stock.length, hint: hi && hi.stock });
    else h += CG.slot(X(0), 0, S.waste.length ? '&#8635;' : '', { act: 'stock', hint: hi && hi.stock });
    var wn = S.waste.length, show = Math.min(S.draw === 3 ? 3 : 1, wn);
    if (!wn) h += CG.slot(X(1), 0, '', {});
    for (var k = 0; k < show; k++) {
      var idx = wn - show + k, last = idx === wn - 1;
      h += CG.card(S.waste[idx], X(1) + k * cw * 0.32, 0, last ? {
        act: 'card', data: { p: 'waste', i: idx }, sel: this.isSel('waste', idx), hint: this.isHint('waste', idx, wn)
      } : {});
    }
    for (f = 0; f < 4; f++) {
      var F = S.found[f], fp = 'f' + f;
      if (F.length) h += CG.card(top(F), X(3 + f), 0, { act: 'card', data: { p: fp, i: F.length - 1 }, sel: this.isSel(fp, F.length - 1), hint: this.isHint(fp, F.length - 1, F.length) });
      else h += CG.slot(X(3 + f), 0, 'A', { act: 'slot', data: { p: fp }, hint: hi && hi.dst === fp });
    }
    var ty = Math.round(ch + gap * 1.5), avail = H - ty;
    for (t = 0; t < 7; t++) {
      var T = S.tab[t], tp = 't' + t;
      if (!T.length) { h += CG.slot(X(t), ty, 'K', { act: 'slot', data: { p: tp }, hint: hi && hi.dst === tp }); continue; }
      var ys = CG.stackYs(T, cw, avail);
      for (var i = 0; i < T.length; i++)
        h += CG.card(T[i], X(t), ty + ys[i], { act: 'card', data: { p: tp, i: i }, sel: this.isSel(tp, i), hint: this.isHint(tp, i, T.length) });
    }
    CG.paint('<div style="--cw:' + cw + 'px">' + h + '</div>');
    var left;
    if (S.over) left = 'Solved! Well done.';
    else if (this.sel) left = selText(kPile(S, this.sel.p)[this.sel.i]);
    else if (!S.moves) left = 'Tap a card, then tap where it should go.';
    else left = 'Moves: ' + S.moves + (S.draw === 3 ? ' &middot; Turning 3' : '');
    CG.status(left, self.canFinish() && !this.busy ? '<button class="bigbtn primary" data-act="finish">Finish for me</button>' : '');
    CG.save(this);
  };
  reg(K);

  /* ================= FREECELL ================= */
  var FC = {
    id: 'freecell', name: 'FreeCell', group: 'solo',
    blurb: 'All cards face up. Use four free cells to sort them out.',
    emblem: [{ r: 7, s: 'c' }, { r: 6, s: 'd' }, { r: 5, s: 's' }],
    tools: [{ act: 'undo', label: 'Undo' }, { act: 'hint', label: 'Hint' }],
    rules:
      '<p><b>Goal:</b> move all cards to the four foundations (top right), one suit each, from Ace up to King.</p>' +
      '<h4>Moving cards</h4><ul><li>Tap a card to pick it up, then tap where it should go.</li><li>Tap a card twice to send it to the best spot.</li></ul>' +
      '<h4>The rules</h4><ul><li>In the columns, put a card on one that is one higher and the opposite color.</li>' +
      '<li>The four free cells (top left) each hold one card for later.</li>' +
      '<li>Any card can go in an empty column.</li>' +
      '<li>You can move a group of cards at once if you have enough empty free cells and columns. The game tells you how many.</li>' +
      '<li>Cards that are safe to move go up to the foundations on their own.</li></ul>'
  };
  function fPile(S, p) {
    if (p[0] === 'c') return S.cells[+p.slice(1)];
    if (p[0] === 'f') return S.found[+p.slice(1)];
    return S.tab[+p.slice(1)];
  }
  FC.newGame = function (first) {
    var self = this;
    if (first) return this.deal();
    CG.confirmNew(this, function () { self.deal(); });
  };
  FC.deal = function () {
    var deck = CG.shuffle(CG.deck(1));
    var S = { cells: [[], [], [], []], found: [[], [], [], []], tab: [[], [], [], [], [], [], [], []], moves: 0, over: false };
    for (var i = 0; i < 52; i++) S.tab[i % 8].push(deck[i]);
    this.start(S);
  };
  FC.selectable = function (p, i) {
    var P = fPile(this.S, p);
    if (!P[i] || p[0] === 'f') return false;
    if (p[0] === 'c') return true;
    for (var k = i; k < P.length - 1; k++)
      if (CG.red(P[k]) === CG.red(P[k + 1]) || P[k].r !== P[k + 1].r + 1) return false;
    return true;
  };
  FC.maxMove = function (toEmpty) {
    var S = this.S, free = 0, empty = 0;
    S.cells.forEach(function (c) { if (!c.length) free++; });
    S.tab.forEach(function (t) { if (!t.length) empty++; });
    if (toEmpty) empty--;
    return (free + 1) * Math.pow(2, Math.max(0, empty));
  };
  FC.check = function (src, dst) {
    var S = this.S, from = fPile(S, src.p), c = from[src.i], n = from.length - src.i, to = fPile(S, dst);
    if (src.p === dst) return 'The card is already there.';
    if (dst[0] === 'c') {
      if (n > 1) return 'A free cell holds just one card.';
      if (to.length) return 'That free cell is already in use.';
      return null;
    }
    if (dst[0] === 'f') {
      if (n > 1) return 'Move one card at a time to the foundations.';
      if (!canFound(c, to)) return to.length ? 'Foundations go up in the same suit.' : 'Start a foundation with an Ace.';
      return null;
    }
    if (to.length) {
      var t = top(to);
      if (CG.red(t) === CG.red(c) || t.r !== c.r + 1) return 'Put a card on one that is one higher and the opposite color.';
    }
    var max = this.maxMove(!to.length);
    if (n > max) return 'With the free space you have, you can move ' + max + ' card' + (max === 1 ? '' : 's') + ' at once.';
    return null;
  };
  FC.fr = function (s) {
    var S = this.S;
    for (var f = 0; f < 4; f++) if (S.found[f].length && S.found[f][0].s === s) return S.found[f].length;
    return 0;
  };
  FC.safe = function (c) {
    if (c.r <= 2) return true;
    var o = CG.red(c) ? ['s', 'c'] : ['h', 'd'];
    return this.fr(o[0]) >= c.r - 1 && this.fr(o[1]) >= c.r - 1;
  };
  FC.autoFound = function () {
    var S = this.S, moved = true;
    while (moved) {
      moved = false;
      var piles = S.cells.concat(S.tab);
      for (var k = 0; k < piles.length && !moved; k++) {
        var P = piles[k];
        if (!P.length) continue;
        var c = top(P);
        if (!this.safe(c)) continue;
        for (var f = 0; f < 4; f++)
          if (canFound(c, S.found[f])) { S.found[f].push(P.pop()); moved = true; break; }
      }
    }
  };
  FC.doMove = function (src, dst) {
    var S = this.S, from = fPile(S, src.p), to = fPile(S, dst);
    this.push();
    var cards = from.splice(src.i, from.length - src.i);
    for (var i = 0; i < cards.length; i++) to.push(cards[i]);
    S.moves++;
    this.sel = null;
    this.autoFound();
    this.after();
  };
  FC.after = function () {
    var n = 0;
    this.S.found.forEach(function (F) { n += F.length; });
    if (n === 52 && !this.S.over) return this.win('You solved it in ' + this.S.moves + ' moves.');
    this.render();
  };
  FC.autoMove = function (src) {
    var S = this.S, from = fPile(S, src.p), c = from[src.i], single = src.i === from.length - 1, t, k;
    if (single) for (var f = 0; f < 4; f++) if (canFound(c, S.found[f])) { this.doMove(src, 'f' + f); return true; }
    for (t = 0; t < 8; t++) if ('t' + t !== src.p && S.tab[t].length && !this.check(src, 't' + t)) { this.doMove(src, 't' + t); return true; }
    if (!(src.p[0] === 't' && src.i === 0))
      for (t = 0; t < 8; t++) if (!S.tab[t].length && !this.check(src, 't' + t)) { this.doMove(src, 't' + t); return true; }
    if (single && src.p[0] !== 'c')
      for (k = 0; k < 4; k++) if (!S.cells[k].length) { this.doMove(src, 'c' + k); return true; }
    return false;
  };
  FC.findHint = function () {
    var S = this.S, t, u, k, f, i;
    var srcs = [];
    for (k = 0; k < 4; k++) if (S.cells[k].length) srcs.push({ p: 'c' + k, i: 0 });
    for (t = 0; t < 8; t++) if (S.tab[t].length) srcs.push({ p: 't' + t, i: S.tab[t].length - 1 });
    for (k = 0; k < srcs.length; k++) {
      var c = fPile(S, srcs[k].p)[srcs[k].i];
      for (f = 0; f < 4; f++) if (canFound(c, S.found[f])) return { src: srcs[k], dst: 'f' + f };
    }
    for (t = 0; t < 8; t++) {
      var T = S.tab[t];
      for (i = 0; i < T.length; i++) {
        if (!this.selectable('t' + t, i)) continue;
        for (u = 0; u < 8; u++)
          if (u !== t && S.tab[u].length && !this.check({ p: 't' + t, i: i }, 't' + u)) return { src: { p: 't' + t, i: i }, dst: 't' + u };
        break;
      }
    }
    for (k = 0; k < 4; k++) {
      if (!S.cells[k].length) continue;
      for (u = 0; u < 8; u++) if (S.tab[u].length && !this.check({ p: 'c' + k, i: 0 }, 't' + u)) return { src: { p: 'c' + k, i: 0 }, dst: 't' + u };
    }
    return null;
  };
  FC.hint = function () {
    if (this.S.over) return;
    var h = this.findHint();
    if (!h) { CG.toast('Try moving a card to a free cell or an empty column.'); return; }
    this.showHint(h);
  };
  FC.act = function (a, d) {
    if (this.S.over) return;
    this.hintInfo = null;
    if (a === 'undo') return this.undo();
    if (a === 'hint') return this.hint();
    var r;
    if (a === 'slot') {
      if (this.sel) {
        r = this.check(this.sel, d.p);
        if (!r) return this.doMove(this.sel, d.p);
        CG.toast(r);
        this.sel = null;
      }
      return this.render();
    }
    if (a !== 'card') return;
    var p = d.p, i = +d.i;
    if (this.sel) {
      if (this.sel.p === p && this.sel.i === i) {
        if (!this.autoMove(this.sel)) { CG.toast('This card has nowhere to go right now.'); this.sel = null; this.render(); }
        return;
      }
      if (this.sel.p !== p) {
        r = this.check(this.sel, p);
        if (!r) return this.doMove(this.sel, p);
        CG.toast(r);
        this.sel = this.selectable(p, i) ? { p: p, i: i } : null;
        return this.render();
      }
    }
    if (!this.selectable(p, i) && p[0] === 't') CG.toast('You can only pick up cards that are in order, from the bottom of a column.');
    this.sel = this.selectable(p, i) ? { p: p, i: i } : null;
    this.render();
  };
  FC.render = function () {
    var S = this.S, W = CG.W(), H = CG.H();
    var gap = Math.max(7, Math.round(Math.min(W, H) * 0.012));
    var wb = (W - gap * 7) / 8, maxF = 0;
    S.tab.forEach(function (T) { maxF = Math.max(maxF, CG.stackFactor(T)); });
    var fit = (H - gap * 1.5) / (1.4 + maxF);
    var cw = Math.floor(Math.min(wb, Math.max(fit, wb * 0.72), H / 3.3));
    var ch = cw * 1.4, x0 = Math.round((W - (8 * cw + 7 * gap)) / 2);
    function X(i) { return x0 + i * (cw + gap); }
    var hi = this.hintInfo, h = '', k, t;
    for (k = 0; k < 4; k++) {
      var C = S.cells[k], cp = 'c' + k;
      if (C.length) h += CG.card(C[0], X(k), 0, { act: 'card', data: { p: cp, i: 0 }, sel: this.isSel(cp, 0), hint: this.isHint(cp, 0, 1) });
      else h += CG.slot(X(k), 0, 'Free<small>cell</small>', { act: 'slot', data: { p: cp }, hint: hi && hi.dst === cp });
    }
    for (k = 0; k < 4; k++) {
      var F = S.found[k], fp = 'f' + k;
      if (F.length) h += CG.card(top(F), X(4 + k), 0, { act: 'card', data: { p: fp, i: F.length - 1 }, hint: this.isHint(fp, F.length - 1, F.length) });
      else h += CG.slot(X(4 + k), 0, 'A', { act: 'slot', data: { p: fp }, hint: hi && hi.dst === fp });
    }
    var ty = Math.round(ch + gap * 1.5), avail = H - ty;
    for (t = 0; t < 8; t++) {
      var T = S.tab[t], tp = 't' + t;
      if (!T.length) { h += CG.slot(X(t), ty, '', { act: 'slot', data: { p: tp }, hint: hi && hi.dst === tp }); continue; }
      var ys = CG.stackYs(T, cw, avail);
      for (var i = 0; i < T.length; i++)
        h += CG.card(T[i], X(t), ty + ys[i], { act: 'card', data: { p: tp, i: i }, sel: this.isSel(tp, i), hint: this.isHint(tp, i, T.length) });
    }
    CG.paint('<div style="--cw:' + cw + 'px">' + h + '</div>');
    var left;
    if (S.over) left = 'Solved! Well done.';
    else if (this.sel) left = selText(fPile(S, this.sel.p)[this.sel.i]);
    else left = S.moves ? 'Moves: ' + S.moves + ' &middot; You can move ' + this.maxMove(false) + ' cards at once' : 'Tap a card, then tap where it should go.';
    CG.status(left, '');
    CG.save(this);
  };
  reg(FC);

  /* ================= SPIDER ================= */
  var SP = {
    id: 'spider', name: 'Spider Solitaire', short: 'Spider', group: 'solo',
    blurb: 'Build full runs from King down to Ace to clear the table.',
    emblem: [{ r: 13, s: 's' }, { r: 12, s: 's' }, { r: 11, s: 's' }],
    tools: [{ act: 'undo', label: 'Undo' }, { act: 'hint', label: 'Hint' }],
    rules:
      '<p><b>Goal:</b> make 8 complete runs from King down to Ace in one suit. Each finished run leaves the table.</p>' +
      '<h4>The rules</h4><ul><li>Put any card on a card that is one higher, whatever the suit: a 6 on any 7.</li>' +
      '<li>You can pick up a group of cards only if they are all the same suit and in order.</li>' +
      '<li>Any card or group can go into an empty column.</li>' +
      '<li>Tap <b>Deal</b> (top right) to put one new card on every column. All columns must have at least one card first.</li></ul>' +
      '<p>Tap a card twice to send it to the best spot. One suit is the easiest game.</p>'
  };
  SP.newGame = function (first) {
    var self = this, pref = CG.store.get('spider_suits', 1);
    if (first) return this.deal(pref);
    var b = [
      { label: '1 suit (easiest)', primary: pref === 1, fn: function () { self.deal(1); } },
      { label: '2 suits (medium)', primary: pref === 2, fn: function () { self.deal(2); } },
      { label: '4 suits (hard)', primary: pref === 4, fn: function () { self.deal(4); } }
    ];
    if (this.S && !this.S.over) b.push({ label: 'Keep playing' });
    CG.dialog({ title: 'New game of Spider', body: '<p>How many suits do you want to play with?</p>', buttons: b });
  };
  SP.deal = function (n) {
    CG.store.set('spider_suits', n);
    var suits = n === 1 ? ['s'] : n === 2 ? ['s', 'h'] : ['s', 'h', 'd', 'c'];
    var deck = CG.shuffle(CG.deck(8 / suits.length, 0, suits));
    var S = { suits: n, tab: [], stock: [], done: [], moves: 0, over: false };
    for (var t = 0; t < 10; t++) S.tab.push([]);
    for (var i = 0; i < 54; i++) { var c = deck.pop(); c.up = false; S.tab[i % 10].push(c); }
    S.tab.forEach(function (T) { top(T).up = true; });
    deck.forEach(function (c) { c.up = false; });
    S.stock = deck;
    this.start(S);
  };
  SP.selectable = function (t, i) {
    var T = this.S.tab[t];
    if (!T[i] || T[i].up === false) return false;
    for (var k = i; k < T.length - 1; k++) if (T[k + 1].s !== T[k].s || T[k + 1].r !== T[k].r - 1) return false;
    return true;
  };
  SP.check = function (src, u) {
    var T = this.S.tab[src.t], c = T[src.i], D = this.S.tab[u];
    if (src.t === u) return 'The cards are already there.';
    if (D.length && top(D).r !== c.r + 1) return 'Put a card on one that is exactly one higher.';
    return null;
  };
  SP.completeRuns = function () {
    var S = this.S, found = false;
    S.tab.forEach(function (T) {
      if (T.length < 13) return;
      var b = T.length - 13;
      for (var k = 0; k < 13; k++) {
        var c = T[b + k];
        if (c.up === false || c.s !== T[b].s || c.r !== 13 - k) return;
      }
      S.done.push(T[b].s);
      T.splice(b, 13);
      if (T.length && top(T).up === false) top(T).up = true;
      found = true;
    });
    return found;
  };
  SP.doMove = function (src, u) {
    var S = this.S, T = S.tab[src.t], D = S.tab[u];
    this.push();
    var cards = T.splice(src.i, T.length - src.i);
    for (var i = 0; i < cards.length; i++) D.push(cards[i]);
    if (T.length && top(T).up === false) top(T).up = true;
    S.moves++;
    this.sel = null;
    if (this.completeRuns()) CG.toast('A full run is done!');
    this.after();
  };
  SP.after = function () {
    if (this.S.done.length >= 8 && !this.S.over) return this.win('All 8 runs are done in ' + this.S.moves + ' moves.');
    this.render();
  };
  SP.dealRow = function () {
    var S = this.S;
    if (!S.stock.length) { CG.toast('There are no more cards to deal.'); return; }
    for (var t = 0; t < 10; t++) if (!S.tab[t].length) { CG.toast('Put a card in every empty column before dealing.'); return; }
    this.push();
    for (t = 0; t < 10; t++) { var c = S.stock.pop(); c.up = true; S.tab[t].push(c); }
    S.moves++;
    this.sel = null;
    if (this.completeRuns()) CG.toast('A full run is done!');
    this.after();
  };
  SP.runStart = function (t) {
    var T = this.S.tab[t];
    if (!T.length) return -1;
    var i = T.length - 1;
    while (i > 0 && this.selectable(t, i - 1)) i--;
    return i;
  };
  SP.autoMove = function (src) {
    var S = this.S, c = S.tab[src.t][src.i], u, best = -1;
    for (u = 0; u < 10; u++) {
      if (u === src.t || !S.tab[u].length) continue;
      var tp = top(S.tab[u]);
      if (tp.r === c.r + 1 && tp.s === c.s) { best = u; break; }
      if (tp.r === c.r + 1 && best < 0) best = u;
    }
    if (best < 0 && src.i > 0) for (u = 0; u < 10; u++) if (!S.tab[u].length) { best = u; break; }
    if (best < 0) return false;
    this.doMove(src, best);
    return true;
  };
  SP.findHint = function () {
    var S = this.S, t, u, pass;
    for (pass = 0; pass < 2; pass++) {
      for (t = 0; t < 10; t++) {
        var i = this.runStart(t);
        if (i < 0) continue;
        var T = S.tab[t], c = T[i];
        var below = i > 0 ? T[i - 1] : null;
        for (u = 0; u < 10; u++) {
          if (u === t || !S.tab[u].length) continue;
          var tp = top(S.tab[u]);
          if (tp.r !== c.r + 1) continue;
          var sameSuit = tp.s === c.s;
          var alreadyHome = below && below.up !== false && below.r === c.r + 1 && below.s === c.s;
          if (alreadyHome) continue;
          if (pass === 0 && sameSuit) return { src: { p: 't' + t, i: i }, dst: 't' + u };
          if (pass === 1 && !(below && below.up !== false && below.r === c.r + 1)) return { src: { p: 't' + t, i: i }, dst: 't' + u };
        }
      }
    }
    if (S.stock.length) return { deal: true };
    return null;
  };
  SP.hint = function () {
    if (this.S.over) return;
    var h = this.findHint();
    if (!h) { CG.toast('No helpful moves left. Try Undo, or start a new game.'); return; }
    if (h.deal) { CG.toast('Tap Deal to put a new card on every column.'); return; }
    this.showHint(h);
  };
  SP.act = function (a, d) {
    if (this.S.over) return;
    this.hintInfo = null;
    if (a === 'undo') return this.undo();
    if (a === 'hint') return this.hint();
    if (a === 'deal') return this.dealRow();
    var r, u;
    if (a === 'slot') {
      u = +d.p.slice(1);
      if (this.sel) {
        r = this.check(this.sel, u);
        if (!r) return this.doMove(this.sel, u);
        CG.toast(r);
        this.sel = null;
      }
      return this.render();
    }
    if (a !== 'card') return;
    var t = +d.p.slice(1), i = +d.i;
    if (this.sel) {
      if (this.sel.t === t && this.sel.i === i) {
        if (!this.autoMove(this.sel)) { CG.toast('This card has nowhere to go right now.'); this.sel = null; this.render(); }
        return;
      }
      if (this.sel.t !== t) {
        r = this.check(this.sel, t);
        if (!r) return this.doMove(this.sel, t);
        CG.toast(r);
        this.sel = this.selectable(t, i) ? { t: t, i: i, p: 't' + t } : null;
        return this.render();
      }
    }
    if (!this.selectable(t, i) && this.S.tab[t][i].up !== false) CG.toast('You can only pick up cards of one suit that are in order.');
    this.sel = this.selectable(t, i) ? { t: t, i: i, p: 't' + t } : null;
    this.render();
  };
  SP.render = function () {
    var S = this.S, W = CG.W(), H = CG.H();
    var gap = Math.max(6, Math.round(Math.min(W, H) * 0.01));
    var wb = (W - gap * 9) / 10, maxF = 0;
    S.tab.forEach(function (T) { maxF = Math.max(maxF, CG.stackFactor(T, { down: 0.14 })); });
    var fit = H / maxF;
    var cw = Math.floor(Math.min(wb, Math.max(fit, wb * 0.75), H / 2.2));
    var x0 = Math.round((W - (10 * cw + 9 * gap)) / 2), h = '', hi = this.hintInfo;
    for (var t = 0; t < 10; t++) {
      var T = S.tab[t], tp = 't' + t, X = x0 + t * (cw + gap);
      if (!T.length) { h += CG.slot(X, 0, '', { act: 'slot', data: { p: tp }, hint: hi && hi.dst === tp }); continue; }
      var ys = CG.stackYs(T, cw, H, { down: 0.14, minUp: 0.22, minDown: 0.06 });
      for (var i = 0; i < T.length; i++)
        h += CG.card(T[i], X, ys[i], { act: 'card', data: { p: tp, i: i }, sel: this.isSel(tp, i), hint: this.isHint(tp, i, T.length) });
    }
    CG.paint('<div style="--cw:' + cw + 'px">' + h + '</div>');
    var left;
    if (S.over) left = 'All runs done!';
    else if (this.sel) left = selText(S.tab[this.sel.t][this.sel.i]);
    else left = 'Runs done: ' + S.done.length + ' of 8 &middot; Moves: ' + S.moves;
    var deals = S.stock.length / 10;
    CG.status(left, S.over ? '' : '<button class="bigbtn primary" data-act="deal"' + (deals ? '' : ' disabled') + '>Deal (' + deals + ' left)</button>');
    CG.save(this);
    if (W < H && !this.tipped) {
      this.tipped = true;
      CG.toast('Tip: turn the iPad sideways to make these cards bigger.', 4500);
    }
  };
  reg(SP);

  /* ================= PYRAMID ================= */
  var PY = {
    id: 'pyramid', name: 'Pyramid', group: 'solo',
    blurb: 'Pair up cards that add to 13 to clear the pyramid.',
    emblem: [{ r: 13, s: 'c' }, { r: 6, s: 'h' }, { r: 7, s: 's' }],
    tools: [{ act: 'undo', label: 'Undo' }, { act: 'hint', label: 'Hint' }],
    rules:
      '<p><b>Goal:</b> remove every card from the pyramid.</p>' +
      '<h4>How</h4><ul><li>Tap two cards that add up to 13 and they are removed.</li>' +
      '<li>Ace counts 1, Jack 11, Queen 12. A King is 13 on its own, so tap a King once to remove it.</li>' +
      '<li>Pairs that make 13: A+Q, 2+J, 3+10, 4+9, 5+8, 6+7.</li>' +
      '<li>You can only use a card when no cards are covering it. Covered cards look darker.</li>' +
      '<li>Tap the deck to turn over a new card. You can also pair the turned-over card.</li>' +
      '<li>You can go through the deck 3 times.</li></ul>'
  };
  var PROW = [], PPOS = [];
  (function () {
    for (var r = 0; r < 7; r++) for (var k = 0; k <= r; k++) { PROW.push(r); PPOS.push(k); }
  })();
  function pIdx(r, k) { return r * (r + 1) / 2 + k; }
  function pv(c) { return c.r; }
  PY.newGame = function (first) {
    var self = this;
    if (first) return this.deal();
    CG.confirmNew(this, function () { self.deal(); });
  };
  PY.deal = function () {
    var deck = CG.shuffle(CG.deck(1));
    var S = { pyr: deck.slice(0, 28), stock: deck.slice(28), waste: [], pass: 1, maxPass: 3, moves: 0, over: false };
    S.stock.forEach(function (c) { c.up = false; });
    this.start(S);
  };
  PY.avail = function (i) {
    var S = this.S;
    if (!S.pyr[i]) return false;
    var r = PROW[i], k = PPOS[i];
    if (r === 6) return true;
    return !S.pyr[pIdx(r + 1, k)] && !S.pyr[pIdx(r + 1, k + 1)];
  };
  PY.cardOf = function (sel) {
    return sel.p === 'p' ? this.S.pyr[sel.i] : top(this.S.waste);
  };
  PY.removeSel = function (sel) {
    if (sel.p === 'p') this.S.pyr[sel.i] = null;
    else this.S.waste.pop();
  };
  PY.tapCard = function (sel) {
    var c = this.cardOf(sel), self = this;
    if (c.r === 13) {
      this.push();
      this.removeSel(sel);
      this.S.moves++;
      this.sel = null;
      return this.after();
    }
    if (this.sel) {
      if (this.sel.p === sel.p && this.sel.i === sel.i) { this.sel = null; return this.render(); }
      var o = this.cardOf(this.sel);
      if (pv(o) + pv(c) === 13) {
        this.push();
        var a = this.sel, b = sel;
        // remove waste last so indexes stay right
        if (a.p === 'w') { this.removeSel(b); this.removeSel(a); } else { this.removeSel(a); this.removeSel(b); }
        this.S.moves++;
        this.sel = null;
        return this.after();
      }
      CG.toast(CG.cardText(o) + ' and ' + CG.cardText(c) + ' add up to ' + (pv(o) + pv(c)) + ', not 13.');
    }
    this.sel = sel;
    self.render();
  };
  PY.pairs = function () {
    var S = this.S, av = [], out = [], i, j;
    for (i = 0; i < 28; i++) if (this.avail(i)) av.push({ p: 'p', i: i });
    if (S.waste.length) av.push({ p: 'w', i: S.waste.length - 1 });
    for (i = 0; i < av.length; i++) {
      var a = this.cardOf(av[i]);
      if (a.r === 13) out.push([av[i]]);
      for (j = i + 1; j < av.length; j++) if (pv(a) + pv(this.cardOf(av[j])) === 13) out.push([av[i], av[j]]);
    }
    return out;
  };
  PY.after = function () {
    var S = this.S, left = 0;
    S.pyr.forEach(function (c) { if (c) left++; });
    if (!left && !S.over) return this.win('You cleared the pyramid in ' + S.moves + ' moves.');
    this.render();
    if (!S.stock.length && (S.pass >= S.maxPass || !S.waste.length) && !this.pairs().length) {
      var self = this;
      S.over = true;
      CG.save(this);
      CG.later(function () {
        CG.dialog({
          title: 'No more moves',
          body: '<p>There are no pairs left and the deck is used up. ' + left + ' cards were left in the pyramid.</p>',
          buttons: [
            { label: 'Deal a new game', primary: true, fn: function () { self.newGame(true); } },
            { label: 'Undo last move', fn: function () { S.over = false; self.undo(); } },
            { label: 'Back to menu', fn: CG.showMenu }
          ]
        });
      }, 600);
    }
  };
  PY.drawStock = function () {
    var S = this.S;
    this.sel = null;
    if (S.stock.length) {
      this.push();
      var c = S.stock.pop();
      c.up = true;
      S.waste.push(c);
      S.moves++;
    } else if (S.pass < S.maxPass && S.waste.length) {
      this.push();
      S.stock = S.waste.reverse();
      S.stock.forEach(function (c) { c.up = false; });
      S.waste = [];
      S.pass++;
      S.moves++;
      CG.toast('Pass ' + S.pass + ' of ' + S.maxPass + ' through the deck.');
    } else {
      CG.toast('No more passes through the deck.');
      return;
    }
    this.after();
  };
  PY.hint = function () {
    if (this.S.over) return;
    var p = this.pairs();
    if (p.length) {
      var h = { also: p[0][0].p === 'p' ? { p: 'p', i: p[0][0].i } : { p: 'w', i: p[0][0].i } };
      if (p[0][1]) h.also2 = p[0][1];
      return this.showHint(h);
    }
    if (this.S.stock.length || (this.S.pass < this.S.maxPass && this.S.waste.length)) {
      CG.toast('Tap the deck to turn over a card.');
      return this.showHint({ stock: true });
    }
    CG.toast('No moves left.');
  };
  PY.isPyHint = function (p, i) {
    var h = this.hintInfo;
    if (!h) return false;
    function m(x) { return x && x.p === p && x.i === i; }
    return m(h.also) || m(h.also2);
  };
  PY.act = function (a, d) {
    if (this.S.over) return;
    this.hintInfo = null;
    if (a === 'undo') return this.undo();
    if (a === 'hint') return this.hint();
    if (a === 'stock') return this.drawStock();
    if (a === 'pcard') {
      var i = +d.i;
      if (!this.avail(i)) { CG.toast('That card is covered. Clear the two cards below it first.'); return; }
      return this.tapCard({ p: 'p', i: i });
    }
    if (a === 'wcard') return this.tapCard({ p: 'w', i: this.S.waste.length - 1 });
  };
  PY.render = function () {
    var S = this.S, W = CG.W(), H = CG.H(), wide = W > H * 1.1, h = '', hi = this.hintInfo;
    var gap = Math.max(8, Math.round(Math.min(W, H) * 0.015)), cw, px0, py0, sx, sy, wx, wy;
    if (wide) {
      cw = Math.floor(Math.min(W / (7.7 + 1.6), (H - 4) / 5.6));
      var side = cw + gap * 2;
      px0 = side + Math.round((W - side - 7.66 * cw) / 2);
      py0 = Math.round((H - 5.6 * cw) / 2);
      sx = 0; sy = Math.round(H / 2 - cw * 1.4 - gap / 2);
      wx = 0; wy = Math.round(H / 2 + gap / 2);
    } else {
      cw = Math.floor(Math.min(W / 7.7, (H - gap * 2) / 7.1));
      px0 = Math.round((W - 7.66 * cw) / 2);
      py0 = 0;
      sy = wy = Math.round(5.6 * cw + gap * 2);
      sx = Math.round(W / 2 - cw - gap); wx = Math.round(W / 2 + gap);
    }
    for (var i = 0; i < 28; i++) {
      var c = S.pyr[i];
      if (!c) continue;
      var r = PROW[i], k = PPOS[i], av = this.avail(i);
      var x = px0 + (6 - r) * 0.555 * cw + k * 1.11 * cw, y = py0 + r * 0.7 * cw;
      h += CG.card(c, x, y, {
        act: 'pcard', data: { i: i }, cls: av ? '' : 'dimlite',
        sel: !!(this.sel && this.sel.p === 'p' && this.sel.i === i), hint: this.isPyHint('p', i)
      });
    }
    if (S.stock.length) h += CG.card(null, sx, sy, { act: 'stock', label: S.stock.length, hint: hi && hi.stock });
    else h += CG.slot(sx, sy, S.pass < S.maxPass && S.waste.length ? '&#8635;' : 'Empty', { act: 'stock', hint: hi && hi.stock });
    if (S.waste.length) {
      var wi = S.waste.length - 1;
      h += CG.card(top(S.waste), wx, wy, { act: 'wcard', sel: !!(this.sel && this.sel.p === 'w'), hint: this.isPyHint('w', wi) });
    } else h += CG.slot(wx, wy, '', {});
    CG.paint('<div style="--cw:' + cw + 'px">' + h + '</div>');
    var left;
    if (this.sel) {
      var sc = this.cardOf(this.sel);
      left = 'Holding ' + CG.cardText(sc) + '. Find a card worth ' + (13 - sc.r) + ' (' + (13 - sc.r === 1 ? 'Ace' : 13 - sc.r === 11 ? 'Jack' : 13 - sc.r === 12 ? 'Queen' : 13 - sc.r) + ').';
    } else left = 'Pairs that add to 13 &middot; Deck pass ' + S.pass + ' of ' + S.maxPass;
    CG.status(left, '');
    CG.save(this);
  };
  reg(PY);
})();
