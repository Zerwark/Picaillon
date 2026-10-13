/* ==========================================================================
   Picaillon — cœur métier
   Règles micro-entreprise 2026, calculs URSSAF, numérotation, PDF, CSV.
   Aucun accès au DOM ici : ce fichier est testable tel quel dans Node.
   ========================================================================== */
(function (root) {
  'use strict';

  /* ---------- Règles 2026 ------------------------------------------------ */
  // Taux de cotisations sociales 2026 (URSSAF), CFP, versement libératoire,
  // plafonds du régime micro 2026-2028 et seuils de franchise de TVA.
  var ACTIVITES = {
    vente:   { label: 'Vente de marchandises', court: 'Vente · BIC', social: 12.3, cfp: 0.1, vl: 1.0, plafond: 203100, tva: 85000, tvaMaj: 93500 },
    service: { label: 'Prestations de services commerciales', court: 'Services · BIC', social: 21.2, cfp: 0.1, vl: 1.7, plafond: 83600, tva: 37500, tvaMaj: 41250 },
    artisan: { label: 'Activité artisanale', court: 'Artisanat · BIC', social: 21.2, cfp: 0.3, vl: 1.7, plafond: 83600, tva: 37500, tvaMaj: 41250 },
    liberal: { label: 'Profession libérale non réglementée', court: 'Libéral · BNC', social: 25.6, cfp: 0.2, vl: 2.2, plafond: 83600, tva: 37500, tvaMaj: 41250 },
    cipav:   { label: 'Profession libérale réglementée (Cipav)', court: 'Libéral · Cipav', social: 23.2, cfp: 0.2, vl: 2.2, plafond: 83600, tva: 37500, tvaMaj: 41250, acreAvant: 13.4 }
  };
  // acreAvant : taux ACRE officiel quand il n'est pas 50 % du taux normal (début d'activité avant ACRE_BASCULE).
  // Cipav : 13,4 % (economie.gouv.fr, fiche « charges sociales » du 06/03/2026 ; bpifrance-creation.fr).
  // Règles qui changent d'une année à l'autre (2026 = valeurs ci-dessus)
  var ANNEE_REF = 2026;
  var DIFF = {
    2025: { liberal: { social: 24.6 }, vente: { plafond: 188700 }, service: { plafond: 77700 }, artisan: { plafond: 77700 }, cipav: { plafond: 77700 } }
  };
  DIFF[2025].liberal.plafond = 77700;
  var ACRE_BASCULE = '2026-07-01'; // taux réduit : 50 % avant, 75 % des taux normaux ensuite
  var MENTION_TVA = 'TVA non applicable, art. 293 B du CGI';
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var MOIS_COURT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

  /* ---------- Dates (ISO AAAA-MM-JJ, sans fuseau) ------------------------- */
  function pad(n) { return String(n).padStart(2, '0'); }
  function iso(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }
  function parse(s) { var p = String(s).split('-'); return { y: +p[0], m: +p[1], d: +p[2] }; }
  function lastDay(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function toUTC(s) { var p = parse(s); return Date.UTC(p.y, p.m - 1, p.d); }
  function addDays(s, n) { var t = new Date(toUTC(s) + n * 86400000); return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()); }
  function daysBetween(a, b) { return Math.round((toUTC(b) - toUTC(a)) / 86400000); }
  function todayIso(now) { var d = now || new Date(); return iso(d.getFullYear(), d.getMonth() + 1, d.getDate()); }
  function fmtDate(s) { if (!s) return ''; var p = parse(s); return pad(p.d) + '/' + pad(p.m) + '/' + p.y; }
  function fmtDateLong(s) { if (!s) return ''; var p = parse(s); return (p.d === 1 ? '1er' : p.d) + ' ' + MOIS[p.m - 1] + ' ' + p.y; }

  /* ---------- Montants ---------------------------------------------------- */
  function round2(n) { return Math.round((+n + Number.EPSILON) * 100) / 100; }
  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var n = parseFloat(String(v || '').replace(/\s/g, '').replace(',', '.'));
    return isFinite(n) ? n : 0;
  }
  var nf2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  function eur(n, dec) { return (dec === 0 ? nf0 : nf2).format(round2(n)) + ' €'; }
  function plainNum(n) { return nf2.format(round2(n)).replace(/[  ]/g, ' '); }

  /* ---------- Documents --------------------------------------------------- */
  function ligneTotal(l) { return round2(num(l.qte) * num(l.pu)); }
  function docTotal(d) { return round2((d.lignes || []).reduce(function (s, l) { return s + ligneTotal(l); }, 0)); }

  function nextNumero(docs, type, year) {
    var pre = (type === 'facture' ? 'F' : type === 'avoir' ? 'AV' : 'D') + '-' + year + '-';
    var max = 0;
    docs.forEach(function (d) {
      if (d.numero && d.numero.indexOf(pre) === 0) {
        var n = parseInt(d.numero.slice(pre.length), 10);
        if (n > max) max = n;
      }
    });
    return pre + String(max + 1).padStart(3, '0');
  }

  // État affiché d'un document à une date donnée
  function etat(d, today) {
    if (d.type === 'avoir') {
      if (d.statut === 'brouillon') return { code: 'brouillon', label: 'Brouillon', ton: 'neutre' };
      if (d.statut === 'a_rembourser') return { code: 'a_rembourser', label: 'À rembourser', ton: 'warn' };
      if (d.statut === 'rembourse') return { code: 'rembourse', label: 'Remboursé', ton: 'ok' };
      return { code: 'emis', label: 'Facture annulée', ton: 'neutre' };
    }
    if (d.type === 'facture') {
      if (d.statut === 'annulee') return { code: 'annulee', label: 'Annulée par avoir', ton: 'neutre' };
      if (d.statut === 'payee') return { code: 'payee', label: 'Payée', ton: 'ok' };
      if (d.statut === 'brouillon') return { code: 'brouillon', label: 'Brouillon', ton: 'neutre' };
      if (d.echeance && d.echeance < today) {
        var j = daysBetween(d.echeance, today);
        return { code: 'retard', label: 'En retard · ' + j + ' j', ton: 'bad', jours: j };
      }
      return { code: 'envoyee', label: 'En attente', ton: 'warn' };
    }
    if (d.statut === 'accepte') return { code: 'accepte', label: d.factureId ? 'Facturé' : 'Accepté', ton: 'ok' };
    if (d.statut === 'refuse') return { code: 'refuse', label: 'Refusé', ton: 'neutre' };
    if (d.statut === 'brouillon') return { code: 'brouillon', label: 'Brouillon', ton: 'neutre' };
    if (d.validite && d.validite < today) return { code: 'expire', label: 'Expiré', ton: 'neutre' };
    return { code: 'envoye', label: 'Envoyé', ton: 'warn' };
  }

  /* ---------- ACRE et taux ------------------------------------------------ */
  function ceil1(x) { return Math.ceil(x * 10 - 1e-7) / 10; }
  function acreInfo(s) {
    if (!s || !s.acre || !s.dateCreation) return null;
    var p = parse(s.dateCreation);
    var endQ = Math.floor((p.m - 1) / 3) + 3;           // fin du 3e trimestre civil suivant
    var ey = p.y + Math.floor(endQ / 4), em = (endQ % 4) * 3 + 3;
    return { debut: s.dateCreation, fin: iso(ey, em, lastDay(ey, em)), facteur: s.dateCreation >= ACRE_BASCULE ? 0.75 : 0.5 };
  }
  // Règles d'une activité pour une année donnée. Avant 2025 : règles 2025 ; après 2026 : dernières règles connues.
  function activite(s, annee) {
    var key = (s && s.activite) || 'service';
    var base = ACTIVITES[key] || ACTIVITES.service;
    var y = annee || ANNEE_REF, ry = Math.min(Math.max(y, 2025), ANNEE_REF);
    var a = Object.assign({}, base, (DIFF[ry] && DIFF[ry][key]) || {});
    a.annee = ry; a.estime = y > ANNEE_REF;
    return a;
  }
  function tauxAt(s, date) {
    var a = activite(s, +String(date).slice(0, 4)), ac = acreInfo(s);
    var acre = !!(ac && date >= ac.debut && date <= ac.fin);
    var social = !acre ? a.social : (ac.facteur === 0.5 && a.acreAvant) ? a.acreAvant : ceil1(a.social * ac.facteur);
    var vl = s && s.vl ? a.vl : 0;
    return { social: social, cfp: a.cfp, vl: vl, total: round2(social + a.cfp + vl), acre: acre, annee: a.annee, estime: a.estime };
  }

  /* ---------- Encaissements & cotisations -------------------------------- */
  function encaissements(docs) {
    return docs.filter(function (d) { return d.datePaiement && ((d.type === 'facture' && d.statut === 'payee') || (d.type === 'avoir' && d.statut === 'rembourse')); })
      .map(function (d) { return { date: d.datePaiement, montant: docTotal(d), doc: d }; })
      .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }
  function cotisations(list, s) {
    var r = { ca: 0, social: 0, cfp: 0, vl: 0 };
    list.forEach(function (e) {
      var t = tauxAt(s, e.date);
      r.ca += e.montant;
      r.social += e.montant * t.social / 100;
      r.cfp += e.montant * t.cfp / 100;
      r.vl += e.montant * t.vl / 100;
    });
    r.ca = round2(r.ca); r.social = round2(r.social); r.cfp = round2(r.cfp); r.vl = round2(r.vl);
    r.total = round2(r.social + r.cfp + r.vl);
    r.net = round2(r.ca - r.total);
    return r;
  }

  /* ---------- Périodes de déclaration URSSAF ------------------------------ */
  function periodKey(date, per) {
    var p = parse(date);
    return per === 'mensuelle' ? p.y + '-M' + pad(p.m) : p.y + '-T' + Math.ceil(p.m / 3);
  }
  function periodInfo(key) {
    var y = +key.slice(0, 4), kind = key[5], n = +key.slice(6);
    var sm, em, label;
    if (kind === 'M') { sm = em = n; label = MOIS[n - 1].charAt(0).toUpperCase() + MOIS[n - 1].slice(1) + ' ' + y; }
    else { sm = (n - 1) * 3 + 1; em = sm + 2; label = (n === 1 ? '1er' : n + 'e') + ' trimestre ' + y; }
    var dy = y, dm = em + 1;
    if (dm > 12) { dm = 1; dy++; }
    return { key: key, label: label, debut: iso(y, sm, 1), fin: iso(y, em, lastDay(y, em)), limite: iso(dy, dm, lastDay(dy, dm)) };
  }
  function periodShift(key, delta) {
    var y = +key.slice(0, 4), kind = key[5], n = +key.slice(6), size = kind === 'M' ? 12 : 4;
    var idx = y * size + (n - 1) + delta;
    var ny = Math.floor(idx / size), nn = idx % size + 1;
    return ny + '-' + kind + (kind === 'M' ? pad(nn) : nn);
  }
  // Liste des périodes d'une année avec CA, cotisations et état de déclaration
  function declarations(state, year, today) {
    var s = state.settings, per = s.periodicite || 'trimestrielle';
    var count = per === 'mensuelle' ? 12 : 4;
    var all = encaissements(state.docs);
    var out = [];
    for (var i = 1; i <= count; i++) {
      var key = year + '-' + (per === 'mensuelle' ? 'M' + pad(i) : 'T' + i);
      var info = periodInfo(key);
      if (s.dateCreation && info.fin < s.dateCreation) continue;
      var list = all.filter(function (e) { return e.date >= info.debut && e.date <= info.fin; });
      var c = cotisations(list, s);
      var declared = !!(s.declarations && s.declarations[key]);
      var statut, suivi = s.suiviDepuis || today;
      if (declared) statut = 'declaree';
      else if (today > info.limite) statut = info.limite < suivi ? 'avant' : (c.ca > 0 ? 'retard' : 'zero');
      else if (today > info.fin) statut = 'a_declarer';
      else if (today >= info.debut) statut = 'en_cours';
      else statut = 'a_venir';
      out.push({ info: info, c: c, encaissements: list, statut: statut, declared: declared });
    }
    return out;
  }
  // Prochaine échéance : période terminée dont la date limite n'est pas passée, sinon période en cours
  function prochaineDeclaration(state, today) {
    var per = state.settings.periodicite || 'trimestrielle';
    var cur = periodKey(today, per), prev = periodShift(cur, -1);
    var pi = periodInfo(prev);
    var key = (today <= pi.limite && !(state.settings.declarations || {})[prev]) ? prev : cur;
    var info = periodInfo(key);
    var list = encaissements(state.docs).filter(function (e) { return e.date >= info.debut && e.date <= info.fin; });
    return { info: info, c: cotisations(list, state.settings), terminee: today > info.fin, jours: daysBetween(today, info.limite) };
  }

  /* ---------- Plafonds ---------------------------------------------------- */
  function prorata(s, year) {
    if (!s.dateCreation || +s.dateCreation.slice(0, 4) !== year) return 1;
    var total = daysBetween(iso(year, 1, 1), iso(year + 1, 1, 1));
    var restant = daysBetween(s.dateCreation, iso(year + 1, 1, 1));
    return Math.max(0, Math.min(1, restant / total));
  }

  /* ---------- Tableau de bord -------------------------------------------- */
  function dashboard(state, today) {
    var year = +today.slice(0, 4), s = state.settings, a = activite(s, year);
    var enc = encaissements(state.docs);
    var annee = enc.filter(function (e) { return e.date.slice(0, 4) === String(year); });
    var mois = new Array(12).fill(0);
    annee.forEach(function (e) { mois[parse(e.date).m - 1] += e.montant; });
    var c = cotisations(annee, s);
    var k = prorata(s, year);
    var factures = state.docs.filter(function (d) { return d.type === 'facture'; });
    var attente = factures.filter(function (d) { return d.statut === 'envoyee'; });
    var retard = attente.filter(function (d) { return d.echeance && d.echeance < today; });
    var devis = state.docs.filter(function (d) { return d.type === 'devis' && d.statut === 'envoye' && !(d.validite && d.validite < today); });
    var sum = function (l) { return round2(l.reduce(function (t, d) { return t + docTotal(d); }, 0)); };
    return {
      annee: year,
      c: c,
      mois: mois.map(round2),
      plafond: round2(a.plafond * k), tva: round2(a.tva * k), tvaMaj: round2(a.tvaMaj * k), prorata: k < 1,
      attente: { liste: attente, total: sum(attente) },
      retard: { liste: retard, total: sum(retard) },
      devis: { liste: devis, total: sum(devis) },
      prochaine: prochaineDeclaration(state, today),
      taux: tauxAt(s, today)
    };
  }

  // « Combien facturer pour gagner X net ? »
  function brutPourNet(net, s, date) { var t = tauxAt(s, date); return round2(net / (1 - t.total / 100)); }

  /* ---------- Livre des recettes (CSV) ------------------------------------ */
  function csvCell(v) { var t = String(v == null ? '' : v); return /[;"\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; }
  function livreRecettesCSV(state, year) {
    var clients = {};
    state.clients.forEach(function (c) { clients[c.id] = c; });
    var rows = [['Date d\'encaissement', 'N° de facture', 'Client', 'Nature de la prestation', 'Montant encaissé (€)', 'Mode de règlement']];
    encaissements(state.docs).filter(function (e) { return !year || e.date.slice(0, 4) === String(year); }).forEach(function (e) {
      var d = e.doc, c = clients[d.clientId];
      var nature = d.objet || (d.lignes && d.lignes[0] ? d.lignes[0].designation : '');
      rows.push([fmtDate(e.date), d.numero || '', c ? c.nom : '', nature, plainNum(e.montant), d.modePaiement || '']);
    });
    return '﻿' + rows.map(function (r) { return r.map(csvCell).join(';'); }).join('\r\n') + '\r\n';
  }

  /* ---------- Devis rapide sans IA (repli) -------------------------------- */
  var UNITES = [
    [/^(h|heures?|hrs?)$/i, 'h'], [/^(j|jours?|journées?)$/i, 'jour'], [/^(m²|m2)$/i, 'm²'], [/^(ml|m\.l\.)$/i, 'ml'],
    [/^(km)$/i, 'km'], [/^(u|unités?|pièces?|pcs?)$/i, 'u'], [/^(séances?|seances?)$/i, 'séance'], [/^(mois)$/i, 'mois']
  ];
  function uniteDe(t) { for (var i = 0; i < UNITES.length; i++) if (UNITES[i][0].test(t)) return UNITES[i][1]; return null; }
  function devisRapide(texte) {
    var parts = String(texte || '').split(/\n|;|,(?!\d)|\s\+\s/).map(function (p) { return p.trim(); }).filter(Boolean);
    var lignes = [];
    parts.forEach(function (p) {
      var qte = 1, unite = 'forfait', pu = 0, m;
      var qm = p.match(/(\d+(?:[.,]\d+)?)\s*(h|heures?|hrs?|j|jours?|journées?|m²|m2|ml|km|u|unités?|pièces?|pcs?|séances?|seances?|mois)(?=$|[\s,.;:/)])/i);
      if (qm) { qte = num(qm[1]); unite = uniteDe(qm[2]) || unite; }
      var am = p.match(/(?:à|a|@|x)\s*(\d[\d\s]*(?:[.,]\d+)?)\s*(?:€|euros?)?(?:\s*(?:\/|par)\s*\S+)?/i);
      var em = p.match(/(\d[\d\s]*(?:[.,]\d+)?)\s*(?:€|euros?)/i);
      if (am && qm) pu = num(am[1].replace(/\s/g, ''));
      else if (em) { pu = num(em[1].replace(/\s/g, '')); if (qm && unite !== 'forfait' && !/(?:à|par|\/)/i.test(p)) { pu = round2(pu / (qte || 1)); } }
      else if (am) pu = num(am[1].replace(/\s/g, ''));
      var designation = p
        .replace(/(?:à|a|@|x)\s*\d[\d\s]*(?:[.,]\d+)?\s*(?:€|euros?)?(?:\s*(?:\/|par)\s*\S+)?/gi, '')
        .replace(/\d[\d\s]*(?:[.,]\d+)?\s*(?:€|euros?)/gi, '')
        .replace(/\s{2,}/g, ' ').replace(/[\s:,\-–]+$/, '').trim();
      if (!designation) designation = 'Prestation';
      designation = designation.charAt(0).toUpperCase() + designation.slice(1);
      lignes.push({ designation: designation, qte: qte, unite: unite, pu: pu });
    });
    return lignes;
  }

  /* ---------- Générateur PDF (A4, polices standard WinAnsi) --------------- */
  var WIDTHS = {
    F1: [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,350,556,350,222,556,333,1000,556,556,333,1000,667,333,1000,350,611,350,350,222,222,333,333,350,556,1000,333,1000,500,333,944,350,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500],
    F2: [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,350,556,350,278,556,500,1000,556,556,333,1000,667,333,1000,350,611,350,350,278,278,500,500,350,556,1000,333,1000,556,333,944,350,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556]
  };
  var CP1252 = { 0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F, 0x202F: 0x20, 0x2009: 0x20, 0x2007: 0x20 };
  function winAnsi(str) {
    var out = '';
    for (var ch of String(str == null ? '' : str)) {
      var cp = ch.codePointAt(0), b;
      if (cp >= 0x20 && cp < 0x7F) b = cp;
      else if (CP1252[cp] !== undefined) b = CP1252[cp];
      else if (cp >= 0xA0 && cp <= 0xFF) b = cp;
      else if (cp === 9 || cp === 10 || cp === 13) b = 0x20;
      else b = 0x3F;
      out += String.fromCharCode(b);
    }
    return out;
  }
  var PT = 72 / 25.4;
  function f(n) { return (Math.round(n * 100) / 100).toString(); }
  function rgb(hex) { var h = hex.replace('#', ''); return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]; }

  function Pdf() { this.H = 841.89; this.Wd = 595.28; this.pages = []; this.addPage(); }
  Pdf.prototype.addPage = function () { this.c = []; this.pages.push(this.c); };
  Pdf.prototype.Y = function (y) { return this.H - y * PT; };
  Pdf.prototype.col = function (hex, stroke) { var c = rgb(hex); this.c.push(f(c[0]) + ' ' + f(c[1]) + ' ' + f(c[2]) + (stroke ? ' RG' : ' rg')); };
  Pdf.prototype.widthPt = function (str, font, size) {
    var s = winAnsi(str), w = 0;
    for (var i = 0; i < s.length; i++) { var b = s.charCodeAt(i); w += font === 'F3' ? 600 : (WIDTHS[font] || WIDTHS.F1)[b - 32] || 556; }
    return w / 1000 * size;
  };
  Pdf.prototype.width = function (str, font, size) { return this.widthPt(str, font, size) / PT; };
  Pdf.prototype.rect = function (x, y, w, h, o) {
    o = o || {};
    if (o.fill) this.col(o.fill);
    if (o.stroke) { this.col(o.stroke, true); this.c.push(f(o.lw || 0.5) + ' w'); }
    this.c.push(f(x * PT) + ' ' + f(this.Y(y + h)) + ' ' + f(w * PT) + ' ' + f(h * PT) + ' re ' + (o.fill && o.stroke ? 'B' : o.fill ? 'f' : 'S'));
  };
  Pdf.prototype.line = function (x1, y1, x2, y2, o) {
    o = o || {};
    this.col(o.color || '#DCE1EA', true);
    this.c.push(f(o.lw || 0.5) + ' w ' + f(x1 * PT) + ' ' + f(this.Y(y1)) + ' m ' + f(x2 * PT) + ' ' + f(this.Y(y2)) + ' l S');
  };
  function pdfEsc(s) { return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }
  Pdf.prototype.text = function (str, x, y, o) {
    o = o || {};
    var font = o.font || 'F1', size = o.size || 10, xx = x * PT;
    var w = this.widthPt(str, font, size);
    if (o.align === 'right') xx -= w; else if (o.align === 'center') xx -= w / 2;
    this.col(o.color || '#14182B');
    this.c.push('BT /' + font + ' ' + f(size) + ' Tf ' + f(xx) + ' ' + f(this.Y(y)) + ' Td (' + pdfEsc(winAnsi(str)) + ') Tj ET');
  };
  Pdf.prototype.wrap = function (str, font, size, maxMm) {
    var out = [];
    String(str || '').split(/\n/).forEach(function (para) {
      var words = para.split(/\s+/).filter(Boolean), line = '';
      words.forEach(function (w) {
        var t = line ? line + ' ' + w : w;
        if (this.width(t, font, size) <= maxMm || !line) line = t; else { out.push(line); line = w; }
      }, this);
      out.push(line);
    }, this);
    return out;
  };
  Pdf.prototype.stamp = function (label, sub, cx, cy, angle, hex) {
    var a = angle * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    var size = 17, sub2 = 8.5;
    var tw = this.widthPt(label, 'F2', size), sw = this.widthPt(sub, 'F2', sub2);
    var w = Math.max(tw, sw) + 26, h = 46;
    var col = rgb(hex), cs = f(col[0]) + ' ' + f(col[1]) + ' ' + f(col[2]);
    this.c.push('q ' + [c, s, -s, c].map(f).join(' ') + ' ' + f(cx * PT) + ' ' + f(this.Y(cy)) + ' cm');
    this.c.push(cs + ' RG 1.8 w ' + f(-w / 2) + ' ' + f(-h / 2) + ' ' + f(w) + ' ' + f(h) + ' re S');
    this.c.push('0.7 w ' + f(-w / 2 + 3) + ' ' + f(-h / 2 + 3) + ' ' + f(w - 6) + ' ' + f(h - 6) + ' re S');
    this.c.push(cs + ' rg BT /F2 ' + size + ' Tf ' + f(-tw / 2) + ' 1.5 Td (' + pdfEsc(winAnsi(label)) + ') Tj ET');
    this.c.push('BT /F2 ' + sub2 + ' Tf ' + f(-sw / 2) + ' -12 Td (' + pdfEsc(winAnsi(sub)) + ') Tj ET');
    this.c.push('Q');
  };
  // QR code : matrice de modules, marge de 4 modules incluse dans sizeMm
  Pdf.prototype.qr = function (M, x, y, sizeMm) {
    var n = M.length, u = sizeMm / (n + 8), ops = ['0 0 0 rg'];
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (!M[r][c]) continue;
        var s0 = c; while (c + 1 < n && M[r][c + 1]) c++;
        ops.push(f((x + (s0 + 4) * u) * PT) + ' ' + f(this.Y(y + (r + 5) * u)) + ' ' + f((c - s0 + 1) * u * PT) + ' ' + f(u * PT + 0.05) + ' re');
      }
    }
    ops.push('f'); this.c.push(ops.join('\n'));
  };
  // Signature : traits normalisés (0..1) dessinés dans un cadre
  Pdf.prototype.strokes = function (sig, x, y, w, h) {
    var ratio = sig.ratio || 3, bw = w, bh = w / ratio;
    if (bh > h) { bh = h; bw = h * ratio; }
    var ox = x + (w - bw) / 2, oy = y + (h - bh) / 2, self = this;
    var ops = ['0.08 0.16 0.55 RG 1.3 w 1 J 1 j'];
    (sig.strokes || []).forEach(function (st) {
      if (!st.length) return;
      st.forEach(function (pt, i) { ops.push(f((ox + pt[0] * bw) * PT) + ' ' + f(self.Y(oy + pt[1] * bh)) + (i ? ' l' : ' m')); });
      if (st.length === 1) ops.push(f((ox + st[0][0] * bw) * PT + 0.5) + ' ' + f(self.Y(oy + st[0][1] * bh)) + ' l');
      ops.push('S');
    });
    this.c.push(ops.join('\n'));
  };
  Pdf.prototype.output = function (title, attachments) {
    var objs = [], self = this;
    var add = function (s) { objs.push(s); return objs.length; };
    add('CATALOG');
    add('PAGES');
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>');
    var info = add('<< /Title (' + pdfEsc(winAnsi(title || 'Document')) + ') /Producer (Picaillon) >>');
    var kids = [];
    this.pages.forEach(function (c) {
      var stream = c.join('\n');
      var cid = add('<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream');
      kids.push(add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + f(self.Wd) + ' ' + f(self.H) + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ' + cid + ' 0 R >>'));
    });
    objs[1] = '<< /Type /Pages /Kids [' + kids.map(function (k) { return k + ' 0 R'; }).join(' ') + '] /Count ' + kids.length + ' >>';
    // Fichiers joints (Factur-X : XML structuré associé au PDF)
    var specs = [];
    (attachments || []).forEach(function (a) {
      var ef = add('<< /Type /EmbeddedFile /Subtype /' + a.mime.replace('/', '#2F') + ' /Length ' + a.data.length + ' /Params << /Size ' + a.data.length + ' >> >>\nstream\n' + a.data + '\nendstream');
      specs.push([a.name, add('<< /Type /Filespec /F (' + a.name + ') /UF (' + a.name + ') /Desc (' + pdfEsc(winAnsi(a.desc || a.name)) + ') /AFRelationship /' + (a.rel || 'Data') + ' /EF << /F ' + ef + ' 0 R /UF ' + ef + ' 0 R >> >>')]);
    });
    objs[0] = '<< /Type /Catalog /Pages 2 0 R' + (specs.length ? ' /Names << /EmbeddedFiles << /Names [' + specs.map(function (x) { return '(' + x[0] + ') ' + x[1] + ' 0 R'; }).join(' ') + '] >> >> /AF [' + specs.map(function (x) { return x[1] + ' 0 R'; }).join(' ') + ']' : '') + ' >>';
    var out = '%PDF-1.7\n%\xE2\xE3\xCF\xD3\n', offs = [];
    objs.forEach(function (o, i) { offs.push(out.length); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
    var xref = out.length;
    out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n';
    offs.forEach(function (o) { out += String(o).padStart(10, '0') + ' 00000 n \n'; });
    out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R /Info ' + info + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
    var bytes = new Uint8Array(out.length);
    for (var i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xFF;
    return bytes;
  };

  /* ---------- Mise en page facture / devis -------------------------------- */
  var C = { ink: '#14182B', muted: '#5B6276', line: '#D5DBE6', fill: '#F1F4F9', accent: '#2340D8', ok: '#13795B' };
  function vendeurLignes(s) {
    var l = [];
    if (s.nomCommercial) l.push(s.nomCommercial);
    (s.adresse || '').split('\n').forEach(function (x) { if (x.trim()) l.push(x.trim()); });
    if (s.siret) l.push('SIRET ' + s.siret);
    if (s.email) l.push(s.email);
    if (s.tel) l.push(s.tel);
    return l;
  }
  // Nature des opérations (mention obligatoire des factures électroniques) : biens, services ou les deux.
  // s.natureOp : 'biens' | 'services' | 'mixte' ; vide = déduite de l'activité principale.
  var NATURES = { biens: 'livraison de biens', services: 'prestation de services', mixte: 'livraison de biens et prestation de services' };
  function natureOperation(s) {
    if (s && NATURES[s.natureOp]) return NATURES[s.natureOp];
    return (s && s.activite === 'vente') ? NATURES.biens : NATURES.services;
  }
  function documentPDF(d, client, s, opts) {
    opts = opts || {};
    var pdf = new Pdf(), L = 18, R = 192, isF = d.type === 'facture', isA = d.type === 'avoir', isFL = isF || isA;
    var y = 22;
    // Vendeur
    pdf.text((s.nom || 'Votre nom') + ' EI', L, y, { font: 'F2', size: 14 });
    var vy = y + 6;
    vendeurLignes(s).forEach(function (t) { pdf.text(t, L, vy, { size: 9, color: C.muted }); vy += 4.6; });
    // Titre
    var titre = isA ? 'AVOIR' : isF ? (d.typeFacture === 'acompte' ? 'FACTURE D\'ACOMPTE' : 'FACTURE') : 'DEVIS';
    pdf.text(titre, R, y + 1, { font: 'F2', size: titre.length > 8 ? 17 : 24, color: C.accent, align: 'right' });
    pdf.text(d.numero || 'BROUILLON', R, y + 9, { font: 'F2', size: 11, align: 'right' });
    var meta = [['Date', fmtDate(d.date)]];
    if (d.datePrestation) meta.push([isFL ? 'Prestation' : 'Début prévu', fmtDate(d.datePrestation)]);
    if (isF && d.echeance) meta.push(['Échéance', fmtDate(d.echeance)]);
    if (!isFL && d.validite) meta.push(['Valable jusqu\'au', fmtDate(d.validite)]);
    var my = y + 16;
    meta.forEach(function (m) {
      pdf.text(m[0], R - 26, my, { size: 9, color: C.muted, align: 'right' });
      pdf.text(m[1], R, my, { size: 9, font: 'F2', align: 'right' });
      my += 4.8;
    });
    // Client
    y = Math.max(vy, my) + 8;
    var cx = 112, cw = R - cx, cl = [];
    if (client) {
      cl.push([client.nom || '', 'F2']);
      (client.adresse || '').split('\n').forEach(function (x) { if (x.trim()) cl.push([x.trim(), 'F1']); });
      if (client.type === 'pro' && client.siren) cl.push(['SIREN ' + client.siren, 'F1']);
      if (client.email) cl.push([client.email, 'F1']);
    }
    var ch = 10 + cl.length * 4.8;
    pdf.rect(cx, y, cw, ch, { fill: C.fill });
    pdf.text(isF ? 'FACTURÉ À' : 'CLIENT', cx + 4, y + 5.5, { size: 7.5, font: 'F2', color: C.muted });
    cl.forEach(function (t, i) { pdf.text(t[0], cx + 4, y + 11 + i * 4.8, { size: 9.5, font: t[1] }); });
    y += ch + 7;
    if (d.adresseIntervention) {
      pdf.wrap('Lieu d\'intervention ou de livraison : ' + String(d.adresseIntervention).replace(/\n+/g, ', '), 'F1', 9, R - L).forEach(function (t) { pdf.text(t, L, y, { size: 9, color: C.muted }); y += 4.4; });
      y += 2;
    }
    if (isA && d.origine) { pdf.text('Avoir sur la facture ' + d.origine.numero + ' du ' + fmtDate(d.origine.date), L, y, { size: 10, font: 'F2', color: C.accent }); y += 6; }
    if (d.objet) { pdf.text('Objet : ' + d.objet, L, y, { size: 10, font: 'F2' }); y += 8; } else y += 2;
    // Tableau
    var cols = { des: L, qte: 128, unite: 131, pu: 166, tot: R };
    var header = function () {
      pdf.rect(L, y - 5, R - L, 8, { fill: C.ink });
      pdf.text('Désignation', cols.des + 3, y, { size: 8.5, font: 'F2', color: '#FFFFFF' });
      pdf.text('Qté', cols.qte, y, { size: 8.5, font: 'F2', color: '#FFFFFF', align: 'right' });
      pdf.text('Unité', cols.unite, y, { size: 8.5, font: 'F2', color: '#FFFFFF' });
      pdf.text('Prix unit. HT', cols.pu, y, { size: 8.5, font: 'F2', color: '#FFFFFF', align: 'right' });
      pdf.text('Montant HT', cols.tot - 3, y, { size: 8.5, font: 'F2', color: '#FFFFFF', align: 'right' });
      y += 9;
    };
    header();
    (d.lignes || []).forEach(function (l) {
      var lines = pdf.wrap(l.designation || '', 'F1', 9.5, cols.qte - cols.des - 18);
      var h = lines.length * 4.6 + 3.4;
      if (y + h > 250) { pdf.addPage(); y = 24; header(); }
      lines.forEach(function (t, i) { pdf.text(t, cols.des + 3, y + i * 4.6, { size: 9.5 }); });
      pdf.text(plainNum(l.qte).replace(/,00$/, ''), cols.qte, y, { size: 9.5, align: 'right' });
      pdf.text(l.unite || '', cols.unite, y, { size: 9.5, color: C.muted });
      pdf.text(plainNum(l.pu) + ' €', cols.pu, y, { size: 9.5, align: 'right' });
      pdf.text(plainNum(ligneTotal(l)) + ' €', cols.tot - 3, y, { size: 9.5, font: 'F2', align: 'right' });
      y += h;
      pdf.line(L, y - 3.2, R, y - 3.2);
    });
    // Totaux
    if (y > 222) { pdf.addPage(); y = 24; }
    y += 4;
    var tx = 120, total = docTotal(d);
    pdf.text('Total HT', tx, y, { size: 9.5, color: C.muted });
    pdf.text(plainNum(total) + ' €', R - 3, y, { size: 9.5, align: 'right' });
    y += 5.5;
    pdf.text('TVA', tx, y, { size: 9.5, color: C.muted });
    pdf.text('Non applicable', R - 3, y, { size: 9.5, align: 'right', color: C.muted });
    y += 4;
    pdf.rect(tx - 3, y, R - tx + 3, 11, { fill: C.accent });
    pdf.text(isA ? 'Montant de l\'avoir' : isF ? 'Net à payer' : 'Total', tx, y + 7.2, { size: 11, font: 'F2', color: '#FFFFFF' });
    pdf.text(plainNum(total) + ' €', R - 3, y + 7.2, { size: 12, font: 'F2', color: '#FFFFFF', align: 'right' });
    var stampY = y - 1.5;
    y += 20;
    // Conditions
    var cond = [];
    if (isF) {
      if (d.statut === 'payee') cond.push('Facture acquittée le ' + fmtDate(d.datePaiement) + (d.modePaiement ? ' (' + d.modePaiement.toLowerCase() + ').' : '.'));
      else {
        cond.push('Conditions de paiement : ' + (d.echeance && d.date && d.echeance !== d.date ? 'à régler avant le ' + fmtDate(d.echeance) + '.' : 'à réception de facture.'));
        if (s.iban) cond.push('Règlement par virement : IBAN ' + s.iban + (s.bic ? ' · BIC ' + s.bic : ''));
      }
      cond.push('Opération : ' + natureOperation(s) + '.');
    } else if (isA) {
      cond.push(d.statut === 'rembourse' ? 'Montant remboursé le ' + fmtDate(d.datePaiement) + '.' : (d.statut === 'a_rembourser' ? 'Cet avoir sera remboursé au client.' : 'Cet avoir annule la facture ' + (d.origine ? d.origine.numero : '') + '.'));
      cond.push('Opération : ' + natureOperation(s) + '.');
    } else {
      cond.push('Devis gratuit, valable jusqu\'au ' + fmtDate(d.validite) + '.' + (d.acompte ? ' Acompte de ' + d.acompte + ' % à la signature.' : ''));
    }
    if (d.notes) cond = cond.concat(pdf.wrap(d.notes, 'F1', 9, R - L));
    cond.forEach(function (t) { pdf.text(t, L, y, { size: 9 }); y += 4.8; });
    // Payer : lien en ligne et QR code de virement
    var aPayer = isF && d.statut !== 'payee' && d.statut !== 'annulee' && total > 0;
    if (aPayer && s.lienPaiement) { pdf.text('Payer en ligne : ' + s.lienPaiement, L, y, { size: 9, font: 'F2', color: C.accent }); y += 5.5; }
    if (aPayer && s.iban && opts.qr) {
      if (y > 228) { pdf.addPage(); y = 24; }
      y += 2;
      pdf.rect(L, y, 34, 34, { stroke: C.line, lw: 0.6 });
      pdf.qr(opts.qr, L + 1, y + 1, 32);
      pdf.text('Payer par virement', L + 39, y + 8, { size: 9.5, font: 'F2' });
      pdf.wrap('Scannez ce code avec votre application bancaire : le bénéficiaire, l\'IBAN, le montant (' + plainNum(total) + ' €) et la référence ' + (d.numero || '') + ' se remplissent tout seuls.', 'F1', 8.5, 72).forEach(function (t, i) { pdf.text(t, L + 39, y + 13 + i * 4, { size: 8.5, color: C.muted }); });
      y += 38;
    }
    // Signature du devis
    if (!isFL) {
      y += 3;
      if (y > 236) { pdf.addPage(); y = 24; }
      var bx = R - 80, bw2 = 80, bh2 = 34;
      pdf.rect(bx, y, bw2, bh2, { stroke: C.line, lw: 0.8 });
      pdf.text('Bon pour accord', bx + 3, y + 5.5, { size: 8.5, font: 'F2' });
      if (d.signature) {
        pdf.strokes(d.signature, bx + 4, y + 8, bw2 - 8, bh2 - 15);
        pdf.text('Signé par ' + d.signature.nom + ' le ' + fmtDate(d.signature.date) + (d.signature.heure ? ' à ' + d.signature.heure : ''), bx + 3, y + bh2 - 3, { size: 7.5, color: C.muted });
      } else pdf.text('Date et signature du client', bx + 3, y + 10, { size: 8, color: C.muted });
      y += bh2 + 4;
    }
    if (isF && d.statut === 'payee' && d.datePaiement) pdf.stamp('ACQUITTÉE', 'LE ' + fmtDate(d.datePaiement) + (d.modePaiement ? ' · ' + d.modePaiement.toUpperCase() : ''), 62, stampY, 9, C.ok);
    if (isF && d.statut === 'annulee') pdf.stamp('ANNULÉE', 'PAR AVOIR', 62, stampY, 9, '#BE3627');
    if (isA && d.statut === 'rembourse') pdf.stamp('REMBOURSÉ', 'LE ' + fmtDate(d.datePaiement), 62, stampY, 9, C.ok);
    if (d.type === 'devis' && d.statut === 'accepte') pdf.stamp('ACCEPTÉ', d.dateAcceptation ? 'LE ' + fmtDate(d.dateAcceptation) : 'BON POUR ACCORD', 62, stampY, 9, C.ok);
    // Mentions légales en pied de page
    var m = [s.mentionTva || MENTION_TVA + '.'];
    if (isF) {
      m.push('En cas de retard de paiement, pénalités au taux de trois fois le taux d\'intérêt légal. Pas d\'escompte pour paiement anticipé.');
      if (client && client.type === 'pro') m.push('Indemnité forfaitaire pour frais de recouvrement : 40 € (art. L441-10 du Code de commerce).');
    }
    if (s.assurance) m.push('Assurance professionnelle : ' + s.assurance);
    if (opts.xml) m.push('Données de facture électronique Factur-X (EN 16931) jointes à ce PDF.');
    var lines = [];
    m.forEach(function (t) { lines = lines.concat(pdf.wrap(t, 'F1', 7.5, R - L)); });
    var fy = 297 - 14 - lines.length * 3.6;
    pdf.line(L, fy - 4, R, fy - 4, { color: C.line });
    lines.forEach(function (t, i) { pdf.text(t, L, fy + i * 3.6, { size: 7.5, color: C.muted }); });
    pdf.text('Créé avec Picaillon', R, 297 - 8, { size: 6.5, color: '#9AA3B5', align: 'right' });
    var att = opts.xml ? [{ name: 'factur-x.xml', mime: 'text/xml', data: utf8bin(opts.xml), desc: 'Factur-X', rel: 'Alternative' }] : [];
    return pdf.output(titre.charAt(0) + titre.slice(1).toLowerCase() + ' ' + (d.numero || ''), att);
  }
  function utf8bin(str) { return unescape(encodeURIComponent(str)); }

  /* ---------- Factur-X : XML CII, profil EN 16931 -------------------------- */
  function xesc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function d102(iso) { return String(iso || '').replace(/-/g, ''); }
  function amt(n) { return (Math.round((+n + Number.EPSILON) * 100) / 100).toFixed(2); }
  var UNITES_CEFACT = { 'h': 'HUR', 'jour': 'DAY', 'm²': 'MTK', 'ml': 'MTR', 'u': 'C62', 'km': 'KMT', 'forfait': 'C62', 'séance': 'C62', 'mois': 'MON' };
  function adresseXML(adr) {
    var lines = String(adr || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
    var cp = '', ville = '', last = lines[lines.length - 1] || '', m = last.match(/^(\d{5})\s+(.+)$/);
    if (m) { cp = m[1]; ville = m[2]; lines.pop(); }
    return '<ram:PostalTradeAddress>' + (cp ? '<ram:PostcodeCode>' + cp + '</ram:PostcodeCode>' : '') +
      (lines[0] ? '<ram:LineOne>' + xesc(lines[0]) + '</ram:LineOne>' : '') + (lines[1] ? '<ram:LineTwo>' + xesc(lines[1]) + '</ram:LineTwo>' : '') +
      (ville ? '<ram:CityName>' + xesc(ville) + '</ram:CityName>' : '') + '<ram:CountryID>FR</ram:CountryID></ram:PostalTradeAddress>';
  }
  function facturXML(d, client, s) {
    var isA = d.type === 'avoir', sign = isA ? -1 : 1, total = docTotal(d) * sign;
    var type = isA ? '381' : d.typeFacture === 'acompte' ? '386' : '380';
    var mention = s.mentionTva || MENTION_TVA;
    var siren = String(s.siret || '').replace(/\D/g, '').slice(0, 9);
    var lines = (d.lignes || []).map(function (l, i) {
      var q = num(l.qte), pu = num(l.pu) * sign, lt = ligneTotal(l) * sign;
      if (q < 0) { q = -q; pu = -pu; }
      return '<ram:IncludedSupplyChainTradeLineItem><ram:AssociatedDocumentLineDocument><ram:LineID>' + (i + 1) + '</ram:LineID></ram:AssociatedDocumentLineDocument>' +
        '<ram:SpecifiedTradeProduct><ram:Name>' + xesc(l.designation) + '</ram:Name></ram:SpecifiedTradeProduct>' +
        '<ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>' + amt(pu) + '</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>' +
        '<ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="' + (UNITES_CEFACT[l.unite] || 'C62') + '">' + (+q.toFixed(4)) + '</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>' +
        '<ram:SpecifiedLineTradeSettlement><ram:ApplicableTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>E</ram:CategoryCode><ram:RateApplicablePercent>0</ram:RateApplicablePercent></ram:ApplicableTradeTax>' +
        '<ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>' + amt(lt) + '</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation></ram:SpecifiedLineTradeSettlement></ram:IncludedSupplyChainTradeLineItem>';
    }).join('');
    var buyer = client ? '<ram:BuyerTradeParty><ram:Name>' + xesc(client.nom) + '</ram:Name>' +
      (client.type === 'pro' && client.siren ? '<ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">' + String(client.siren).replace(/\D/g, '') + '</ram:ID></ram:SpecifiedLegalOrganization>' : '') +
      adresseXML(client.adresse) + (client.email ? '<ram:URIUniversalCommunication><ram:URIID schemeID="EM">' + xesc(client.email) + '</ram:URIID></ram:URIUniversalCommunication>' : '') + '</ram:BuyerTradeParty>' : '';
    return '<?xml version="1.0" encoding="UTF-8"?>\n<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">' +
      '<rsm:ExchangedDocumentContext><ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>urn:cen.eu:en16931:2017</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter></rsm:ExchangedDocumentContext>' +
      '<rsm:ExchangedDocument><ram:ID>' + xesc(d.numero || '') + '</ram:ID><ram:TypeCode>' + type + '</ram:TypeCode><ram:IssueDateTime><udt:DateTimeString format="102">' + d102(d.date) + '</udt:DateTimeString></ram:IssueDateTime>' +
      '<ram:IncludedNote><ram:Content>' + xesc(mention) + '</ram:Content></ram:IncludedNote></rsm:ExchangedDocument>' +
      '<rsm:SupplyChainTradeTransaction>' + lines +
      '<ram:ApplicableHeaderTradeAgreement><ram:SellerTradeParty><ram:Name>' + xesc((s.nom || '') + ' EI') + '</ram:Name>' +
      (siren ? '<ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">' + siren + '</ram:ID>' + (s.nomCommercial ? '<ram:TradingBusinessName>' + xesc(s.nomCommercial) + '</ram:TradingBusinessName>' : '') + '</ram:SpecifiedLegalOrganization>' : '') +
      adresseXML(s.adresse) + (s.email ? '<ram:URIUniversalCommunication><ram:URIID schemeID="EM">' + xesc(s.email) + '</ram:URIID></ram:URIUniversalCommunication>' : '') + '</ram:SellerTradeParty>' + buyer + '</ram:ApplicableHeaderTradeAgreement>' +
      '<ram:ApplicableHeaderTradeDelivery>' + (d.adresseIntervention ? '<ram:ShipToTradeParty>' + adresseXML(d.adresseIntervention) + '</ram:ShipToTradeParty>' : '') +
      (d.datePrestation ? '<ram:ActualDeliverySupplyChainEvent><ram:OccurrenceDateTime><udt:DateTimeString format="102">' + d102(d.datePrestation) + '</udt:DateTimeString></ram:OccurrenceDateTime></ram:ActualDeliverySupplyChainEvent>' : '') + '</ram:ApplicableHeaderTradeDelivery>' +
      '<ram:ApplicableHeaderTradeSettlement><ram:PaymentReference>' + xesc(d.numero || '') + '</ram:PaymentReference><ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>' +
      (s.iban && !isA ? '<ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>58</ram:TypeCode><ram:PayeePartyCreditorFinancialAccount><ram:IBANID>' + String(s.iban).replace(/\s+/g, '') + '</ram:IBANID></ram:PayeePartyCreditorFinancialAccount></ram:SpecifiedTradeSettlementPaymentMeans>' : '') +
      '<ram:ApplicableTradeTax><ram:CalculatedAmount>0.00</ram:CalculatedAmount><ram:TypeCode>VAT</ram:TypeCode><ram:ExemptionReason>' + xesc(mention) + '</ram:ExemptionReason><ram:BasisAmount>' + amt(total) + '</ram:BasisAmount><ram:CategoryCode>E</ram:CategoryCode><ram:ExemptionReasonCode>VATEX-FR-FRANCHISE</ram:ExemptionReasonCode><ram:RateApplicablePercent>0</ram:RateApplicablePercent></ram:ApplicableTradeTax>' +
      (!isA && d.echeance ? '<ram:SpecifiedTradePaymentTerms><ram:DueDateDateTime><udt:DateTimeString format="102">' + d102(d.echeance) + '</udt:DateTimeString></ram:DueDateDateTime></ram:SpecifiedTradePaymentTerms>' : '') +
      '<ram:SpecifiedTradeSettlementHeaderMonetarySummation><ram:LineTotalAmount>' + amt(total) + '</ram:LineTotalAmount><ram:TaxBasisTotalAmount>' + amt(total) + '</ram:TaxBasisTotalAmount><ram:TaxTotalAmount currencyID="EUR">0.00</ram:TaxTotalAmount><ram:GrandTotalAmount>' + amt(total) + '</ram:GrandTotalAmount><ram:DuePayableAmount>' + amt(d.statut === 'payee' ? 0 : total) + '</ram:DuePayableAmount></ram:SpecifiedTradeSettlementHeaderMonetarySummation>' +
      (isA && d.origine ? '<ram:InvoiceReferencedDocument><ram:IssuerAssignedID>' + xesc(d.origine.numero) + '</ram:IssuerAssignedID><ram:FormattedIssueDateTime><qdt:DateTimeString format="102">' + d102(d.origine.date) + '</qdt:DateTimeString></ram:FormattedIssueDateTime></ram:InvoiceReferencedDocument>' : '') +
      '</ram:ApplicableHeaderTradeSettlement></rsm:SupplyChainTradeTransaction></rsm:CrossIndustryInvoice>\n';
  }

  /* ---------- Relevé bancaire : lecture CSV / OFX et rapprochement --------- */
  function sansAccent(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase(); }
  function montantTexte(t) {
    var v = String(t == null ? '' : t).replace(/[\s  €]/g, '').replace(/^\((.*)\)$/, '-$1');
    if (!v) return null;
    var lc = v.lastIndexOf(','), ld = v.lastIndexOf('.');
    if (lc > ld) v = v.replace(/\./g, '').replace(',', '.'); else v = v.replace(/,/g, '');
    var n = parseFloat(v);
    return isFinite(n) ? n : null;
  }
  function dateTexte(t) {
    var v = String(t || '').trim(), m;
    if ((m = v.match(/^(\d{4})-(\d{2})-(\d{2})/))) return m[1] + '-' + m[2] + '-' + m[3];
    if ((m = v.match(/^(\d{4})(\d{2})(\d{2})/))) return m[1] + '-' + m[2] + '-' + m[3];
    if ((m = v.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/))) {
      var y = m[3].length === 2 ? '20' + m[3] : m[3];
      return y + '-' + pad(+m[2]) + '-' + pad(+m[1]);
    }
    return null;
  }
  function csvLigne(line, sep) {
    var out = [], cur = '', q = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === sep) { out.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    out.push(cur.trim());
    return out;
  }
  function parseReleve(texte) {
    var t = String(texte || '').replace(/^﻿/, '');
    if (/<STMTTRN>/i.test(t)) {
      return t.split(/<STMTTRN>/i).slice(1).map(function (b) {
        var g = function (tag) { var m = b.match(new RegExp('<' + tag + '>([^<\\r\\n]*)', 'i')); return m ? m[1].trim() : ''; };
        return { date: dateTexte(g('DTPOSTED')), montant: montantTexte(g('TRNAMT')), libelle: [g('NAME'), g('MEMO')].filter(Boolean).join(' ') };
      }).filter(function (o) { return o.date && o.montant !== null; });
    }
    var lines = t.split(/\r?\n/).filter(function (l) { return l.trim(); });
    if (!lines.length) return [];
    var sample = lines.slice(0, 15).join('\n');
    var seps = [';', '\t', ','], sep = seps.sort(function (a, b) { return sample.split(b).length - sample.split(a).length; })[0];
    var rows = lines.map(function (l) { return csvLigne(l, sep); });
    var hi = -1;
    for (var i = 0; i < Math.min(rows.length, 30); i++) {
      var h = sansAccent(rows[i].join('|'));
      if (/DATE/.test(h) && /(MONTANT|CREDIT|DEBIT|AMOUNT|SOMME)/.test(h)) { hi = i; break; }
    }
    var col = { date: -1, lib: -1, mt: -1, cr: -1, db: -1 };
    if (hi >= 0) {
      rows[hi].forEach(function (c, j) {
        var h = sansAccent(c);
        if (/DATE/.test(h) && (col.date < 0 || /(OPERATION|COMPTA)/.test(h)) && !/VALEUR/.test(h)) col.date = j;
        else if (/DATE/.test(h) && col.date < 0) col.date = j;
        if (/(LIBELL|DESCRI|LABEL|DETAIL|INTITUL|NATURE|OPERATION$)/.test(h) && !/DATE/.test(h) && col.lib < 0) col.lib = j;
        if (/CREDIT/.test(h)) col.cr = j;
        if (/DEBIT/.test(h)) col.db = j;
        if (/(MONTANT|AMOUNT|SOMME)/.test(h) && col.mt < 0) col.mt = j;
      });
    } else { col.date = 0; col.lib = 1; col.mt = rows[0].length - 1; }
    return rows.slice(hi + 1).map(function (r) {
      var mt = null;
      if (col.cr >= 0 && montantTexte(r[col.cr]) !== null) mt = Math.abs(montantTexte(r[col.cr]));
      else if (col.db >= 0 && montantTexte(r[col.db]) !== null) mt = -Math.abs(montantTexte(r[col.db]));
      else if (col.mt >= 0) mt = montantTexte(r[col.mt]);
      return { date: dateTexte(r[col.date]), montant: mt, libelle: col.lib >= 0 ? r[col.lib] || '' : r.filter(function (_, j) { return j !== col.date && j !== col.mt; }).join(' ') };
    }).filter(function (o) { return o.date && o.montant !== null; });
  }
  // Associe les crédits du relevé aux factures en attente (montant identique, puis référence et nom du client)
  function rapprocher(credits, factures, clients) {
    var noms = {};
    (clients || []).forEach(function (c) { noms[c.id] = sansAccent(c.nom).split(/[^A-Z0-9]+/).filter(function (w) { return w.length >= 4 && ['MADAME', 'MONSIEUR', 'SOCIETE', 'AGENCE'].indexOf(w) < 0; }); });
    var pairs = [];
    factures.forEach(function (f) {
      var tot = docTotal(f), ref = sansAccent(f.numero || '').replace(/[^A-Z0-9]/g, '');
      credits.forEach(function (cr, ci) {
        if (!(cr.montant > 0) || Math.abs(cr.montant - tot) > 0.005) return;
        if (f.date && cr.date < addDays(f.date, -5)) return;
        var lib = sansAccent(cr.libelle), libc = lib.replace(/[^A-Z0-9]/g, ''), score = 1, why = ['même montant'];
        if (ref && libc.indexOf(ref) >= 0) { score += 3; why.push('référence ' + f.numero); }
        if ((noms[f.clientId] || []).some(function (w) { return lib.indexOf(w) >= 0; })) { score += 2; why.push('nom du client'); }
        score -= Math.min(Math.abs(daysBetween(f.echeance || f.date, cr.date)), 90) / 200;
        pairs.push({ facture: f, credit: cr, ci: ci, score: score, raisons: why });
      });
    });
    pairs.sort(function (a, b) { return b.score - a.score; });
    var usedF = {}, usedC = {}, out = [];
    pairs.forEach(function (p) {
      if (usedF[p.facture.id] || usedC[p.ci]) return;
      usedF[p.facture.id] = usedC[p.ci] = true;
      out.push({ facture: p.facture, credit: p.credit, sur: p.score >= 2.5, raisons: p.raisons });
    });
    return out;
  }

  var api = {
    ACTIVITES: ACTIVITES, ANNEE_REF: ANNEE_REF, MENTION_TVA: MENTION_TVA, MOIS: MOIS, MOIS_COURT: MOIS_COURT, ACRE_BASCULE: ACRE_BASCULE,
    pad: pad, iso: iso, parse: parse, addDays: addDays, daysBetween: daysBetween, todayIso: todayIso, fmtDate: fmtDate, fmtDateLong: fmtDateLong, lastDay: lastDay,
    round2: round2, num: num, eur: eur, plainNum: plainNum,
    ligneTotal: ligneTotal, docTotal: docTotal, nextNumero: nextNumero, etat: etat,
    acreInfo: acreInfo, activite: activite, tauxAt: tauxAt, encaissements: encaissements, cotisations: cotisations,
    periodKey: periodKey, periodInfo: periodInfo, periodShift: periodShift, declarations: declarations, prochaineDeclaration: prochaineDeclaration,
    prorata: prorata, dashboard: dashboard, brutPourNet: brutPourNet, livreRecettesCSV: livreRecettesCSV, devisRapide: devisRapide,
    winAnsi: winAnsi, Pdf: Pdf, documentPDF: documentPDF, facturXML: facturXML, natureOperation: natureOperation,
    parseReleve: parseReleve, rapprocher: rapprocher, montantTexte: montantTexte, dateTexte: dateTexte
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Core = api;
})(this);
