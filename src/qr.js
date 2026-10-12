/* ==========================================================================
   Picaillon — encodeur QR code (mode octet, correction M, versions 1 à 10)
   Sert au « QR code de virement » SEPA (norme EPC) imprimé sur les factures.
   ========================================================================== */
(function (root) {
  'use strict';
  // Correction M : [codes de correction par bloc, nb blocs groupe 1, octets données groupe 1, nb blocs groupe 2, octets données groupe 2]
  var EC_M = [null,
    [10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0], [24, 2, 43, 0, 0],
    [16, 4, 27, 0, 0], [18, 4, 31, 0, 0], [22, 2, 38, 2, 39], [22, 3, 36, 2, 37], [26, 4, 43, 1, 44]];
  var ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

  // Corps de Galois GF(256), polynôme 0x11D
  var EXP = new Array(512), LOG = new Array(256);
  (function () { var x = 1; for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; } for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255]; })();
  function gmul(a, b) { return a && b ? EXP[LOG[a] + LOG[b]] : 0; }
  function rsGenerator(n) {
    var g = [1];
    for (var i = 0; i < n; i++) {
      var ng = new Array(g.length + 1).fill(0);
      for (var j = 0; j < g.length; j++) { ng[j] ^= g[j]; ng[j + 1] ^= gmul(g[j], EXP[i]); }
      g = ng;
    }
    return g;
  }
  function rsRemainder(data, n) {
    var gen = rsGenerator(n), res = data.concat(new Array(n).fill(0));
    for (var i = 0; i < data.length; i++) {
      var c = res[i];
      if (c) for (var j = 0; j < gen.length; j++) res[i + j] ^= gmul(gen[j], c);
    }
    return res.slice(data.length);
  }
  function utf8(str) {
    var out = [], s = unescape(encodeURIComponent(str));
    for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
    return out;
  }
  function dataCapacity(v) { var e = EC_M[v]; return e[1] * e[2] + e[3] * e[4]; }

  function encode(text) {
    var bytes = utf8(text), v;
    for (v = 1; v <= 10; v++) {
      var head = 4 + (v < 10 ? 8 : 16);
      if (head + bytes.length * 8 <= dataCapacity(v) * 8) break;
    }
    if (v > 10) throw new Error('Texte trop long pour le QR code');
    // Flux de bits
    var bits = [];
    var put = function (val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(4, 4); put(bytes.length, v < 10 ? 8 : 16);
    bytes.forEach(function (b) { put(b, 8); });
    var cap = dataCapacity(v) * 8;
    for (var t = 0; t < 4 && bits.length < cap; t++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    var cw = [];
    for (var k = 0; k < bits.length; k += 8) { var b = 0; for (var m = 0; m < 8; m++) b = (b << 1) | bits[k + m]; cw.push(b); }
    for (var pad = 0; cw.length < dataCapacity(v); pad++) cw.push(pad % 2 ? 0x11 : 0xEC);
    // Blocs et correction d'erreurs, puis entrelacement
    var e = EC_M[v], blocks = [], ecBlocks = [], pos = 0;
    for (var g = 0; g < e[1] + e[3]; g++) {
      var len = g < e[1] ? e[2] : e[4];
      var blk = cw.slice(pos, pos + len); pos += len;
      blocks.push(blk); ecBlocks.push(rsRemainder(blk, e[0]));
    }
    var final = [], maxLen = Math.max.apply(null, blocks.map(function (x) { return x.length; }));
    for (var i2 = 0; i2 < maxLen; i2++) blocks.forEach(function (bl) { if (i2 < bl.length) final.push(bl[i2]); });
    for (var i3 = 0; i3 < e[0]; i3++) ecBlocks.forEach(function (bl) { final.push(bl[i3]); });
    return build(v, final);
  }

  function build(v, codewords) {
    var size = v * 4 + 17, M = [], F = [];
    for (var r = 0; r < size; r++) { M.push(new Array(size).fill(0)); F.push(new Array(size).fill(false)); }
    function set(r, c, val) { M[r][c] = val ? 1 : 0; F[r][c] = true; }
    function finder(r0, c0) {
      for (var r = -1; r <= 7; r++) for (var c = -1; c <= 7; c++) {
        var rr = r0 + r, cc = c0 + c;
        if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
        var on = (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6)) || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        set(rr, cc, on);
      }
    }
    finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
    for (var i = 8; i < size - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    var al = ALIGN[v];
    al.forEach(function (ar) {
      al.forEach(function (ac) {
        if ((ar === 6 && ac === 6) || (ar === 6 && ac === size - 7) || (ar === size - 7 && ac === 6)) return;
        for (var r = -2; r <= 2; r++) for (var c = -2; c <= 2; c++) set(ar + r, ac + c, Math.max(Math.abs(r), Math.abs(c)) !== 1);
      });
    });
    set(4 * v + 9, 8, 1); // module sombre
    // Zones réservées : informations de format et de version
    for (var f = 0; f < 9; f++) { if (!F[8][f]) F[8][f] = true; if (!F[f][8]) F[f][8] = true; }
    for (var f2 = 0; f2 < 8; f2++) { F[8][size - 1 - f2] = true; F[size - 1 - f2][8] = true; }
    if (v >= 7) for (var a = 0; a < 6; a++) for (var b = 0; b < 3; b++) { F[a][size - 11 + b] = true; F[size - 11 + b][a] = true; }
    // Placement des données en zigzag
    var bitIdx = 0, totalBits = codewords.length * 8;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) {
        for (var j = 0; j < 2; j++) {
          var col = right - j, upward = ((right + 1) & 2) === 0;
          var row = upward ? size - 1 - vert : vert;
          if (F[row][col]) continue;
          var bit = 0;
          if (bitIdx < totalBits) bit = (codewords[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1;
          M[row][col] = bit; bitIdx++;
        }
      }
    }
    // Choix du masque le plus lisible
    var best = null, bestScore = Infinity;
    for (var mask = 0; mask < 8; mask++) {
      var T = M.map(function (rw) { return rw.slice(); });
      applyMask(T, F, mask, size); drawFormat(T, mask, size); if (v >= 7) drawVersion(T, v, size);
      var sc = penalty(T, size);
      if (sc < bestScore) { bestScore = sc; best = T; }
    }
    return best;
  }
  function maskBit(mask, r, c) {
    switch (mask) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return (r * c) % 2 + (r * c) % 3 === 0;
      case 6: return ((r * c) % 2 + (r * c) % 3) % 2 === 0;
      default: return ((r + c) % 2 + (r * c) % 3) % 2 === 0;
    }
  }
  function applyMask(T, F, mask, size) {
    for (var r = 0; r < size; r++) for (var c = 0; c < size; c++) if (!F[r][c] && maskBit(mask, r, c)) T[r][c] ^= 1;
  }
  function bch(data, poly, polyDeg) {
    var d = data << polyDeg;
    for (var i = 31 - Math.clz32(d); i >= polyDeg; i--) if ((d >>> i) & 1) d ^= poly << (i - polyDeg);
    return d;
  }
  function drawFormat(T, mask, size) {
    var data = (0 << 3) | mask; // niveau M = 00
    var bits = ((data << 10) | bch(data, 0x537, 10)) ^ 0x5412;
    var bit = function (i) { return (bits >>> i) & 1; };
    for (var i = 0; i <= 5; i++) T[i][8] = bit(i);
    T[7][8] = bit(6); T[8][8] = bit(7); T[8][7] = bit(8);
    for (var j = 9; j < 15; j++) T[8][14 - j] = bit(j);
    for (var k = 0; k < 8; k++) T[8][size - 1 - k] = bit(k);
    for (var l = 8; l < 15; l++) T[size - 15 + l][8] = bit(l);
    T[size - 8][8] = 1;
  }
  function drawVersion(T, v, size) {
    var bits = (v << 12) | bch(v, 0x1F25, 12);
    for (var i = 0; i < 18; i++) {
      var b = (bits >>> i) & 1, a = Math.floor(i / 3), c = i % 3;
      T[a][size - 11 + c] = b; T[size - 11 + c][a] = b;
    }
  }
  function penalty(T, size) {
    var score = 0, r, c, run, prev;
    for (r = 0; r < size; r++) { // règle 1, lignes
      run = 1; prev = T[r][0];
      for (c = 1; c < size; c++) { if (T[r][c] === prev) { run++; if (run === 5) score += 3; else if (run > 5) score++; } else { run = 1; prev = T[r][c]; } }
    }
    for (c = 0; c < size; c++) { // règle 1, colonnes
      run = 1; prev = T[0][c];
      for (r = 1; r < size; r++) { if (T[r][c] === prev) { run++; if (run === 5) score += 3; else if (run > 5) score++; } else { run = 1; prev = T[r][c]; } }
    }
    for (r = 0; r < size - 1; r++) for (c = 0; c < size - 1; c++) { // règle 2
      var s = T[r][c] + T[r][c + 1] + T[r + 1][c] + T[r + 1][c + 1];
      if (s === 0 || s === 4) score += 3;
    }
    var pat = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], pat2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    for (r = 0; r < size; r++) for (c = 0; c <= size - 11; c++) { // règle 3
      var h1 = true, h2 = true, v1 = true, v2 = true;
      for (var k = 0; k < 11; k++) {
        if (T[r][c + k] !== pat[k]) h1 = false; if (T[r][c + k] !== pat2[k]) h2 = false;
        if (T[c + k][r] !== pat[k]) v1 = false; if (T[c + k][r] !== pat2[k]) v2 = false;
      }
      score += (h1 ? 40 : 0) + (h2 ? 40 : 0) + (v1 ? 40 : 0) + (v2 ? 40 : 0);
    }
    var dark = 0; for (r = 0; r < size; r++) for (c = 0; c < size; c++) dark += T[r][c];
    score += Math.floor(Math.abs(dark * 100 / (size * size) - 50) / 5) * 10; // règle 4
    return score;
  }

  // Contenu du QR code de virement SEPA (norme EPC069-12, version 002, UTF-8)
  function epcPayload(o) {
    var clean = function (t, max) { return String(t || '').replace(/[\r\n]+/g, ' ').trim().slice(0, max); };
    var iban = String(o.iban || '').replace(/\s+/g, '').toUpperCase();
    var bic = String(o.bic || '').replace(/\s+/g, '').toUpperCase();
    var amount = o.montant > 0 ? 'EUR' + (Math.round(o.montant * 100) / 100).toFixed(2) : '';
    return ['BCD', '002', '1', 'SCT', bic, clean(o.nom, 70), iban, amount, '', '', clean(o.libelle, 140)].join('\n');
  }
  // Chemin SVG d'une matrice (1 unité = 1 module, marge de 4 modules)
  function svgPath(M) {
    var d = '';
    for (var r = 0; r < M.length; r++) {
      for (var c = 0; c < M.length; c++) {
        if (!M[r][c]) continue;
        var s = c; while (c + 1 < M.length && M[r][c + 1]) c++;
        d += 'M' + (s + 4) + ' ' + (r + 4) + 'h' + (c - s + 1) + 'v1h-' + (c - s + 1) + 'z';
      }
    }
    return d;
  }

  var api = { encode: encode, epcPayload: epcPayload, svgPath: svgPath };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.QR = api;
})(this);
