/* Picaillon — vidéo verticale : chaque image est calculée à partir du temps t (rendu image par image). */
(function () {
  'use strict';
  var TL = window.TL, M = window.META;
  var L = {}; TL.lines.forEach(function (l) { L[l.id] = l; });
  var $ = function (id) { return document.getElementById(id); };
  var clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
  var prog = function (t, a, b) { return clamp((t - a) / (b - a), 0, 1); };
  var eOut = function (x) { return 1 - Math.pow(1 - x, 3); };
  var eInOut = function (x) { return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  var eBack = function (x) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  var eBounce = function (x) { var n = 7.5625, d = 2.75; if (x < 1 / d) return n * x * x; if (x < 2 / d) return n * (x -= 1.5 / d) * x + .75; if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + .9375; return n * (x -= 2.625 / d) * x + .984375; };
  var lerp = function (a, b, x) { return a + (b - a) * x; };
  function set(el, o) {
    if (!el) return;
    var tr = '';
    if (o.x != null || o.y != null) tr += 'translate(' + (o.x || 0) + 'px,' + (o.y || 0) + 'px) ';
    if (o.s != null) tr += 'scale(' + o.s + ') ';
    if (o.r != null) tr += 'rotate(' + o.r + 'deg) ';
    el.style.transform = tr;
    if (o.o != null) el.style.opacity = o.o;
  }
  function hexToRgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function mix(c1, c2, x) { var a = hexToRgb(c1), b = hexToRgb(c2); return 'rgb(' + a.map(function (v, i) { return Math.round(lerp(v, b[i], x)); }).join(',') + ')'; }

  // ---------- Fenêtres des scènes ----------
  var W = {
    A: [-1, L.s2a.start - 0.25], B: [L.s2a.start - 0.25, L.s3.start - 0.2], C: [L.s3.start - 0.2, L.s4a.start - 0.15],
    D: [L.s4a.start - 0.15, L.s5.start - 0.2], E: [L.s5.start - 0.2, L.s6a.start - 0.15], F: [L.s6a.start - 0.15, L.s7a.start - 0.25],
    G: [L.s7a.start - 0.25, L.s8.start - 0.25], H: [L.s8.start - 0.25, L.s9a.start - 0.25], I: [L.s9a.start - 0.25, TL.total + 1]
  };
  function vis(t, w, fi, fo) { fi = fi || 0.3; fo = fo || 0.3; return Math.min(prog(t, w[0] - fi / 2, w[0] + fi / 2), 1 - prog(t, w[1] - fo / 2, w[1] + fo / 2)); }
  var BG = { A: '#F1F3F8', B: '#0E1224', C: '#F1F3F8', D: '#F1F3F8', E: '#F1F3F8', F: '#F1F3F8', G: '#141829', H: '#F1F3F8', I: '#2340D8' };
  var ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

  // ---------- Mise en place ----------
  var k = 600 / 390;
  $('screen').style.height = Math.round(844 * k) + 'px';
  $('phone').style.height = Math.round(844 * k + 28) + 'px';
  $('vp').style.transform = 'scale(' + k + ')';
  // Logo : icône + logotype (le point du premier i est la pièce)
  var WMH = 190, WMW = WMH * 7815 / 2478, gap = 40, tot = 250 + gap + WMW, left0 = (1080 - tot) / 2;
  $('logoIcon').style.left = left0 + 'px'; $('logoWord').style.left = (left0 + 250 + gap) + 'px';
  $('logoWord').style.width = WMW + 'px';
  $('logoWord').innerHTML = window.WM.replace('<svg ', '<svg style="width:100%;height:100%;overflow:visible" ');
  var wmSvg = $('logoWord').querySelector('svg');
  var coin = wmSvg.querySelectorAll('circle')[0];
  // Logo blanc pour la fin
  var ctaH = 150, ctaW = ctaH * 7815 / 2478, ctaTot = 200 + 32 + ctaW, ctaLeft = (1080 - ctaTot) / 2;
  $('ctaLogo').innerHTML = '<svg style="position:absolute;left:' + ctaLeft + 'px;top:0;width:200px;height:200px" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#fff"/><rect x="16" y="13" width="10.5" height="38" rx="5.25" fill="#2340D8"/><circle cx="35" cy="27" r="14" fill="#2340D8"/><circle cx="35" cy="27" r="8.4" fill="none" stroke="#fff" stroke-width="3.2"/></svg>' +
    '<div style="position:absolute;left:' + (ctaLeft + 232) + 'px;top:28px;width:' + ctaW + 'px;height:' + ctaH + 'px;color:#fff;--accent:#A9B8FF">' + window.WM.replace('<svg ', '<svg style="width:100%;height:100%;overflow:visible" ') + '</div>';
  // Signature : tracés en coordonnées de l'écran (pixels CSS du téléphone)
  var pad = M.pad, sig = $('sig'), paths = [], lens = [], totLen = 0;
  M.strokes.forEach(function (st) {
    var d = st.map(function (p, i) { return (i ? 'L' : 'M') + (pad.x + p[0] * pad.width).toFixed(1) + ' ' + (pad.y + p[1] * pad.height).toFixed(1); }).join(' ');
    var el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    el.setAttribute('d', d); el.setAttribute('fill', 'none'); el.setAttribute('stroke', '#1A2A8C'); el.setAttribute('stroke-width', '2.6');
    el.setAttribute('stroke-linecap', 'round'); el.setAttribute('stroke-linejoin', 'round');
    sig.appendChild(el); var len = el.getTotalLength(); paths.push(el); lens.push(len); totLen += len;
    el.style.strokeDasharray = len; el.style.strokeDashoffset = len;
  });
  // Repères dans les captures
  var F = M.facture, H = M.accueil;
  var qrC = { x: F.qr.x + F.qr.w / 2, y: F.qr.y + F.qr.h / 2 };
  function placeRing(el, r, padPx) { el.style.left = (r.x - padPx) + 'px'; el.style.top = (r.y - padPx) + 'px'; el.style.width = (r.w + 2 * padPx) + 'px'; el.style.height = (r.h + 2 * padPx) + 'px'; }
  placeRing($('ringQr'), F.qr, 8); placeRing($('ringHero'), H.hero, 4); placeRing($('ringUrssaf'), H.urssafCard, 4);
  $('scan').style.left = (F.qr.x - 10) + 'px'; $('scan').style.width = (F.qr.w + 20) + 'px';
  var stampScroll = Math.max(0, Math.round(M['devis-accepte'].stamp.y - 430));
  var qrScroll = Math.round(F.qr.y - 300);
  var urssafScroll = Math.round(H.urssafCard.y - 140);
  // Pièces qui jaillissent du « payé »
  var coins = [], seed = 11;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  for (var i = 0; i < 12; i++) {
    var c = document.createElement('div'); c.className = 'coin'; $('coins').appendChild(c);
    var ang = -Math.PI / 2 + (rnd() - 0.5) * 2.4;
    coins.push({ el: c, vx: Math.cos(ang) * (700 + rnd() * 700), vy: Math.sin(ang) * (900 + rnd() * 700), rot: (rnd() - 0.5) * 720, s: 0.7 + rnd() * 0.6 });
  }
  // Sous-titres : mots apparaissant au rythme de la voix
  var capLine = null;
  function caption(t) {
    var cur = null;
    for (var i = 0; i < TL.lines.length; i++) {
      var l = TL.lines[i], next = TL.lines[i + 1];
      var endShow = next ? next.start - 0.06 : l.end + 2.0;
      if (t >= l.start - 0.12 && t < endShow) { cur = l; break; }
    }
    var box = $('capBox');
    if (!cur) { $('cap').style.opacity = 0; return; }
    if (capLine !== cur.id) {
      capLine = cur.id;
      var words = cur.caption.split(' ');
      var total = cur.caption.replace(/\s/g, '').length, acc = 0;
      box.innerHTML = words.map(function (w) {
        var st = cur.start + (cur.end - cur.start) * (acc / total); acc += w.length;
        return '<span class="w" data-t="' + st.toFixed(3) + '">' + w + '</span>';
      }).join(' ');
    }
    var spans = box.querySelectorAll('.w'), last = -1;
    for (var j = 0; j < spans.length; j++) if (t >= +spans[j].dataset.t - 0.02) last = j;
    for (j = 0; j < spans.length; j++) spans[j].className = 'w' + (j < last ? ' on' : j === last ? ' cur' : '');
    $('cap').style.opacity = Math.min(1, prog(t, cur.start - 0.12, cur.start + 0.05) + (capLine === cur.id && t > cur.start ? 1 : 0));
  }
  function fmtEur(n) { return Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' ') + ' €'; }

  // ---------- Rendu d'une image ----------
  window.render = function (t) {
    // Fond
    var bg = BG.A;
    for (var i = 0; i < ORDER.length - 1; i++) {
      var a = ORDER[i], b = ORDER[i + 1], tb = W[b][0];
      if (t >= W[a][0] - 0.3) bg = BG[a];
      if (t >= tb - 0.2) { bg = BG[b]; if (t < tb + 0.2) bg = mix(BG[a], BG[b], eInOut(prog(t, tb - 0.2, tb + 0.2))); }
    }
    $('stage').style.background = bg;
    set($('glow'), { x: 60 * Math.sin(t * 0.3), y: 80 * Math.cos(t * 0.25), o: (t > W.I[0] ? 0 : 1) });
    set($('lamp'), { o: vis(t, W.B, 0.6, 0.4) });
    ORDER.forEach(function (s) { var el = $(s); if (el) el.style.opacity = vis(t, W[s], s === 'A' ? 0.01 : 0.3); });

    // A — Camille
    var a0 = 0.05;
    set($('avatar'), { s: 0.6 + 0.4 * eBack(prog(t, a0 + 0.05, a0 + 0.6)), o: prog(t, a0, a0 + 0.3), y: -40 * prog(t, W.A[1] - 0.3, W.A[1] + 0.2) });
    $('stripe').style.width = (1160 * eInOut(prog(t, a0 + 0.3, a0 + 1.0))) + 'px';
    $('camName').style.clipPath = 'inset(0 ' + (100 - 100 * eInOut(prog(t, a0 + 0.42, a0 + 1.05))) + '% 0 0)';
    set($('camRole'), { y: 40 * (1 - eOut(prog(t, a0 + 0.9, a0 + 1.4))), o: prog(t, a0 + 0.9, a0 + 1.3) });
    set($('camCard'), { y: -40 * prog(t, W.A[1] - 0.3, W.A[1] + 0.2) });

    // B — le soir
    var b0 = W.B[0];
    var clockTxt = t < L.s2a.start + 1.4 ? '21:47' : t < L.s2b.start ? '22:31' : '23:15';
    $('clock').textContent = clockTxt;
    var flip = Math.min(prog(t, L.s2a.start + 1.32, L.s2a.start + 1.4), 1 - prog(t, L.s2a.start + 1.4, L.s2a.start + 1.5)) + Math.min(prog(t, L.s2b.start - 0.08, L.s2b.start), 1 - prog(t, L.s2b.start, L.s2b.start + 0.1));
    var dimB = prog(t, L.s2b.start - 0.1, L.s2b.start + 0.4);
    set($('clock'), { o: (1 - 0.6 * flip) * prog(t, b0 + 0.1, b0 + 0.5) * (1 - 0.75 * dimB), y: -30 * (1 - eOut(prog(t, b0 + 0.1, b0 + 0.6))) });
    set($('clockLbl'), { o: prog(t, b0 + 0.4, b0 + 0.8) * (1 - dimB) });
    [['p1', -9, 0.15], ['p2', 7, 0.35], ['p3', -2, 0.55]].forEach(function (p) {
      var x = eOut(prog(t, b0 + p[2], b0 + p[2] + 0.5));
      set($(p[0]), { y: -700 * (1 - x) + 60 * dimB, r: p[1] * x + (1 - x) * 25, o: Math.min(1, x * 1.4) * (1 - 0.82 * dimB), s: 1 - 0.08 * dimB });
    });
    var sp = $('scribPath'), sl = sp.getTotalLength();
    sp.style.strokeDasharray = sl; sp.style.strokeDashoffset = sl * (1 - eInOut(prog(t, L.s2a.start + 1.0, L.s2a.start + 2.4)));
    var eq = $('euroQ');
    var flick = t > L.s2b.start - 0.15 && t < L.s2b.start + 1.1;
    if (flick) { var fr = Math.floor(t * 14); eq.textContent = ((fr * 7919) % 9 + 1) + ' ' + String((fr * 104729) % 1000).padStart(3, '0') + ' €'; }
    else if (t >= L.s2b.start + 1.1) eq.textContent = '? ??? €';
    set(eq, { o: prog(t, L.s2b.start - 0.15, L.s2b.start + 0.1), s: 0.9 + 0.1 * eOut(prog(t, L.s2b.start - 0.15, L.s2b.start + 0.3)) });
    $('bigQ').style.top = '860px';
    set($('bigQ'), { o: prog(t, L.s2b.start + 0.05, L.s2b.start + 0.4), y: 50 * (1 - eOut(prog(t, L.s2b.start + 0.05, L.s2b.start + 0.6))) });

    // C — logo
    var c0 = L.s3.start - 0.05;
    set($('logoIcon'), { s: eBack(prog(t, c0 + 0.45, c0 + 1.0)), r: -25 * (1 - eOut(prog(t, c0 + 0.45, c0 + 1.0))), o: prog(t, c0 + 0.45, c0 + 0.6) });
    var rv = prog(t, c0 + 0.75, c0 + 1.3);
    $('logoWord').style.clipPath = rv >= 1 ? 'none' : 'inset(-40% ' + (100 - 100 * eInOut(rv)) + '% -10% 0)';
    var cd = prog(t, c0 + 1.3, c0 + 1.95);
    coin.style.transform = 'translateY(' + (-6500 * (1 - eBounce(cd))) + 'px)';
    coin.style.opacity = cd > 0 ? 1 : 0;
    set($('tagline'), { o: prog(t, c0 + 1.5, c0 + 1.9), y: 30 * (1 - eOut(prog(t, c0 + 1.5, c0 + 2.0))) });
    set($('logoWrap'), { s: 1 + 0.04 * prog(t, c0, W.C[1] + 0.3) });

    // Téléphone (D à G)
    var pIn = eOut(prog(t, W.D[0] - 0.1, W.D[0] + 0.55)), pOut = eInOut(prog(t, W.G[1] - 0.15, W.G[1] + 0.35));
    var phoneVis = t > W.D[0] - 0.15 && t < W.G[1] + 0.4;
    // Le téléphone remonte pendant la signature pour que le cadre reste au-dessus des sous-titres
    var lift = -270 * (1 - eInOut(prog(t, W.E[0] - 0.3, W.E[0] + 0.4)));
    var phoneY = lift + 1300 * (1 - pIn) + 1400 * pOut;
    set($('phone'), { y: phoneY, o: phoneVis ? 1 : 0 });
    // Couches de l'écran
    var sSig = L.s4b.start - 0.15, sigDone = L.s4b.start + 1.35, toDevis = L.s4b.start + 1.5;
    var tFact = W.E[0] + 0.9, tHome = W.G[0];
    var oSign = 1 - prog(t, toDevis, toDevis + 0.25);
    var oDevis = Math.min(prog(t, toDevis, toDevis + 0.25), 1 - prog(t, tFact, tFact + 0.25));
    var oFact = Math.min(prog(t, tFact, tFact + 0.25), 1 - prog(t, tHome - 0.1, tHome + 0.2));
    var oHome = prog(t, tHome - 0.1, tHome + 0.2);
    $('Lsign').style.opacity = oSign; $('Ldevis').style.opacity = oDevis; $('Lfact').style.opacity = oFact; $('Lhome').style.opacity = oHome;
    // Signature tracée au doigt
    var sp2 = eInOut(prog(t, sSig, sigDone)) * totLen, accL = 0;
    paths.forEach(function (p, i) { var l = lens[i]; p.style.strokeDashoffset = Math.max(0, l - clamp(sp2 - accL, 0, l)); accL += l; });
    // Devis accepté : on montre le tampon, puis on remonte vers « Créer la facture »
    var dScroll = stampScroll * (1 - eInOut(prog(t, W.E[0] - 0.05, W.E[0] + 0.45)));
    var dv = $('Ldevis');
    dv.querySelector('.doc').style.transform = 'translateY(' + (-dScroll) + 'px)';
    dv.querySelector('.topcrop').style.opacity = dScroll > 2 ? 1 : 0;
    // Facture : en-tête, puis QR code en gros plan
    var fScroll = lerp(0, 150, eInOut(prog(t, tFact + 0.2, tFact + 1.1)));
    fScroll = lerp(fScroll, qrScroll, eInOut(prog(t, W.F[0], W.F[0] + 0.6)));
    var zoom = 1 + 0.6 * eInOut(prog(t, W.F[0] + 0.35, W.F[0] + 1.0)) - 0.6 * eInOut(prog(t, L.s6b.start + 0.5, W.F[1]));
    var fw = $('Lfact').querySelector('.docwrap');
    fw.style.transformOrigin = qrC.x + 'px ' + qrC.y + 'px';
    fw.style.transform = 'translateY(' + (-fScroll) + 'px) scale(' + zoom + ')';
    $('Lfact').querySelector('.topcrop').style.opacity = fScroll > 2 && zoom < 1.05 ? 1 : 0;
    var scanP = prog(t, W.F[0] + 0.95, L.s6b.start);
    var sweep = scanP < 0.5 ? scanP * 2 : 2 - scanP * 2;
    $('scan').style.top = (F.qr.y + sweep * F.qr.h) + 'px';
    $('scan').style.opacity = scanP > 0 && scanP < 1 ? 1 : 0;
    set($('ringQr'), { o: Math.min(prog(t, W.F[0] + 0.9, W.F[0] + 1.1), 1 - prog(t, L.s6b.start + 0.4, L.s6b.start + 0.7)) });
    var nP = prog(t, L.s6b.start - 0.1, L.s6b.start + 0.45);
    $('notif').style.transform = 'translateY(' + (180 * eBack(nP)) + 'px)';
    // Accueil : URSSAF puis net en poche
    var hScroll = urssafScroll * eInOut(prog(t, L.s7a.start + 0.7, L.s7a.start + 1.3)) * (1 - eInOut(prog(t, L.s7b.start - 0.15, L.s7b.start + 0.35)));
    var hw = $('Lhome').querySelector('.docwrap');
    hw.style.transform = 'translateY(' + (-hScroll) + 'px)';
    $('Lhome').querySelector('.topcrop').style.opacity = hScroll > 2 ? 1 : 0;
    set($('ringUrssaf'), { o: Math.min(prog(t, L.s7a.start + 1.2, L.s7a.start + 1.45), 1 - prog(t, L.s7b.start - 0.2, L.s7b.start)) });
    set($('ringHero'), { o: Math.min(prog(t, L.s7b.start + 0.3, L.s7b.start + 0.55), 1 - prog(t, W.G[1] - 0.3, W.G[1])) });

    // Titres
    function head(id, a, b) { var x = Math.min(prog(t, a, a + 0.3), 1 - prog(t, b - 0.2, b + 0.1)); set($(id), { o: x, y: 30 * (1 - eOut(prog(t, a, a + 0.45))) }); }
    head('hD1', W.D[0] + 0.15, L.s4b.start - 0.05);
    head('hD2', L.s4b.start - 0.05, W.D[1] + 0.1);
    head('hE', W.E[0] + 0.1, W.E[1] + 0.1);
    head('hF1', W.F[0] + 0.1, L.s6b.start - 0.05);
    head('hF2', L.s6b.start - 0.05, W.F[1] + 0.1);
    head('hG1', W.G[0] + 0.15, L.s7b.start - 0.05);
    head('hG2', L.s7b.start - 0.05, W.G[1] + 0.05);
    var nb = prog(t, L.s7b.start + 0.05, L.s7b.start + 1.25);
    $('bigNum').textContent = fmtEur(20487 * eOut(nb));
    set($('bigNum'), { o: Math.min(prog(t, L.s7b.start, L.s7b.start + 0.25), 1 - prog(t, W.G[1] - 0.2, W.G[1] + 0.1)), s: 0.92 + 0.08 * eOut(nb) });
    $('bigNum').style.top = '190px';
    // Mentions obligatoires cochées une à une
    var mv = Math.min(prog(t, tFact + 0.25, tFact + 0.55), 1 - prog(t, W.E[1] - 0.25, W.E[1] + 0.05));
    set($('mentions'), { o: mv, y: 40 * (1 - eOut(prog(t, tFact + 0.25, tFact + 0.7))) });
    ['m1', 'm2', 'm3', 'm4'].forEach(function (id, i) {
      var st = tFact + 0.55 + i * 0.4, x = prog(t, st, st + 0.3);
      set($(id), { o: x, s: 0.85 + 0.15 * eBack(x) });
    });
    var cu = $('cU'); cu.style.left = '170px'; cu.style.top = '1230px';
    var xu = prog(t, L.s7a.start + 1.5, L.s7a.start + 1.85);
    set(cu, { o: Math.min(xu, 1 - prog(t, L.s7b.start - 0.25, L.s7b.start)), s: 0.7 + 0.3 * eBack(xu) });
    // Pièces
    var t0c = L.s6b.start + 0.05, oxS = 226 + 14 + 195 * k, oyS = 420 + 14 + 75 * k;
    coins.forEach(function (c) {
      var dt = t - t0c;
      if (dt < 0 || dt > 1.6) { c.el.style.opacity = 0; return; }
      var x = oxS + c.vx * dt, y = oyS + c.vy * dt + 0.5 * 2600 * dt * dt;
      c.el.style.left = (x - 27) + 'px'; c.el.style.top = (y - 27) + 'px';
      c.el.style.transform = 'scale(' + c.s + ') rotate(' + (c.rot * dt) + 'deg)';
      c.el.style.opacity = 1 - prog(dt, 1.0, 1.6);
    });

    // H — vie privée
    var h0 = W.H[0];
    set($('lock'), { s: 0.6 + 0.4 * eBack(prog(t, h0 + 0.05, h0 + 0.55)), o: prog(t, h0, h0 + 0.25) });
    $('shackle').style.transform = 'translateY(' + (-22 * (1 - eBounce(prog(t, h0 + 0.5, h0 + 0.95)))) + 'px)';
    set($('privTitle'), { o: prog(t, h0 + 0.3, h0 + 0.6), y: 30 * (1 - eOut(prog(t, h0 + 0.3, h0 + 0.8))) });
    [['pl1', L.s8.start + 0.05], ['pl2', L.s8.start + 0.85], ['pl3', L.s8.start + 1.75]].forEach(function (p) {
      var x = prog(t, p[1], p[1] + 0.35);
      set($(p[0]), { o: x, x: -60 * (1 - eOut(x)) });
    });

    // I — appel à l'action
    var i0 = W.I[0];
    set($('ctaHead'), { o: prog(t, L.s9a.start - 0.1, L.s9a.start + 0.25), y: 30 * (1 - eOut(prog(t, L.s9a.start - 0.1, L.s9a.start + 0.4))) });
    set($('ctaLogo'), { s: 0.8 + 0.2 * eBack(prog(t, i0 + 0.1, i0 + 0.7)), o: prog(t, i0 + 0.05, i0 + 0.35) });
    var fx = prog(t, L.s9b.start - 0.1, L.s9b.start + 0.3);
    $('ctaFree').style.opacity = fx;
    $('ctaFree').style.transform = 'translateX(-50%) scale(' + (0.6 + 0.4 * eBack(fx)) + ')';
    set($('ctaUrl'), { o: prog(t, L.s9c.start - 0.35, L.s9c.start), y: 30 * (1 - eOut(prog(t, L.s9c.start - 0.35, L.s9c.start + 0.2))) });
    set($('ctaArrow'), { o: prog(t, L.s9c.start, L.s9c.start + 0.3), y: 14 * Math.abs(Math.sin((t - L.s9c.start) * 4)) * prog(t, L.s9c.start, L.s9c.start + 0.3) });

    caption(t);
    if (t > W.I[0] + 0.1) $('cap').style.opacity = Math.max(0, 1 - prog(t, W.I[0] + 0.1, W.I[0] + 0.35));
  };
  window.render(0);
})();
