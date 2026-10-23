/* Trick-taking games: Hearts and Spades (you against three computer players). */
(function () {
  'use strict';
  var CG = window.CG;
  var hv = CG.hi;
  function hasCard(arr, f) { for (var i = 0; i < arr.length; i++) if (f(arr[i])) return arr[i]; return null; }
  function byHigh(a) { return a.slice().sort(function (x, y) { return hv(y) - hv(x); }); }
  function byLow(a) { return a.slice().sort(function (x, y) { return hv(x) - hv(y); }); }
  function isQS(c) { return c.s === 's' && c.r === 12; }
  function suitWord(s) { return CG.SUIT_ONE[s] + ' ' + CG.suitSvg(s, 'si'); }

  var TB = {
    newGame: function (first) {
      var self = this;
      if (first) return this.startGame();
      CG.confirmNew(this, function () { self.startGame(); });
    },
    startGame: function () {
      CG.clearTimers();
      this.S = this.initState();
      this.sel = null;
      this.passSel = [];
      this.startHand();
    },
    dealCards: function () {
      var S = this.S, deck = CG.shuffle(CG.deck(1));
      S.hands = [[], [], [], []];
      for (var i = 0; i < 52; i++) S.hands[i % 4].push(deck[i]);
      for (var p = 0; p < 4; p++) this.sortHand(S.hands[p]);
      S.trick = []; S.tricks = [0, 0, 0, 0]; S.trickNo = 0; S.winner = null; S.received = [];
      this.sel = null;
      this.passSel = [];
    },
    sortHand: function (h) {
      var o = this.suitOrder;
      h.sort(function (a, b) { return a.s !== b.s ? o.indexOf(a.s) - o.indexOf(b.s) : hv(a) - hv(b); });
    },
    resume: function () {
      this.sel = null;
      this.passSel = [];
      if (this.S.phase === 'handEnd') { this.render(); this.showHandEnd(); return; }
      this.advance();
    },
    advance: function () {
      var S = this.S, self = this;
      if (S.over) return this.render();
      if (S.phase === 'play') {
        if (S.trick.length === 4) {
          this.render();
          CG.later(function () { if (S === self.S) self.collect(); }, CG.wait(1800));
          return;
        }
        this.render();
        if (S.turn === 0 && !CG.autoplay) return;
        CG.later(function () {
          if (S !== self.S || S.phase !== 'play' || S.trick.length === 4) return;
          self.playCard(S.turn, self.aiPlay(S.turn));
        }, CG.wait(S.trick.length ? 950 : 1150));
        return;
      }
      if (this.advancePhase) this.advancePhase();
      else this.render();
    },
    playCard: function (p, c) {
      var S = this.S, hand = S.hands[p], i = CG.byId(hand, c.id);
      if (i < 0) return;
      hand.splice(i, 1);
      S.trick.push({ p: p, c: c });
      this.onPlay(c, p);
      S.turn = (p + 1) % 4;
      this.sel = null;
      if (S.trick.length === 4) S.winner = this.winner(S.trick);
      this.advance();
    },
    collect: function () {
      var S = this.S, w = S.winner;
      S.tricks[w]++;
      this.onCollect(w, S.trick.map(function (t) { return t.c; }));
      S.trick = [];
      S.trickNo++;
      S.received = [];
      S.leader = S.turn = w;
      S.winner = null;
      if (!S.hands[0].length) return this.endHand();
      this.advance();
    },
    currentWinner: function () {
      var S = this.S;
      return S.trick.length ? this.winner(S.trick) : -1;
    },
    showHandEnd: function () {
      var S = this.S, self = this, sm = S.summary;
      var btns = sm.gameOver ? [
        { label: 'Play a new game', primary: true, fn: function () { self.startGame(); } },
        { label: 'Back to menu', fn: CG.showMenu }
      ] : [{ label: 'Deal the next hand', primary: true, fn: function () { self.startHand(); } }];
      CG.dialog({ title: sm.title, body: sm.body, buttons: btns });
    },
    finishHand: function (title, body, gameOver) {
      var S = this.S;
      S.phase = 'handEnd';
      S.summary = { title: title, body: body, gameOver: gameOver };
      if (gameOver) S.over = true;
      this.render();
      var self = this;
      CG.later(function () { self.showHandEnd(); }, CG.wait(700));
    },
    bgTap: function () {
      if (this.sel != null) { this.sel = null; this.render(); }
    },
    act: function (a, d) {
      var S = this.S;
      if (a === 'scores') return CG.dialog({ title: 'Scores', body: this.scoreTable(), buttons: [{ label: 'Back to the game', primary: true }] });
      if (S.over) return;
      if (a === 'hand') return this.tapHand(+d.id);
      if (this.actExtra) this.actExtra(a, d);
    },
    tapHand: function (id) {
      var S = this.S;
      if (S.phase === 'pass') return this.togglePass(id);
      if (S.phase !== 'play' || S.turn !== 0 || S.trick.length === 4) {
        CG.toast(S.phase === 'bid' ? 'Choose your bid first.' : 'Please wait for your turn.');
        return;
      }
      var hand = S.hands[0], i = CG.byId(hand, id);
      if (i < 0) return;
      var c = hand[i];
      if (CG.byId(this.legal(S, 0), id) < 0) { CG.toast(this.whyNot(S, c)); return; }
      if (CG.settings.oneTap || this.sel === id) { this.playCard(0, c); return; }
      this.sel = id;
      this.render();
    },
    render: function () {
      var S = this.S, W = CG.W(), H = CG.H(), h = '', self = this;
      var hand = S.hands[0], n = Math.max(hand.length, 1), step = 0.7;
      var cw1 = Math.min(W / (1 + step * (n - 1)), (H * 0.32) / (1.4 * 1.22));
      var per2 = Math.ceil(n / 2);
      var cw2 = n > 6 ? Math.min(W / (1 + step * (per2 - 1)), (H * 0.44) / (1.4 * 1.5 + 1.4 * 0.22)) : 0;
      var rows = cw2 > cw1 * 1.1 ? 2 : 1;
      var cw = Math.floor(Math.min(rows === 2 ? cw2 : cw1, 150));
      var ch = cw * 1.4, lift = Math.round(ch * 0.22);
      var handTop = Math.round(H - (rows === 2 ? ch * 1.5 : ch));
      var legal = S.phase === 'play' && S.turn === 0 && S.trick.length < 4 ? this.legal(S, 0) : null;
      var ok = {};
      if (legal) legal.forEach(function (c) { ok[c.id] = 1; });
      var rowsArr = rows === 2 ? [hand.slice(0, per2), hand.slice(per2)] : [hand];
      rowsArr.forEach(function (row, r) {
        var m = row.length, st = m > 1 ? Math.min(cw * 0.8, (W - cw) / (m - 1)) : 0, x0 = (W - (cw + st * (m - 1))) / 2;
        row.forEach(function (c, k) {
          var raised = self.sel === c.id || self.passSel.indexOf(c.id) >= 0;
          h += CG.card(c, x0 + k * st, handTop + r * ch * 0.5 - (raised ? lift : 0), {
            act: 'hand', data: { id: c.id }, w: cw, z: 10 + r * 20 + k, sel: raised,
            dim: legal && !ok[c.id], hint: !raised && S.received && S.received.indexOf(c.id) >= 0
          });
        });
      });
      var tableBottom = handTop - lift - 8;
      var lblW = Math.round(Math.min(210, W * 0.22)), lblH = 92;
      var topY = lblH + 8, availT = tableBottom - topY;
      var cwT = Math.floor(Math.max(40, Math.min(cw, availT / 2.15 / 1.4, (W - 2 * lblW - 24) / 2.8)));
      var chT = cwT * 1.4, cx = W / 2, cy = topY + availT / 2;
      var pos = [[cx - cwT / 2, cy + chT * 0.05], [cx - cwT * 1.4, cy - chT / 2], [cx - cwT / 2, cy - chT * 1.05], [cx + cwT * 0.4, cy - chT / 2]];
      var showWin = S.trick.length === 4;
      S.trick.forEach(function (t, k) {
        h += CG.card(t.c, pos[t.p][0], pos[t.p][1], { w: cwT, z: 5 + k, cls: showWin && S.winner === t.p ? 'win' : '' });
      });
      var midY = Math.round(cy - lblH / 2);
      var lp = [null, [0, midY], [Math.round(cx - lblW / 2), 0], [W - lblW, midY]];
      var active = S.phase === 'play' ? (showWin ? S.winner : S.turn) : S.phase === 'bid' ? S.bidTurn : -1;
      for (var p = 1; p < 4; p++)
        h += '<div class="lbl' + (active === p ? ' turn' : '') + '" style="left:' + lp[p][0] + 'px;top:' + lp[p][1] + 'px;width:' + lblW + 'px;min-height:' + lblH + 'px"><b>' +
          this.names[p] + '</b>' + this.seatInfo(S, p) + '</div>';
      if (this.panel) h += this.panel(S, { x: lblW + 12, y: topY, w: W - 2 * lblW - 24, h: availT, W: W, cx: cx, cy: cy });
      CG.paint(h);
      CG.status(this.statusText(S), '<button class="bigbtn" data-act="scores">Scores</button>');
      CG.save(this);
    },
    statusText: function (S) {
      if (S.over) return 'Game over.';
      if (S.phase === 'handEnd') return 'Hand over.';
      if (S.phase === 'play') {
        if (S.trick.length === 4) return (S.winner === 0 ? 'You take' : this.names[S.winner] + ' takes') + ' the trick.';
        if (S.turn !== 0) return this.names[S.turn] + ' is playing&hellip;';
        if (this.sel != null) return 'Tap the raised card again to play it.';
        if (!S.trick.length) return 'Your turn. Lead any bright card.';
        var led = S.trick[0].c.s;
        return 'Your turn. ' + (hasCard(S.hands[0], function (c) { return c.s === led; }) ? 'Play a ' + suitWord(led) + '.' : 'You have no ' + CG.SUIT_NAMES[led] + ', so play any card.');
      }
      return this.phaseText ? this.phaseText(S) : '';
    }
  };
  function makeGame(g) {
    for (var k in TB) if (!g[k]) g[k] = TB[k];
    g.sel = null;
    g.passSel = [];
    CG.register(g);
    return g;
  }
  function trickWinnerLed(trick, trump) {
    var best = trick[0];
    for (var i = 1; i < trick.length; i++) {
      var t = trick[i], b = best.c, c = t.c;
      if (trump && c.s === trump && b.s !== trump) best = t;
      else if (c.s === b.s && hv(c) > hv(b)) best = t;
    }
    return best.p;
  }

  /* ================= HEARTS ================= */
  var HE = makeGame({
    id: 'hearts', name: 'Hearts', group: 'vs',
    blurb: 'Dodge the hearts and the Queen of Spades. Low score wins.',
    emblem: [{ r: 12, s: 's' }, { r: 1, s: 'h' }, { r: 2, s: 'c' }],
    names: ['You', 'West', 'North', 'East'],
    suitOrder: 'cdsh',
    rules:
      '<p>You play against three computer players. <b>Low score wins.</b> The game ends when someone reaches 100 points.</p>' +
      '<h4>Points</h4><ul><li>Each heart you take is 1 point.</li><li>The Queen of Spades is 13 points.</li>' +
      '<li><b>Shooting the moon:</b> take all the hearts and the Queen, and everyone else gets 26 points instead.</li></ul>' +
      '<h4>Playing</h4><ul><li>Before each hand you pass 3 cards: to the left, then right, then across, then no pass.</li>' +
      '<li>The player with the 2 of Clubs starts.</li><li>You must play the same suit that was led if you can.</li>' +
      '<li>Highest card of the suit that was led wins the trick.</li><li>You can’t lead hearts until a heart has been played.</li>' +
      '<li>No hearts or Queen of Spades on the very first trick.</li></ul>' +
      '<p>Cards you can play are bright. Cards you can’t play are darker. Tap a card to raise it, then tap it again to play.</p>',
    initState: function () {
      return { scores: [0, 0, 0, 0], handNo: 0, over: false, phase: 'pass' };
    },
    startHand: function () {
      var S = this.S;
      this.dealCards();
      S.points = [0, 0, 0, 0];
      S.broken = false;
      S.qPlayed = false;
      S.dir = S.handNo % 4;
      if (S.dir === 3) return this.startPlay();
      S.phase = 'pass';
      if (CG.autoplay) return this.doPass();
      this.render();
    },
    passTarget: function (p) { return (p + [1, 3, 2][this.S.dir]) % 4; },
    startPlay: function () {
      var S = this.S;
      S.phase = 'play';
      for (var p = 0; p < 4; p++) if (hasCard(S.hands[p], function (c) { return c.s === 'c' && c.r === 2; })) S.leader = S.turn = p;
      this.advance();
    },
    togglePass: function (id) {
      var i = this.passSel.indexOf(id);
      if (i >= 0) this.passSel.splice(i, 1);
      else if (this.passSel.length < 3) this.passSel.push(id);
      else CG.toast('You have picked 3 cards. Tap one to put it back.');
      this.render();
    },
    aiPassPick: function (hand) {
      var cnt = { s: 0, h: 0, d: 0, c: 0 };
      hand.forEach(function (c) { cnt[c.s]++; });
      function danger(c) {
        var v = hv(c);
        if (isQS(c)) return 100;
        if (c.s === 's' && v > 12) return cnt.s >= 5 ? 20 : 90;
        if (c.s === 'h') return 40 + v;
        if (c.s === 's') return v - 10;
        return v + (cnt[c.s] <= 2 ? 8 : 0);
      }
      return hand.slice().sort(function (a, b) { return danger(b) - danger(a); }).slice(0, 3).map(function (c) { return c.id; });
    },
    doPass: function () {
      var S = this.S, picks = [], p, self = this;
      for (p = 0; p < 4; p++) picks.push(p === 0 && !CG.autoplay ? this.passSel.slice() : this.aiPassPick(S.hands[p]));
      var moving = [];
      for (p = 0; p < 4; p++) {
        moving.push(picks[p].map(function (id) { return S.hands[p].splice(CG.byId(S.hands[p], id), 1)[0]; }));
      }
      for (p = 0; p < 4; p++) {
        var to = this.passTarget(p);
        moving[p].forEach(function (c) { S.hands[to].push(c); });
        this.sortHand(S.hands[to]);
      }
      var from = [0, 1, 2, 3].filter(function (q) { return self.passTarget(q) === 0; })[0];
      S.received = moving[from].map(function (c) { return c.id; });
      this.passSel = [];
      CG.toast('You got 3 cards from ' + this.names[from] + '. They are glowing blue.', 3200);
      this.startPlay();
    },
    actExtra: function (a) {
      if (a === 'pass' && this.S.phase === 'pass') {
        if (this.passSel.length !== 3) { CG.toast('Pick 3 cards to pass.'); return; }
        this.doPass();
      }
    },
    panel: function (S, b) {
      if (S.phase !== 'pass') return '';
      var dirName = ['West (left)', 'East (right)', 'North (across)'][S.dir];
      return '<div class="panel" style="left:' + b.x + 'px;top:' + Math.round(b.cy - 80) + 'px;width:' + b.w + 'px">' +
        '<h3>Pick 3 cards to pass to ' + dirName + '</h3>' +
        '<button class="bigbtn primary" data-act="pass"' + (this.passSel.length === 3 ? '' : ' disabled') + '>Pass ' + this.passSel.length + ' of 3 cards</button></div>';
    },
    phaseText: function (S) {
      if (S.phase === 'pass') return 'Tap 3 cards you want to get rid of.';
      return '';
    },
    legal: function (S, p) {
      var hand = S.hands[p];
      if (!S.trick.length) {
        if (S.trickNo === 0) {
          var two = hasCard(hand, function (c) { return c.s === 'c' && c.r === 2; });
          if (two) return [two];
        }
        if (!S.broken) {
          var non = hand.filter(function (c) { return c.s !== 'h'; });
          if (non.length) return non;
        }
        return hand.slice();
      }
      var led = S.trick[0].c.s;
      var f = hand.filter(function (c) { return c.s === led; });
      if (f.length) return f;
      if (S.trickNo === 0) {
        var safe = hand.filter(function (c) { return c.s !== 'h' && !isQS(c); });
        if (safe.length) return safe;
      }
      return hand.slice();
    },
    whyNot: function (S, c) {
      if (!S.trick.length) {
        if (S.trickNo === 0) return 'The 2 of Clubs must start the first trick.';
        return 'You can’t lead hearts until a heart has been played.';
      }
      var led = S.trick[0].c.s;
      if (c.s !== led && hasCard(S.hands[0], function (x) { return x.s === led; })) return 'You have to play a ' + suitWord(led) + '.';
      return 'No hearts or Queen of Spades on the first trick.';
    },
    onPlay: function (c) {
      if (c.s === 'h') this.S.broken = true;
      if (isQS(c)) this.S.qPlayed = true;
    },
    winner: function (trick) { return trickWinnerLed(trick, null); },
    onCollect: function (w, cards) {
      var pts = 0;
      cards.forEach(function (c) { if (c.s === 'h') pts++; if (isQS(c)) pts += 13; });
      this.S.points[w] += pts;
    },
    seatInfo: function (S, p) {
      return 'Cards: ' + S.hands[p].length + '<br>Points: ' + (S.points ? S.points[p] : 0);
    },
    statusText: function (S) {
      var base = TB.statusText.call(this, S);
      return base + (S.points ? ' <span style="color:var(--ink-dim)">&middot; Your points: ' + S.points[0] + '</span>' : '');
    },
    scoreTable: function () {
      var S = this.S, h = '<table class="sc"><tr><th>Player</th><th>This hand</th><th>Total</th></tr>';
      for (var p = 0; p < 4; p++) h += '<tr><td>' + this.names[p] + '</td><td>' + (S.points ? S.points[p] : 0) + '</td><td>' + S.scores[p] + '</td></tr>';
      return h + '</table><p>The game ends when someone reaches 100. Lowest score wins.</p>';
    },
    endHand: function () {
      var S = this.S, pts = S.points.slice(), moon = pts.indexOf(26), p, note = '';
      if (moon >= 0) {
        for (p = 0; p < 4; p++) pts[p] = p === moon ? 0 : 26;
        note = '<p><b>' + (moon === 0 ? 'You' : this.names[moon]) + ' shot the moon!</b> Everyone else gets 26 points.</p>';
      }
      for (p = 0; p < 4; p++) S.scores[p] += pts[p];
      var body = note + '<table class="sc"><tr><th>Player</th><th>This hand</th><th>Total</th></tr>';
      for (p = 0; p < 4; p++) body += '<tr><td>' + this.names[p] + '</td><td>' + pts[p] + '</td><td>' + S.scores[p] + '</td></tr>';
      body += '</table>';
      S.handNo++;
      var max = Math.max.apply(null, S.scores), title = 'Hand finished', over = false;
      if (max >= 100) {
        over = true;
        var min = Math.min.apply(null, S.scores);
        if (S.scores[0] === min) { title = 'You won the game!'; CG.addWin(this.id); }
        else title = this.names[S.scores.indexOf(min)] + ' wins the game';
        body += '<p>Someone reached 100, so the game is over. Lowest score wins.</p>';
      }
      this.finishHand(title, body, over);
    },
    aiPlay: function (p) {
      var S = this.S, hand = S.hands[p], legal = this.legal(S, p);
      if (legal.length === 1) return legal[0];
      var hi = byHigh(legal), qOut = S.qPlayed, hasQ = !!hasCard(hand, isQS);
      if (!S.trick.length) {
        var best = null, bs = 1e9;
        legal.forEach(function (c) {
          var n = hand.filter(function (x) { return x.s === c.s; }).length;
          var sc = hv(c) * 2 + n;
          if (c.s === 'h') sc += 12;
          if (c.s === 's' && !qOut && hv(c) >= 12) sc += 40;
          if (c.s === 's' && hv(c) < 12 && !qOut && !hasQ) sc -= 6;
          if (sc < bs) { bs = sc; best = c; }
        });
        return best;
      }
      var led = S.trick[0].c.s, w = S.trick[this.trickPos(S.trick, trickWinnerLed(S.trick, null))].c;
      var pts = 0;
      S.trick.forEach(function (t) { if (t.c.s === 'h') pts++; if (isQS(t.c)) pts += 13; });
      var last = S.trick.length === 3;
      var nonQ = hi.filter(function (c) { return !isQS(c); });
      if (legal[0].s === led) {
        var q = hasCard(legal, isQS);
        if (led === 's' && q && S.trick.some(function (t) { return t.c.s === 's' && hv(t.c) > 12; })) return q;
        if (last && pts === 0) return nonQ.length ? nonQ[0] : hi[0];
        var under = hi.filter(function (c) { return hv(c) < hv(w); });
        if (under.length) return under[0];
        if (led === 's' && !qOut) return byLow(legal)[0];
        return nonQ.length ? nonQ[0] : hi[0];
      }
      var qs = hasCard(legal, isQS);
      if (qs) return qs;
      if (!qOut) {
        var big = hasCard(hi, function (c) { return c.s === 's' && hv(c) > 12; });
        if (big) return big;
      }
      var heart = hasCard(hi, function (c) { return c.s === 'h'; });
      if (heart) return heart;
      return hi[0];
    },
    trickPos: function (trick, p) {
      for (var i = 0; i < trick.length; i++) if (trick[i].p === p) return i;
      return 0;
    }
  });

  /* ================= SPADES ================= */
  function estimateTricks(hand) {
    var est = 0, by = { s: [], h: [], d: [], c: [] };
    hand.forEach(function (c) { by[c.s].push(hv(c)); });
    ['h', 'd', 'c'].forEach(function (s) {
      var v = by[s], n = v.length, A = v.indexOf(14) >= 0, K = v.indexOf(13) >= 0;
      if (A) est += n <= 5 ? 1 : 0.7;
      if (K) est += n >= 2 ? (A ? 0.9 : 0.55) : 0.1;
      if (v.indexOf(12) >= 0 && n >= 3 && (A || K)) est += 0.25;
    });
    var sp = by.s, ns = sp.length;
    if (sp.indexOf(14) >= 0) est += 1;
    if (sp.indexOf(13) >= 0) est += ns >= 2 ? 0.9 : 0.4;
    if (sp.indexOf(12) >= 0) est += ns >= 3 ? 0.6 : 0.2;
    if (ns > 3) est += (ns - 3) * 0.8;
    var spare = Math.max(0, ns - 2);
    ['h', 'd', 'c'].forEach(function (s) {
      var n = by[s].length;
      if (spare > 0 && n === 0) { est += 0.8; spare--; } else if (spare > 0 && n === 1) { est += 0.4; spare--; }
    });
    return est;
  }
  var SPD = makeGame({
    id: 'spades', name: 'Spades', group: 'vs',
    blurb: 'Team up with your partner. Bid your tricks, then make them.',
    emblem: [{ r: 1, s: 's' }, { r: 13, s: 's' }, { r: 2, s: 's' }],
    names: ['You', 'West', 'North', 'East'],
    suitOrder: 'dchs',
    rules:
      '<p>You and <b>North</b> (across the table) are partners against West and East. First team to <b>500 points</b> wins.</p>' +
      '<h4>Bidding</h4><ul><li>Look at your cards and guess how many tricks you will win. The game suggests a number.</li>' +
      '<li>Your bid and your partner’s bid add up to your team’s goal.</li><li><b>Nil</b> means you promise to win no tricks at all: 100 points if you do it, minus 100 if you don’t.</li></ul>' +
      '<h4>Playing</h4><ul><li>Play the same suit that was led if you can.</li><li>Spades are trumps: any spade beats any other suit.</li>' +
      '<li>Highest spade wins, or if no spades were played, the highest card of the suit that was led.</li>' +
      '<li>You can’t lead spades until a spade has been played.</li></ul>' +
      '<h4>Scoring</h4><ul><li>Make your team’s goal: 10 points per trick bid, plus 1 point for each extra trick.</li>' +
      '<li>Miss it: lose 10 points per trick bid.</li><li>Every 10 extra tricks (called bags) costs 100 points.</li></ul>',
    initState: function () {
      return { scores: [0, 0], bags: [0, 0], dealer: 3, over: false, phase: 'bid', bids: [null, null, null, null] };
    },
    startHand: function () {
      var S = this.S;
      this.dealCards();
      S.dealer = (S.dealer + 1) % 4;
      S.bids = [null, null, null, null];
      S.bidTurn = (S.dealer + 1) % 4;
      S.broken = false;
      S.phase = 'bid';
      this.advance();
    },
    advancePhase: function () {
      var S = this.S, self = this;
      if (S.phase !== 'bid') return this.render();
      if (S.bids[S.bidTurn] != null) {
        S.phase = 'play';
        S.leader = S.turn = (S.dealer + 1) % 4;
        return this.advance();
      }
      this.render();
      if (S.bidTurn === 0 && !CG.autoplay) return;
      CG.later(function () {
        if (S !== self.S || S.phase !== 'bid') return;
        self.makeBid(S.bidTurn, Math.min(13, Math.max(1, Math.round(estimateTricks(S.hands[S.bidTurn])))));
      }, CG.wait(900));
    },
    makeBid: function (p, n) {
      var S = this.S;
      S.bids[p] = n;
      S.bidTurn = (p + 1) % 4;
      this.advance();
    },
    actExtra: function (a, d) {
      var S = this.S;
      if (a === 'bid' && S.phase === 'bid' && S.bidTurn === 0) this.makeBid(0, +d.n);
    },
    panel: function (S, b) {
      if (S.phase !== 'bid' || S.bidTurn !== 0) return '';
      var sug = Math.min(13, Math.max(1, Math.round(estimateTricks(S.hands[0]))));
      var w = b.w >= 470 ? b.w : Math.min(b.W - 20, 600);
      var h = '<div class="panel" style="left:' + Math.round((b.W - w) / 2) + 'px;top:' + b.y + 'px;width:' + w + 'px;z-index:40;background:rgba(0,0,0,0.55);border-radius:18px;padding:12px 0">' +
        '<h3>How many tricks will you win?</h3><div style="font-size:21px;margin:-4px 0 8px">Suggested bid: <b style="color:var(--gold)">' + sug + '</b>' +
        (S.bids[2] != null ? ' &middot; Partner bid ' + (S.bids[2] === 0 ? 'Nil' : S.bids[2]) : '') + '</div><div class="bidgrid">';
      for (var n = 0; n <= 13; n++)
        h += '<button class="bigbtn' + (n === sug ? ' primary' : '') + (n === 0 ? ' wide' : '') + '" data-act="bid" data-n="' + n + '">' + (n === 0 ? 'Nil' : n) + '</button>';
      return h + '</div></div>';
    },
    phaseText: function (S) {
      if (S.phase === 'bid') return S.bidTurn === 0 ? 'Your bid. How many tricks do you think you can win?' : this.names[S.bidTurn] + ' is bidding&hellip;';
      return '';
    },
    statusText: function (S) {
      var base = TB.statusText.call(this, S);
      if (S.phase === 'play' || S.phase === 'handEnd') {
        var bid = (S.bids[0] || 0) + (S.bids[2] || 0), won = S.tricks[0] + S.tricks[2];
        base += ' <span style="color:var(--ink-dim)">&middot; Team: ' + won + ' of ' + bid + '</span>';
      }
      return base;
    },
    seatInfo: function (S, p) {
      var bid = S.bids[p] == null ? '&ndash;' : S.bids[p] === 0 ? 'Nil' : S.bids[p];
      return (p === 2 ? '<span style="color:var(--gold)">Your partner</span><br>' : '') + 'Bid ' + bid + ' &middot; Won ' + S.tricks[p];
    },
    legal: function (S, p) {
      var hand = S.hands[p];
      if (!S.trick.length) {
        if (!S.broken) {
          var non = hand.filter(function (c) { return c.s !== 's'; });
          if (non.length) return non;
        }
        return hand.slice();
      }
      var led = S.trick[0].c.s, f = hand.filter(function (c) { return c.s === led; });
      return f.length ? f : hand.slice();
    },
    whyNot: function (S, c) {
      if (!S.trick.length) return 'You can’t lead spades until a spade has been played.';
      return 'You have to play a ' + suitWord(S.trick[0].c.s) + '.';
    },
    onPlay: function (c) { if (c.s === 's') this.S.broken = true; },
    winner: function (trick) { return trickWinnerLed(trick, 's'); },
    onCollect: function () {},
    scoreTable: function () {
      var S = this.S;
      return '<table class="sc"><tr><th>Team</th><th>Score</th><th>Bags</th></tr>' +
        '<tr><td>You &amp; North</td><td>' + S.scores[0] + '</td><td>' + S.bags[0] + '</td></tr>' +
        '<tr><td>West &amp; East</td><td>' + S.scores[1] + '</td><td>' + S.bags[1] + '</td></tr></table><p>First team to 500 wins.</p>';
    },
    endHand: function () {
      var S = this.S, rows = [], t;
      for (t = 0; t < 2; t++) {
        var bid = 0, tr = 0, nilPts = 0, bags = 0, nilNote = [];
        [t, t + 2].forEach(function (p) {
          if (S.bids[p] === 0) {
            nilPts += S.tricks[p] === 0 ? 100 : -100;
            bags += S.tricks[p];
            nilNote.push(S.tricks[p] === 0 ? 'Nil made' : 'Nil missed');
          } else { bid += S.bids[p]; tr += S.tricks[p]; }
        });
        var sc = nilPts, made = tr >= bid;
        if (bid > 0) {
          if (made) { sc += 10 * bid; bags += tr - bid; } else sc -= 10 * bid;
        }
        sc += bags;
        S.bags[t] += bags;
        var pen = 0;
        while (S.bags[t] >= 10) { S.bags[t] -= 10; pen += 100; }
        sc -= pen;
        S.scores[t] += sc;
        rows.push({ bid: bid, tr: tr + (S.bids[t] === 0 ? S.tricks[t] : 0) + (S.bids[t + 2] === 0 ? S.tricks[t + 2] : 0), sc: sc, made: made || bid === 0, pen: pen, nil: nilNote.join(', ') });
      }
      var names = ['You &amp; North', 'West &amp; East'];
      var body = '<table class="sc"><tr><th>Team</th><th>Bid</th><th>Won</th><th>Hand</th><th>Total</th></tr>';
      for (t = 0; t < 2; t++)
        body += '<tr><td>' + names[t] + '</td><td>' + rows[t].bid + '</td><td>' + rows[t].tr + '</td><td>' + (rows[t].sc > 0 ? '+' : '') + rows[t].sc + '</td><td>' + S.scores[t] + '</td></tr>';
      body += '</table>';
      for (t = 0; t < 2; t++) {
        var notes = [];
        if (!rows[t].made) notes.push('missed their bid');
        if (rows[t].nil) notes.push(rows[t].nil.toLowerCase());
        if (rows[t].pen) notes.push('lost 100 for 10 bags');
        if (notes.length) body += '<p>' + names[t] + ': ' + notes.join(', ') + '.</p>';
      }
      var a = S.scores[0], b = S.scores[1], over = false, title = 'Hand finished';
      if (((a >= 500 || b >= 500) && a !== b) || a <= -200 || b <= -200) {
        over = true;
        var youWin = a <= -200 ? false : b <= -200 ? true : a > b;
        title = youWin ? 'You and North win!' : 'West and East win';
        if (youWin) CG.addWin(this.id);
      }
      this.finishHand(title, body, over);
    },
    aiPlay: function (p) {
      var S = this.S, legal = this.legal(S, p);
      if (legal.length === 1) return legal[0];
      var partner = (p + 2) % 4;
      var bid = (S.bids[p] || 0) + (S.bids[partner] || 0), won = S.tricks[p] + S.tricks[partner];
      var need = won < bid, myNil = S.bids[p] === 0;
      var partnerNil = S.bids[partner] === 0 && S.tricks[partner] === 0;
      function key(c) { return (c.s === 's' ? 100 : 0) + hv(c); }
      function low(a) { return a.slice().sort(function (x, y) { return key(x) - key(y); })[0]; }
      function high(a) { return a.slice().sort(function (x, y) { return key(y) - key(x); })[0]; }
      if (!S.trick.length) {
        var nonS = legal.filter(function (c) { return c.s !== 's'; });
        if (myNil) return low(legal);
        if (need || partnerNil) {
          var ace = hasCard(nonS, function (c) { return c.r === 1; });
          if (ace) return ace;
          var sp = legal.filter(function (c) { return c.s === 's'; });
          if (S.broken && sp.length && hv(high(sp)) >= 13) return high(sp);
        }
        var pool = nonS.length ? nonS : legal, cnt = {};
        pool.forEach(function (c) { cnt[c.s] = (cnt[c.s] || 0) + 1; });
        var bestS = null;
        for (var s in cnt) if (!bestS || cnt[s] > cnt[bestS]) bestS = s;
        return low(pool.filter(function (c) { return c.s === bestS; }));
      }
      var led = S.trick[0].c.s, wp = trickWinnerLed(S.trick, 's'), wc = null;
      S.trick.forEach(function (t) { if (t.p === wp) wc = t.c; });
      function beats(c) { return c.s === wc.s ? hv(c) > hv(wc) : c.s === 's'; }
      var winners = legal.filter(beats), losers = legal.filter(function (c) { return !beats(c); });
      var last = S.trick.length === 3, partnerWinning = wp === partner;
      var partnerPlayed = S.trick.some(function (t) { return t.p === partner; });
      if (myNil) return losers.length ? high(losers) : low(winners);
      if (partnerNil && (!partnerPlayed || partnerWinning)) {
        if (winners.length) return last ? low(winners) : high(winners);
        return low(losers);
      }
      if (need && !partnerWinning) {
        if (winners.length) {
          if (last) return low(winners);
          var follow = winners.filter(function (c) { return c.s === led; });
          return follow.length ? high(follow) : low(winners);
        }
        return low(losers);
      }
      if (losers.length) return partnerWinning ? low(losers) : high(losers);
      return low(winners);
    }
  });
  CG.estimateSpades = estimateTricks;
  void HE; void SPD;
})();
