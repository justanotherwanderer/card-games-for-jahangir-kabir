/* Gin Rummy, Crazy Eights, Blackjack */
(function () {
  'use strict';
  var CG = window.CG;
  function top(a) { return a[a.length - 1]; }

  /* ================= GIN RUMMY ================= */
  function dv(c) { return c.r >= 10 ? 10 : c.r; }
  function meldList(cards) {
    var list = [], byR = {}, byS = {};
    cards.forEach(function (c, i) {
      (byR[c.r] = byR[c.r] || []).push(i);
      (byS[c.s] = byS[c.s] || []).push(i);
    });
    function add(idx) {
      var m = 0, v = 0;
      idx.forEach(function (i) { m |= 1 << i; v += dv(cards[i]); });
      list.push({ mask: m, val: v });
    }
    Object.keys(byR).forEach(function (r) {
      var idx = byR[r];
      if (idx.length >= 3) add(idx);
      if (idx.length === 4) for (var k = 0; k < 4; k++) add(idx.filter(function (x, j) { return j !== k; }));
    });
    Object.keys(byS).forEach(function (s) {
      var idx = byS[s].slice().sort(function (a, b) { return cards[a].r - cards[b].r; });
      for (var a = 0; a < idx.length; a++) {
        var end = a;
        while (end + 1 < idx.length && cards[idx[end + 1]].r === cards[idx[end]].r + 1) end++;
        for (var b = a + 2; b <= end; b++) add(idx.slice(a, b + 1));
      }
    });
    return list;
  }
  function bestMelds(cards) {
    var M = meldList(cards), total = 0, bestV = 0, bestSet = [];
    cards.forEach(function (c) { total += dv(c); });
    function rec(i, used, v, chosen) {
      if (v > bestV) { bestV = v; bestSet = chosen.slice(); }
      for (var k = i; k < M.length; k++)
        if (!(M[k].mask & used)) { chosen.push(k); rec(k + 1, used | M[k].mask, v + M[k].val, chosen); chosen.pop(); }
    }
    rec(0, 0, 0, []);
    var inMeld = 0, melds = bestSet.map(function (k) {
      inMeld |= M[k].mask;
      var g = [];
      cards.forEach(function (c, i) { if (M[k].mask & (1 << i)) g.push(c); });
      return g.sort(function (a, b) { return a.r - b.r; });
    });
    var dead = cards.filter(function (c, i) { return !(inMeld & (1 << i)); }).sort(function (a, b) { return a.r - b.r || (a.s < b.s ? -1 : 1); });
    return { melds: melds, dead: dead, dw: total - bestV };
  }
  function fits(c, m) {
    var set = m.every(function (x) { return x.r === m[0].r; });
    if (set) return c.r === m[0].r && m.length < 4;
    if (c.s !== m[0].s) return false;
    var rs = m.map(function (x) { return x.r; }).sort(function (a, b) { return a - b; });
    return c.r === rs[0] - 1 || c.r === rs[rs.length - 1] + 1;
  }
  function layoff(melds, dead) {
    var ms = melds.map(function (m) { return m.slice(); }), left = dead.slice(), laid = [], changed = true;
    while (changed) {
      changed = false;
      for (var i = 0; i < left.length && !changed; i++)
        for (var j = 0; j < ms.length; j++)
          if (fits(left[i], ms[j])) { ms[j].push(left[i]); laid.push(left[i]); left.splice(i, 1); changed = true; break; }
    }
    return { laid: laid, left: left };
  }
  function sumDv(a) { var s = 0; a.forEach(function (c) { s += dv(c); }); return s; }
  function bestDiscard(hand, forbidId) {
    var best = null;
    hand.forEach(function (c) {
      if (c.id === forbidId) return;
      var rest = hand.filter(function (x) { return x.id !== c.id; }), dw = bestMelds(rest).dw;
      if (!best || dw < best.dw || (dw === best.dw && dv(c) > dv(best.c))) best = { c: c, dw: dw };
    });
    return best;
  }

  var GR = {
    id: 'gin', name: 'Gin Rummy', group: 'vs',
    blurb: 'Make sets and runs, then knock before the computer does.',
    emblem: [{ r: 5, s: 'h' }, { r: 6, s: 'h' }, { r: 7, s: 'h' }],
    tools: [],
    rules:
      '<p>You play against the computer. First to <b>100 points</b> wins.</p>' +
      '<h4>Your turn</h4><ul><li>Take the top card of the discard pile, or draw from the deck.</li>' +
      '<li>Then tap a card to raise it and tap it again (or tap <b>Discard</b>) to throw it away.</li></ul>' +
      '<h4>Melds</h4><ul><li><b>Sets:</b> 3 or 4 cards of the same rank, like three 8s.</li>' +
      '<li><b>Runs:</b> 3 or more cards in a row in the same suit, like 4, 5, 6 of Hearts. Ace is low.</li>' +
      '<li>Your hand is sorted for you: melds first (in boxes), then the loose cards, called <b>deadwood</b>.</li></ul>' +
      '<h4>Knocking</h4><ul><li>Deadwood counts: Ace 1, number cards their number, picture cards 10.</li>' +
      '<li>When your deadwood is 10 or less after discarding, you can <b>Knock</b> to end the hand.</li>' +
      '<li>No deadwood at all is <b>Gin</b>: 25 bonus points.</li>' +
      '<li>The other player can add loose cards to your melds. If their deadwood ends up as low as yours, they score instead (an undercut, 25 bonus).</li></ul>'
  };
  GR.newGame = function (first) {
    var self = this;
    if (first) return this.startGame();
    CG.confirmNew(this, function () { self.startGame(); });
  };
  GR.startGame = function () {
    CG.clearTimers();
    this.S = { scores: [0, 0], boxes: [0, 0], dealer: 1, over: false };
    this.startHand();
  };
  GR.startHand = function () {
    var S = this.S;
    S.stock = CG.shuffle(CG.deck(1));
    S.hands = [[], []];
    for (var i = 0; i < 10; i++) { S.hands[0].push(S.stock.pop()); S.hands[1].push(S.stock.pop()); }
    S.pile = [S.stock.pop()];
    S.dealer = 1 - S.dealer;
    S.turn = 1 - S.dealer;
    S.phase = 'draw';
    S.takenId = null;
    S.newId = null;
    S.summary = null;
    S.msg = S.turn === 0 ? 'New hand. You go first.' : 'New hand. The computer goes first.';
    this.sel = null;
    this.beginTurn();
  };
  GR.beginTurn = function () {
    var S = this.S, self = this;
    S.phase = 'draw';
    S.takenId = null;
    this.render();
    if (S.turn === 1 || CG.autoplay) CG.later(function () { if (S === self.S) self.aiDraw(); }, CG.wait(1100));
  };
  GR.resume = function () {
    var S = this.S, self = this;
    this.sel = null;
    if (S.phase === 'handEnd') { this.render(); return this.showHandEnd(); }
    this.render();
    if (S.turn === 1 || CG.autoplay)
      CG.later(function () { if (S === self.S) { if (S.phase === 'draw') self.aiDraw(); else self.aiDiscard(); } }, CG.wait(900));
  };
  GR.take = function (p, fromPile) {
    var S = this.S, c = fromPile ? S.pile.pop() : S.stock.pop();
    S.hands[p].push(c);
    S.takenId = fromPile ? c.id : null;
    S.newId = p === 0 ? c.id : null;
    S.phase = 'discard';
    return c;
  };
  GR.aiDraw = function () {
    var S = this.S, p = S.turn, self = this, hand = S.hands[p], t = top(S.pile);
    var cur = bestMelds(hand).dw, takeIt = false;
    if (t) {
      var b = bestMelds(hand.concat([t]));
      var inMeld = !b.dead.some(function (c) { return c.id === t.id; });
      var after = bestDiscard(hand.concat([t]), t.id);
      takeIt = inMeld || (after.dw < cur && dv(t) <= 3);
    }
    var c = this.take(p, takeIt);
    S.msg = (p === 1 ? 'The computer ' : 'You ') + (takeIt ? 'took ' + CG.cardText(c) + ' from the discard pile.' : 'drew from the deck.');
    this.render();
    CG.later(function () { if (S === self.S) self.aiDiscard(); }, CG.wait(1200));
  };
  GR.aiDiscard = function () {
    var S = this.S, p = S.turn, b = bestDiscard(S.hands[p], S.takenId);
    this.discard(p, b.c, b.dw <= 10);
  };
  GR.discard = function (p, c, knock) {
    var S = this.S, H = S.hands[p], i = CG.byId(H, c.id);
    if (i < 0) return;
    H.splice(i, 1);
    S.newId = null;
    this.sel = null;
    if (knock) {
      var dw = bestMelds(H).dw;
      if (dw > 10) { H.splice(i, 0, c); CG.toast('Your deadwood would be ' + dw + '. You need 10 or less to knock.'); return; }
      S.pile.push(c);
      return this.resolve(p, dw === 0);
    }
    S.pile.push(c);
    S.msg = (p === 0 ? 'You discarded ' : 'The computer discarded ') + CG.cardText(c) + '.';
    if (S.stock.length <= 2) return this.deadHand();
    S.turn = 1 - p;
    this.beginTurn();
  };
  GR.deadHand = function () {
    var S = this.S;
    S.phase = 'handEnd';
    S.summary = { title: 'No winner this hand', body: '<p>The deck ran low before anyone knocked, so nobody scores. The next hand starts fresh.</p>', gameOver: false };
    this.render();
    var self = this;
    CG.later(function () { self.showHandEnd(); }, CG.wait(700));
  };
  function handHTML(melds, dead, laid) {
    var h = '<div class="hands">';
    melds.forEach(function (m) { h += '<span class="grp">' + CG.inlineCards(m, 52) + '</span>'; });
    if (laid && laid.length) h += '<span class="grp" title="laid off">' + CG.inlineCards(laid, 52) + '</span>';
    if (dead.length) h += '<span class="grp dead">' + CG.inlineCards(dead, 52) + '</span>';
    return h + '</div>';
  }
  GR.resolve = function (k, gin) {
    var S = this.S, d = 1 - k, K = bestMelds(S.hands[k]), D = bestMelds(S.hands[d]);
    var defDead = D.dead, laid = [];
    if (!gin) { var lo = layoff(K.melds, D.dead); laid = lo.laid; defDead = lo.left; }
    var kdw = K.dw, ddw = sumDv(defDead), winner, pts, how;
    var who = ['You', 'The computer'];
    if (gin) { winner = k; pts = 25 + ddw; how = who[k] + ' went Gin! 25 bonus + ' + ddw + ' deadwood.'; }
    else if (ddw <= kdw) { winner = d; pts = 25 + (kdw - ddw); how = who[d] + ' undercut the knock! 25 bonus + ' + (kdw - ddw) + '.'; }
    else { winner = k; pts = ddw - kdw; how = who[k] + ' knocked and won by ' + pts + ' (' + ddw + ' minus ' + kdw + ').'; }
    S.scores[winner] += pts;
    S.boxes[winner]++;
    var body = '<p><b>' + how + '</b></p>' +
      '<h4>' + (k === 0 ? 'Your hand (knocked)' : 'Computer’s hand (knocked)') + ': deadwood ' + kdw + '</h4>' + handHTML(K.melds, K.dead) +
      '<h4>' + (d === 0 ? 'Your hand' : 'Computer’s hand') + ': deadwood ' + ddw + '</h4>' + handHTML(D.melds, defDead, laid) +
      (laid.length ? '<p style="font-size:20px">The middle group shows cards added to the knocker’s melds.</p>' : '') +
      '<table class="sc"><tr><th></th><th>Score</th></tr><tr><td>You</td><td>' + S.scores[0] + '</td></tr><tr><td>Computer</td><td>' + S.scores[1] + '</td></tr></table>';
    var title = winner === 0 ? 'You win the hand' : 'The computer wins the hand', over = false;
    if (S.scores[winner] >= 100) {
      over = true;
      var fin = [S.scores[0] + S.boxes[0] * 25 + (winner === 0 ? 100 : 0), S.scores[1] + S.boxes[1] * 25 + (winner === 1 ? 100 : 0)];
      title = winner === 0 ? 'You won the game!' : 'The computer wins the game';
      body += '<p>Final count with 100 for winning and 25 per hand won: You ' + fin[0] + ', Computer ' + fin[1] + '.</p>';
      if (winner === 0) CG.addWin(this.id);
    }
    S.phase = 'handEnd';
    S.summary = { title: title, body: body, gameOver: over };
    S.reveal = true;
    if (over) S.over = true;
    this.render();
    var self = this;
    CG.later(function () { self.showHandEnd(); }, CG.wait(800));
  };
  GR.showHandEnd = function () {
    var S = this.S, sm = S.summary, self = this;
    CG.dialog({
      title: sm.title, body: sm.body,
      buttons: sm.gameOver ? [
        { label: 'Play a new game', primary: true, fn: function () { self.startGame(); } },
        { label: 'Back to menu', fn: CG.showMenu }
      ] : [{ label: 'Deal the next hand', primary: true, fn: function () { S.reveal = false; self.startHand(); } }]
    });
  };
  GR.bgTap = function () { if (this.sel != null) { this.sel = null; this.render(); } };
  GR.act = function (a, d) {
    var S = this.S;
    if (a === 'scores') return CG.dialog({ title: 'Scores', body: '<table class="sc"><tr><th></th><th>Score</th><th>Hands won</th></tr><tr><td>You</td><td>' + S.scores[0] + '</td><td>' + S.boxes[0] + '</td></tr><tr><td>Computer</td><td>' + S.scores[1] + '</td><td>' + S.boxes[1] + '</td></tr></table><p>First to 100 wins.</p>', buttons: [{ label: 'Back to the game', primary: true }] });
    if (S.over || S.phase === 'handEnd') return;
    if (S.turn !== 0 || CG.autoplay) { CG.toast('Please wait. The computer is playing.'); return; }
    if (a === 'stock' || a === 'pile') {
      if (S.phase !== 'draw') { CG.toast('You already have your card. Now pick a card to discard.'); return; }
      if (a === 'pile' && !S.pile.length) { CG.toast('The discard pile is empty.'); return; }
      var c = this.take(0, a === 'pile');
      S.msg = a === 'pile' ? 'You took ' + CG.cardText(c) + '.' : 'You drew ' + CG.cardText(c) + '.';
      return this.render();
    }
    if (a === 'hand') {
      var id = +d.id;
      if (S.phase !== 'discard') { CG.toast('First take a card: tap the deck or the discard pile.'); return; }
      if (this.sel === id || CG.settings.oneTap) return this.tryDiscard(id, false);
      this.sel = id;
      return this.render();
    }
    if ((a === 'discard' || a === 'knock') && this.sel != null) return this.tryDiscard(this.sel, a === 'knock');
  };
  GR.tryDiscard = function (id, knock) {
    var S = this.S;
    if (id === S.takenId) { CG.toast('You can’t throw away the card you just took from the pile.'); this.sel = null; return this.render(); }
    var H = S.hands[0], c = H[CG.byId(H, id)];
    this.discard(0, c, knock);
  };
  GR.render = function () {
    var S = this.S, W = CG.W(), H = CG.H(), h = '', self = this, gap = 10;
    var hand = S.hands[0], arr = bestMelds(hand), seq = [];
    arr.melds.forEach(function (m, gi) { m.forEach(function (c, k) { seq.push({ c: c, g: gi, br: k === 0 && gi > 0 }); }); });
    arr.dead.forEach(function (c, k) { seq.push({ c: c, g: -1, br: k === 0 && arr.melds.length > 0 }); });
    var step = 0.7, brk = 0.28;
    function units(items) {
      var u = 1;
      for (var i = 1; i < items.length; i++) u += step + (items[i].br ? brk : 0);
      return u;
    }
    var cw1 = Math.min(W / units(seq), H * 0.36 / 1.65);
    var half = Math.ceil(seq.length / 2), r1 = seq.slice(0, half), r2 = seq.slice(half);
    if (r2.length) r2 = r2.map(function (x, i) { return i === 0 ? { c: x.c, g: x.g, br: false } : x; });
    var cw2 = Math.min(W / Math.max(units(r1), units(r2)), H * 0.5 / 2.4);
    var two = cw2 > cw1 * 1.12, rows = two ? [r1, r2] : [seq];
    var cw = Math.floor(Math.min(two ? cw2 : cw1, 140)), ch = cw * 1.4, lift = Math.round(ch * 0.2);
    var handTop = Math.round(H - ch - (two ? ch * 0.55 : 0));
    rows.forEach(function (row, r) {
      var tot = units(row) * cw, x = (W - tot) / 2;
      row.forEach(function (it, k) {
        if (k > 0) x += (step + (it.br ? brk : 0)) * cw;
        var on = self.sel === it.c.id;
        h += CG.card(it.c, x, handTop + r * ch * 0.55 - (on ? lift : 0), {
          act: 'hand', data: { id: it.c.id }, w: cw, z: 10 + r * 30 + k, sel: on,
          cls: (it.g < 0 ? '' : '') + (S.newId === it.c.id ? ' new' : ''), dim: S.phase === 'discard' && S.turn === 0 && it.c.id === S.takenId
        });
      });
    });
    var midBottom = handTop - lift - gap;
    var lblH = 84, pw = Math.floor(Math.min(cw * 1.05, (midBottom - lblH - gap * 2) / 1.4)), ph = pw * 1.4;
    var my = Math.round(lblH + gap + (midBottom - lblH - gap - ph) / 2);
    var cx = W / 2;
    var oppTurn = S.turn === 1 && S.phase !== 'handEnd';
    var lblW = Math.min(360, W - 20);
    h += '<div class="lbl' + (oppTurn ? ' turn' : '') + '" style="left:' + Math.round(cx - lblW / 2) + 'px;top:0;width:' + lblW + 'px"><b>Computer</b>' +
      (S.reveal ? 'Hand shown in the results' : S.hands[1].length + ' cards in hand') + '</div>';
    var sx = Math.round(cx - pw - gap * 2), px = Math.round(cx + gap * 2);
    if (S.reveal) sx = px = -9999;
    h += CG.card(null, sx, my, { w: pw, act: 'stock', label: S.stock.length, hint: S.turn === 0 && S.phase === 'draw' });
    if (S.pile.length) h += CG.card(top(S.pile), px, my, { w: pw, act: 'pile', hint: S.turn === 0 && S.phase === 'draw' });
    else h += CG.slot(px, my, '', { w: pw, act: 'pile' });
    h += '<div class="note" style="left:' + (sx) + 'px;top:' + Math.round(my + ph + 4) + 'px;width:' + pw + 'px;font-size:20px">Deck</div>';
    h += '<div class="note" style="left:' + (px) + 'px;top:' + Math.round(my + ph + 4) + 'px;width:' + pw + 'px;font-size:20px">Discard</div>';
    var bx = px + pw + gap * 3, mine = S.turn === 0 && S.phase === 'discard';
    if (mine && !S.reveal) {
      var canKnock = false, kdw = 0;
      if (this.sel != null && this.sel !== S.takenId) {
        kdw = bestMelds(hand.filter(function (c) { return c.id !== self.sel; })).dw;
        canKnock = kdw <= 10;
      }
      var bw = W - bx;
      var vertical = bw >= 170;
      var bs = vertical ? 'position:absolute;left:' + bx + 'px;top:' + my + 'px;width:' + Math.min(bw - 4, 230) + 'px' :
        'position:absolute;left:0;right:0;top:' + Math.round(my - 80) + 'px;text-align:center';
      h += '<div style="' + bs + '">' +
        '<button class="bigbtn" style="width:100%;margin-bottom:12px" data-act="discard"' + (this.sel != null ? '' : ' disabled') + '>Discard</button>' +
        (canKnock ? '<button class="bigbtn primary" style="width:100%" data-act="knock">' + (kdw === 0 ? 'Gin!' : 'Knock (' + kdw + ')') + '</button>' : '') + '</div>';
    }
    CG.paint(h);
    var left = S.msg ? S.msg + ' ' : '';
    if (S.phase === 'handEnd') left = 'Hand over.';
    else if (S.turn === 1) left += '<span style="color:var(--ink-dim)">The computer is playing&hellip;</span>';
    else if (S.phase === 'draw') left += '<span style="color:var(--gold)">Your turn: take the discard or draw from the deck.</span>';
    else {
      var bd = bestDiscard(hand, S.takenId);
      left += '<span style="color:var(--gold)">' + (bd && bd.dw <= 10 ? 'You can knock! Pick a card, then tap Knock.' : 'Pick a card to discard.') + '</span>';
    }
    left += ' <span style="color:var(--ink-dim)">&middot; Deadwood ' + arr.dw + '</span>';
    CG.status(left, '<button class="bigbtn" data-act="scores">Scores</button>');
    CG.save(this);
  };
  GR.sel = null;
  CG.register(GR);
  CG.gin = { best: bestMelds, layoff: layoff };

  /* ================= CRAZY EIGHTS ================= */
  var C8 = {
    id: 'crazy8', name: 'Crazy Eights', group: 'vs',
    blurb: 'Match the suit or the number. Eights are wild. Empty your hand first.',
    emblem: [{ r: 8, s: 'c' }, { r: 8, s: 'h' }, { r: 8, s: 's' }],
    tools: [],
    rules:
      '<p>Be the first to get rid of all your cards.</p><ul>' +
      '<li>Play a card that matches the top card of the pile by <b>suit</b> or by <b>number</b>.</li>' +
      '<li><b>Eights are wild.</b> Play one any time and choose the next suit.</li>' +
      '<li>If you can’t play, tap the deck to draw a card. Keep drawing until you can play.</li>' +
      '<li>Cards you can play are bright. The others are darker.</li></ul>'
  };
  var C8N = { 2: ['You', 'Computer'], 3: ['You', 'West', 'East'], 4: ['You', 'West', 'North', 'East'] };
  C8.newGame = function (first) {
    var self = this, pref = CG.store.get('crazy8_n', 2);
    if (first) return this.startGame(pref);
    var b = [2, 3, 4].map(function (n) {
      return { label: (n - 1) + ' computer player' + (n > 2 ? 's' : ''), primary: n === pref, fn: function () { self.startGame(n); } };
    });
    if (this.S && !this.S.over) b.push({ label: 'Keep playing' });
    CG.dialog({ title: 'New game of Crazy Eights', body: '<p>How many computer players?</p>', buttons: b });
  };
  C8.startGame = function (n) {
    CG.store.set('crazy8_n', n);
    CG.clearTimers();
    this.S = { n: n, wins: [0, 0, 0, 0].slice(0, n), round: 0, over: false };
    this.startRound();
  };
  C8.startRound = function () {
    var S = this.S, k = S.n === 2 ? 7 : 5;
    S.stock = CG.shuffle(CG.deck(1));
    S.hands = [];
    for (var p = 0; p < S.n; p++) S.hands.push([]);
    for (var i = 0; i < k; i++) for (p = 0; p < S.n; p++) S.hands[p].push(S.stock.pop());
    var c = S.stock.pop();
    while (c.r === 8) { S.stock.unshift(c); c = S.stock.pop(); }
    S.pile = [c];
    S.suit = c.s;
    S.turn = S.round % S.n;
    S.round++;
    S.phase = 'play';
    S.msg = '';
    S.over = false;
    this.sortHand();
    this.sel = null;
    this.advance();
  };
  C8.sortHand = function () {
    var o = 'cdsh';
    this.S.hands[0].sort(function (a, b) {
      if ((a.r === 8) !== (b.r === 8)) return a.r === 8 ? 1 : -1;
      return a.s !== b.s ? o.indexOf(a.s) - o.indexOf(b.s) : a.r - b.r;
    });
  };
  C8.legalCard = function (c) {
    var t = top(this.S.pile);
    return c.r === 8 || c.s === this.S.suit || c.r === t.r;
  };
  C8.legal = function (p) {
    var self = this;
    return this.S.hands[p].filter(function (c) { return self.legalCard(c); });
  };
  C8.refill = function () {
    var S = this.S;
    if (S.stock.length || S.pile.length < 2) return S.stock.length > 0;
    var t = S.pile.pop();
    S.stock = CG.shuffle(S.pile);
    S.pile = [t];
    CG.toast('The deck ran out, so the pile was shuffled into a new deck.');
    return true;
  };
  C8.advance = function () {
    var S = this.S, self = this;
    this.render();
    if (S.phase !== 'play' && S.phase !== 'suit') return;
    if (S.turn !== 0 || CG.autoplay) CG.later(function () { if (S === self.S) self.aiTurn(); }, CG.wait(1000));
  };
  C8.resume = function () {
    this.sel = null;
    if (this.S.phase === 'roundEnd') { this.render(); return this.showEnd(); }
    if (this.S.phase === 'suit' && this.S.turn === 0 && !CG.autoplay) return this.render();
    this.advance();
  };
  C8.play = function (p, c, suit) {
    var S = this.S, H = S.hands[p], i = CG.byId(H, c.id);
    H.splice(i, 1);
    S.pile.push(c);
    S.suit = c.s;
    this.sel = null;
    var name = C8N[S.n][p];
    S.msg = (p === 0 ? 'You played ' : name + ' played ') + CG.cardText(c) + '.';
    if (c.r === 8) {
      if (p === 0 && !CG.autoplay && !suit) { S.phase = 'suit'; return this.render(); }
      S.suit = suit;
      S.msg += ' ' + (p === 0 ? 'You chose ' : name + ' chose ') + CG.SUIT_NAMES[suit] + '.';
    }
    if (!H.length) return this.endRound(p);
    S.turn = (p + 1) % S.n;
    this.advance();
  };
  C8.endRound = function (p) {
    var S = this.S;
    S.wins[p]++;
    S.phase = 'roundEnd';
    S.winner = p;
    S.over = true;
    if (p === 0) CG.addWin(this.id);
    this.render();
    var self = this;
    CG.later(function () { self.showEnd(); }, CG.wait(700));
  };
  C8.showEnd = function () {
    var S = this.S, self = this, names = C8N[S.n], tbl = '<table class="sc"><tr><th>Player</th><th>Rounds won</th></tr>';
    for (var p = 0; p < S.n; p++) tbl += '<tr><td>' + names[p] + '</td><td>' + S.wins[p] + '</td></tr>';
    CG.dialog({
      title: S.winner === 0 ? 'You won the round!' : names[S.winner] + ' won the round',
      body: tbl + '</table>',
      buttons: [
        { label: 'Play another round', primary: true, fn: function () { self.startRound(); } },
        { label: 'Back to menu', fn: CG.showMenu }
      ]
    });
  };
  C8.aiTurn = function () {
    var S = this.S, p = S.turn, self = this;
    if (S.phase !== 'play') return;
    var legal = this.legal(p);
    if (legal.length) {
      var H = S.hands[p], cnt = { s: 0, h: 0, d: 0, c: 0 };
      H.forEach(function (c) { if (c.r !== 8) cnt[c.s]++; });
      var non8 = legal.filter(function (c) { return c.r !== 8; });
      var pick;
      if (non8.length) pick = non8.sort(function (a, b) { return cnt[b.s] - cnt[a.s] || b.r - a.r; })[0];
      else pick = legal[0];
      var bestSuit = 's';
      ['s', 'h', 'd', 'c'].forEach(function (s) { if (cnt[s] > cnt[bestSuit]) bestSuit = s; });
      if (pick.r === 8 && cnt[pick.s] && pick.s === bestSuit) cnt[pick.s]--;
      return this.play(p, pick, bestSuit);
    }
    if (!this.refill()) {
      S.msg = C8N[S.n][p] + (p === 0 ? ' can’t play and pass.' : ' can’t play and passes.');
      S.turn = (p + 1) % S.n;
      S.passes = (S.passes || 0) + 1;
      if (S.passes > S.n * 2) return this.blocked();
      return this.advance();
    }
    S.passes = 0;
    S.hands[p].push(S.stock.pop());
    if (p === 0) this.sortHand();
    S.msg = C8N[S.n][p] + (p === 0 ? ' draw a card.' : ' draws a card.');
    this.render();
    CG.later(function () { if (S === self.S) self.aiTurn(); }, CG.wait(650));
  };
  C8.blocked = function () {
    var S = this.S, best = 0, sizes = S.hands.map(function (h) { return h.length; });
    for (var p = 1; p < S.n; p++) if (sizes[p] < sizes[best]) best = p;
    S.msg = 'Nobody can play. The player with the fewest cards wins.';
    this.endRound(best);
  };
  C8.bgTap = function () { if (this.sel != null) { this.sel = null; this.render(); } };
  C8.act = function (a, d) {
    var S = this.S;
    if (S.phase === 'roundEnd') return;
    if (S.turn !== 0 || CG.autoplay) { CG.toast('Please wait for your turn.'); return; }
    if (a === 'suit' && S.phase === 'suit') {
      S.phase = 'play';
      S.suit = d.s;
      S.msg = 'You chose ' + CG.SUIT_NAMES[d.s] + '.';
      if (!S.hands[0].length) return this.endRound(0);
      S.turn = 1;
      return this.advance();
    }
    if (S.phase !== 'play') return;
    var legal = this.legal(0);
    if (a === 'stock') {
      if (legal.length) { CG.toast('You have a card you can play. Look for the bright cards.'); return; }
      if (!this.refill()) { CG.toast('No cards left to draw. Tap Pass.'); return; }
      var c = S.stock.pop();
      S.hands[0].push(c);
      this.sortHand();
      S.msg = 'You drew ' + CG.cardText(c) + '.';
      S.newId = c.id;
      return this.render();
    }
    if (a === 'pass') {
      S.msg = 'You passed.';
      S.turn = 1;
      S.passes = (S.passes || 0) + 1;
      if (S.passes > S.n * 2) return this.blocked();
      return this.advance();
    }
    if (a === 'hand') {
      var id = +d.id, H = S.hands[0], card = H[CG.byId(H, id)];
      if (!card) return;
      if (!this.legalCard(card)) {
        CG.toast('Play a ' + CG.SUIT_ONE[S.suit] + ' ' + CG.suitSvg(S.suit) + ', a ' + CG.RANKS[top(S.pile).r] + ', or an 8.');
        return;
      }
      if (this.sel === id || CG.settings.oneTap) { S.passes = 0; return this.play(0, card); }
      this.sel = id;
      this.render();
    }
  };
  C8.render = function () {
    var S = this.S, W = CG.W(), H = CG.H(), h = '', self = this, names = C8N[S.n];
    var hand = S.hands[0], n = Math.max(1, hand.length), step = 0.68;
    var cw1 = Math.min(W / (1 + step * (n - 1)), H * 0.36 / 1.68);
    var per2 = Math.ceil(n / 2), cw2 = n > 5 ? Math.min(W / (1 + step * (per2 - 1)), H * 0.5 / 2.4) : 0;
    var two = cw2 > cw1 * 1.1, rowsArr = two ? [hand.slice(0, per2), hand.slice(per2)] : [hand];
    var cw = Math.floor(Math.min(two ? cw2 : cw1, 150)), ch = cw * 1.4, lift = Math.round(ch * 0.2);
    var handTop = Math.round(H - ch - (two ? ch * 0.5 : 0));
    var myTurn = S.turn === 0 && S.phase === 'play';
    rowsArr.forEach(function (row, r) {
      var m = row.length, st = m > 1 ? Math.min(cw * 0.8, (W - cw) / (m - 1)) : 0, x0 = (W - (cw + st * (m - 1))) / 2;
      row.forEach(function (c, k) {
        var on = self.sel === c.id;
        h += CG.card(c, x0 + k * st, handTop + r * ch * 0.5 - (on ? lift : 0), {
          act: 'hand', data: { id: c.id }, w: cw, z: 10 + r * 30 + k, sel: on,
          dim: myTurn && !self.legalCard(c), cls: S.newId === c.id ? 'new' : ''
        });
      });
    });
    var bottom = handTop - lift - 10, lblW = Math.round(Math.min(200, W * 0.22)), lblH = 84;
    var seats = S.n === 2 ? { 1: 'top' } : S.n === 3 ? { 1: 'left', 2: 'right' } : { 1: 'left', 2: 'top', 3: 'right' };
    var topY = S.n === 3 ? 0 : lblH + 10, midY = Math.round(topY + (bottom - topY) / 2);
    Object.keys(seats).forEach(function (k) {
      var p = +k, where = seats[k], x = where === 'left' ? 0 : where === 'right' ? W - lblW : Math.round(W / 2 - lblW / 2);
      var y = where === 'top' ? 0 : Math.round(midY - lblH / 2);
      h += '<div class="lbl' + (S.turn === p && S.phase !== 'roundEnd' ? ' turn' : '') + '" style="left:' + x + 'px;top:' + y + 'px;width:' + lblW + 'px"><b>' +
        names[p] + '</b>Cards: ' + S.hands[p].length + '<br>Wins: ' + S.wins[p] + '</div>';
    });
    var room = Math.min(W - 2 * lblW - 40, (bottom - topY) / 1.4 * 2.4);
    var pw = Math.floor(Math.max(50, Math.min(cw * 1.1, room / 2.4, (bottom - topY - 50) / 1.4))), ph = pw * 1.4;
    var py = Math.round(midY - ph / 2 - 16), cx = W / 2;
    var sx = Math.round(cx - pw - 14), px = Math.round(cx + 14);
    if (S.stock.length || S.pile.length > 1) h += CG.card(null, sx, py, { w: pw, act: 'stock', label: S.stock.length, hint: myTurn && !this.legal(0).length });
    else h += CG.slot(sx, py, 'Empty', { w: pw });
    h += CG.card(top(S.pile), px, py, { w: pw });
    var t = top(S.pile);
    h += '<div class="note" style="left:' + (px - 40) + 'px;width:' + (pw + 80) + 'px;top:' + Math.round(py + ph + 6) + 'px;font-size:22px">' +
      (t.r === 8 || S.suit !== t.s ? 'Suit: ' + CG.SUIT_NAMES[S.suit] + ' ' + CG.suitSvg(S.suit) : 'Discard pile') + '</div>';
    h += '<div class="note" style="left:' + (sx - 20) + 'px;width:' + (pw + 40) + 'px;top:' + Math.round(py + ph + 6) + 'px;font-size:22px">Deck</div>';
    if (S.phase === 'suit' && S.turn === 0) {
      var pnl = '<div class="panel" style="left:0;right:0;top:' + Math.max(0, Math.round(midY - 150)) + 'px;z-index:40"><div style="display:inline-block;background:rgba(0,0,0,0.7);border-radius:20px;padding:14px 16px"><h3>Choose the next suit</h3>';
      ['s', 'h', 'd', 'c'].forEach(function (s) {
        pnl += '<button class="bigbtn suitbtn s-' + s + '" data-act="suit" data-s="' + s + '">' + CG.suitSvg(s, '') + CG.SUIT_NAMES[s] + '</button>';
      });
      h += pnl + '</div></div>';
    }
    if (myTurn && !this.legal(0).length && !S.stock.length && S.pile.length < 2)
      h += '<button class="bigbtn primary abs" style="left:' + Math.round(cx - 70) + 'px;top:' + Math.round(py - 80) + 'px" data-act="pass">Pass</button>';
    CG.paint(h);
    var left = S.msg ? S.msg + ' ' : '';
    if (S.phase === 'roundEnd') left = S.msg;
    else if (S.phase === 'suit' && S.turn === 0) left = 'Pick the suit the next player must follow.';
    else if (S.turn !== 0) left += '<span style="color:var(--ink-dim)">' + names[S.turn] + ' is playing&hellip;</span>';
    else if (this.legal(0).length) left += '<span style="color:var(--gold)">Your turn: play a bright card.</span>';
    else left += '<span style="color:var(--gold)">No card fits. Tap the deck to draw.</span>';
    CG.status(left, '');
    CG.save(this);
  };
  C8.sel = null;
  CG.register(C8);

  /* ================= BLACKJACK ================= */
  function bjTotal(cards) {
    var t = 0, aces = 0;
    cards.forEach(function (c) { if (c.r === 1) { aces++; t += 11; } else t += Math.min(10, c.r); });
    while (t > 21 && aces) { t -= 10; aces--; }
    return { t: t, soft: aces > 0 };
  }
  function bjVal(c) { return c.r === 1 ? 11 : Math.min(10, c.r); }
  var BJ = {
    id: 'blackjack', name: 'Blackjack', group: 'vs',
    menuMeta: function (S) { return 'Chips: ' + S.chips; },
    blurb: 'Get closer to 21 than the dealer without going over.',
    emblem: [{ r: 1, s: 's' }, { r: 13, s: 'h' }],
    tools: [],
    rules:
      '<p>Beat the dealer by getting closer to 21 without going over. You start with 1000 chips. No real money is used.</p><ul>' +
      '<li>Number cards count their number. Jack, Queen and King count 10. An Ace counts 1 or 11, whichever helps.</li>' +
      '<li><b>Hit</b> takes another card. <b>Stand</b> keeps what you have.</li>' +
      '<li><b>Double</b> doubles your bet and gives you exactly one more card.</li>' +
      '<li><b>Split</b> turns two matching cards into two separate hands.</li>' +
      '<li>The dealer must take cards until reaching 17 or more.</li>' +
      '<li>A win pays the same as your bet. Blackjack (Ace plus a 10 or picture card as your first two cards) pays 3 to 2.</li></ul>'
  };
  BJ.newGame = function (first) {
    var self = this;
    if (first) return this.startGame();
    CG.confirmNew(this, function () { self.startGame(); }, [{ label: 'Start over with 1000 chips', primary: true, fn: function () { self.startGame(); } }]);
  };
  BJ.startGame = function () {
    CG.clearTimers();
    this.S = { shoe: CG.shuffle(CG.deck(6)), chips: 1000, bet: 50, hands: [], dealer: [], cur: 0, phase: 'bet', over: false, msg: '' };
    this.render();
  };
  BJ.resume = function () {
    var S = this.S;
    if (S.phase === 'dealer') return this.dealerPlay();
    this.render();
  };
  BJ.draw = function () {
    var S = this.S;
    if (!S.shoe.length) S.shoe = CG.shuffle(CG.deck(6));
    return S.shoe.pop();
  };
  BJ.deal = function () {
    var S = this.S;
    if (S.bet < 10) { CG.toast('Place a bet of at least 10 chips.'); return; }
    if (S.bet > S.chips) { CG.toast('You don’t have enough chips for that bet.'); return; }
    if (S.shoe.length < 60) { S.shoe = CG.shuffle(CG.deck(6)); CG.toast('Shuffling a fresh shoe of cards.'); }
    S.chips -= S.bet;
    var a = this.draw(), d1 = this.draw(), b = this.draw(), d2 = this.draw();
    d2.up = false;
    S.hands = [{ cards: [a, b], bet: S.bet, done: false, res: '' }];
    S.dealer = [d1, d2];
    S.cur = 0;
    S.phase = 'play';
    S.msg = '';
    var dealerBJ = bjTotal([d1, { r: d2.r, s: d2.s }]).t === 21, playerBJ = bjTotal([a, b]).t === 21;
    if (dealerBJ || playerBJ) {
      S.dealer[1].up = true;
      var hd = S.hands[0];
      hd.done = true;
      if (dealerBJ && playerBJ) { hd.res = 'Push'; S.chips += hd.bet; S.msg = 'You both have Blackjack. Your bet comes back.'; }
      else if (dealerBJ) { hd.res = 'Lose'; S.msg = 'The dealer has Blackjack.'; }
      else { hd.res = 'Blackjack!'; S.chips += Math.round(hd.bet * 2.5); hd.bj = true; S.msg = 'Blackjack! You win ' + Math.round(hd.bet * 1.5) + '.'; }
      S.phase = 'bet';
    }
    this.render();
  };
  BJ.hand = function () { return this.S.hands[this.S.cur]; };
  BJ.nextHand = function () {
    var S = this.S;
    while (S.cur < S.hands.length && S.hands[S.cur].done) S.cur++;
    if (S.cur >= S.hands.length) return this.dealerPlay();
    var hd = S.hands[S.cur];
    if (hd.cards.length === 1) {
      hd.cards.push(this.draw());
      if (hd.splitAces || bjTotal(hd.cards).t === 21) { hd.done = true; return this.nextHand(); }
    }
    this.render();
  };
  BJ.hit = function () {
    var hd = this.hand();
    hd.cards.push(this.draw());
    var t = bjTotal(hd.cards).t;
    if (t > 21) { hd.done = true; hd.res = 'Bust'; }
    else if (t === 21) hd.done = true;
    if (hd.done) return this.nextHand();
    this.render();
  };
  BJ.dealerPlay = function () {
    var S = this.S, self = this;
    S.phase = 'dealer';
    S.dealer[1].up = true;
    var live = S.hands.some(function (h) { return h.res !== 'Bust'; });
    if (live && bjTotal(S.dealer).t < 17) {
      this.render();
      CG.later(function () {
        if (S !== self.S) return;
        S.dealer.push(self.draw());
        self.dealerPlay();
      }, CG.wait(900));
      return;
    }
    var dt = bjTotal(S.dealer).t, net = 0;
    S.hands.forEach(function (h) {
      if (h.res === 'Bust') { net -= h.bet; return; }
      var t = bjTotal(h.cards).t;
      if (dt > 21 || t > dt) { h.res = 'Win'; S.chips += h.bet * 2; net += h.bet; }
      else if (t === dt) { h.res = 'Push'; S.chips += h.bet; }
      else { h.res = 'Lose'; net -= h.bet; }
    });
    S.msg = (dt > 21 ? 'The dealer went bust. ' : 'The dealer has ' + dt + '. ') +
      (net > 0 ? 'You won ' + net + ' chips.' : net < 0 ? 'You lost ' + (-net) + ' chips.' : 'You broke even.');
    S.phase = 'bet';
    if (S.bet > S.chips) S.bet = Math.max(10, Math.floor(S.chips / 10) * 10);
    CG.later(function () { if (S === self.S) self.render(); }, CG.wait(500));
    this.render();
  };
  BJ.act = function (a, d) {
    var S = this.S;
    if (S.phase === 'dealer') return;
    if (S.phase === 'bet') {
      if (a === 'chip') { S.bet = Math.min(S.chips, S.bet + +d.v); return this.render(); }
      if (a === 'clearbet') { S.bet = 0; return this.render(); }
      if (a === 'deal') return this.deal();
      if (a === 'refill') { S.chips = 1000; S.bet = 50; S.msg = 'You have 1000 chips again.'; return this.render(); }
      return;
    }
    var hd = this.hand();
    if (!hd) return;
    if (a === 'hit') return this.hit();
    if (a === 'stand') { hd.done = true; return this.nextHand(); }
    if (a === 'double') {
      if (hd.cards.length !== 2 || S.chips < hd.bet) return;
      S.chips -= hd.bet;
      hd.bet *= 2;
      hd.cards.push(this.draw());
      hd.done = true;
      if (bjTotal(hd.cards).t > 21) hd.res = 'Bust';
      return this.nextHand();
    }
    if (a === 'split') {
      if (!this.canSplit()) return;
      S.chips -= hd.bet;
      var c2 = hd.cards.pop(), aces = hd.cards[0].r === 1;
      var nh = { cards: [c2], bet: hd.bet, done: false, res: '', splitAces: aces };
      hd.splitAces = aces;
      S.hands.splice(S.cur + 1, 0, nh);
      hd.cards.push(this.draw());
      if (aces || bjTotal(hd.cards).t === 21) { hd.done = true; return this.nextHand(); }
      return this.render();
    }
  };
  BJ.canSplit = function () {
    var S = this.S, hd = this.hand();
    return hd && hd.cards.length === 2 && bjVal(hd.cards[0]) === bjVal(hd.cards[1]) && S.hands.length < 4 && S.chips >= hd.bet && !hd.splitAces;
  };
  BJ.render = function () {
    var S = this.S, W = CG.W(), H = CG.H(), h = '';
    var nh = Math.max(1, S.hands.length), maxCards = 2;
    S.hands.forEach(function (x) { maxCards = Math.max(maxCards, x.cards.length); });
    var dealerCards = Math.max(2, S.dealer.length);
    var btnH = 86, lblH = 40;
    var cwH = (H - btnH - 2 * lblH - 30) / 2.8;
    var cwW1 = W / (1 + 0.42 * (dealerCards - 1)) * 0.9;
    var cwW2 = (W - 20 * (nh - 1)) / nh / (1 + 0.42 * (maxCards - 1));
    var cw = Math.floor(Math.max(48, Math.min(150, cwH, cwW1, cwW2))), ch = cw * 1.4, st = cw * 0.42;
    var dy = lblH, py = lblH * 2 + ch + 20;
    var dTot = S.dealer.length ? bjTotal(S.dealer.filter(function (c) { return c.up !== false; })) : null;
    if (S.dealer.length) {
      var dw = cw + st * (S.dealer.length - 1), dx = (W - dw) / 2;
      h += '<div class="note" style="left:0;right:0;top:0;font-size:26px">Dealer' + (dTot ? ': ' + dTot.t : '') + '</div>';
      S.dealer.forEach(function (c, i) { h += CG.card(c, dx + i * st, dy, { w: cw, z: i + 1 }); });
    } else {
      h += '<div class="note" style="left:0;right:0;top:' + Math.round(dy + ch / 2 - 20) + 'px;font-size:28px;color:var(--ink-dim)">Place your bet, then tap Deal.</div>';
    }
    var slotW = W / nh;
    S.hands.forEach(function (hd, k) {
      var t = bjTotal(hd.cards), w = cw + st * (hd.cards.length - 1), x = k * slotW + (slotW - w) / 2;
      var active = S.phase === 'play' && k === S.cur;
      var label = (nh > 1 ? 'Hand ' + (k + 1) + ': ' : 'You: ') + t.t + (t.soft && t.t < 21 ? ' (soft)' : '') + ' &middot; Bet ' + hd.bet;
      var res = hd.res ? ' <span style="color:var(--gold)">' + hd.res + '</span>' : '';
      h += '<div class="note" style="left:' + Math.round(k * slotW) + 'px;width:' + Math.round(slotW) + 'px;top:' + (py - lblH) + 'px;font-size:' + (nh > 2 ? 20 : 25) + 'px' +
        (active ? ';color:var(--gold)' : '') + '">' + label + res + '</div>';
      hd.cards.forEach(function (c, i) { h += CG.card(c, x + i * st, py, { w: cw, z: i + 1, cls: active && i === hd.cards.length - 1 ? 'sel' : '' }); });
    });
    var by = H - btnH + 10, bh = '';
    if (S.phase === 'play') {
      var hd = this.hand();
      bh += '<button class="bigbtn primary" data-act="hit">Hit</button><button class="bigbtn primary" data-act="stand">Stand</button>';
      if (hd && hd.cards.length === 2 && S.chips >= hd.bet) bh += '<button class="bigbtn" data-act="double">Double</button>';
      if (this.canSplit()) bh += '<button class="bigbtn" data-act="split">Split</button>';
    } else if (S.phase === 'bet') {
      if (S.chips < 10) bh += '<button class="bigbtn primary" data-act="refill">Get 1000 new chips</button>';
      else bh += '<button class="bigbtn" data-act="chip" data-v="10">+10</button><button class="bigbtn" data-act="chip" data-v="50">+50</button>' +
        '<button class="bigbtn" data-act="chip" data-v="100">+100</button><button class="bigbtn" data-act="clearbet">Clear</button>' +
        '<button class="bigbtn primary" data-act="deal"' + (S.bet >= 10 ? '' : ' disabled') + '>Deal</button>';
    }
    h += '<div class="panel" style="left:0;right:0;top:' + by + 'px">' + bh + '</div>';
    CG.paint(h);
    var left = '<span style="color:var(--gold)">Chips: ' + S.chips + '</span> &middot; ' + (S.phase === 'bet' ? 'Bet: ' + S.bet : 'In play') + (S.msg ? ' &middot; ' + S.msg : '');
    CG.status(left, '');
    CG.save(this);
  };
  CG.register(BJ);
})();
