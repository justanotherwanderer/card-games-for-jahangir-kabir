/* Canasta for two: you against the computer. */
(function () {
  'use strict';
  var CG = window.CG;

  function isWild(c) { return c.s === 'j' || c.r === 2; }
  function isRed3(c) { return c.r === 3 && (c.s === 'h' || c.s === 'd'); }
  function isBlack3(c) { return c.r === 3 && (c.s === 's' || c.s === 'c'); }
  function val(c) {
    if (c.s === 'j') return 50;
    if (c.r === 2 || c.r === 1) return 20;
    if (c.r >= 8) return 10;
    if (c.r === 3) return isRed3(c) ? 100 : 5;
    return 5;
  }
  function sum(cards) { var s = 0; cards.forEach(function (c) { s += val(c); }); return s; }
  function minMeld(score) { return score < 0 ? 15 : score < 1500 ? 50 : score < 3000 ? 90 : 120; }
  function rankOrder(c) { if (c.s === 'j') return 100; if (c.r === 2) return 99; if (c.r === 1) return 14; return c.r; }
  function sortHand(h) {
    h.sort(function (a, b) { return rankOrder(a) - rankOrder(b) || (a.s < b.s ? -1 : a.s > b.s ? 1 : 0); });
  }
  function meldOrder(r) { return r === 1 ? 14 : r; }
  function wildCount(m) { return m.cards.filter(isWild).length; }
  function rankName(r, plural) {
    var n = r === 1 ? 'Ace' : r === 11 ? 'Jack' : r === 12 ? 'Queen' : r === 13 ? 'King' : String(r);
    return plural ? n + 's' : n;
  }

  var CA = {
    id: 'canasta', name: 'Canasta', group: 'vs',
    blurb: 'Meld cards of the same rank and build canastas of seven.',
    emblem: [{ r: 0, s: 'j' }, { r: 13, s: 'h' }, { r: 13, s: 'c' }],
    tools: [],
    rules:
      '<p>Two-player Canasta against the computer, with two decks and four Jokers. The first to the goal score (5000, or 2500 for a short game) wins.</p>' +
      '<h4>Your turn</h4><ul><li><b>Draw:</b> tap the deck to take 2 cards, <i>or</i> take the whole discard pile (see below).</li>' +
      '<li><b>Meld:</b> pick 3 or more cards of the same rank and tap <b>Meld</b>. To add cards to a meld you already have, pick them and tap that meld.</li>' +
      '<li><b>Discard:</b> pick 1 card and tap <b>Discard</b> to end your turn.</li></ul>' +
      '<h4>Melds</h4><ul><li>A meld needs at least 2 natural cards and can have up to 3 wild cards. Jokers and 2s are wild.</li>' +
      '<li>A meld of 7 cards is a <b>canasta</b>: 500 points if it has no wild cards (natural, shown red), 300 if it has some (mixed, shown black).</li>' +
      '<li>Your first meld of each hand must be worth enough points: 50 at the start, more as your score grows. The game shows how many.</li></ul>' +
      '<h4>Card points</h4><ul><li>Joker 50. Ace and 2: 20. King to 8: 10. 7 to 4 and black 3: 5.</li>' +
      '<li>Red 3s are put aside on their own and are worth 100 each (800 for all four).</li></ul>' +
      '<h4>Taking the discard pile</h4><ul><li>Pick cards from your hand that make a meld with the top card, then tap the pile. You get the whole pile.</li>' +
      '<li>Before your first meld, or when the pile is <b>frozen</b> (a wild card was thrown on it), you need two natural cards that match the top card.</li>' +
      '<li>A black 3 or a wild card on top blocks the pile for that turn.</li></ul>' +
      '<h4>Going out</h4><ul><li>You need <b>2 canastas</b> to go out. Then meld all your cards (or meld all but one and discard it). Going out is worth 100.</li>' +
      '<li>When a hand ends, cards left in your hand count against you.</li></ul>'
  };

  CA.newGame = function (first) {
    var self = this, pref = CG.store.get('canasta_target', 5000);
    if (first) return this.startGame(pref);
    var b = [
      { label: 'Play to 5000 (standard)', primary: pref === 5000, fn: function () { self.startGame(5000); } },
      { label: 'Play to 2500 (shorter)', primary: pref === 2500, fn: function () { self.startGame(2500); } }
    ];
    if (this.S && !this.S.over) b.push({ label: 'Keep playing' });
    CG.dialog({ title: 'New game of Canasta', body: '<p>How long a game would you like?</p>', buttons: b });
  };
  CA.startGame = function (target) {
    CG.store.set('canasta_target', target);
    CG.clearTimers();
    this.S = { scores: [0, 0], target: target, handNo: 0, over: false };
    this.startHand();
  };
  CA.drawOne = function (p) {
    var S = this.S;
    while (S.stock.length) {
      var c = S.stock.pop();
      if (isRed3(c)) { S.red3[p].push(c); continue; }
      S.hands[p].push(c);
      return c;
    }
    return null;
  };
  CA.startHand = function () {
    var S = this.S, p, i;
    S.stock = CG.shuffle(CG.deck(2, 4));
    S.pile = []; S.hands = [[], []]; S.melds = [[], []]; S.red3 = [[], []];
    S.frozen = false; S.newIds = []; S.summary = null; S.msg = '';
    for (i = 0; i < 15; i++) for (p = 0; p < 2; p++) S.hands[p].push(S.stock.pop());
    for (p = 0; p < 2; p++) {
      var H = S.hands[p];
      for (i = H.length - 1; i >= 0; i--) if (isRed3(H[i])) { S.red3[p].push(H.splice(i, 1)[0]); }
      while (H.length < 15) this.drawOne(p);
      sortHand(H);
    }
    var up = S.stock.pop();
    S.pile.push(up);
    while (isWild(up) || isRed3(up)) {
      if (isWild(up)) S.frozen = true;
      up = S.stock.pop();
      S.pile.push(up);
    }
    S.turn = S.handNo % 2;
    S.handNo++;
    this.sel = [];
    S.msg = S.turn === 0 ? 'New hand. You go first.' : 'New hand. The computer goes first.';
    this.beginTurn();
  };
  CA.beginTurn = function () {
    var S = this.S, self = this;
    S.phase = 'draw';
    S.aiStep = 1;
    S.startMelds = S.melds[S.turn].length;
    if (!S.stock.length) { S.msg = 'The deck has run out.'; return this.endHand(-1); }
    this.render();
    if (S.turn === 1 || CG.autoplay) CG.later(function () { if (S === self.S) self.aiRun(); }, CG.wait(1200));
  };
  CA.nextTurn = function () {
    this.S.turn = 1 - this.S.turn;
    this.sel = [];
    this.beginTurn();
  };
  CA.findMeld = function (p, r) {
    var M = this.S.melds[p];
    for (var i = 0; i < M.length; i++) if (M[i].r === r) return M[i];
    return null;
  };
  CA.canastas = function (p) {
    return this.S.melds[p].filter(function (m) { return m.cards.length >= 7; }).length;
  };

  /* Work out how a set of cards would be melded. Returns {err} or a plan. */
  CA.plan = function (p, cards, top, targetRank) {
    var S = this.S, self = this, all = cards.slice(), nat = {}, wilds = [], ranks = [];
    if (top) all.push(top);
    if (!all.length) return { err: 'Pick the cards you want to meld first.' };
    all.forEach(function (c) {
      if (isWild(c)) wilds.push(c);
      else {
        if (!nat[c.r]) { nat[c.r] = []; ranks.push(c.r); }
        nat[c.r].push(c);
      }
    });
    if (targetRank != null) {
      for (var i = 0; i < ranks.length; i++)
        if (ranks[i] !== targetRank) return { err: 'Only ' + rankName(targetRank, true) + ' and wild cards can go on that meld.' };
      if (!ranks.length) { ranks = [targetRank]; nat[targetRank] = []; }
    }
    if (!ranks.length) return { err: 'Pick some natural cards too, or tap one of your melds to add wild cards to it.' };
    var groups = ranks.map(function (r) {
      var ex = self.findMeld(p, r);
      return { r: r, add: nat[r].slice(), ex: ex, n: nat[r].length + (ex ? ex.cards.length - wildCount(ex) : 0), w: ex ? wildCount(ex) : 0 };
    });
    var pool = wilds.slice().sort(function (a, b) { return val(b) - val(a); });
    groups.forEach(function (g) {
      while (g.n + g.w < 3 && g.n >= 2 && g.r !== 3 && pool.length) { g.add.push(pool.pop()); g.w++; }
    });
    groups.sort(function (a, b) { return b.n + b.w - (a.n + a.w); });
    while (pool.length) {
      var placed = false;
      for (var k = 0; k < groups.length; k++)
        if (groups[k].w < 3 && groups[k].r !== 3 && groups[k].n >= 2) { groups[k].add.push(pool.pop()); groups[k].w++; placed = true; break; }
      if (!placed) return { err: 'A meld can hold at most 3 wild cards.' };
    }
    for (k = 0; k < groups.length; k++) {
      var g = groups[k];
      if (g.n < 2) return { err: 'A new meld needs at least 2 natural cards of the same rank, like two ' + rankName(g.r, true) + '.' };
      if (g.n + g.w < 3) return { err: 'A meld needs at least 3 cards. Add one more ' + rankName(g.r) + ' or a wild card.' };
      if (g.r === 3 && g.w) return { err: 'Black 3s can’t be melded with wild cards.' };
    }
    var pts = sum(all), melded = S.melds[p].length > 0;
    if (!melded) {
      var need = minMeld(S.scores[p]);
      if (pts < need) return { err: 'Your first meld must be worth at least ' + need + ' points. These cards are worth ' + pts + '.', short: true };
    }
    var touched = groups.filter(function (x) { return x.ex; }).map(function (x) { return x.ex; });
    var canastas = S.melds[p].filter(function (m) { return m.cards.length >= 7 && touched.indexOf(m) < 0; }).length +
      groups.filter(function (x) { return (x.ex ? x.ex.cards.length : 0) + x.add.length >= 7; }).length;
    var remaining = S.hands[p].length - cards.length + (top ? S.pile.length - 1 : 0);
    var canOut = canastas >= 2;
    if (remaining <= 1 && !canOut)
      return { err: 'You need 2 canastas before you can go out, so keep at least 2 cards in your hand.', keep: true };
    for (k = 0; k < groups.length; k++)
      if (groups[k].r === 3 && !(canOut && remaining <= 1)) return { err: 'Black 3s can only be melded when you go out.' };
    return { groups: groups, pts: pts, remaining: remaining, canOut: canOut };
  };
  CA.applyPlan = function (p, plan, fromHand) {
    var S = this.S, H = S.hands[p];
    fromHand.forEach(function (c) { var i = CG.byId(H, c.id); if (i >= 0) H.splice(i, 1); });
    plan.groups.forEach(function (g) {
      if (g.ex) g.add.forEach(function (c) { g.ex.cards.push(c); });
      else S.melds[p].push({ r: g.r, cards: g.add.slice() });
    });
    S.melds[p].sort(function (a, b) { return meldOrder(a.r) - meldOrder(b.r); });
  };
  CA.checkTake = function (p, sel) {
    var S = this.S, top = S.pile[S.pile.length - 1];
    if (!top) return { err: 'The discard pile is empty.' };
    if (isBlack3(top)) return { err: 'A black 3 is on top, so the pile can’t be taken this turn.' };
    if (isWild(top)) return { err: 'A wild card is on top, so the pile can’t be taken this turn.' };
    var frozen = S.frozen || !S.melds[p].length;
    var match = sel.filter(function (c) { return !isWild(c) && c.r === top.r; }).length;
    if (frozen && match < 2) {
      return { err: (S.frozen ? 'The pile is frozen. ' : 'Before your first meld, ') + 'you need two natural ' + rankName(top.r, true) +
        ' from your hand to take it. Pick them first, then tap the pile.' };
    }
    if (!frozen && match < 1 && !this.findMeld(p, top.r))
      return { err: 'To take the pile, pick cards from your hand that go with the top card (' + rankName(top.r) + '), then tap the pile.' };
    return this.plan(p, sel, top);
  };
  CA.doTake = function (p, sel, plan) {
    var S = this.S, top = S.pile.pop(), self = this;
    void top;
    this.applyPlan(p, plan, sel);
    var rest = S.pile;
    S.pile = [];
    S.newIds = [];
    rest.forEach(function (c) {
      if (isRed3(c)) S.red3[p].push(c);
      else { S.hands[p].push(c); if (p === 0) S.newIds.push(c.id); }
    });
    S.frozen = false;
    sortHand(S.hands[p]);
    S.phase = 'meld';
    if (!S.hands[p].length) { self.endHand(p); return true; }
    return false;
  };
  CA.drawStock = function (p) {
    var S = this.S, got = [];
    var r3 = S.red3[p].length;
    for (var k = 0; k < 2; k++) { var c = this.drawOne(p); if (c) got.push(c); }
    S.newIds = p === 0 ? got.map(function (c) { return c.id; }) : [];
    sortHand(S.hands[p]);
    S.phase = 'meld';
    return { got: got, red3: S.red3[p].length - r3 };
  };
  CA.discard = function (p, c) {
    var S = this.S, H = S.hands[p], i = CG.byId(H, c.id);
    if (i < 0) return;
    if (H.length === 1 && this.canastas(p) < 2) {
      CG.toast('You need 2 canastas before you can discard your last card.');
      return;
    }
    H.splice(i, 1);
    S.pile.push(c);
    if (isWild(c)) S.frozen = true;
    S.newIds = [];
    S.lastDiscard = { p: p, id: c.id };
    S.msg = (p === 0 ? 'You discarded ' : 'The computer discarded ') + CG.cardText(c) + '.' + (isWild(c) ? ' The pile is now frozen.' : '');
    if (!H.length) return this.endHand(p);
    this.nextTurn();
  };
  CA.endHand = function (outP) {
    var S = this.S, rows = [], self = this;
    for (var p = 0; p < 2; p++) {
      var canN = 0, canM = 0, meldPts = 0;
      S.melds[p].forEach(function (m) {
        if (m.cards.length >= 7) { if (wildCount(m)) canM++; else canN++; }
        meldPts += sum(m.cards);
      });
      var r3 = S.red3[p].length, r3pts = r3 === 4 ? 800 : r3 * 100;
      if (!S.melds[p].length) r3pts = -r3pts;
      var out = outP === p ? (S.startMelds === 0 && p === S.turn ? 200 : 100) : 0;
      var handPts = sum(S.hands[p]);
      var total = canN * 500 + canM * 300 + r3pts + out + meldPts - handPts;
      S.scores[p] += total;
      rows.push({ can: canN * 500 + canM * 300, canTxt: canN + ' natural, ' + canM + ' mixed', r3: r3pts, out: out, meld: meldPts, hand: handPts, total: total });
    }
    function line(label, k, neg) {
      return '<tr><td>' + label + '</td><td>' + (neg ? '&minus;' : '') + rows[0][k] + '</td><td>' + (neg ? '&minus;' : '') + rows[1][k] + '</td></tr>';
    }
    var body = '<table class="sc"><tr><th></th><th>You</th><th>Computer</th></tr>' +
      line('Canastas', 'can') + line('Red 3s', 'r3') + line('Going out', 'out') + line('Melded cards', 'meld') + line('Left in hand', 'hand', true) +
      '<tr class="tot"><td>This hand</td><td>' + rows[0].total + '</td><td>' + rows[1].total + '</td></tr>' +
      '<tr class="tot"><td>Game total</td><td>' + S.scores[0] + '</td><td>' + S.scores[1] + '</td></tr></table>' +
      '<p>Goal: ' + S.target + ' points.</p>';
    var title = outP === 0 ? 'You went out!' : outP === 1 ? 'The computer went out' : 'The deck ran out';
    var over = false;
    if (S.scores[0] >= S.target || S.scores[1] >= S.target) {
      if (S.scores[0] !== S.scores[1]) {
        over = true;
        if (S.scores[0] > S.scores[1]) { title = 'You won the game!'; CG.addWin(self.id); } else title = 'The computer wins the game';
      }
    }
    S.phase = 'handEnd';
    S.summary = { title: title, body: body, gameOver: over };
    if (over) S.over = true;
    this.sel = [];
    this.render();
    CG.later(function () { self.showHandEnd(); }, CG.wait(900));
  };
  CA.showHandEnd = function () {
    var S = this.S, self = this, sm = S.summary;
    CG.dialog({
      title: sm.title, body: sm.body,
      buttons: sm.gameOver ? [
        { label: 'Play a new game', primary: true, fn: function () { self.startGame(S.target); } },
        { label: 'Back to menu', fn: CG.showMenu }
      ] : [{ label: 'Deal the next hand', primary: true, fn: function () { self.startHand(); } }]
    });
  };
  CA.resume = function () {
    var S = this.S, self = this;
    this.sel = [];
    if (S.phase === 'handEnd') { this.render(); return this.showHandEnd(); }
    this.render();
    if (S.turn === 1 || CG.autoplay) CG.later(function () { if (S === self.S) self.aiRun(); }, CG.wait(900));
  };

  /* ---------- Computer player ---------- */
  CA.aiRun = function () {
    var S = this.S, self = this, p = S.turn;
    if (S.phase === 'handEnd' || S.over) return;
    if (S.aiStep === 1) {
      var sel = this.aiTakeSel(p);
      if (sel) {
        var n = S.pile.length;
        var plan = this.plan(p, sel, S.pile[S.pile.length - 1]);
        if (this.doTake(p, sel, plan)) return;
        S.msg = (p === 1 ? 'The computer took the discard pile' : 'You took the pile') + ' (' + n + ' cards).';
      } else {
        var r = this.drawStock(p);
        S.msg = (p === 1 ? 'The computer drew ' : 'You drew ') + r.got.length + ' cards' + (r.red3 ? ' and put down a red 3' : '') + '.';
      }
      S.aiStep = 2;
    } else if (S.aiStep === 2) {
      var before = S.melds[p].reduce(function (s, m) { return s + m.cards.length; }, 0);
      this.aiMeld(p);
      if (S.phase === 'handEnd') return;
      var after = S.melds[p].reduce(function (s, m) { return s + m.cards.length; }, 0);
      if (after > before) S.msg = (p === 1 ? 'The computer melded ' : 'You melded ') + (after - before) + ' cards.';
      if (!S.hands[p].length) return this.endHand(p);
      S.aiStep = 3;
    } else {
      return this.discard(p, this.aiPickDiscard(p));
    }
    this.render();
    CG.later(function () { if (S === self.S) self.aiRun(); }, CG.wait(1300));
  };
  CA.aiBuildInitial = function (p, base, top) {
    var S = this.S, hand = S.hands[p], used = {}, self = this;
    base.forEach(function (c) { used[c.id] = 1; });
    var by = {}, ranks = [];
    hand.forEach(function (c) {
      if (used[c.id] || isWild(c) || c.r === 3) return;
      if (top && c.r === top.r) return;
      if (!by[c.r]) { by[c.r] = []; ranks.push(c.r); }
      by[c.r].push(c);
    });
    var sel = base.slice();
    function tryIt() { var pl = self.plan(p, sel, top); return pl.err ? null : sel; }
    ranks.forEach(function (r) { if (by[r].length >= 3) sel = sel.concat(by[r]); });
    if (sel.length && tryIt()) return sel;
    var wilds = hand.filter(function (c) { return isWild(c) && !used[c.id]; }).sort(function (a, b) { return val(a) - val(b); });
    var pairs = ranks.filter(function (r) { return by[r].length === 2; }).sort(function (a, b) { return val(by[b][0]) - val(by[a][0]); });
    for (var i = 0; i < pairs.length && wilds.length; i++) {
      sel = sel.concat(by[pairs[i]]);
      sel.push(wilds.shift());
      if (tryIt()) return sel;
    }
    while (wilds.length && sel.length) {
      sel.push(wilds.shift());
      if (tryIt()) return sel;
    }
    return null;
  };
  CA.aiTakeSel = function (p) {
    var S = this.S, top = S.pile[S.pile.length - 1], hand = S.hands[p];
    if (!top || isBlack3(top) || isWild(top)) return null;
    var frozen = S.frozen || !S.melds[p].length;
    var nat = hand.filter(function (c) { return !isWild(c) && c.r === top.r; });
    var wild = hand.filter(isWild).sort(function (a, b) { return val(a) - val(b); });
    var tries = [];
    if (frozen) { if (nat.length >= 2) tries.push(nat.slice()); }
    else {
      if (this.findMeld(p, top.r) || nat.length >= 2) tries.push(nat.slice());
      if (nat.length === 1 && wild.length && S.pile.length >= 3) tries.push([nat[0], wild[0]]);
    }
    for (var i = 0; i < tries.length; i++) {
      var pl = this.plan(p, tries[i], top);
      if (!pl.err) return tries[i];
      if (!S.melds[p].length && pl.short) {
        var ext = this.aiBuildInitial(p, tries[i], top);
        if (ext) return ext;
      }
    }
    return null;
  };
  CA.aiMeld = function (p) {
    var S = this.S, guard = 0, self = this;
    if (!S.melds[p].length) {
      var first = this.aiBuildInitial(p, [], null);
      if (!first) return;
      this.applyPlan(p, this.plan(p, first, null), first);
    }
    while (guard++ < 14) {
      var hand = S.hands[p], by = {}, ranks = [], done = false, k, pl;
      hand.forEach(function (c) {
        if (isWild(c) || c.r === 3) return;
        if (!by[c.r]) { by[c.r] = []; ranks.push(c.r); }
        by[c.r].push(c);
      });
      var cands = [];
      ranks.forEach(function (r) { if (self.findMeld(p, r)) cands.push(by[r]); });
      ranks.forEach(function (r) { if (!self.findMeld(p, r) && by[r].length >= 3) cands.push(by[r]); });
      for (k = 0; k < cands.length && !done; k++) {
        pl = this.plan(p, cands[k], null);
        if (!pl.err) { this.applyPlan(p, pl, cands[k]); done = true; }
      }
      if (done) continue;
      var wilds = hand.filter(isWild).sort(function (a, b) { return val(a) - val(b); });
      if (wilds.length) {
        var ms = S.melds[p].filter(function (m) { return m.cards.length < 7 && m.r !== 3; })
          .sort(function (a, b) { return b.cards.length - a.cards.length; });
        for (k = 0; k < ms.length && !done; k++) {
          var need = 7 - ms[k].cards.length, wc = wildCount(ms[k]);
          if (need <= wilds.length && wc + need <= 3) {
            var ws = wilds.slice(0, need);
            pl = this.plan(p, ws, null, ms[k].r);
            if (!pl.err) { this.applyPlan(p, pl, ws); done = true; }
          }
        }
      }
      if (!done) break;
    }
    if (this.canastas(p) >= 2) this.aiGoOut(p);
  };
  CA.aiGoOut = function (p) {
    var S = this.S, hand = S.hands[p], pl;
    if (!hand.length) return;
    pl = this.plan(p, hand.slice(), null);
    if (!pl.err) { this.applyPlan(p, pl, hand.slice()); return; }
    for (var i = 0; i < hand.length; i++) {
      var rest = hand.filter(function (c, j) { return j !== i; });
      if (!rest.length) return;
      pl = this.plan(p, rest, null);
      if (!pl.err) { this.applyPlan(p, pl, rest); return; }
    }
  };
  CA.aiPickDiscard = function (p) {
    var S = this.S, hand = S.hands[p], opp = 1 - p, self = this, cnt = {};
    hand.forEach(function (c) { if (!isWild(c)) cnt[c.r] = (cnt[c.r] || 0) + 1; });
    var best = null, bs = 1e9;
    hand.forEach(function (c) {
      var sc;
      if (isWild(c)) sc = 1000 + val(c);
      else if (isBlack3(c)) sc = -50;
      else {
        sc = cnt[c.r] === 1 ? 0 : cnt[c.r] === 2 ? 40 : 80;
        if (self.findMeld(opp, c.r)) sc += S.frozen ? 15 : 70;
        if (self.findMeld(p, c.r)) sc += 50;
        sc += val(c) * 0.4;
      }
      if (sc < bs) { bs = sc; best = c; }
    });
    return best;
  };

  /* ---------- Your moves ---------- */
  CA.selCards = function () {
    var H = this.S.hands[0];
    return this.sel.map(function (id) { return H[CG.byId(H, id)]; }).filter(function (c) { return !!c; });
  };
  CA.bgTap = function () {
    if (this.sel.length) { this.sel = []; this.render(); }
  };
  CA.act = function (a, d) {
    var S = this.S, plan, sc;
    if (a === 'scores') return this.showScores();
    if (S.over || S.phase === 'handEnd') return;
    if (S.turn !== 0 || CG.autoplay) { CG.toast('Please wait. The computer is playing.'); return; }
    if (a === 'hand') {
      var id = +d.id, i = this.sel.indexOf(id);
      if (i >= 0) this.sel.splice(i, 1); else this.sel.push(id);
      return this.render();
    }
    if (a === 'clear') { this.sel = []; return this.render(); }
    if (a === 'stock') {
      if (S.phase !== 'draw') { CG.toast('You already drew this turn. Now meld, or pick 1 card and tap Discard.'); return; }
      var r = this.drawStock(0);
      this.sel = [];
      S.msg = 'You drew ' + r.got.map(CG.cardText).join(' and ') + '.' + (r.red3 ? ' A red 3 went to your red 3 pile.' : '');
      return this.render();
    }
    if (a === 'pile') {
      if (S.phase === 'draw') {
        sc = this.selCards();
        plan = this.checkTake(0, sc);
        if (plan.err) { CG.toast(plan.err, 4500); return; }
        var n = S.pile.length;
        this.sel = [];
        if (this.doTake(0, sc, plan)) return;
        S.msg = 'You took the pile: ' + n + ' cards. They are marked NEW.';
        return this.render();
      }
      a = 'discard';
    }
    if (S.phase === 'draw' && (a === 'meld' || a === 'tile' || a === 'discard')) {
      CG.toast('First tap the deck to draw 2 cards, or take the discard pile.');
      return;
    }
    if (a === 'discard') {
      if (this.sel.length !== 1) { CG.toast('Pick exactly 1 card to discard.'); return; }
      var c = this.selCards()[0];
      this.sel = [];
      return this.discard(0, c);
    }
    if (a === 'meld' || a === 'tile') {
      sc = this.selCards();
      if (!sc.length) { CG.toast(a === 'tile' ? 'Pick cards from your hand first, then tap the meld to add them.' : 'Pick the cards you want to meld.'); return; }
      plan = this.plan(0, sc, null, a === 'tile' ? +d.r : null);
      if (plan.err) { CG.toast(plan.err, 4500); return; }
      this.applyPlan(0, plan, sc);
      this.sel = [];
      S.msg = 'You melded ' + sc.length + ' card' + (sc.length > 1 ? 's' : '') + '.';
      if (!S.hands[0].length) return this.endHand(0);
      return this.render();
    }
  };
  CA.showScores = function () {
    var S = this.S;
    CG.dialog({
      title: 'Scores',
      body: '<table class="sc"><tr><th></th><th>Score</th><th>First meld needs</th></tr>' +
        '<tr><td>You</td><td>' + S.scores[0] + '</td><td>' + minMeld(S.scores[0]) + '</td></tr>' +
        '<tr><td>Computer</td><td>' + S.scores[1] + '</td><td>' + minMeld(S.scores[1]) + '</td></tr></table><p>First to ' + S.target + ' wins.</p>',
      buttons: [{ label: 'Back to the game', primary: true }]
    });
  };

  /* ---------- Drawing the table ---------- */
  function tile(m, x, y, tw, th, own) {
    var w = wildCount(m), sz = m.cards.length, can = sz >= 7, nat = can && !w;
    var cls = 'tilem' + (can ? (nat ? ' nat' : ' mix') : '');
    var sub = can ? (nat ? 'Natural' : 'Mixed') : w ? w + ' wild' : 'no wild';
    return '<div class="' + cls + '"' + (own ? ' data-act="tile" data-r="' + m.r + '"' : '') +
      ' style="left:' + Math.round(x) + 'px;top:' + Math.round(y) + 'px;width:' + tw + 'px;height:' + th + 'px">' +
      '<span class="tr" style="font-size:' + Math.round(tw * 0.44) + 'px;margin-top:' + Math.round(th * 0.05) + 'px">' + CG.RANKS[m.r] + '</span>' +
      '<span class="tc" style="font-size:' + Math.round(tw * 0.27) + 'px">&times;' + sz + '</span>' +
      '<span class="tw" style="font-size:' + Math.max(15, Math.round(tw * 0.19)) + 'px">' + sub + '</span></div>';
  }
  CA.render = function () {
    var S = this.S, W = CG.W(), H = CG.H(), h = '', self = this, gap = 8;
    var hand = S.hands[0], n = Math.max(1, hand.length), cw = 100, rows = 1, perRow = 1;
    for (rows = 1; rows <= 5; rows++) {
      cw = Math.min(138, (H - 4 * gap) / (4.93 + 0.77 * (rows - 1)));
      perRow = Math.max(1, Math.floor((W - cw) / (0.6 * cw)) + 1);
      if (Math.ceil(n / perRow) <= rows) break;
    }
    rows = Math.max(1, Math.ceil(n / perRow));
    cw = Math.floor(cw);
    var ch = cw * 1.4, tw = Math.round(cw * 0.78), th = Math.round(tw * 1.25), pw = Math.round(cw * 0.95), ph = Math.round(pw * 1.4);
    var used = th + gap + ph + gap + th + gap + Math.round(ch * 0.18) + (rows - 1) * ch * 0.55 + ch;
    var extra = Math.max(0, H - used);
    var yA = 0, yB = Math.round(th + gap + extra * 0.3), yC = Math.round(yB + ph + gap + extra * 0.3);
    var yD = Math.round(H - ch - (rows - 1) * ch * 0.55);
    var lblW = Math.round(Math.min(200, W * 0.21));
    var myTurn = S.turn === 0 && S.phase !== 'handEnd';

    function meldRow(p, y) {
      var M = S.melds[p], x0 = lblW + gap, cnt = M.length;
      var stepX = cnt > 1 ? Math.min(tw + gap, (W - x0 - tw) / (cnt - 1)) : 0;
      if (!cnt) return '<div class="note" style="text-align:left;right:0;left:' + x0 + 'px;top:' + Math.round(y + th / 2 - 16) + 'px;font-size:22px;color:var(--ink-dim)">' +
        (p === 0 ? 'No melds yet. Your first meld needs ' + minMeld(S.scores[0]) + ' points.' : 'No melds yet.') + '</div>';
      var out = '';
      M.forEach(function (m, i) { out += tile(m, x0 + i * stepX, y, tw, th, p === 0); });
      return out;
    }
    function label(p, y) {
      var turn = S.turn === p && S.phase !== 'handEnd';
      return '<div class="lbl' + (turn ? ' turn' : '') + '" style="left:0;top:' + y + 'px;width:' + lblW + 'px;height:' + th + 'px;padding:6px 8px;font-size:20px">' +
        '<b>' + (p === 0 ? 'You' : 'Computer') + '</b>Score ' + S.scores[p] + '<br>' + (p === 1 ? S.hands[1].length + ' cards' : '') +
        (S.red3[p].length ? (p === 1 ? ' &middot; ' : '') + '<span style="color:#ff8b9b">Red 3s: ' + S.red3[p].length + '</span>' : '') + '</div>';
    }
    h += label(1, yA) + meldRow(1, yA);
    h += label(0, yC) + meldRow(0, yC);

    var top = S.pile[S.pile.length - 1];
    h += S.stock.length ? CG.card(null, 0, yB, { w: pw, act: 'stock', label: S.stock.length, hint: myTurn && S.phase === 'draw' })
      : CG.slot(0, yB, 'Empty', { w: pw });
    if (top) h += CG.card(top, pw + gap, yB, { w: pw, act: 'pile', hint: myTurn && S.phase === 'draw' && this.sel.length > 0 });
    else h += CG.slot(pw + gap, yB, 'Empty', { w: pw, act: 'pile' });
    var ix = 2 * pw + 2 * gap + 10;
    var info = 'Discard pile: ' + S.pile.length + ' card' + (S.pile.length === 1 ? '' : 's');
    if (S.frozen) info += ' &middot; <span style="color:var(--gold)">FROZEN</span>';
    else if (top && isBlack3(top)) info += ' &middot; <span style="color:var(--gold)">Blocked</span>';
    h += '<div class="note" style="left:' + ix + 'px;top:' + (yB + 4) + 'px;text-align:left;font-size:22px">' + info + '</div>';
    var btns = '';
    if (myTurn && S.phase === 'draw') {
      btns = '<button class="bigbtn primary" data-act="stock">Draw 2</button><button class="bigbtn" data-act="pile">Take pile</button>';
    } else if (myTurn && S.phase === 'meld') {
      btns = '<button class="bigbtn primary" data-act="meld"' + (this.sel.length ? '' : ' disabled') + '>Meld</button>' +
        '<button class="bigbtn" data-act="discard"' + (this.sel.length === 1 ? '' : ' disabled') + '>Discard</button>' +
        '<button class="bigbtn" data-act="clear"' + (this.sel.length ? '' : ' disabled') + '>Clear</button>';
    }
    if (btns) h += '<div class="panel" style="left:' + ix + 'px;top:' + (yB + 40) + 'px;text-align:left;margin-left:-6px">' + btns + '</div>';

    var per = Math.ceil(n / rows);
    for (var r = 0; r < rows; r++) {
      var row = hand.slice(r * per, (r + 1) * per), m = row.length;
      var st = m > 1 ? Math.min(cw * 0.74, (W - cw) / (m - 1)) : 0, x0 = (W - (cw + st * (m - 1))) / 2;
      row.forEach(function (c, k) {
        var on = self.sel.indexOf(c.id) >= 0;
        h += CG.card(c, x0 + k * st, yD + r * ch * 0.55 - (on ? Math.round(ch * 0.18) : 0), {
          act: 'hand', data: { id: c.id }, w: cw, z: 10 + r * 40 + k, sel: on, cls: S.newIds.indexOf(c.id) >= 0 ? 'new' : ''
        });
      });
    }
    CG.paint(h);
    var left = S.msg ? S.msg + ' ' : '';
    if (S.phase === 'handEnd') left = 'Hand over.';
    else if (S.turn === 1) left += '<span style="color:var(--ink-dim)">The computer is playing&hellip;</span>';
    else if (S.phase === 'draw') left += '<span style="color:var(--gold)">Your turn: draw 2, or take the pile.</span>';
    else left += '<span style="color:var(--gold)">Meld, then discard 1 card.</span>';
    CG.status(left, '<button class="bigbtn" data-act="scores">Scores</button>');
    CG.save(this);
  };
  CA.sel = [];
  CG.register(CA);
  CG.canastaTest = { plan: function (g, p, cards, top, r) { return g.plan(p, cards, top, r); } };
})();
