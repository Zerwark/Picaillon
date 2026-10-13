/* ==========================================================================
   Picaillon — interface
   ========================================================================== */
(function () {
  'use strict';
  var C = window.Core, Demo = window.Demo;
  var KEY = 'encaisse:v1';
  var DEFAULT_SETTINGS = {
    nom: '', nomCommercial: '', adresse: '', siret: '', email: '', tel: '', iban: '', bic: '', assurance: '',
    activite: 'service', dateCreation: '', acre: false, vl: false, periodicite: 'trimestrielle',
    delaiPaiement: 30, validiteDevis: 30, mentionTva: '', declarations: {}, charges: []
  };
  var MODES = ['Virement', 'Chèque', 'Espèces', 'Carte bancaire', 'Autre'];
  var UNITES = ['forfait', 'h', 'jour', 'm²', 'ml', 'u', 'km', 'séance', 'mois'];

  /* ---------- Outils ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function uid() { return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-5); }
  function today() { return C.todayIso(); }
  function eur(n, dec) { return C.eur(n, dec); }
  function pct(n) { return String(C.round2(n)).replace('.', ',') + ' %'; }
  function hasClaude() { return typeof window.claude !== 'undefined' && window.claude && typeof window.claude.use === 'function'; }
  // Version web autonome (site) : réglages passés par des attributs data-* sur #app
  var CFG = (function () { var el = document.getElementById('app'); return (el && el.dataset) || {}; })();
  var WEB = !hasClaude();
  var SITE = WEB && CFG.web != null;
  function lsGet(k) { try { return localStorage.getItem(KEY + ':' + k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(KEY + ':' + k); else localStorage.setItem(KEY + ':' + k, String(v)); } catch (e) { /* rien */ } }
  var SHARE = (function () {
    if (!WEB) return false;
    try { return !!(navigator.share && navigator.canShare && navigator.canShare({ files: [new File([new Uint8Array([37])], 'test.pdf', { type: 'application/pdf' })] })); } catch (e) { return false; }
  })();
  var IOS = /iphone|ipad|ipod/i.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function standalone() { try { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } }
  function prenom(s) { return (s.nom || '').trim().split(/\s+/)[0] || ''; }
  function slug(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40); }

  var I = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
    bank: '<path d="M3 9.5 12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/>',
    back: '<path d="M15 18l-6-6 6-6"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    dl: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    send: '<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/>',
    bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    dup: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    alert: '<path d="M12 3 2 20h20zM12 10v4M12 17v.5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    next: '<path d="M9 18l6-6-6-6"/>',
    share: '<path d="M12 15V3M7.5 7.5 12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
    phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 7 8.5-7"/>'
  };
  function icon(n, s) { s = s || 20; return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + I[n] + '</svg>'; }
  var LOGO = '<svg width="30" height="30" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="15" fill="var(--accent)"/><rect x="16" y="13" width="10.5" height="38" rx="5.25" fill="var(--accent-ink)"/><circle cx="35" cy="27" r="14" fill="var(--accent-ink)"/><circle cx="35" cy="27" r="8.4" fill="none" stroke="var(--accent)" stroke-width="3.2"/></svg>';
  var WORDMARK = '<svg class="wordmark" viewBox="0 0 7815 2478" role="img" aria-label="Picaillon"><path d="M96 1984H456V1502H704C1049 1502 1267 1307 1267 998C1267 689 1051 494 706 494H96ZM456 1203V792H681C825 792 916 871 916 998C916 1124 825 1203 681 1203Z M1353.8 1984H1697.8V928H1353.8Z M2340.6 2008C2639.6 2008 2851.6 1824 2858.6 1566H2525.6C2512.6 1669 2449.6 1735 2347.6 1735C2219.6 1735 2143.6 1629 2143.6 1456C2143.6 1283 2218.6 1177 2347.6 1177C2449.6 1177 2515.6 1242 2526.6 1343H2858.6C2843.6 1084 2634.6 904 2340.6 904C2013.6 904 1794.6 1128 1794.6 1456C1794.6 1785 2013.6 2008 2340.6 2008Z M3274.3999999999996 2002C3423.3999999999996 2002 3518.3999999999996 1950 3581.3999999999996 1836H3585.3999999999996V1984H3921.3999999999996V1273C3921.3999999999996 1040 3752.3999999999996 905 3445.3999999999996 905C3139.3999999999996 905 2966.3999999999996 1041 2951.3999999999996 1270H3271.3999999999996C3278.3999999999996 1198 3337.3999999999996 1152 3433.3999999999996 1152C3524.3999999999996 1152 3580.3999999999996 1195 3580.3999999999996 1258V1263C3580.3999999999996 1326 3511.3999999999996 1341 3322.3999999999996 1357C3097.3999999999996 1375 2912.3999999999996 1452 2912.3999999999996 1689C2912.3999999999996 1899 3063.3999999999996 2002 3274.3999999999996 2002ZM3379.3999999999996 1777C3295.3999999999996 1777 3238.3999999999996 1738 3238.3999999999996 1673C3238.3999999999996 1604 3304.3999999999996 1566 3396.3999999999996 1552C3481.3999999999996 1538 3546.3999999999996 1525 3583.3999999999996 1508V1604C3583.3999999999996 1708 3494.3999999999996 1777 3379.3999999999996 1777Z M4062.2 1984H4406.2V928H4062.2Z M4891.0 494H4547.0V1984H4891.0Z M5375.8 494H5031.8V1984H5375.8Z M6028.6 2008C6359.6 2008 6583.6 1791 6583.6 1456C6583.6 1123 6359.6 904 6028.6 904C5697.6 904 5472.6 1123 5472.6 1456C5472.6 1791 5697.6 2008 6028.6 2008ZM6028.6 1734C5907.6 1734 5821.6 1635 5821.6 1456C5821.6 1278 5908.6 1178 6028.6 1178C6148.6 1178 6235.6 1278 6235.6 1456C6235.6 1635 6148.6 1734 6028.6 1734Z M7024.400000000001 1410C7024.400000000001 1266 7094.400000000001 1199 7203.400000000001 1199C7312.400000000001 1199 7375.400000000001 1267 7375.400000000001 1392V1984H7719.400000000001V1320C7719.400000000001 1060 7585.400000000001 905 7356.400000000001 905C7197.400000000001 905 7090.400000000001 978 7020.400000000001 1099V928H6680.400000000001V1984H7024.400000000001Z" fill="currentColor"/><circle cx="1525" cy="652" r="212" fill="var(--accent)"/><circle cx="4234" cy="652" r="190" fill="currentColor"/></svg>';

  /* ---------- État ---------- */
  var S = {
    mode: 'demo', storage: hasClaude() ? 'pending' : 'local', demo: null, real: null, forcedDemo: false,
    view: 'home', param: null, draft: null, form: null, modal: null,
    filter: 'tous', q: '', cq: '', year: null, calc: '2000', ai: null, caps: {}, dirty: false
  };
  function data() { return S.mode === 'demo' ? S.demo : S.real; }
  function st() { return data().settings; }
  function findDoc(id) { return data().docs.find(function (d) { return d.id === id; }); }
  function findClient(id) { return data().clients.find(function (c) { return c.id === id; }); }
  function normalize(o) {
    return {
      settings: Object.assign({}, DEFAULT_SETTINGS, (o && o.settings) || {}),
      clients: (o && Array.isArray(o.clients)) ? o.clients : [],
      docs: (o && Array.isArray(o.docs)) ? o.docs : []
    };
  }

  /* ---------- Stockage ---------- */
  var Store = {
    db: null, uid: null, unsub: null, queues: {},
    col: function () { return this.db.collection('data/users/' + this.uid); },
    boot: function () {
      var self = this;
      if (!hasClaude()) { self.loadLocal(); return; }
      window.claude.use('downloads').then(function (d) { S.caps.downloads = d; if (!d) render(); }, function () { S.caps.downloads = null; });
      window.claude.use('sample').then(function (f) { S.caps.sample = f; }, function () { S.caps.sample = null; });
      window.claude.use('mcp').then(function (m) { S.caps.mcp = m; if (S.modal) render(); }, function () { S.caps.mcp = null; });
      Promise.all([window.claude.use('db'), window.claude.use('user')]).then(function (r) {
        var db = r[0], user = r[1];
        if (!db || !user) { self.loadLocal(); return; }
        return user.id().then(function (id) {
          if (!id) { self.loadLocal(); return; }
          self.db = db; self.uid = id; S.storage = 'cloud';
          self.unsub = self.col().onSnapshot(function (snap) { self.onSnap(snap); }, function () {
            S.storage = 'local'; self.loadLocal();
            toast('Connexion à votre espace perdue : les modifications restent sur cet appareil.');
          });
        });
      }).catch(function () { self.loadLocal(); });
    },
    loadLocal: function () {
      S.storage = 'local';
      var saved = null;
      try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { saved = null; }
      if (saved && saved.settings && saved.settings.nom) {
        S.real = normalize(saved);
        if (S.mode === 'demo' && !S.forcedDemo) { S.mode = 'real'; }
      }
      refresh();
      maybeWelcome();
    },
    onSnap: function (snap) {
      var built = { settings: null, clients: [], docs: [] };
      snap.docs.forEach(function (doc) {
        var v = doc.data();
        if (!v || !v.data) return;
        var body = clone(v.data);
        if (doc.id === 'settings') built.settings = Object.assign({}, DEFAULT_SETTINGS, body);
        else if (v.kind === 'client') built.clients.push(body);
        else if (v.kind === 'doc') built.docs.push(body);
      });
      if (built.settings) {
        S.real = built;
        if (S.mode === 'demo' && !S.forcedDemo && !S.started) S.mode = 'real';
      }
      S.started = true;
      refresh();
      maybeWelcome();
    },
    write: function (kind, rec, del) {
      if (S.mode === 'demo') return;
      if (S.storage === 'cloud' && this.db) {
        var id = kind === 'settings' ? 'settings' : (kind === 'client' ? 'c_' : 'd_') + rec.id;
        var ref = this.col().doc(id);
        var body = del ? null : { kind: kind, data: clone(rec), t: Date.now() };
        this.queues[id] = (this.queues[id] || Promise.resolve()).then(function () { return del ? ref.delete() : ref.set(body); }).catch(dbError);
      } else this.saveLocal();
    },
    saveLocal: function () {
      try { localStorage.setItem(KEY, JSON.stringify(S.real)); }
      catch (e) { toast('Impossible d\'enregistrer sur cet appareil. Exportez une sauvegarde depuis les réglages.'); }
    },
    wipe: function () {
      var self = this, d = S.real;
      if (S.storage === 'cloud' && this.db && d) {
        self.write('settings', d.settings, true);
        d.clients.forEach(function (c) { self.write('client', c, true); });
        d.docs.forEach(function (x) { self.write('doc', x, true); });
      }
      try { localStorage.removeItem(KEY); } catch (e) { /* rien */ }
    }
  };
  function dbError(e) {
    var code = e && e.code;
    if (code === 'quota_exceeded') toast('Votre espace est plein : supprimez d\'anciens documents ou exportez une sauvegarde.');
    else if (code === 'invalid_argument') toast('Enregistrement refusé : cette page ne vous permet pas d\'écrire. Vos changements restent visibles jusqu\'au rechargement.');
    else if (code === 'revoked') toast('L\'accès à votre espace a changé. Rechargez la page.');
    else toast('Enregistrement momentanément impossible. Réessayez dans un instant.');
  }
  function persist(kind, rec, del) { Store.write(kind, rec, del); }
  // Réglages : chaque changement est enregistré tout seul (le nom vide garde l'ancien)
  var autoTimer = null;
  function applySettings() {
    var f = S.form, s = st();
    Object.assign(s, f, {
      nom: String(f.nom || '').trim() || s.nom,
      delaiPaiement: Math.max(0, parseInt(f.delaiPaiement, 10) || 0),
      validiteDevis: Math.max(1, parseInt(f.validiteDevis, 10) || 30),
      declarations: s.declarations, suiviDepuis: s.suiviDepuis, charges: s.charges, guideMasque: s.guideMasque
    });
    saveSettings();
  }
  function autosave(msg) {
    clearTimeout(autoTimer);
    autoTimer = setTimeout(function () {
      autoTimer = null;
      if (S.view !== 'settings' || !S.form) return;
      applySettings();
      toast(S.mode === 'demo' ? 'Réglage de l\'exemple modifié (non enregistré)' : (msg || 'Réglages enregistrés'));
    }, 400);
  }
  function upsertDoc(doc) { var d = data(), i = d.docs.findIndex(function (x) { return x.id === doc.id; }); if (i < 0) d.docs.push(doc); else d.docs[i] = doc; persist('doc', doc); }
  function removeDoc(doc) { var d = data(); d.docs = d.docs.filter(function (x) { return x.id !== doc.id; }); persist('doc', doc, true); }
  function upsertClient(c) { var d = data(), i = d.clients.findIndex(function (x) { return x.id === c.id; }); if (i < 0) d.clients.push(c); else d.clients[i] = c; persist('client', c); }
  function removeClient(c) { var d = data(); d.clients = d.clients.filter(function (x) { return x.id !== c.id; }); persist('client', c, true); }
  function saveSettings() { persist('settings', st()); }

  /* ---------- Fichiers ---------- */
  function canDownload() { return !hasClaude() || S.caps.downloads !== null; }
  function saveFile(filename, payload) {
    var dl = S.caps.downloads;
    if (dl) {
      dl.save({ filename: filename, data: payload }).then(function () { toast('Fichier enregistré : ' + filename); }, function (e) {
        var code = e && e.code;
        if (code === 'declined') return;
        if (code === 'rate_limited') toast('Un enregistrement est déjà en cours.');
        else toast('Le téléchargement n\'a pas abouti.');
      });
      return;
    }
    if (!hasClaude()) {
      var blob = payload instanceof Blob ? payload : new Blob([payload]);
      var url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
      return;
    }
    toast('Le téléchargement n\'est pas disponible dans cette vue.');
  }
  function pdfOpts(d) {
    var s = st(), c = findClient(d.clientId), o = {}, total = C.docTotal(d);
    if (d.type === 'facture' && s.iban && s.qrVirement !== false && d.statut !== 'payee' && d.statut !== 'annulee' && total > 0) {
      try { o.qr = window.QR.encode(window.QR.epcPayload({ nom: s.nom, iban: s.iban, bic: s.bic, montant: total, libelle: d.numero ? 'Facture ' + d.numero : 'Facture' })); } catch (e) { o.qr = null; }
    }
    if ((d.type === 'facture' || d.type === 'avoir') && d.numero && s.facturx !== false) o.xml = C.facturXML(d, c, s);
    return o;
  }
  function pdfBytes(d) { return C.documentPDF(d, findClient(d.clientId), st(), pdfOpts(d)); }
  function pdfName(d) {
    var c = findClient(d.clientId);
    var pre = d.type === 'avoir' ? 'Avoir-' : d.type === 'devis' ? 'Devis-' : d.typeFacture === 'acompte' ? 'Facture-acompte-' : 'Facture-';
    return pre + (d.numero || 'brouillon') + (c ? '-' + slug(c.nom) : '') + '.pdf';
  }
  function downloadPdf(d) { saveFile(pdfName(d), new Blob([pdfBytes(d)], { type: 'application/pdf' })); }
  // Téléphone : le PDF part par Mail, WhatsApp, SMS… depuis la feuille de partage du système
  function sharePdf(d, text, title) {
    var file;
    try { file = new File([pdfBytes(d)], pdfName(d), { type: 'application/pdf' }); } catch (e) { downloadPdf(d); return; }
    var payload = { files: [file], title: title || pdfName(d) };
    if (text) payload.text = text;
    navigator.share(payload).then(function () {
      if (S.modal && S.modal.kind === 'send' && S.modal.id === d.id) { S.modal.shared = true; render(); }
    }, function (e) {
      if (e && e.name === 'AbortError') return;
      toast('Le partage n\'a pas abouti : le PDF est téléchargé à la place.');
      downloadPdf(d);
    });
  }
  function mailtoHref(to, subject, body) {
    return 'mailto:' + encodeURIComponent(String(to || '').trim()).replace(/%40/g, '@') + '?subject=' + encodeURIComponent(subject || '') + '&body=' + encodeURIComponent(body || '');
  }
  function b64(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function emailOk(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim()); }
  // Messages d'erreur Gmail : chaque cas a sa solution
  function gmailErr(e) {
    var c = e && e.code;
    if (c === 'server_not_connected' || c === 'selection_required' || c === 'server_not_found') return 'Gmail n\'est pas connecté à votre compte Claude. Ajoutez-le dans claude.ai, Réglages, Connecteurs, puis réessayez.';
    if (c === 'needs_reauth') return 'La connexion à Gmail a expiré. Reconnectez Gmail dans claude.ai, Réglages, Connecteurs.';
    if (c === 'not_in_manifest' || c === 'not_granted' || c === 'consent_required' || c === 'approval_required' || c === 'capability_disabled') return 'L\'envoi par Gmail n\'a pas été autorisé pour Picaillon. Autorisez-le depuis le menu Autorisations de la page, ou copiez le message.';
    if (c === 'blocked_by_policy') return 'Votre organisation bloque l\'envoi par Gmail depuis cette page.';
    if (c === 'tool_error') return 'Gmail a refusé l\'envoi : ' + (e.message || 'vérifiez l\'adresse du destinataire.');
    if (c === 'server_unavailable' || c === 'upstream_error' || c === 'cancelled') return 'Gmail n\'a pas répondu. Regardez dans vos e-mails envoyés avant de réessayer : le message est peut-être parti.';
    return 'L\'envoi n\'a pas abouti. Vous pouvez copier le message et joindre le PDF vous-même.';
  }
  // Envoi réel depuis le Gmail du compte, PDF joint (ou brouillon à relire dans Gmail)
  function gmailSend(opts) {
    var m = S.modal, d = findDoc(m.id), mcp = S.caps.mcp;
    if (!d || !mcp) return;
    var to = String(m.to || '').trim();
    if (!emailOk(to)) { m.err = 'Indiquez une adresse e-mail valide pour le client.'; render(); return; }
    m.busy = opts.draft ? 'draft' : 'send'; m.err = null; render();
    var input = { to: [to], subject: m.subject || '', body: m.body || '', attachments: [{ content: b64(pdfBytes(d)), filename: pdfName(d), mimeType: 'application/pdf' }] };
    mcp.callTool('Gmail', opts.draft ? 'create_draft' : 'send_message', input).then(function () {
      d.envois = (d.envois || []).concat([{ date: today(), to: to, mode: opts.draft ? 'brouillon Gmail' : 'e-mail' }]);
      if (opts.after) opts.after(d);
      if (!opts.draft && d.statut === 'brouillon') markSent(d); else upsertDoc(d);
      S.modal = null; render();
      toast(opts.draft ? 'Brouillon créé dans Gmail : relisez-le puis envoyez-le' : 'E-mail envoyé à ' + to);
    }, function (e) {
      if (S.modal) { S.modal.busy = false; S.modal.err = gmailErr(e); render(); }
    });
  }
  function copyText(text, msg) {
    var done = function () { toast(msg || 'Texte copié'); };
    var fail = function () {
      var ta = document.querySelector('[data-copy-src]');
      if (ta) { ta.focus(); ta.select(); }
      toast('Texte sélectionné : copiez-le avec votre clavier.');
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fail);
      else fail();
    } catch (e) { fail(); }
  }

  /* ---------- Sélecteur de date (jour / mois / année) ---------- */
  // where : 'f' (réglages), 'ed' (éditeur), 'm' (fenêtre) ; from/to : années relatives à aujourd'hui
  function dateSel(id, value, where, key, o) {
    o = o || {};
    var p = value ? C.parse(value) : null, cy = +today().slice(0, 4);
    var opt = function (v, label, sel) { return '<option value="' + v + '"' + (sel ? ' selected' : '') + '>' + label + '</option>'; };
    var days = opt('', 'Jour', !p), months = opt('', 'Mois', !p), years = opt('', 'Année', !p);
    for (var d = 1; d <= 31; d++) days += opt(d, d === 1 ? '1er' : d, p && p.d === d);
    for (var m = 1; m <= 12; m++) months += opt(m, C.MOIS[m - 1].charAt(0).toUpperCase() + C.MOIS[m - 1].slice(1), p && p.m === m);
    var y0 = o.minYear || cy + (o.from == null ? -5 : o.from), y1 = cy + (o.to == null ? 1 : o.to);
    if (p && p.y < y0) y0 = p.y;
    if (p && p.y > y1) y1 = p.y;
    for (var y = y1; y >= y0; y--) years += opt(y, y, p && p.y === y);
    var attrs = ' data-where="' + where + '" data-key="' + key + '"';
    return '<div class="date-sel" id="' + id + '"' + attrs + (o.optional ? ' data-optional="1"' : '') + '>' +
      '<select class="input" data-part="d" aria-label="Jour">' + days + '</select>' +
      '<select class="input" data-part="m" aria-label="Mois">' + months + '</select>' +
      '<select class="input" data-part="y" aria-label="Année">' + years + '</select>' +
      (o.optional && value ? '<button class="btn btn-ghost btn-icon" data-act="date-clear" data-where="' + where + '" data-key="' + key + '" aria-label="Effacer la date">' + icon('x', 18) + '</button>' : '') +
      '</div>';
  }
  function dateValue(wrap) {
    var g = function (part) { return wrap.querySelector('[data-part="' + part + '"]').value; };
    var d = +g('d'), m = +g('m'), y = +g('y');
    if (!d || !m || !y) return null;
    return C.iso(y, m, Math.min(d, C.lastDay(y, m)));
  }
  // Applique une date choisie là où elle doit aller, avec les effets propres à chaque champ
  function setDate(where, key, v) {
    if (where === 'f' && S.form) {
      S.form[key] = v;
      if (S.view === 'settings') autosave();
      render(); return;
    }
    if (where === 'ed' && S.draft) {
      var d = S.draft; d[key] = v;
      if (key === 'echeance' || key === 'validite') d._ech = true;
      if (key === 'date' && v && !d._ech) { d.echeance = C.addDays(v, +st().delaiPaiement || 0); d.validite = C.addDays(v, +st().validiteDevis || 30); }
      render(); return;
    }
    if (where === 'm' && S.modal) { S.modal[key] = v; render(); }
  }

  /* ---------- Toast ---------- */
  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = msg; el.hidden = false;
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2800);
  }

  /* ---------- Navigation ---------- */
  var FORM_VIEWS = { edit: 1, client: 1, settings: 1, onboarding: 1 };
  var trapOn = false;
  function ensureTrap() {
    if (!WEB || trapOn) return;
    try { history.pushState({ picaillon: 'trap' }, ''); trapOn = true; } catch (e) { trapOn = false; }
  }
  function go(view, param) {
    ensureTrap();
    if (S.view === 'settings' && autoTimer && view !== 'settings') { clearTimeout(autoTimer); autoTimer = null; applySettings(); }
    S.view = view; S.param = param == null ? null : param; S.modal = null; S.ai = null;
    if (view === 'settings') S.form = clone(st());
    if (view === 'onboarding') S.form = clone(st());
    if (view === 'client') {
      var c = param ? findClient(param) : null;
      S.form = c ? clone(c) : { id: null, nom: '', type: 'particulier', email: '', tel: '', adresse: '', siren: '' };
    }
    try { localStorage.setItem(KEY + ':tab', view === 'docs' || view === 'clients' || view === 'urssaf' ? view : 'home'); } catch (e) { /* rien */ }
    render();
    window.scrollTo(0, 0);
  }
  // Espaces créés avant le suivi des déclarations : on date le suivi au jour de la mise à jour
  var migrating = false;
  function migrate() {
    var r = S.real;
    if (migrating || !r || !r.settings || !r.settings.nom || r.settings.suiviDepuis) return;
    migrating = true; r.settings.suiviDepuis = today();
    setTimeout(function () { persist('settings', r.settings); migrating = false; }, 0);
  }
  function refresh() {
    migrate();
    if (FORM_VIEWS[S.view] || S.modal) { S.dirty = true; return; }
    render();
  }

  /* ---------- Coquille ---------- */
  function navItems() {
    return [['home', 'Accueil', 'home'], ['docs', 'Documents', 'doc'], ['clients', 'Clients', 'users'], ['urssaf', 'URSSAF', 'bank'], ['settings', 'Réglages', 'gear']];
  }
  function activeTab() {
    var v = S.view;
    if (v === 'doc' || v === 'edit') return 'docs';
    if (v === 'client') return 'clients';
    if (v === 'onboarding') return 'settings';
    return v;
  }
  function side() {
    var tab = activeTab();
    var store = S.mode === 'demo' ? '<div class="store-chip"><i class="mem"></i>Mode exemple : rien n\'est enregistré</div>'
      : S.storage === 'cloud' ? '<div class="store-chip"><i></i>Enregistré dans votre espace privé</div>'
        : '<div class="store-chip"><i></i>Enregistré sur cet appareil</div>';
    return '<aside class="side" aria-label="Navigation">' +
      '<a class="brand" href="#" data-act="go" data-v="home" aria-label="Picaillon, accueil">' + LOGO + WORDMARK + '</a>' +
      '<button class="btn btn-primary" data-act="new-menu">' + icon('plus', 18) + 'Nouveau</button>' +
      navItems().map(function (n) { return '<button class="nav-item" data-act="go" data-v="' + n[0] + '"' + (tab === n[0] ? ' aria-current="page"' : '') + '>' + icon(n[2]) + n[1] + '</button>'; }).join('') +
      '<div class="side-foot">' + store +
      (SITE ? '<a class="nav-item" href="' + esc(CFG.avis || '../avis.html') + '">' + icon('chat') + 'Donner mon avis</a>' : '') +
      '<button class="nav-item" data-act="go" data-v="settings" data-anchor="pro">' + icon('spark') + 'Picaillon Pro <span class="pro-tag" style="margin-left:auto">7,90 €</span></button></div>' +
      '</aside>';
  }
  function tabbar() {
    var tab = activeTab();
    var t = function (v, label, ic) { return '<button class="tab" data-act="go" data-v="' + v + '"' + (tab === v ? ' aria-current="page"' : '') + '>' + icon(ic, 22) + label + '</button>'; };
    return '<nav class="tabbar" aria-label="Navigation">' + t('home', 'Accueil', 'home') + t('docs', 'Documents', 'doc') +
      '<button class="tab-new" data-act="new-menu" aria-label="Nouveau document">' + icon('plus', 26) + '</button>' +
      t('clients', 'Clients', 'users') + t('urssaf', 'URSSAF', 'bank') + '</nav>';
  }
  function banner() {
    if (S.mode !== 'demo') return '';
    var hasReal = S.real && S.real.settings && S.real.settings.nom;
    return '<div class="banner" role="note"><div class="grow"><b>Exemple.</b> Vous visitez l\'espace de Camille, artisan peintre à Lyon. Testez tout librement : rien n\'est enregistré.</div>' +
      '<button class="btn btn-sm" data-act="start">' + (hasReal ? 'Revenir à mes données' : 'Commencer avec mes données') + '</button></div>';
  }
  function topbar(title, opts) {
    opts = opts || {};
    var hasBack = opts.back !== undefined || !!opts.backAct;
    var left = hasBack ? '<button class="btn btn-ghost btn-icon" data-act="' + (opts.backAct || 'go') + '" data-v="' + (opts.back || '') + '" aria-label="Retour">' + icon('back', 22) + '</button>'
      : '<a class="brand brand-sm" href="#" data-act="go" data-v="home" aria-label="Accueil">' + LOGO + '</a>';
    var right = opts.right || '';
    if (!hasBack && S.view !== 'settings') right += '<button class="btn btn-ghost btn-icon brand-sm" data-act="go" data-v="settings" aria-label="Réglages">' + icon('gear', 22) + '</button>';
    return '<header class="topbar">' + left + '<h1>' + esc(title) + '</h1>' + right + '</header>';
  }

  function render() {
    S.dirty = false;
    if (!S.real && S.mode === 'real') S.mode = 'demo';
    var html;
    switch (S.view) {
      case 'docs': html = viewDocs(); break;
      case 'doc': html = viewDoc(); break;
      case 'edit': html = viewEdit(); break;
      case 'clients': html = viewClients(); break;
      case 'client': html = viewClient(); break;
      case 'urssaf': html = viewUrssaf(); break;
      case 'settings': html = viewSettings(); break;
      case 'onboarding': html = viewOnboarding(); break;
      default: html = viewHome();
    }
    document.getElementById('app').innerHTML = '<div class="shell">' + side() + '<main class="main" id="main"><div class="wrap">' + banner() + html + '</div></main>' + tabbar() + '</div>' + modalHtml();
    if (S.modal && S.modal.kind === 'sign') initSignPad();
  }

  /* ---------- Accueil ---------- */
  function niceMax(v) {
    if (v <= 0) return 1000;
    var raw = v / 4, p = Math.pow(10, Math.floor(Math.log10(raw))), steps = [1, 2, 2.5, 5, 10];
    for (var i = 0; i < steps.length; i++) if (steps[i] * p >= raw) return steps[i] * p * 4;
    return 10 * p * 4;
  }
  function kfmt(v) { return v >= 1000 ? (Math.round(v / 100) / 10).toString().replace('.', ',') + 'k' : String(Math.round(v)); }
  function chartSvg(mois, cur) {
    var compact = (window.innerWidth || 1000) < 600;
    var W = compact ? 340 : 640, H = compact ? 200 : 230, pl = compact ? 30 : 46, pr = 4, pt = 22, pb = 28, max = niceMax(Math.max.apply(null, mois));
    var peak = mois.indexOf(Math.max.apply(null, mois));
    var bw = (W - pl - pr) / 12, ih = H - pt - pb, out = '';
    for (var g = 0; g <= 4; g++) {
      var gv = max / 4 * g, gy = H - pb - ih * g / 4;
      out += '<line class="grid-l" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + gy + '" y2="' + gy + '"/>';
      out += '<text x="' + (pl - 8) + '" y="' + (gy + 4) + '" text-anchor="end">' + kfmt(gv) + '</text>';
    }
    mois.forEach(function (v, i) {
      var x = pl + i * bw + bw * 0.2, w = bw * 0.6, h = ih * v / max, y = H - pb - h;
      if (i <= cur && v > 0) {
        out += '<rect class="bar' + (i < cur ? ' past' : '') + '" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + Math.max(h, 1).toFixed(1) + '" rx="3"><title>' + C.MOIS[i] + ' : ' + eur(v) + '</title></rect>';
        if (!compact || i === cur || i === peak) out += '<text class="val" x="' + (x + w / 2).toFixed(1) + '" y="' + (y - 6).toFixed(1) + '" text-anchor="middle">' + kfmt(v) + '</text>';
      } else if (i > cur) {
        out += '<rect class="bar future" x="' + x.toFixed(1) + '" y="' + (H - pb - 4) + '" width="' + w.toFixed(1) + '" height="4" rx="2"/>';
      }
      out += '<text x="' + (x + w / 2).toFixed(1) + '" y="' + (H - 9) + '" text-anchor="middle">' + (compact ? C.MOIS[i].charAt(0).toUpperCase() : C.MOIS_COURT[i].replace('.', '')) + '</text>';
    });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Chiffre d\'affaires encaissé par mois">' + out + '</svg>';
  }
  function clientName(id) { var c = findClient(id); return c ? c.nom : 'Client supprimé'; }
  function viewHome() {
    var d = data(), s = d.settings, t = today(), db = C.dashboard(d, t), c = db.c, tot = c.ca || 1;
    var name = prenom(s);
    var head = topbar(name ? 'Bonjour ' + name : 'Tableau de bord');
    var seg = function (cls, v) { return v > 0 ? '<i class="' + cls + '" style="width:' + (v / tot * 100).toFixed(2) + '%"></i>' : ''; };
    var fr = fraisAnnee(db, s, t), net = C.round2(c.net - fr.total);
    var hero = '<section class="card hero" aria-labelledby="h-net"><div class="eyebrow" id="h-net">Net en poche · ' + db.annee + '</div>' +
      '<div class="hero-num">' + (net < 0 ? '− ' : '') + eur(Math.abs(net), 0) + '</div>' +
      '<div class="hero-sub">' + (c.ca > 0 ? 'sur ' + eur(c.ca, 0) + ' encaissés depuis le 1er janvier · taux global ' + pct(db.taux.total) + (db.taux.acre ? ' avec l\'ACRE' : '') +
        (fr.total ? ' · ' + eur(fr.total, 0) + ' de frais sur ' + fr.mois + ' mois' : '') : 'Vos encaissements apparaîtront ici dès qu\'une facture sera marquée payée.') + '</div>' +
      '<div class="split">' + seg('sw-net', net) + seg('sw-soc', c.social) + seg('sw-cfp', c.cfp) + seg('sw-vl', c.vl) + seg('sw-frais', fr.total) + '</div>' +
      '<div class="legend">' +
      '<div><span class="sw sw-net"></span>Pour vous<span class="v">' + (net < 0 ? '− ' : '') + eur(Math.abs(net), 0) + '</span></div>' +
      (fr.total ? '<div><span class="sw sw-frais"></span>Vos frais<span class="v">' + eur(fr.total, 0) + '</span></div>' : '') +
      '<div><span class="sw sw-soc"></span>Cotisations sociales<span class="v">' + eur(c.social, 0) + '</span></div>' +
      '<div><span class="sw sw-cfp"></span>Formation (CFP)<span class="v">' + eur(c.cfp, 0) + '</span></div>' +
      (s.vl ? '<div><span class="sw sw-vl"></span>Impôt libératoire<span class="v">' + eur(c.vl, 0) + '</span></div>' : '') +
      '</div>' + (s.vl ? '' : '<p class="hero-sub" style="margin:12px 0 0;font-size:13px">Impôt sur le revenu non inclus : vous n\'avez pas choisi le versement libératoire.</p>') +
      (c.ca > 0 && !(s.charges || []).length ? '<p class="hero-sub" style="margin:8px 0 0;font-size:13px">Vos frais (mutuelle, assurance, véhicule…) ne sont pas déduits. <button class="link" data-act="focus-charges">Les ajouter</button></p>' : '') +
      heroStats(db, s, t) + '</section>';

    var p = db.prochaine, decl = (s.declarations || {})[p.info.key];
    var urs = '<section class="card"><div class="card-h"><h2>Déclaration URSSAF</h2>' +
      (p.terminee ? (decl ? '<span class="pill ok">Déclarée</span>' : '<span class="pill warn">À déclarer</span>') : '<span class="pill accent">En cours</span>') + '</div>' +
      '<div class="eyebrow">' + esc(p.info.label) + '</div>' +
      (p.c.ca > 0 ? '<div class="big" style="margin:6px 0 4px">' + eur(p.c.total) + '</div><div class="note">à payer sur ' + eur(p.c.ca) + ' de chiffre d\'affaires ' + (p.terminee ? 'à déclarer' : 'encaissé jusqu\'ici') + '</div>'
        : '<div class="big" style="margin:6px 0 4px">Rien à payer</div><div class="note">' + (p.terminee ? 'Aucun encaissement sur cette période : déclarez quand même 0 € à l\'URSSAF, c\'est obligatoire.' : 'Aucun encaissement pour l\'instant sur cette période.') + '</div>') +
      '<div class="kv" style="margin-top:10px"><span>Date limite</span><b>' + C.fmtDateLong(p.info.limite) + '</b></div>' +
      '<div class="kv"><span>Délai</span><b>' + (p.jours >= 0 ? 'dans ' + p.jours + ' jour' + (p.jours > 1 ? 's' : '') : 'dépassé') + '</b></div>' +
      '<div class="btn-row" style="margin-top:12px">' + (p.terminee && !decl ? '<button class="btn btn-sm btn-primary" data-act="declare" data-v="' + p.info.key + '">' + icon('check', 16) + 'Marquer déclarée</button>' : '') +
      '<button class="btn btn-sm" data-act="go" data-v="urssaf">Détail</button></div></section>';

    var att = db.attente.liste.slice().sort(function (a, b) { return (a.echeance || '') < (b.echeance || '') ? -1 : 1; });
    var enc = '<section class="card"><div class="card-h"><h2>À encaisser</h2>' + (db.retard.liste.length ? '<span class="pill bad">' + db.retard.liste.length + ' en retard</span>' : '') + '</div>' +
      '<div class="big">' + eur(db.attente.total) + '</div><div class="note">' + (att.length ? att.length + ' facture' + (att.length > 1 ? 's' : '') + ' envoyée' + (att.length > 1 ? 's' : '') + (db.retard.total ? ', dont ' + eur(db.retard.total) + ' en retard' : '') : 'Aucune facture en attente de paiement.') + '</div>' +
      (att.length ? '<button class="btn btn-sm" style="margin-top:10px" data-act="bank">' + icon('up', 15) + 'Importer un relevé bancaire</button>' : '') +
      (att.length ? '<div class="mini-list" style="margin-top:8px">' + att.slice(0, 4).map(function (f) {
        var e = C.etat(f, t);
        return '<div class="mini"><div class="who"><b>' + esc(clientName(f.clientId)) + '</b><span class="mono">' + esc(f.numero) + '</span> · <span>' + (e.code === 'retard' ? e.jours + ' j de retard' : 'échéance ' + C.fmtDate(f.echeance)) + '</span></div>' +
          '<b class="num">' + eur(C.docTotal(f), 0) + '</b>' +
          (e.code === 'retard' ? '<button class="btn btn-sm" data-act="relance" data-id="' + f.id + '">' + icon('bell', 15) + 'Relancer</button>' : '<button class="btn btn-sm btn-ghost" data-act="open" data-id="' + f.id + '" aria-label="Ouvrir">' + icon('next', 15) + '</button>') +
          '</div>';
      }).join('') + '</div>' : '') + '</section>';

    var a = C.activite(s);
    var r1 = c.ca / db.plafond, ton1 = r1 >= 1 ? 'bad' : r1 >= 0.85 ? 'warn' : '';
    var tvaFill = Math.min(c.ca / db.tvaMaj, 1), tick = db.tva / db.tvaMaj;
    var tvaTon, tvaMsg;
    if (c.ca > db.tvaMaj) { tvaTon = 'bad'; tvaMsg = 'Seuil majoré dépassé : la TVA est due dès le dépassement. Parlez-en à un expert-comptable.'; }
    else if (c.ca > db.tva) { tvaTon = 'warn'; tvaMsg = 'Seuil de base dépassé. Vous restez en franchise cette année tant que vous ne dépassez pas ' + eur(db.tvaMaj, 0) + ', puis la TVA s\'applique au 1er janvier.'; }
    else { tvaTon = c.ca / db.tva >= 0.8 ? 'warn' : ''; tvaMsg = 'Il vous reste ' + eur(db.tva - c.ca, 0) + ' avant le seuil de franchise en base de TVA.'; }
    var plaf = '<section class="card"><div class="card-h"><h2>Plafonds ' + db.annee + '</h2><span class="pill">' + esc(a.court) + '</span></div>' +
      '<div class="meter-block"><h3>Franchise de TVA ' + (tvaTon ? '<span class="pill ' + tvaTon + '">' + Math.round(c.ca / db.tva * 100) + ' %</span>' : '') + '</h3>' +
      '<div class="meter" role="meter" aria-valuemin="0" aria-valuemax="' + db.tvaMaj + '" aria-valuenow="' + c.ca + '" aria-label="Franchise de TVA"><i class="' + tvaTon + '" style="width:' + (tvaFill * 100).toFixed(1) + '%"></i><span class="tick" style="left:' + (tick * 100).toFixed(1) + '%" title="Seuil de base"></span></div>' +
      '<div class="meter-row"><span>' + eur(c.ca, 0) + '</span><span>base ' + eur(db.tva, 0) + ' · majoré ' + eur(db.tvaMaj, 0) + '</span></div>' +
      '<p class="note" style="margin:8px 0 0">' + tvaMsg + '</p></div>' +
      '<div class="meter-block"><h3>Plafond micro-entreprise ' + (ton1 ? '<span class="pill ' + ton1 + '">' + Math.round(r1 * 100) + ' %</span>' : '') + '</h3>' +
      '<div class="meter" role="meter" aria-valuemin="0" aria-valuemax="' + db.plafond + '" aria-valuenow="' + c.ca + '" aria-label="Plafond micro-entreprise"><i class="' + ton1 + '" style="width:' + Math.min(r1 * 100, 100).toFixed(1) + '%"></i></div>' +
      '<div class="meter-row"><span>' + Math.round(r1 * 100) + ' % utilisé</span><span>' + eur(db.plafond, 0) + (db.prorata ? ' (proratisé)' : '') + '</span></div></div></section>';

    var cm = +t.slice(5, 7) - 1;
    var chart = '<section class="card span2 chart"><div class="card-h"><h2>Encaissé par mois</h2><span class="note">' + db.annee + '</span></div>' + chartSvg(db.mois, cm) + '</section>';

    var dv = db.devis.liste.slice().sort(function (x, y) { return x.date < y.date ? 1 : -1; });
    var devis = '<section class="card"><div class="card-h"><h2>Devis en attente</h2><span class="pill accent">' + dv.length + '</span></div>' +
      '<div class="big">' + eur(db.devis.total) + '</div><div class="note">' + (dv.length ? 'de chiffre d\'affaires potentiel à signer' : 'Aucun devis en attente de réponse.') + '</div>' +
      (dv.length ? '<div class="mini-list" style="margin-top:8px">' + dv.slice(0, 3).map(function (x) {
        return '<div class="mini" role="button" tabindex="0" data-act="open" data-id="' + x.id + '" style="cursor:pointer"><div class="who"><b>' + esc(clientName(x.clientId)) + '</b><span>valable jusqu\'au ' + C.fmtDate(x.validite) + '</span></div><b class="num">' + eur(C.docTotal(x), 0) + '</b></div>';
      }).join('') + '</div>' : '<button class="btn btn-sm" style="margin-top:12px" data-act="new" data-v="devis">' + icon('plus', 16) + 'Créer un devis</button>') + '</section>';

    var calc = '<section class="card"><div class="card-h"><h2>Combien il me reste ?</h2></div>' +
      '<label class="calc" for="calc-in">Si j\'encaisse <input class="input num" id="calc-in" inputmode="decimal" data-calc value="' + esc(S.calc) + '"> € ce mois-ci</label>' +
      '<div class="calc-out" id="calc-out">' + calcOut() + '</div>' + chargeForm() + '</section>';

    return head + webReminders() + '<div class="dash">' + guideCard() + hero + urs + enc + plaf + devis + chart + calc + '</div>' +
      (SITE ? '<p class="note beta-foot">Picaillon est en version de test. Un bug, une idée ? <a href="' + esc(CFG.avis || '../avis.html') + '">Donner mon avis</a></p>' : '');
  }
  // Frais de l'année : comptés à partir du premier encaissement connu de Picaillon (ou de la création si elle est plus tard)
  function fraisAnnee(db, s, t) {
    var charges = s.charges || [];
    if (!charges.length || !(db.c.ca > 0)) return { total: 0, mois: 0 };
    var y = db.annee, first = C.encaissements(data().docs).filter(function (e) { return e.date.slice(0, 4) === String(y); })[0];
    var debut = first ? first.date : t;
    if (s.dateCreation && s.dateCreation.slice(0, 4) === String(y) && s.dateCreation < debut) debut = s.dateCreation;
    var mois = (+t.slice(5, 7)) - C.parse(debut).m + 1;
    var parMois = charges.reduce(function (x, c) { return x + chargeMois(c); }, 0);
    return { total: C.round2(parMois * mois), mois: mois };
  }
  function heroStats(db, s, t) {
    var y = db.annee, m = +t.slice(5, 7) - 1, debut = C.iso(y, 1, 1);
    if (s.dateCreation && s.dateCreation > debut) debut = s.dateCreation;
    else if (!s.dateCreation) {
      // Sans date de début, on part du premier encaissement de l'année connu de Picaillon
      var first = C.encaissements(data().docs).filter(function (e) { return e.date.slice(0, 4) === String(y); })[0];
      if (first) debut = first.date;
    }
    var jours = C.daysBetween(debut, t) + 1, an = C.daysBetween(debut, C.iso(y + 1, 1, 1));
    var moisActifs = m - (C.parse(debut).m - 1) + 1;
    var proj = jours >= 60 && db.c.ca > 0 ? db.c.ca / jours * an : null;
    var moy = moisActifs >= 2 && db.c.ca > 0 ? db.c.ca / moisActifs : null;
    return '<div class="hero-stats"><div><span>Encaissé ce mois-ci</span><b>' + eur(db.mois[m], 0) + '</b></div>' +
      '<div><span>Moyenne par mois</span><b>' + (moy ? eur(moy, 0) : '—') + '</b></div>' +
      '<div><span>Projection fin ' + y + '</span><b>' + (proj ? eur(proj, 0) : '—') + '</b></div></div>';
  }
  var CHARGES = [
    ['mutuelle', 'Mutuelle', 'mois'], ['prevoyance', 'Prévoyance', 'mois'], ['assurance', 'Assurance pro (RC, décennale)', 'an'],
    ['cfe', 'CFE (taxe locale des entreprises)', 'an'], ['loyer', 'Loyer du local ou de l\'atelier', 'mois'], ['vehicule', 'Véhicule et carburant', 'mois'],
    ['telephone', 'Téléphone et internet', 'mois'], ['logiciels', 'Logiciels et abonnements', 'mois'], ['banque', 'Banque', 'mois'],
    ['comptable', 'Comptable', 'an'], ['materiel', 'Matériel et fournitures', 'mois'], ['formation', 'Formation', 'an'], ['autre', 'Autre frais', 'mois']
  ];
  function chargeLabel(type) { for (var i = 0; i < CHARGES.length; i++) if (CHARGES[i][0] === type) return CHARGES[i][1]; return 'Frais'; }
  function chargeMois(c) { return C.round2(C.num(c.montant) / (c.freq === 'an' ? 12 : 1)); }
  function calcOut() {
    var paye = C.num(S.calc);
    if (!(paye > 0)) return '<p class="note" style="margin:0">Entrez ce que vous encaissez dans le mois.</p>';
    var t = C.tauxAt(st(), today()), charges = st().charges || [];
    var soc = C.round2(paye * t.social / 100), cfp = C.round2(paye * t.cfp / 100), vl = C.round2(paye * t.vl / 100);
    var apresUrssaf = C.round2(paye - soc - cfp - vl);
    var frais = C.round2(charges.reduce(function (x, c) { return x + chargeMois(c); }, 0));
    var net = C.round2(apresUrssaf - frais);
    var lines = '<div class="kv"><span>Cotisations URSSAF (' + pct(t.social) + (t.acre ? ', ACRE' : '') + ')</span><b>− ' + eur(soc) + '</b></div>' +
      '<div class="kv"><span>Formation professionnelle (' + pct(t.cfp) + ')</span><b>− ' + eur(cfp) + '</b></div>' +
      (t.vl ? '<div class="kv"><span>Impôt libératoire (' + pct(t.vl) + ')</span><b>− ' + eur(vl) + '</b></div>' : '') +
      charges.map(function (c) {
        return '<div class="kv charge"><span>' + esc(c.label || chargeLabel(c.type)) + (c.freq === 'an' ? ' <small>(' + eur(c.montant, 0) + ' par an)</small>' : '') + '</span>' +
          '<b>− ' + eur(chargeMois(c)) + '</b><button class="btn btn-ghost btn-icon btn-sm" data-act="charge-del" data-id="' + esc(c.id) + '" aria-label="Retirer ' + esc(c.label || chargeLabel(c.type)) + '">' + icon('x', 16) + '</button></div>';
      }).join('');
    return '<div class="calc-net' + (net < 0 ? ' neg' : '') + '"><span>' + (net < 0 ? 'Il vous manque' : 'Il vous reste') + '</span><b>' + eur(Math.abs(net)) + '</b></div>' +
      (charges.length ? '<p class="note" style="margin:0 0 4px">' + eur(apresUrssaf) + ' après l\'URSSAF, puis ' + eur(frais) + ' de frais ce mois-ci.</p>' : '') +
      lines +
      (t.vl ? '' : '<p class="note" style="margin:8px 0 0">L\'impôt sur le revenu reste à payer en plus, selon votre foyer fiscal (vous n\'avez pas choisi le versement libératoire).</p>');
  }
  function chargeForm() {
    var f = S.chargeForm || (S.chargeForm = { type: 'mutuelle', montant: '', freq: 'mois' });
    return '<div class="charge-add"><div class="charge-add-h">Ajoutez ce que vous payez</div>' +
      '<select class="input" id="cf-type" data-cf="type" aria-label="Type de frais">' + CHARGES.map(function (c) { return '<option value="' + c[0] + '"' + (c[0] === f.type ? ' selected' : '') + '>' + c[1] + '</option>'; }).join('') + '</select>' +
      '<div class="charge-row"><input class="input num" id="cf-montant" inputmode="decimal" data-cf="montant" placeholder="Montant €" value="' + esc(f.montant) + '" aria-label="Montant">' +
      '<div class="seg" role="group" aria-label="Fréquence"><button data-act="cf-freq" data-v="mois" aria-pressed="' + (f.freq === 'mois') + '">par mois</button><button data-act="cf-freq" data-v="an" aria-pressed="' + (f.freq === 'an') + '">par an</button></div>' +
      '<button class="btn btn-primary" data-act="charge-add">' + icon('plus', 18) + 'Ajouter</button></div></div>';
  }

  // Carte d'accueil pour les nouveaux inscrits : les 4 étapes qui rendent l'outil utile
  function guideCard() {
    if (S.mode !== 'real') return '';
    var d = data(), s = d.settings;
    if (s.guideMasque) return '';
    var steps = [
      [!!(s.siret && String(s.adresse || '').trim()), 'Complétez votre SIRET et votre adresse', 'Ils sont obligatoires sur chaque devis et facture.', 'go', 'settings', 'Compléter'],
      [d.clients.length > 0, 'Ajoutez votre premier client', 'Il sera proposé dans tous vos devis.', 'go', 'client', 'Ajouter'],
      [d.docs.length > 0, 'Créez votre premier devis', 'Décrivez le travail en une phrase : les lignes se remplissent.', 'new', 'devis', 'Créer'],
      [(s.charges || []).length > 0, 'Indiquez vos frais du mois', 'Pour savoir ce qui vous reste vraiment.', 'focus-charges', '', 'Indiquer']
    ];
    var done = steps.filter(function (x) { return x[0]; }).length;
    if (done === steps.length) return '';
    return '<section class="card guide span-all"><div class="card-h"><h2>Bien démarrer</h2><span class="pill accent">' + done + ' sur ' + steps.length + '</span></div><div class="guide-steps">' +
      steps.map(function (x, i) {
        return '<div class="step' + (x[0] ? ' done' : '') + '"><span class="step-n">' + (x[0] ? icon('check', 15) : (i + 1)) + '</span><div class="step-t"><b>' + x[1] + '</b><span>' + x[2] + '</span></div>' +
          (x[0] ? '' : '<button class="btn btn-sm" data-act="' + x[3] + '" data-v="' + x[4] + '">' + x[5] + '</button>') + '</div>';
      }).join('') + '</div><button class="btn btn-ghost btn-sm" data-act="guide-hide" style="margin-top:6px">Masquer ce guide</button></section>';
  }
  // Mentions obligatoires manquantes, signalées avant qu'un document parte chez le client
  function legalWarnings(d, c) {
    var s = st(), w = [], miss = [];
    if (!s.siret) miss.push('SIRET');
    if (!String(s.adresse || '').trim()) miss.push('adresse');
    if (miss.length) w.push('<div class="callout warn">' + icon('alert', 18) + '<div>Votre ' + miss.join(' et votre ') + (miss.length > 1 ? ' doivent' : ' doit') + ' figurer sur vos ' + (d.type === 'facture' ? 'factures' : 'devis') + '. <button class="link" data-act="go" data-v="settings">Compléter mes informations</button></div></div>');
    if (d.type === 'facture' && c && !String(c.adresse || '').trim()) w.push('<div class="callout warn">' + icon('alert', 18) + '<div>L\'adresse du client est obligatoire sur une facture. <button class="link" data-act="go" data-v="client" data-p="' + c.id + '">Compléter la fiche de ' + esc(c.nom) + '</button></div></div>');
    return w.length ? '<div class="warns">' + w.join('') + '</div>' : '';
  }
  function caseUrssaf(s) {
    var k = (s && s.activite) || 'service';
    if (k === 'vente') return 'ventes de marchandises (BIC)';
    if (k === 'liberal') return 'prestations de services (BNC)';
    if (k === 'cipav') return 'activité libérale relevant de la Cipav';
    return 'prestations de services commerciales et artisanales (BIC)';
  }

  /* ---------- Documents ---------- */
  function docMatches(d, q) {
    if (!q) return true;
    var hay = [d.numero, d.objet, clientName(d.clientId)].join(' ').toLowerCase();
    return hay.indexOf(q.toLowerCase()) >= 0;
  }
  function docRows() {
    var t = today(), f = S.filter;
    var list = data().docs.filter(function (d) {
      if (f === 'devis' && d.type !== 'devis') return false;
      if (f === 'factures' && d.type !== 'facture' && d.type !== 'avoir') return false;
      if (f === 'attente' && !(d.type === 'facture' && d.statut === 'envoyee')) return false;
      return docMatches(d, S.q);
    }).sort(function (a, b) { return a.date === b.date ? ((b.createdAt || 0) - (a.createdAt || 0)) : (a.date < b.date ? 1 : -1); });
    if (!list.length) {
      if (!data().docs.length) return '<div class="rows"><div class="empty"><h3>Aucun document pour l\'instant</h3><p>Créez votre premier devis en une minute, puis transformez-le en facture.</p><button class="btn btn-primary" data-act="new" data-v="devis">' + icon('plus', 18) + 'Créer un devis</button></div></div>';
      return '<div class="rows"><div class="empty"><h3>Aucun résultat</h3><p>Modifiez la recherche ou le filtre.</p></div></div>';
    }
    var groups = {}, order = [];
    list.forEach(function (d) { var k = d.date.slice(0, 7); if (!groups[k]) { groups[k] = []; order.push(k); } groups[k].push(d); });
    return order.map(function (k) {
      var p = C.parse(k + '-01');
      return '<div class="group-h">' + C.MOIS[p.m - 1].charAt(0).toUpperCase() + C.MOIS[p.m - 1].slice(1) + ' ' + p.y + '</div><div class="rows">' + groups[k].map(function (d) {
        var e = C.etat(d, t);
        return '<div class="row" role="button" tabindex="0" data-act="open" data-id="' + d.id + '">' +
          '<div style="min-width:0"><div class="t">' + esc(clientName(d.clientId)) + '</div><div class="s"><span class="mono">' + esc(d.numero || 'Brouillon') + '</span> · ' + (d.type === 'avoir' ? 'Avoir' : d.type === 'facture' ? (d.typeFacture === 'acompte' ? 'Acompte' : 'Facture') : 'Devis') + (d.objet ? ' · ' + esc(d.objet) : '') + '</div></div>' +
          '<div class="r"><span class="amt">' + eur(C.docTotal(d)) + '</span><span class="pill ' + e.ton + '">' + esc(e.label) + '</span></div></div>';
      }).join('') + '</div>';
    }).join('');
  }
  function viewDocs() {
    var f = S.filter;
    var b = function (v, l) { return '<button data-act="filter" data-v="' + v + '" aria-pressed="' + (f === v) + '">' + l + '</button>'; };
    return topbar('Devis et factures', { right: '<button class="btn btn-primary" data-act="new-menu">' + icon('plus', 18) + '<span class="hide-sm">Nouveau</span></button>' }) +
      '<div class="toolbar"><div class="seg" role="group" aria-label="Filtrer">' + b('tous', 'Tout') + b('devis', 'Devis') + b('factures', 'Factures') + b('attente', 'À encaisser') + '</div>' +
      '<label class="search">' + icon('search', 18) + '<input class="input" id="q-docs" type="search" placeholder="Client, numéro, objet…" data-q="docs" value="' + esc(S.q) + '" aria-label="Rechercher"></label></div>' +
      '<div id="rows">' + docRows() + '</div>';
  }

  /* ---------- Feuille (aperçu) ---------- */
  function sigSvg(sig) {
    var r = sig.ratio || 3, W = 300, H = Math.round(300 / r);
    return '<svg class="sig-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Signature de ' + esc(sig.nom) + '">' + (sig.strokes || []).map(function (st) {
      return '<polyline points="' + st.map(function (p) { return (p[0] * W).toFixed(1) + ',' + (p[1] * H).toFixed(1); }).join(' ') + '"/>';
    }).join('') + '</svg>';
  }
  function sheetHtml(d) {
    var s = st(), c = findClient(d.clientId), isF = d.type === 'facture', isA = d.type === 'avoir', isFL = isF || isA, total = C.docTotal(d);
    var vend = [];
    if (s.nomCommercial) vend.push(s.nomCommercial);
    (s.adresse || '').split('\n').forEach(function (x) { if (x.trim()) vend.push(x.trim()); });
    if (s.siret) vend.push('SIRET ' + s.siret);
    if (s.email) vend.push(s.email);
    if (s.tel) vend.push(s.tel);
    var meta = [['Date', C.fmtDate(d.date)]];
    if (d.datePrestation) meta.push([isFL ? 'Prestation' : 'Début prévu', C.fmtDate(d.datePrestation)]);
    if (isF && d.echeance) meta.push(['Échéance', C.fmtDate(d.echeance)]);
    if (!isFL && d.validite) meta.push(['Valable jusqu\'au', C.fmtDate(d.validite)]);
    var cl = c ? ['<b>' + esc(c.nom) + '</b>'].concat((c.adresse || '').split('\n').filter(function (x) { return x.trim(); }).map(esc)).concat(c.type === 'pro' && c.siren ? ['SIREN ' + esc(c.siren)] : []).concat(c.email ? [esc(c.email)] : []) : ['<span style="color:var(--sheet-muted)">Aucun client choisi</span>'];
    var rows = (d.lignes || []).map(function (l) {
      var q = C.plainNum(l.qte).replace(/,00$/, '');
      return '<tr><td class="d">' + esc(l.designation) + '</td><td class="n wide-only">' + q + '</td><td class="u wide-only">' + esc(l.unite) + '</td><td class="n wide-only">' + C.plainNum(l.pu) + ' €</td>' +
        '<td class="qup qup-in">' + q + ' ' + esc(l.unite) + ' × ' + C.plainNum(l.pu) + ' €</td><td class="n t"><b>' + C.plainNum(C.ligneTotal(l)) + ' €</b></td></tr>';
    }).join('');
    var nature = '<div>Opération : ' + C.natureOperation(s) + '.</div>';
    var cond = '';
    if (isF) {
      if (d.statut === 'payee') cond += '<div>Facture acquittée le ' + C.fmtDate(d.datePaiement) + (d.modePaiement ? ' (' + esc(d.modePaiement.toLowerCase()) + ')' : '') + '.</div>';
      else {
        cond += '<div>Conditions de paiement : ' + (d.echeance && d.echeance !== d.date ? 'à régler avant le ' + C.fmtDate(d.echeance) + '.' : 'à réception de facture.') + '</div>';
        if (s.iban) cond += '<div>Règlement par virement : IBAN ' + esc(s.iban) + (s.bic ? ' · BIC ' + esc(s.bic) : '') + '</div>';
      }
      cond += nature;
    } else if (isA) {
      cond += '<div>' + (d.statut === 'rembourse' ? 'Montant remboursé le ' + C.fmtDate(d.datePaiement) + '.' : d.statut === 'a_rembourser' ? 'Cet avoir sera remboursé au client.' : 'Cet avoir annule la facture ' + esc(d.origine ? d.origine.numero : '') + '.') + '</div>' + nature;
    } else {
      cond += '<div>Devis gratuit, valable jusqu\'au ' + C.fmtDate(d.validite) + '.' + (d.acompte ? ' Acompte de ' + esc(d.acompte) + ' % à la signature.' : '') + '</div>';
    }
    if (d.notes) cond += '<div style="margin-top:6px;white-space:pre-line">' + esc(d.notes) + '</div>';
    // Paiement : lien en ligne et QR code de virement
    var pay = '', aPayer = isF && d.statut !== 'payee' && d.statut !== 'annulee' && total > 0;
    if (aPayer && s.lienPaiement) pay += '<div class="sheet-paylink">Payer en ligne : <a href="' + esc(s.lienPaiement) + '" target="_blank" rel="noopener">' + esc(s.lienPaiement) + '</a></div>';
    var o = aPayer ? pdfOpts(d) : {};
    if (o.qr) pay += '<div class="sheet-qr"><svg viewBox="0 0 ' + (o.qr.length + 8) + ' ' + (o.qr.length + 8) + '" role="img" aria-label="QR code de virement"><rect width="100%" height="100%" fill="#fff"/><path fill="#000" d="' + window.QR.svgPath(o.qr) + '"/></svg>' +
      '<div><b>Payer par virement</b><span>Scannez ce code avec votre application bancaire : l\'IBAN, le montant et la référence ' + esc(d.numero || '') + ' se remplissent tout seuls.</span></div></div>';
    var legal = [esc(s.mentionTva || C.MENTION_TVA + '.')];
    if (isF) {
      legal.push('En cas de retard de paiement, pénalités au taux de trois fois le taux d\'intérêt légal. Pas d\'escompte pour paiement anticipé.');
      if (c && c.type === 'pro') legal.push('Indemnité forfaitaire pour frais de recouvrement : 40 € (art. L441-10 du Code de commerce).');
    }
    if (s.assurance) legal.push('Assurance professionnelle : ' + esc(s.assurance));
    if (isFL && d.numero && s.facturx !== false) legal.push('Données de facture électronique Factur-X (EN 16931) jointes au PDF.');
    var stamp = '';
    if (isF && d.statut === 'payee') stamp = '<div class="stamp" aria-label="Facture acquittée"><b>ACQUITTÉE</b><span>LE ' + C.fmtDate(d.datePaiement) + (d.modePaiement ? ' · ' + esc(d.modePaiement.toUpperCase()) : '') + '</span></div>';
    if (isF && d.statut === 'annulee') stamp = '<div class="stamp bad" aria-label="Facture annulée"><b>ANNULÉE</b><span>PAR AVOIR</span></div>';
    if (isA && d.statut === 'rembourse') stamp = '<div class="stamp" aria-label="Avoir remboursé"><b>REMBOURSÉ</b><span>LE ' + C.fmtDate(d.datePaiement) + '</span></div>';
    if (d.type === 'devis' && d.statut === 'accepte') stamp = '<div class="stamp" aria-label="Devis accepté"><b>ACCEPTÉ</b><span>' + (d.dateAcceptation ? 'LE ' + C.fmtDate(d.dateAcceptation) : 'BON POUR ACCORD') + '</span></div>';
    var titre = isA ? 'AVOIR' : isF ? (d.typeFacture === 'acompte' ? 'FACTURE D\'ACOMPTE' : 'FACTURE') : 'DEVIS';
    return '<div class="sheet-wrap"><article class="sheet">' +
      '<div class="sheet-head"><div class="who"><b>' + esc(s.nom || 'Votre nom') + ' EI</b>' + vend.map(function (v) { return '<div>' + esc(v) + '</div>'; }).join('') + '</div>' +
      '<div class="sheet-title"><h2' + (titre.length > 8 ? ' class="long"' : '') + '>' + titre + '</h2><span class="mono">' + esc(d.numero || 'BROUILLON') + '</span><div class="sheet-meta">' + meta.map(function (m) { return '<span>' + m[0] + '</span><b>' + m[1] + '</b>'; }).join('') + '</div></div></div>' +
      '<div class="sheet-client"><div class="lab">' + (isF ? 'FACTURÉ À' : 'CLIENT') + '</div>' + cl.join('<br>') + '</div>' +
      (d.adresseIntervention ? '<div class="sheet-lieu">Lieu d\'intervention ou de livraison : ' + esc(String(d.adresseIntervention).replace(/\n+/g, ', ')) + '</div>' : '') +
      (isA && d.origine ? '<div class="sheet-obj" style="color:var(--sheet-accent)">Avoir sur la facture ' + esc(d.origine.numero) + ' du ' + C.fmtDate(d.origine.date) + '</div>' : '') +
      (d.objet ? '<div class="sheet-obj">Objet : ' + esc(d.objet) + '</div>' : '') +
      '<div class="sheet-table-wrap"><table class="sheet-table"><thead><tr><th>Désignation</th><th class="n">Qté</th><th>Unité</th><th class="n">Prix unit. HT</th><th class="n">Montant HT</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="sheet-totwrap"><div class="sheet-tot"><div><span>Total HT</span><span class="num">' + C.plainNum(total) + ' €</span></div><div><span>TVA</span><span>Non applicable</span></div><div class="grand"><span>' + (isA ? 'Montant de l\'avoir' : isF ? 'Net à payer' : 'Total') + '</span><span class="num">' + C.plainNum(total) + ' €</span></div></div>' + stamp + '</div>' +
      '<div class="sheet-cond">' + cond + '</div>' + pay +
      (!isFL ? '<div class="sheet-sign"><b>Bon pour accord</b>' + (d.signature ? sigSvg(d.signature) + '<span>Signé par ' + esc(d.signature.nom) + ' le ' + C.fmtDate(d.signature.date) + (d.signature.heure ? ' à ' + esc(d.signature.heure) : '') + '</span>' : '<span>Date et signature du client</span>') + '</div>' : '') +
      '<div class="sheet-legal">' + legal.join('<br>') + '</div>' +
      '</article></div>';
  }

  /* ---------- Détail ---------- */
  function viewDoc() {
    var d = findDoc(S.param);
    if (!d) return topbar('Document', { back: 'docs' }) + '<div class="card empty"><h3>Ce document n\'existe plus</h3><button class="btn" data-act="go" data-v="docs">Voir les documents</button></div>';
    var t = today(), e = C.etat(d, t), isF = d.type === 'facture', isA = d.type === 'avoir', c = findClient(d.clientId), B = [];
    var btn = function (cls, act, ic, label, extra) { return '<button class="btn' + (cls ? ' ' + cls : '') + '" data-act="' + act + '" data-id="' + d.id + '"' + (extra || '') + '>' + (ic ? icon(ic, 18) : '') + label + '</button>'; };
    var pdfBtn = (canDownload() ? btn('', 'pdf', 'dl', 'PDF') : '') + (SHARE ? btn('', 'share-pdf', 'share', 'Partager') : '');
    var avoirLie = d.avoirId && findDoc(d.avoirId);
    if (isF) {
      if (d.statut === 'brouillon') B.push(btn('btn-primary', 'send', 'send', 'Finaliser et envoyer'), btn('', 'pay', 'check', 'Déjà payée'), btn('', 'edit', 'edit', 'Modifier'), pdfBtn);
      else if (d.statut === 'envoyee') B.push(btn('btn-ok', 'pay', 'check', 'Marquer payée'), btn(e.code === 'retard' ? 'btn-primary' : '', 'relance', 'bell', 'Relancer'), btn('', 'send', 'send', 'Renvoyer'), pdfBtn);
      else if (d.statut === 'payee') B.push(pdfBtn, btn('', 'unpay', 'undo', 'Annuler le paiement'));
      else B.push(pdfBtn);
      if (d.numero && (d.statut === 'envoyee' || d.statut === 'payee') && !avoirLie) B.push(btn('btn-ghost', 'avoir', 'undo', 'Créer un avoir'));
      if (avoirLie) B.push('<button class="btn" data-act="open" data-id="' + avoirLie.id + '">Voir l\'avoir ' + esc(avoirLie.numero || '(brouillon)') + '</button>');
      B.push(btn('btn-ghost', 'dup', 'dup', 'Dupliquer'));
      if (!d.numero) B.push(btn('btn-ghost btn-danger', 'del', 'trash', 'Supprimer'));
    } else if (isA) {
      var orig = d.origine && findDoc(d.origine.id);
      if (d.statut === 'brouillon') B.push(btn('btn-primary', 'avoir-finalize', 'check', 'Finaliser l\'avoir'), btn('', 'edit', 'edit', 'Modifier'), pdfBtn, btn('btn-ghost btn-danger', 'del', 'trash', 'Supprimer'));
      else {
        if (d.statut === 'a_rembourser') B.push(btn('btn-ok', 'pay', 'check', 'Marquer remboursé'));
        B.push(btn('', 'send', 'send', 'Envoyer'), pdfBtn);
      }
      if (orig) B.push('<button class="btn btn-ghost" data-act="open" data-id="' + orig.id + '">Voir la facture ' + esc(orig.numero) + '</button>');
    } else {
      if ((d.statut === 'brouillon' || d.statut === 'envoye') && !d.signature) B.push(btn('btn-primary', 'sign', 'edit', 'Faire signer'));
      if (d.statut === 'brouillon') B.push(btn('', 'send', 'send', 'Envoyer'));
      if (d.statut === 'envoye') B.push(btn('', 'send', 'send', 'Renvoyer'));
      if (d.statut === 'envoye' || d.statut === 'brouillon') B.push(btn('', 'accept', 'check', 'Marquer accepté'));
      if (d.statut === 'envoye') B.push(btn('', 'refuse', '', 'Refusé'));
      if (d.statut === 'accepte') {
        var acF = d.acompteFactureId && findDoc(d.acompteFactureId), finF = d.factureId && findDoc(d.factureId);
        var pctA = C.num(d.acompte);
        if (finF) B.push('<button class="btn btn-primary" data-act="open" data-id="' + d.factureId + '">Voir la facture</button>');
        else if (pctA > 0 && !acF) B.push(btn('btn-primary', 'invoice-acompte', 'doc', 'Facture d\'acompte (' + pctA + ' %)'), btn('', 'invoice', '', 'Facture finale'));
        else B.push(btn('btn-primary', 'invoice', 'doc', acF ? 'Facture de solde' : 'Créer la facture'));
        if (acF) B.push('<button class="btn" data-act="open" data-id="' + acF.id + '">Voir l\'acompte</button>');
      }
      if (d.statut === 'refuse') B.push(btn('', 'reopen', 'undo', 'Rouvrir'));
      if (d.statut !== 'accepte') B.push(btn('', 'edit', 'edit', 'Modifier'));
      B.push(pdfBtn, btn('btn-ghost', 'dup', 'dup', 'Dupliquer'), btn('btn-ghost btn-danger', 'del', 'trash', 'Supprimer'));
    }
    // Chronologie
    var tl = [['done', 'Créé', C.fmtDateLong(d.date)]];
    if (isA) {
      if (d.statut !== 'brouillon') tl.push(['done', 'Finalisé', d.numero || '']);
      if (d.statut === 'rembourse') tl.push(['done', 'Remboursé', C.fmtDateLong(d.datePaiement) + (d.modePaiement ? ' · ' + d.modePaiement : '')]);
      else if (d.statut === 'a_rembourser') tl.push(['', 'Remboursement', 'à effectuer']);
    } else if (d.dateEnvoi || (d.statut !== 'brouillon' && !d.signature)) tl.push(['done', 'Envoyé', d.dateEnvoi ? C.fmtDateLong(d.dateEnvoi) : '']);
    (d.envois || []).forEach(function (x) { tl.push(['done', 'Envoyé par ' + x.mode, C.fmtDateLong(x.date) + ' · ' + x.to]); });
    (d.relances || []).forEach(function (r) { tl.push(['done', 'Relance · ' + r.ton, C.fmtDateLong(r.date)]); });
    if (isF) {
      if (d.statut === 'payee') tl.push(['done', 'Payée', C.fmtDateLong(d.datePaiement) + (d.modePaiement ? ' · ' + d.modePaiement : '')]);
      else if (d.statut === 'annulee') tl.push(['done', 'Annulée par avoir', avoirLie ? avoirLie.numero : '']);
      else if (d.echeance) tl.push([e.code === 'retard' ? 'late' : '', 'Échéance', C.fmtDateLong(d.echeance) + (e.code === 'retard' ? ' · ' + e.jours + ' j de retard' : '')]);
    } else if (!isA) {
      if (d.signature) tl.push(['done', 'Signé sur place', d.signature.nom + ' · ' + C.fmtDateLong(d.signature.date) + (d.signature.heure ? ' à ' + d.signature.heure : '')]);
      else if (d.statut === 'accepte') tl.push(['done', 'Accepté', d.dateAcceptation ? C.fmtDateLong(d.dateAcceptation) : '']);
      else if (d.statut === 'refuse') tl.push(['', 'Refusé', '']);
      else if (d.validite) tl.push(['', 'Fin de validité', C.fmtDateLong(d.validite)]);
    }
    var taux = C.tauxAt(st(), d.datePaiement || t), total = C.docTotal(d), mis = C.round2(total * taux.total / 100);
    var aside = '<aside class="doc-aside grid">' +
      '<section class="card"><div class="card-h"><h2>' + (isA ? 'Avoir' : isF ? 'Facture' : 'Devis') + '</h2><span class="pill ' + e.ton + '">' + esc(e.label) + '</span></div>' +
      '<div class="big">' + eur(total) + '</div>' +
      (isF && d.statut !== 'annulee' ? '<div class="note" style="margin-top:4px">dont ' + eur(mis) + ' à mettre de côté pour l\'URSSAF' + (taux.vl ? ' et l\'impôt' : '') + ' · net ' + eur(total - mis) + '</div>' : '') +
      (isA ? '<div class="note" style="margin-top:4px">' + (d.statut === 'rembourse' ? 'Retiré de votre chiffre d\'affaires le ' + C.fmtDate(d.datePaiement) + '.' : d.statut === 'a_rembourser' ? 'Une fois remboursé, ce montant sera retiré de votre chiffre d\'affaires.' : d.statut === 'emis' ? 'La facture d\'origine ne compte plus dans vos montants à encaisser.' : 'Finalisez l\'avoir pour lui donner son numéro.') + '</div>' : '') +
      '<div class="timeline" style="margin-top:16px">' + tl.map(function (x) { return '<div class="tl ' + x[0] + '"><span class="dot"></span><div><b>' + esc(x[1]) + '</b><span>' + esc(x[2]) + '</span></div></div>'; }).join('') + '</div></section>' +
      (c ? '<section class="card"><div class="card-h"><h2>Client</h2><button class="btn btn-sm btn-ghost" data-act="go" data-v="client" data-p="' + c.id + '">Fiche</button></div><b>' + esc(c.nom) + '</b>' +
        (c.email ? '<div class="note" style="user-select:all">' + esc(c.email) + '</div>' : '') + (c.tel ? '<div class="note" style="user-select:all">' + esc(c.tel) + '</div>' : '') + '</section>' : '') +
      (isF && d.numero && d.statut === 'envoyee' ? '<p class="note">Une facture numérotée ne se supprime pas. Pour l\'annuler ou la corriger, créez un avoir.</p>' : '') +
      '</aside>';
    var titre = isA ? 'Avoir ' : isF ? (d.typeFacture === 'acompte' ? 'Acompte ' : 'Facture ') : 'Devis ';
    return topbar(titre + (d.numero || '(brouillon)'), { back: 'docs' }) +
      '<div class="actions">' + B.filter(Boolean).join('') + '</div>' + legalWarnings(d, c) + ibanHint(d) +
      '<div class="doc-layout"><div style="min-width:0">' + sheetHtml(d) + '</div>' + aside + '</div>';
  }

  /* ---------- Éditeur ---------- */
  function newDraft(type, from) {
    var s = st(), t = today();
    return {
      id: null, type: type, clientId: (from && from.clientId) || '', objet: (from && from.objet) || '',
      date: t, datePrestation: (from && type === 'facture' && from.datePrestation) || '',
      echeance: C.addDays(t, +s.delaiPaiement || 0), validite: C.addDays(t, +s.validiteDevis || 30),
      acompte: type === 'devis' ? ((from && from.acompte) || '') : '',
      lignes: from && from.lignes && from.lignes.length ? clone(from.lignes) : [{ designation: '', qte: 1, unite: 'forfait', pu: '' }],
      notes: (from && from.notes) || '', statut: 'brouillon', devisId: (from && from.type === 'devis') ? from.id : null,
      adresseIntervention: (from && from.adresseIntervention) || '',
      _ai: '', _ech: false
    };
  }
  function lineHtml(l, i) {
    return '<div class="line">' +
      '<label class="c-des"><span class="lab-m">Désignation</span><textarea class="input" rows="1" data-li="' + i + '" data-k="designation" placeholder="Ex. Peinture murs, 2 couches" aria-label="Désignation ligne ' + (i + 1) + '">' + esc(l.designation) + '</textarea></label>' +
      '<label><span class="lab-m">Quantité</span><input class="input num" inputmode="decimal" data-li="' + i + '" data-k="qte" value="' + esc(l.qte) + '" aria-label="Quantité"></label>' +
      '<label><span class="lab-m">Unité</span><input class="input" list="unites" data-li="' + i + '" data-k="unite" value="' + esc(l.unite) + '" aria-label="Unité"></label>' +
      '<label><span class="lab-m">Prix unitaire €</span><input class="input num" inputmode="decimal" data-li="' + i + '" data-k="pu" value="' + esc(l.pu) + '" placeholder="0,00" aria-label="Prix unitaire"></label>' +
      '<button class="btn btn-ghost btn-icon c-x" data-act="ed-del-line" data-i="' + i + '" aria-label="Supprimer la ligne">' + icon('x', 18) + '</button>' +
      '<div class="lt c-tot" data-lt="' + i + '">' + eur(C.ligneTotal(l)) + '</div>' +
      '</div>';
  }
  function aiCard() {
    var d = S.draft, ai = S.ai || {};
    var noAI = S.caps.sample === null || !hasClaude();
    return '<div class="ai-card"><h3>' + icon('spark', 18) + 'Décrire le travail <span class="pro-tag">PRO</span></h3>' +
      '<p class="note" style="margin:0">Écrivez comme vous parlez : l\'appli crée les lignes chiffrées. Exemple : « Pose de 12 m² de carrelage à 45 € le m², fournitures 380 €, déplacement 30 € ».</p>' +
      '<textarea class="input" id="ai-text" data-ed="_ai" rows="3" placeholder="Décrivez les travaux, les quantités et vos prix">' + esc(d._ai) + '</textarea>' +
      '<div class="btn-row"><button class="btn btn-primary" data-act="ai" ' + (ai.busy ? 'disabled' : '') + '>' + icon('spark', 18) + (ai.busy ? 'Rédaction en cours…' : noAI ? 'Créer les lignes' : 'Créer les lignes avec l\'IA') + '</button>' +
      (ai.busy ? '<button class="btn btn-ghost" data-act="ai-stop">Arrêter</button>' : '') + '</div>' +
      (ai.msg ? '<div class="callout ' + (ai.ton || '') + '">' + icon('info', 18) + '<div>' + esc(ai.msg) + '</div></div>' : '') +
      '</div>';
  }
  function viewEdit() {
    var d = S.draft;
    if (!d) return topbar('Nouveau', { back: 'docs' }) + '<div class="card empty"><h3>Rien à modifier</h3></div>';
    var isF = d.type === 'facture', isA = d.type === 'avoir', clients = data().clients.slice().sort(function (a, b) { return a.nom.localeCompare(b.nom, 'fr'); });
    var title = isA ? (d.id ? 'Modifier l\'avoir' : 'Nouvel avoir') : (d.id ? 'Modifier ' + (isF ? 'la facture' : 'le devis') : (isF ? 'Nouvelle facture' : 'Nouveau devis'));
    if (isA) return viewEditAvoir(d, title);
    var typeSeg = d.id ? '' : '<div class="field full"><span>Type de document</span><div class="seg" role="group" aria-label="Type"><button data-act="ed-type" data-v="devis" aria-pressed="' + !isF + '">Devis</button><button data-act="ed-type" data-v="facture" aria-pressed="' + isF + '">Facture</button></div></div>';
    var head = '<section class="card"><div class="form-grid">' + typeSeg +
      '<label class="field"><span>Client</span><select class="input" id="ed-client" data-ed="clientId"><option value="">Choisir un client…</option>' +
      clients.map(function (c) { return '<option value="' + c.id + '"' + (c.id === d.clientId ? ' selected' : '') + '>' + esc(c.nom) + '</option>'; }).join('') +
      '<option value="__new">+ Nouveau client…</option></select></label>' +
      '<label class="field"><span>Objet</span><input class="input" id="ed-objet" data-ed="objet" value="' + esc(d.objet) + '" placeholder="Ex. Peinture salon"></label>' +
      '<div class="field"><span>Date</span>' + dateSel('ed-date', d.date, 'ed', 'date', { from: -3, to: 2 }) + '</div>' +
      '<div class="field"><span>' + (isF ? 'Date de la prestation' : 'Début des travaux prévu') + '</span>' + dateSel('ed-presta', d.datePrestation, 'ed', 'datePrestation', { from: -3, to: 2, optional: true }) + '</div>' +
      (isF ? '<div class="field"><span>Échéance de paiement</span>' + dateSel('ed-echeance', d.echeance, 'ed', 'echeance', { from: -3, to: 2 }) + '</div>'
        : '<div class="field"><span>Valable jusqu\'au</span>' + dateSel('ed-validite', d.validite, 'ed', 'validite', { from: -3, to: 2 }) + '</div>' +
        '<label class="field"><span>Acompte à la signature (%)</span><input class="input num" id="ed-acompte" inputmode="numeric" data-ed="acompte" value="' + esc(d.acompte) + '" placeholder="Aucun"></label>') +
      '<label class="field full"><span>Lieu d\'intervention ou de livraison (si différent de l\'adresse du client)</span><textarea class="input" id="ed-lieu" data-ed="adresseIntervention" rows="2" placeholder="Ex. 12 rue de la Charité, 69002 Lyon">' + esc(d.adresseIntervention || '') + '</textarea></label>' +
      '</div></section>';
    var lines = '<section class="grid"><div class="card-h" style="margin:0"><h2 style="font-size:17px">Lignes</h2></div>' + aiCard() +
      '<div class="line-head" aria-hidden="true"><span>Désignation</span><span>Qté</span><span>Unité</span><span>Prix unit.</span><span></span></div>' +
      '<div class="lines" id="lines">' + d.lignes.map(lineHtml).join('') + '</div>' +
      '<div><button class="btn" data-act="ed-add-line">' + icon('plus', 18) + 'Ajouter une ligne</button></div></section>';
    var notes = '<section class="card"><label class="field"><span>Note sur le document (facultatif)</span><textarea class="input" id="ed-notes" data-ed="notes" rows="2" placeholder="Ex. Travaux réalisés en semaine, accès par la cour">' + esc(d.notes) + '</textarea></label></section>';
    var foot = '<div class="ed-foot"><div class="tot"><span>Total · TVA non applicable</span><b id="ed-total">' + eur(C.docTotal(d)) + '</b></div>' +
      '<button class="btn btn-ghost" data-act="ed-cancel">Annuler</button><button class="btn btn-primary" data-act="ed-save">' + icon('check', 18) + 'Enregistrer</button></div>';
    return topbar(title, { back: '', backAct: 'ed-cancel' }) + '<datalist id="unites">' + UNITES.map(function (u) { return '<option value="' + u + '">'; }).join('') + '</datalist>' +
      '<div class="editor">' + head + lines + notes + foot + '</div>';
  }
  function viewEditAvoir(d, title) {
    var head = '<section class="card"><div class="callout" style="margin-bottom:14px">' + icon('info', 18) + '<div>Avoir sur la facture <b>' + esc(d.origine ? d.origine.numero : '') + '</b> de ' + esc(clientName(d.clientId)) + '. Les montants sont négatifs : gardez seulement ce que vous remboursez.</div></div><div class="form-grid">' +
      '<label class="field"><span>Objet</span><input class="input" id="ed-objet" data-ed="objet" value="' + esc(d.objet) + '"></label>' +
      '<div class="field"><span>Date</span>' + dateSel('ed-date', d.date, 'ed', 'date', { from: -3, to: 2 }) + '</div></div></section>';
    var lines = '<section class="grid"><div class="card-h" style="margin:0"><h2 style="font-size:17px">Lignes</h2></div>' +
      '<div class="line-head" aria-hidden="true"><span>Désignation</span><span>Qté</span><span>Unité</span><span>Prix unit.</span><span></span></div>' +
      '<div class="lines" id="lines">' + d.lignes.map(lineHtml).join('') + '</div>' +
      '<div><button class="btn" data-act="ed-add-line">' + icon('plus', 18) + 'Ajouter une ligne</button></div></section>';
    var notes = '<section class="card"><label class="field"><span>Motif (facultatif)</span><textarea class="input" id="ed-notes" data-ed="notes" rows="2" placeholder="Ex. Geste commercial suite au retard du chantier">' + esc(d.notes) + '</textarea></label></section>';
    var foot = '<div class="ed-foot"><div class="tot"><span>Montant de l\'avoir</span><b id="ed-total">' + eur(C.docTotal(d)) + '</b></div>' +
      '<button class="btn btn-ghost" data-act="ed-cancel">Annuler</button><button class="btn btn-primary" data-act="ed-save">' + icon('check', 18) + 'Enregistrer</button></div>';
    return topbar(title, { back: '', backAct: 'ed-cancel' }) + '<datalist id="unites">' + UNITES.map(function (u) { return '<option value="' + u + '">'; }).join('') + '</datalist>' +
      '<div class="editor">' + head + lines + notes + foot + '</div>';
  }
  function updateTotals() {
    var d = S.draft;
    d.lignes.forEach(function (l, i) { var el = document.querySelector('[data-lt="' + i + '"]'); if (el) el.textContent = eur(C.ligneTotal(l)); });
    var t = document.getElementById('ed-total'); if (t) t.textContent = eur(C.docTotal(d));
  }
  function saveEditor() {
    var d = S.draft, data0 = data();
    if (!d.clientId) { toast('Choisissez un client.'); var el = document.getElementById('ed-client'); if (el) el.focus(); return; }
    var lignes = d.lignes.map(function (l) { return { designation: String(l.designation || '').trim(), qte: C.num(l.qte), unite: String(l.unite || '').trim(), pu: C.num(l.pu) }; })
      .filter(function (l) { return l.designation || l.pu; });
    if (!lignes.length) { toast('Ajoutez au moins une ligne avec une désignation.'); return; }
    if (!d.date) { toast('Indiquez la date du document.'); return; }
    if (d.type === 'avoir' && !(lignes.reduce(function (x, l) { return x + C.ligneTotal(l); }, 0) < 0)) { toast('Le montant d\'un avoir doit être négatif.'); return; }
    var rec = {};
    Object.keys(d).forEach(function (k) { if (k.charAt(0) !== '_') rec[k] = d[k]; });
    rec.lignes = lignes;
    rec.acompte = C.num(rec.acompte) || '';
    if (!rec.id) {
      rec.id = uid(); rec.createdAt = Date.now(); rec.statut = 'brouillon';
      rec.numero = rec.type === 'devis' ? C.nextNumero(data0.docs, 'devis', +rec.date.slice(0, 4)) : null;
    }
    upsertDoc(rec);
    if (rec.type === 'avoir' && rec.origine) { var of = findDoc(rec.origine.id); if (of && of.avoirId !== rec.id) { of.avoirId = rec.id; upsertDoc(of); } }
    if (rec.devisId) {
      var dv = findDoc(rec.devisId);
      if (dv && rec.typeFacture === 'acompte') { if (!dv.acompteFactureId) { dv.acompteFactureId = rec.id; upsertDoc(dv); } }
      else if (dv && !dv.factureId) { dv.factureId = rec.id; upsertDoc(dv); }
    }
    S.draft = null;
    toast(rec.type === 'avoir' ? 'Avoir enregistré en brouillon' : rec.type === 'facture' ? 'Facture enregistrée en brouillon' : 'Devis ' + rec.numero + ' enregistré');
    go('doc', rec.id);
  }

  var aiCtl = null;
  function runAI() {
    var d = S.draft, text = String(d._ai || '').trim();
    if (!text) { toast('Décrivez le travail en une ou deux phrases.'); var el = document.getElementById('ai-text'); if (el) el.focus(); return; }
    var sample = S.caps.sample;
    if (!sample || !hasClaude()) {
      applyLines(C.devisRapide(text), null);
      S.ai = { msg: 'Lignes créées à partir de votre texte. Vérifiez les prix avant d\'enregistrer.' };
      render(); return;
    }
    var a = C.activite(st());
    var prompt = 'Tu es l\'assistant d\'un micro-entrepreneur français (' + a.label + (st().nomCommercial ? ', ' + st().nomCommercial : '') + '). ' +
      'Transforme la description de travaux ci-dessous en lignes de devis.\n\n' +
      'Règles :\n' +
      '- Réponds uniquement avec un objet JSON : {"objet": "titre court", "lignes": [{"designation": "texte", "qte": 1, "unite": "forfait", "pu": 0}], "remarque": "texte ou chaîne vide"}.\n' +
      '- "unite" parmi : h, jour, m², ml, u, km, forfait, séance, mois.\n' +
      '- "pu" est le prix unitaire HT en euros (nombre). Micro-entrepreneur en franchise de TVA : aucune TVA.\n' +
      '- Reprends exactement les quantités et les prix donnés. Si un prix manque, propose un prix réaliste en France en 2026 et cite ces lignes dans "remarque".\n' +
      '- Désignations claires et professionnelles en français, sans prix dans le texte. Entre 1 et 12 lignes.\n\n' +
      'Description :\n' + text.slice(0, 4000);
    aiCtl = new AbortController();
    S.ai = { busy: true }; render();
    sample.json(prompt, { modelTier: 'quick', signal: aiCtl.signal }).then(function (res) {
      var lignes = res && Array.isArray(res.lignes) ? res.lignes.map(function (l) {
        return { designation: String(l.designation || '').slice(0, 300), qte: C.num(l.qte) || 1, unite: String(l.unite || 'forfait').slice(0, 20), pu: C.round2(C.num(l.pu)) };
      }).filter(function (l) { return l.designation; }) : [];
      if (!lignes.length) { S.ai = { msg: 'Aucune ligne n\'a pu être créée. Précisez la description et réessayez.', ton: 'warn' }; return; }
      if (S.draft && !S.draft.objet && res.objet) S.draft.objet = String(res.objet).slice(0, 120);
      applyLines(lignes);
      S.ai = { msg: res.remarque ? String(res.remarque) : lignes.length + ' ligne' + (lignes.length > 1 ? 's' : '') + ' ajoutée' + (lignes.length > 1 ? 's' : '') + '. Vérifiez les montants avant d\'enregistrer.', ton: res.remarque ? 'warn' : 'ok' };
    }, function (e) {
      var code = e && e.code;
      if (code === 'cancelled') { S.ai = null; return; }
      if (code === 'not_granted' || code === 'sampling_disabled' || code === 'not_declared' || code === 'capability_disabled' || code === 'capability_removed') {
        S.caps.sample = null;
        applyLines(C.devisRapide(text));
        S.ai = { msg: 'L\'IA n\'est pas autorisée ici : lignes créées automatiquement à partir de votre texte. Vérifiez les prix.', ton: 'warn' };
      } else if (code === 'rate_limited') S.ai = { msg: 'Trop de demandes pour le moment. Réessayez dans quelques minutes.', ton: 'warn' };
      else if (code === 'invalid_json' || code === 'empty_completion') S.ai = { msg: 'La réponse n\'était pas exploitable. Reformulez en une phrase par prestation et réessayez.', ton: 'warn' };
      else if (code === 'refused') S.ai = { msg: 'Cette description n\'a pas pu être traitée. Reformulez-la.', ton: 'warn' };
      else S.ai = { msg: 'L\'IA n\'a pas pu répondre. Réessayez dans un instant.', ton: 'warn' };
    }).then(function () { if (S.view === 'edit') render(); });
  }
  function applyLines(lignes) {
    var d = S.draft;
    if (!d) return;
    var empty = d.lignes.filter(function (l) { return !String(l.designation || '').trim() && !C.num(l.pu); }).length === d.lignes.length;
    d.lignes = empty ? lignes : d.lignes.concat(lignes);
  }

  /* ---------- Clients ---------- */
  function clientStats(id) {
    var docs = data().docs.filter(function (d) { return d.clientId === id; });
    var enc = docs.filter(function (d) { return d.type === 'facture' && d.statut === 'payee'; }).reduce(function (s, d) { return s + C.docTotal(d); }, 0);
    return { n: docs.length, enc: C.round2(enc) };
  }
  function clientRows() {
    var list = data().clients.filter(function (c) { return !S.cq || [c.nom, c.email, c.adresse].join(' ').toLowerCase().indexOf(S.cq.toLowerCase()) >= 0; })
      .sort(function (a, b) { return a.nom.localeCompare(b.nom, 'fr'); });
    if (!list.length) return data().clients.length ? '<div class="rows"><div class="empty"><h3>Aucun résultat</h3></div></div>'
      : '<div class="rows"><div class="empty"><h3>Aucun client</h3><p>Ajoutez vos clients une fois, retrouvez-les dans chaque devis.</p><button class="btn btn-primary" data-act="go" data-v="client">' + icon('plus', 18) + 'Ajouter un client</button></div></div>';
    return '<div class="rows">' + list.map(function (c) {
      var x = clientStats(c.id);
      return '<div class="row" role="button" tabindex="0" data-act="go" data-v="client" data-p="' + c.id + '"><div style="min-width:0"><div class="t">' + esc(c.nom) + '</div><div class="s">' + (c.type === 'pro' ? 'Professionnel' : 'Particulier') + (c.email ? ' · ' + esc(c.email) : '') + '</div></div>' +
        '<div class="r"><span class="amt">' + eur(x.enc, 0) + '</span><span class="note">' + x.n + ' document' + (x.n > 1 ? 's' : '') + '</span></div></div>';
    }).join('') + '</div>';
  }
  function viewClients() {
    return topbar('Clients', { right: '<button class="btn btn-primary" data-act="go" data-v="client">' + icon('plus', 18) + '<span class="hide-sm">Ajouter</span></button>' }) +
      '<div class="toolbar"><label class="search">' + icon('search', 18) + '<input class="input" id="q-clients" type="search" placeholder="Nom, e-mail, ville…" data-q="clients" value="' + esc(S.cq) + '" aria-label="Rechercher un client"></label></div>' +
      '<div id="rows">' + clientRows() + '</div>';
  }
  function clientForm(f, prefix) {
    prefix = prefix || 'f';
    var attr = prefix === 'm' ? 'data-m' : 'data-f';
    return '<div class="form-grid">' +
      '<label class="field full"><span>Nom ou raison sociale</span><input class="input" id="' + prefix + '-nom" ' + attr + '="nom" value="' + esc(f.nom) + '" placeholder="Ex. Sophie Lefèvre"></label>' +
      '<div class="field full"><span>Type de client</span><div class="seg" role="group"><button data-act="' + prefix + '-type" data-v="particulier" aria-pressed="' + (f.type !== 'pro') + '">Particulier</button><button data-act="' + prefix + '-type" data-v="pro" aria-pressed="' + (f.type === 'pro') + '">Professionnel</button></div></div>' +
      '<label class="field"><span>E-mail</span><input class="input" type="email" id="' + prefix + '-email" ' + attr + '="email" value="' + esc(f.email) + '"></label>' +
      '<label class="field"><span>Téléphone</span><input class="input" type="tel" id="' + prefix + '-tel" ' + attr + '="tel" value="' + esc(f.tel) + '"></label>' +
      '<label class="field full"><span>Adresse</span><textarea class="input" id="' + prefix + '-adresse" ' + attr + '="adresse" rows="2">' + esc(f.adresse) + '</textarea></label>' +
      (f.type === 'pro' ? '<label class="field"><span>SIREN</span><input class="input" id="' + prefix + '-siren" ' + attr + '="siren" value="' + esc(f.siren) + '" placeholder="9 chiffres"><small>Obligatoire sur les factures aux professionnels à partir de septembre 2027.</small></label>' : '') +
      '</div>';
  }
  function viewClient() {
    var f = S.form, isNew = !f.id;
    var docs = isNew ? [] : data().docs.filter(function (d) { return d.clientId === f.id; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var t = today();
    return topbar(isNew ? 'Nouveau client' : f.nom || 'Client', { back: 'clients' }) +
      '<div class="grid" style="max-width:860px"><section class="card">' + clientForm(f, 'f') +
      '<div class="btn-row" style="margin-top:16px"><button class="btn btn-primary" data-act="client-save">' + icon('check', 18) + 'Enregistrer</button>' +
      (!isNew ? '<button class="btn" data-act="new" data-v="devis" data-client="' + f.id + '">' + icon('plus', 18) + 'Devis pour ce client</button>' : '') +
      (!isNew && !docs.length ? '<button class="btn btn-ghost btn-danger" data-act="client-del">' + icon('trash', 18) + 'Supprimer</button>' : '') + '</div></section>' +
      (docs.length ? '<div class="group-h">Documents</div><div class="rows">' + docs.map(function (d) {
        var e = C.etat(d, t);
        return '<div class="row" role="button" tabindex="0" data-act="open" data-id="' + d.id + '"><div style="min-width:0"><div class="t"><span class="mono">' + esc(d.numero || 'Brouillon') + '</span></div><div class="s">' + (d.type === 'facture' ? 'Facture' : 'Devis') + ' du ' + C.fmtDate(d.date) + (d.objet ? ' · ' + esc(d.objet) : '') + '</div></div><div class="r"><span class="amt">' + eur(C.docTotal(d)) + '</span><span class="pill ' + e.ton + '">' + esc(e.label) + '</span></div></div>';
      }).join('') + '</div>' : '') + '</div>';
  }

  /* ---------- URSSAF ---------- */
  function viewUrssaf() {
    var d = data(), s = d.settings, t = today(), cy = +t.slice(0, 4), y = S.year || cy;
    var ref = y === cy ? t : C.iso(y, 12, 31);
    var a = C.activite(s, y), tx = C.tauxAt(s, ref), ac = C.acreInfo(s);
    var periods = C.declarations(d, y, t);
    var yc = C.cotisations(C.encaissements(d.docs).filter(function (e) { return e.date.slice(0, 4) === String(y); }), s);
    var yearSeg = '<div class="seg" role="group" aria-label="Année">' + [cy - 1, cy].map(function (v) { return '<button data-act="year" data-v="' + v + '" aria-pressed="' + (v === y) + '">' + v + '</button>'; }).join('') + '</div>';
    var rates = '<section class="card"><div class="card-h"><h2>Vos taux ' + y + '</h2><span class="pill">' + esc(a.court) + '</span></div><div class="rates">' +
      '<div class="rate"><b>' + pct(tx.social) + '</b><span>Cotisations sociales' + (tx.acre ? ' avec l\'ACRE' : '') + '</span></div>' +
      '<div class="rate"><b>' + pct(tx.cfp) + '</b><span>Formation professionnelle</span></div>' +
      '<div class="rate"><b>' + (s.vl ? pct(tx.vl) : '—') + '</b><span>' + (s.vl ? 'Versement libératoire' : 'Pas de versement libératoire') + '</span></div>' +
      '<div class="rate"><b>' + pct(tx.total) + '</b><span>Total prélevé sur chaque euro encaissé</span></div></div>' +
      '<p class="note" style="margin:12px 0 0">Plafond micro-entreprise ' + y + ' : ' + eur(a.plafond, 0) + ' · franchise de TVA : ' + eur(a.tva, 0) + ' (seuil majoré ' + eur(a.tvaMaj, 0) + ').</p>' +
      (tx.estime ? '<p class="note" style="margin:8px 0 0">Les taux ' + y + ' ne sont pas encore intégrés : les calculs utilisent ceux de ' + tx.annee + '.</p>' : '') +
      (ac ? '<p class="note" style="margin:12px 0 0">ACRE : cotisations sociales réduites à ' + pct(C.tauxAt(s, ac.debut).social) + ' du ' + C.fmtDate(ac.debut) + ' au ' + C.fmtDate(ac.fin) + '.</p>' : '') +
      '<p class="note" style="margin:8px 0 0">Déclaration ' + (s.periodicite === 'mensuelle' ? 'mensuelle' : 'trimestrielle') + '. La taxe pour frais de chambre consulaire, quand elle s\'applique, n\'est pas incluse.</p></section>';
    var statusPill = { declaree: '<span class="pill ok">Déclarée</span>', retard: '<span class="pill bad">En retard</span>', avant: '<span class="pill">Avant Picaillon</span>', zero: '<span class="pill warn">À déclarer à 0 €</span>', a_declarer: '<span class="pill warn">À déclarer</span>', en_cours: '<span class="pill accent">En cours</span>', a_venir: '<span class="pill">À venir</span>' };
    var list = periods.length ? '<div class="periods"><div class="period-head" aria-hidden="true"><span>Période</span><span>CA encaissé</span><span>À payer</span><span></span></div>' + periods.map(function (p) {
      var btn = '';
      if (p.statut === 'avant') btn = '<button class="btn btn-sm" data-act="declare" data-v="' + p.info.key + '">' + icon('check', 16) + 'Déjà déclarée</button>';
      else if (p.statut === 'a_declarer' || p.statut === 'retard' || p.statut === 'zero') btn = '<button class="btn btn-sm btn-primary" data-act="declare" data-v="' + p.info.key + '">' + icon('check', 16) + 'Marquer déclarée</button>';
      else if (p.statut === 'declaree') btn = '<button class="btn btn-sm btn-ghost" data-act="undeclare" data-v="' + p.info.key + '">Annuler</button>';
      return '<div class="period ' + p.statut + '"><div class="p-main"><div class="p-title"><h3>' + esc(p.info.label) + '</h3>' + statusPill[p.statut] + '</div>' +
        '<div class="note">Du ' + C.fmtDate(p.info.debut) + ' au ' + C.fmtDate(p.info.fin) + ' · à déclarer avant le ' + C.fmtDate(p.info.limite) + '</div>' +
        ((p.statut === 'a_declarer' || p.statut === 'retard' || p.statut === 'zero') ? '<div class="p-decl">Sur le site de l\'URSSAF, déclarez <b>' + eur(Math.round(p.c.ca), 0) + '</b> en ' + caseUrssaf(s) +
          ' <button class="btn btn-ghost btn-sm" data-act="copy-amount" data-v="' + Math.round(p.c.ca) + '">' + icon('copy', 15) + 'Copier</button></div>' : '') + '</div>' +
        '<div class="p-fig"><span>CA encaissé</span><b>' + eur(p.c.ca) + '</b></div><div class="p-fig"><span>À payer</span><b>' + eur(p.c.total) + '</b></div>' +
        '<div class="p-act">' + btn + '</div></div>';
    }).join('') + '</div>' : '<div class="card empty"><h3>Aucune période pour ' + y + '</h3></div>';
    if (periods.some(function (p) { return p.statut === 'avant'; })) list = '<p class="note" style="margin:0">Les périodes terminées avant votre arrivée sur Picaillon ne sont pas suivies : vous les avez sans doute déjà déclarées sur le site de l\'URSSAF.</p>' + list;
    var encs = C.encaissements(d.docs).filter(function (e) { return e.date.slice(0, 4) === String(y); }).reverse();
    var livre = '<div class="table-wrap"><table class="data"><thead><tr><th>Date</th><th>Facture</th><th>Client</th><th>Nature</th><th>Mode</th><th class="n">Montant</th></tr></thead><tbody>' +
      (encs.length ? encs.map(function (e) {
        return '<tr><td>' + C.fmtDate(e.date) + '</td><td class="mono">' + esc(e.doc.numero) + '</td><td>' + esc(clientName(e.doc.clientId)) + '</td><td>' + esc(e.doc.objet || '') + '</td><td>' + esc(e.doc.modePaiement || '') + '</td><td class="n"><b>' + eur(e.montant) + '</b></td></tr>';
      }).join('') : '<tr><td colspan="6" class="note" style="text-align:center;padding:24px">Aucun encaissement en ' + y + '.</td></tr>') + '</tbody></table></div>';
    return topbar('URSSAF', { right: yearSeg }) +
      '<div class="grid">' + rates +
      '<div class="callout">' + icon('info', 18) + '<div>Déclarez votre chiffre d\'affaires encaissé sur <a href="https://www.autoentrepreneur.urssaf.fr" target="_blank" rel="noopener">autoentrepreneur.urssaf.fr</a>, même s\'il est nul. Picaillon calcule les montants ; la déclaration se fait sur le site de l\'URSSAF.</div></div>' +
      '<div class="card-h" style="margin:8px 0 0"><h2 style="font-size:18px">Périodes ' + y + '</h2><span class="note">Total ' + y + ' : ' + eur(yc.total) + ' sur ' + eur(yc.ca) + '</span></div>' + list +
      '<div class="card-h" style="margin:14px 0 0"><h2 style="font-size:18px">Livre des recettes ' + y + '</h2>' + (canDownload() ? '<button class="btn btn-sm" data-act="csv" data-v="' + y + '">' + icon('dl', 16) + 'Exporter (CSV)</button>' : '') + '</div>' +
      '<p class="note" style="margin:0">Registre obligatoire pour tout micro-entrepreneur : il se remplit tout seul quand vous marquez une facture payée.</p>' + livre +
      '</div>';
  }

  /* ---------- Réglages & démarrage ---------- */
  // Explique pourquoi l'ACRE change (ou non) les montants
  function acreNote(f) {
    if (!f.acre) return '';
    var box = function (ton, txt) { return '<div class="callout ' + ton + ' full">' + icon(ton === 'ok' ? 'check' : 'info', 18) + '<div>' + txt + '</div></div>'; };
    if (!f.dateCreation) return box('warn', 'Indiquez votre <b>date de début d\'activité</b> ci-dessus : l\'ACRE ne dure que jusqu\'à la fin du 3e trimestre qui suit la création. Sans cette date, Picaillon ne peut pas l\'appliquer.');
    var ac = C.acreInfo(f), t = today(), a = C.activite(f, +t.slice(0, 4));
    if (t > ac.fin) return box('', 'Votre ACRE a pris fin le ' + C.fmtDate(ac.fin) + ' : les taux normaux (' + pct(a.social) + ') s\'appliquent à vos encaissements actuels. Elle reste appliquée à ceux d\'avant cette date.');
    if (t < ac.debut) return box('', 'Votre ACRE s\'appliquera à partir du ' + C.fmtDate(ac.debut) + '.');
    return box('ok', 'ACRE active jusqu\'au ' + C.fmtDate(ac.fin) + ' : vos cotisations passent de ' + pct(a.social) + ' à <b>' + pct(C.tauxAt(f, t).social) + '</b>.');
  }
  function profileFields(f) {
    var acts = Object.keys(C.ACTIVITES).map(function (k) { var a = C.ACTIVITES[k]; return '<option value="' + k + '"' + (f.activite === k ? ' selected' : '') + '>' + esc(a.label) + ' · ' + pct(a.social) + '</option>'; }).join('');
    return '<div class="section"><h2>Votre entreprise</h2><div class="form-grid">' +
      '<label class="field"><span>Prénom et nom</span><input class="input" id="s-nom" data-f="nom" value="' + esc(f.nom) + '" placeholder="Ex. Camille Roux" autocomplete="name"><small>Tel qu\'inscrit au répertoire SIRENE. « EI » est ajouté sur vos documents.</small></label>' +
      '<label class="field"><span>Nom commercial (facultatif)</span><input class="input" id="s-nc" data-f="nomCommercial" value="' + esc(f.nomCommercial) + '"></label>' +
      '<label class="field"><span>SIRET</span><input class="input" id="s-siret" data-f="siret" value="' + esc(f.siret) + '" inputmode="numeric" placeholder="14 chiffres"></label>' +
      '<label class="field"><span>Téléphone</span><input class="input" type="tel" id="s-tel" data-f="tel" value="' + esc(f.tel) + '" autocomplete="tel"></label>' +
      '<label class="field full"><span>E-mail</span><input class="input" type="email" id="s-email" data-f="email" value="' + esc(f.email) + '" autocomplete="email"></label>' +
      '<label class="field full"><span>Adresse</span><textarea class="input" id="s-adresse" data-f="adresse" rows="2" autocomplete="street-address">' + esc(f.adresse) + '</textarea></label>' +
      '</div></div>' +
      '<div class="section"><h2>Activité et cotisations</h2><div class="form-grid">' +
      '<label class="field full"><span>Activité principale</span><select class="input" id="s-act" data-f="activite">' + acts + '</select></label>' +
      '<div class="field"><span>Date de début d\'activité</span>' + dateSel('s-crea', f.dateCreation, 'f', 'dateCreation', { minYear: 1980, to: 1, optional: true }) + '</div>' +
      '<div class="field"><span>Déclaration URSSAF</span><div class="seg" role="group"><button data-act="f-per" data-v="mensuelle" aria-pressed="' + (f.periodicite === 'mensuelle') + '">Mensuelle</button><button data-act="f-per" data-v="trimestrielle" aria-pressed="' + (f.periodicite !== 'mensuelle') + '">Trimestrielle</button></div></div>' +
      '<label class="check full"><input type="checkbox" id="s-acre" data-f="acre"' + (f.acre ? ' checked' : '') + '><div><b>Je bénéficie de l\'ACRE</b><span>Cotisations réduites jusqu\'à la fin du 3e trimestre civil après la création : 50 % des taux normaux pour une création avant le 1er juillet 2026, 75 % ensuite.</span></div></label>' + acreNote(f) +
      '<label class="check full"><input type="checkbox" id="s-vl" data-f="vl"' + (f.vl ? ' checked' : '') + '><div><b>J\'ai opté pour le versement libératoire</b><span>L\'impôt sur le revenu est payé avec vos cotisations : 1 % (vente), 1,7 % (services BIC) ou 2,2 % (BNC) du chiffre d\'affaires.</span></div></label>' +
      '</div></div>';
  }
  function docFields(f) {
    return '<div class="section"><h2>Paiement et documents</h2><div class="form-grid">' +
      '<label class="field"><span>IBAN (affiché sur vos factures)</span><input class="input" id="s-iban" data-f="iban" value="' + esc(f.iban) + '"></label>' +
      '<label class="field"><span>BIC</span><input class="input" id="s-bic" data-f="bic" value="' + esc(f.bic) + '"></label>' +
      '<label class="field"><span>Délai de paiement (jours)</span><input class="input num" id="s-delai" inputmode="numeric" data-f="delaiPaiement" value="' + esc(f.delaiPaiement) + '"><small>0 = paiement à réception. 30 jours maximum par défaut entre professionnels.</small></label>' +
      '<label class="field"><span>Validité des devis (jours)</span><input class="input num" id="s-valid" inputmode="numeric" data-f="validiteDevis" value="' + esc(f.validiteDevis) + '"></label>' +
      '<label class="field full"><span>Assurance professionnelle (facultatif)</span><input class="input" id="s-assur" data-f="assurance" value="' + esc(f.assurance) + '" placeholder="Assureur, n° de contrat, zone couverte"><small>Obligatoire sur les devis et factures des artisans soumis à une assurance décennale.</small></label>' +
      '<label class="field full"><span>Mention de TVA</span><input class="input" id="s-tva" data-f="mentionTva" value="' + esc(f.mentionTva) + '" placeholder="' + esc(C.MENTION_TVA) + '."></label>' +
      '<label class="field full"><span>Lien de paiement en ligne (facultatif)</span><input class="input" type="url" id="s-lien" data-f="lienPaiement" value="' + esc(f.lienPaiement || '') + '" placeholder="https://… (Stripe, PayPal, SumUp, Lydia Pro…)"><small>Créez un lien de paiement chez votre prestataire et collez-le ici : il apparaît sur vos factures, vos e-mails et vos SMS.</small></label>' +
      '<label class="check full"><input type="checkbox" id="s-qr" data-f="qrVirement"' + (f.qrVirement !== false ? ' checked' : '') + '><div><b>QR code de virement sur les factures</b><span>Votre client le scanne avec son application bancaire : IBAN, montant et référence se remplissent tout seuls. Il faut avoir renseigné votre IBAN.</span></div></label>' +
      '</div></div>';
  }
  function efactSection(f) {
    var d = data(), siren = String(f.siret || '').replace(/\D/g, '').slice(0, 9);
    var pros = d.clients.filter(function (c) { return c.type === 'pro'; });
    var prosOk = pros.filter(function (c) { return String(c.siren || '').replace(/\D/g, '').length === 9; });
    var items = [
      [siren.length === 9, 'Votre SIREN', siren.length === 9 ? siren + ' (tiré de votre SIRET)' : 'Renseignez votre SIRET dans « Votre entreprise »'],
      [!!String(f.adresse || '').trim(), 'Votre adresse', f.adresse ? 'Renseignée' : 'Renseignez-la dans « Votre entreprise »'],
      [pros.length === prosOk.length, 'SIREN de vos clients professionnels', pros.length ? prosOk.length + ' sur ' + pros.length + ' renseignés' : 'Aucun client professionnel pour l\'instant'],
      [f.facturx !== false, 'Données Factur-X jointes à vos factures', 'Chaque PDF contient le fichier structuré (norme EN 16931) que lisent les plateformes'],
      [!!String(f.plateforme || '').trim(), 'Plateforme agréée choisie', f.plateforme ? esc(f.plateforme) : 'À choisir : c\'est elle qui reçoit vos factures et qui transmettra les vôtres']
    ];
    var ok = items.filter(function (x) { return x[0]; }).length;
    return '<div class="section" id="efact"><h2>Facturation électronique</h2><div class="card">' +
      '<div class="card-h"><span class="note">Réception obligatoire depuis le 1er septembre 2026 · émission et e-reporting au 1er septembre 2027 pour les micro-entreprises.</span><span class="pill ' + (ok === items.length ? 'ok' : 'warn') + '">' + ok + ' sur ' + items.length + '</span></div>' +
      '<div class="checklist">' + items.map(function (x) { return '<div class="ck' + (x[0] ? ' done' : '') + '"><span class="step-n">' + (x[0] ? icon('check', 14) : '!') + '</span><div><b>' + x[1] + '</b><span>' + x[2] + '</span></div></div>'; }).join('') + '</div>' +
      '<div class="form-grid" style="margin-top:14px"><label class="field"><span>Ma plateforme agréée</span><input class="input" id="s-pa" data-f="plateforme" value="' + esc(f.plateforme || '') + '" placeholder="Nom de la plateforme"><small>La liste officielle des plateformes immatriculées est publiée par l\'administration fiscale sur impots.gouv.fr.</small></label>' +
      '<label class="check"><input type="checkbox" id="s-fx" data-f="facturx"' + (f.facturx !== false ? ' checked' : '') + '><div><b>Joindre le fichier Factur-X</b><span>Nature de l\'opération indiquée automatiquement : ' + C.natureOperation(f) + '.</span></div></label></div>' +
      '</div></div>';
  }
  function connexions() {
    var gm = !hasClaude() ? 'Disponible quand Picaillon est ouvert dans Claude.' : S.caps.mcp ? 'Les devis, factures et relances partent depuis votre Gmail, PDF joint. Au premier envoi, Claude vous demande l\'autorisation.' : S.caps.mcp === null ? 'Indisponible dans cette vue : copiez les messages et joignez le PDF vous-même.' : 'Vérification…';
    if (WEB) return '<div class="section"><h2>Connexions</h2><div class="conn-grid">' +
      '<div class="card conn"><div class="card-h"><h2>Envoi des documents</h2></div><p class="note" style="margin:0">' +
      (SHARE ? 'Le bouton « Partager » joint le PDF à un e-mail, un SMS ou un WhatsApp, depuis votre téléphone.' : 'Téléchargez le PDF et joignez-le à votre e-mail : le message est prêt à copier, ou s\'ouvre dans votre messagerie.') +
      ' L\'envoi direct depuis Picaillon arrive avec Picaillon Pro.</p></div>' +
      '<div class="card conn"><div class="card-h"><h2>Banque</h2></div><p class="note" style="margin:0 0 12px">Importez un relevé (CSV ou OFX) : Picaillon marque payées les factures dont il retrouve le virement. Le fichier est lu sur votre appareil, il n\'est envoyé nulle part.</p><button class="btn btn-sm" data-act="bank">' + icon('up', 16) + 'Importer un relevé</button></div>' +
      '</div></div>';
    return '<div class="section"><h2>Connexions</h2><div class="conn-grid">' +
      '<div class="card conn"><div class="card-h"><h2>Envoi par Gmail</h2><span class="pill ' + (S.caps.mcp ? 'ok' : '') + '">' + (S.caps.mcp ? 'Prêt' : 'Hors ligne') + '</span></div><p class="note" style="margin:0">' + gm + '</p></div>' +
      '<div class="card conn"><div class="card-h"><h2>Banque</h2></div><p class="note" style="margin:0 0 12px">Importez un relevé (CSV ou OFX) : Picaillon marque payées les factures dont il retrouve le virement.</p><button class="btn btn-sm" data-act="bank">' + icon('up', 16) + 'Importer un relevé</button></div>' +
      '</div></div>';
  }
  function viewOnboarding() {
    var f = S.form;
    return topbar('Créer votre espace', { back: 'home', backAct: 'cancel-onb' }) +
      '<div class="onb"><p class="onb-intro">Trois minutes pour que vos devis et factures soient conformes et que vos cotisations soient calculées avec vos vrais taux. Vous pourrez tout modifier ensuite.' + (WEB ? ' Tout reste sur cet appareil : personne d\'autre n\'y a accès.' : '') + '</p>' +
      '<div class="card">' + profileFields(f) + docFields(f) +
      '<div class="btn-row" style="margin-top:22px"><button class="btn btn-primary" data-act="onb-save">' + icon('check', 18) + 'Créer mon espace</button><button class="btn btn-ghost" data-act="cancel-onb">Revenir à l\'exemple</button></div></div></div>';
  }
  function viewSettings() {
    var f = S.form, demo = S.mode === 'demo';
    var store = demo ? 'Vous êtes dans l\'exemple : les modifications ne sont pas enregistrées.' : S.storage === 'cloud' ? 'Vos données sont enregistrées dans votre espace privé et vous suivent sur tous vos appareils. Personne d\'autre ne peut les lire.'
      : WEB ? 'Vos données sont enregistrées uniquement sur cet appareil, dans ce navigateur : personne d\'autre n\'y a accès, pas même l\'équipe de Picaillon. En contrepartie, si vous effacez les données du navigateur ou changez de téléphone, elles sont perdues : exportez une sauvegarde chaque semaine et gardez-la dans vos fichiers ou envoyez-la-vous par e-mail.' + backupAge()
      : 'Vos données sont enregistrées dans ce navigateur. Exportez une sauvegarde régulièrement.';
    var plans = WEB ? '<div class="section" id="pro"><h2>Votre formule</h2><div class="plans">' +
      '<div class="plan"><div class="eyebrow">Gratuit</div><div class="price">0 € <small>pour toujours</small></div><ul>' +
      ['Devis, factures et avoirs illimités', 'Mentions légales automatiques', 'QR code de virement sur les factures', 'Calcul URSSAF, plafonds et livre des recettes', 'Signature des devis sur place', 'Rapprochement avec votre relevé bancaire'].map(function (x) { return '<li>' + icon('check', 16) + x + '</li>'; }).join('') + '</ul><span class="pill ok" style="justify-self:start">Formule actuelle</span></div>' +
      '<div class="plan pro"><div class="eyebrow" style="color:inherit;opacity:.7">Picaillon Pro · bientôt</div><div class="price">7,90 € <small>par mois</small></div><ul>' +
      ['Envoi direct par e-mail, PDF joint, et relances automatiques', 'Paiements reconnus tout seuls grâce à la synchro bancaire', 'Devis rédigés par l\'IA', 'Sauvegarde en ligne et accès depuis tous vos appareils', 'Facture électronique 2027 via une plateforme agréée', 'Sans mention « Créé avec Picaillon »'].map(function (x) { return '<li>' + icon('check', 16) + x + '</li>'; }).join('') +
      '</ul><span class="muted" style="font-size:13px">En préparation. Les testeurs seront prévenus en premier.</span></div></div></div>'
      : '<div class="section" id="pro"><h2>Votre formule</h2><div class="plans">' +
      '<div class="plan"><div class="eyebrow">Gratuit</div><div class="price">0 € <small>pour toujours</small></div><ul>' +
      ['Devis, factures et avoirs illimités', 'Mentions légales automatiques', 'QR code de virement sur les factures', 'Calcul URSSAF, plafonds et livre des recettes'].map(function (x) { return '<li>' + icon('check', 16) + x + '</li>'; }).join('') + '</ul><span class="pill ok" style="justify-self:start">Formule actuelle</span></div>' +
      '<div class="plan pro"><div class="eyebrow" style="color:inherit;opacity:.7">Picaillon Pro</div><div class="price">7,90 € <small>par mois</small></div><ul>' +
      ['Devis rédigés par l\'IA', 'Envoi et relances depuis votre Gmail, PDF joint', 'Signature des devis sur place', 'Paiements reconnus depuis votre relevé bancaire', 'Factur-X et préparation 2027', 'Sans mention « Créé avec Picaillon »'].map(function (x) { return '<li>' + icon('check', 16) + x + '</li>'; }).join('') +
      '</ul><span class="muted" style="font-size:13px">Pendant le lancement, toutes les fonctions Pro sont offertes.</span></div></div></div>';
    var dataSec = '<div class="section"><h2>Vos données</h2><div class="card"><p class="note" style="margin-top:0">' + store + '</p><div class="btn-row">' +
      (canDownload() ? '<button class="btn" data-act="export">' + icon('dl', 18) + 'Exporter une sauvegarde</button>' : '') +
      (!demo || WEB ? '<label class="btn" for="import-file">' + icon('up', 18) + 'Importer une sauvegarde<input type="file" id="import-file" accept="application/json,.json" hidden></label>' : '') +
      (demo ? '<button class="btn btn-primary" data-act="start">Commencer avec mes données</button>' : '<button class="btn" data-act="show-demo">Voir l\'exemple</button><button class="btn btn-ghost btn-danger" data-act="wipe">' + icon('trash', 18) + 'Tout effacer</button>') +
      '</div></div></div>';
    var rules = '<div class="section"><h2>Règles appliquées en ' + C.ANNEE_REF + '</h2><div class="table-wrap"><table class="data"><thead><tr><th>Activité</th><th class="n">Cotisations</th><th class="n">CFP</th><th class="n">Vers. libératoire</th><th class="n">Plafond micro</th><th class="n">Franchise TVA</th></tr></thead><tbody>' +
      Object.keys(C.ACTIVITES).map(function (k) { var a = C.ACTIVITES[k]; return '<tr><td>' + esc(a.label) + '</td><td class="n">' + pct(a.social) + '</td><td class="n">' + pct(a.cfp) + '</td><td class="n">' + pct(a.vl) + '</td><td class="n">' + eur(a.plafond, 0) + '</td><td class="n">' + eur(a.tva, 0) + ' / ' + eur(a.tvaMaj, 0) + '</td></tr>'; }).join('') +
      '</tbody></table></div><p class="note" style="margin:0">Taux URSSAF au 1er janvier 2026, plafonds 2026-2028, seuils de franchise de TVA inchangés en 2026. Pour 2025, Picaillon applique les règles de 2025 : 24,6 % pour les libéraux non réglementés et des plafonds de 188 700 € (vente) et 77 700 € (services). Sources : <a href="https://www.urssaf.fr" target="_blank" rel="noopener">urssaf.fr</a>, <a href="https://www.economie.gouv.fr/entreprises/micro-entreprise-auto-entreprise-charges-sociales" target="_blank" rel="noopener">economie.gouv.fr</a>. Picaillon vous aide à calculer ; en cas de doute, l\'URSSAF fait foi.</p></div>';
    return topbar('Réglages') +
      '<div style="max-width:900px">' + (demo ? '<div class="callout warn" style="margin-bottom:16px">' + icon('info', 18) + '<div>Ces réglages sont ceux de l\'exemple. Commencez avec vos données pour configurer votre propre espace.</div></div>' : '') +
      '<div class="card">' + profileFields(f) + docFields(f) + '<div class="callout ok" style="margin-top:22px">' + icon('check', 18) + '<div>' + (demo ? 'Les changements s\'appliquent tout de suite à l\'exemple, sans être enregistrés.' : 'Chaque modification est enregistrée automatiquement.') + '</div></div></div>' +
      '<div style="margin-top:26px" class="grid">' + (SITE ? testSection() : '') + efactSection(f) + connexions() + plans + dataSec + rules + (SITE ? legalLinks() : '') + '</div></div>';
  }
  function backupAge() {
    var t = +lsGet('backup');
    if (!t) return ' <b>Aucune sauvegarde pour l\'instant.</b>';
    var j = Math.floor((Date.now() - t) / 86400000);
    return ' Dernière sauvegarde : <b>' + (j < 1 ? 'aujourd\'hui' : j === 1 ? 'hier' : 'il y a ' + j + ' jours') + '</b>.';
  }
  function installable() { return SITE && !standalone() && (!!S.installEvt || IOS || /android/i.test(navigator.userAgent || '')); }
  function testSection() {
    return '<div class="section"><h2>Version de test</h2><div class="card">' +
      '<p class="note" style="margin-top:0">Picaillon est en test et gratuit. Ce qui marche mal, ce qui manque, ce qui vous ferait payer : votre avis décide de la suite.</p>' +
      '<div class="btn-row"><a class="btn btn-primary" href="' + esc(CFG.avis || '../avis.html') + '">' + icon('chat', 18) + 'Donner mon avis</a>' +
      (installable() ? '<button class="btn" data-act="install">' + icon('phone', 18) + 'Installer sur l\'écran d\'accueil</button>' : '') +
      (standalone() ? '<span class="pill ok">Installée sur cet appareil</span>' : '') + '</div></div></div>';
  }
  function legalLinks() {
    var b = CFG.legal || '../';
    return '<p class="note legal-links"><a href="' + esc(b) + 'mentions-legales.html">Mentions légales</a> · <a href="' + esc(b) + 'confidentialite.html">Confidentialité</a> · <a href="' + esc(b) + 'conditions.html">Conditions d\'utilisation</a> · <a href="' + esc(b) + 'index.html">Site de Picaillon</a></p>';
  }
  // Rappels de l'accueil (version web) : installer l'appli, sauvegarder ses données
  function webReminders() {
    if (!WEB) return '';
    var out = '';
    var docs = S.mode === 'real' ? data().docs.length : 0;
    var last = +lsGet('backup'), snooze = +lsGet('backup-snooze'), now = Date.now();
    var due = docs > 0 && (!last || now - last > 7 * 86400000) && (!snooze || now - snooze > 3 * 86400000);
    if (due) out += '<div class="callout warn remind" role="note">' + icon('alert', 18) + '<div class="grow"><b>' + (last ? 'Dernière sauvegarde il y a ' + Math.floor((now - last) / 86400000) + ' jours.' : (docs > 1 ? 'Vos ' + docs + ' documents sont' : 'Votre document est') + ' seulement sur cet appareil.') + '</b> Exportez une sauvegarde : en cas de perte du téléphone ou de nettoyage du navigateur, vous pourrez tout récupérer.</div>' +
      '<div class="btn-row"><button class="btn btn-sm btn-primary" data-act="export">' + icon('dl', 16) + 'Sauvegarder</button><button class="btn btn-sm btn-ghost" data-act="backup-later">Plus tard</button></div></div>';
    var hide = +lsGet('install-hide');
    if (!due && installable() && (!hide || (hide > 1 && now - hide > 14 * 86400000)) && (window.innerWidth || 1000) < 900) out += '<div class="callout remind" role="note">' + icon('phone', 18) + '<div class="grow"><b>Installez Picaillon sur votre écran d\'accueil.</b> Elle s\'ouvre comme une appli, marche sans réseau, et vos données sont mieux protégées.</div>' +
      '<div class="btn-row"><button class="btn btn-sm btn-primary" data-act="install">Installer</button><button class="btn btn-sm btn-ghost" data-act="install-later">Plus tard</button></div></div>';
    return out;
  }

  /* ---------- Modales ---------- */
  function payLines(d, court) {
    var s = st(), out = [];
    if (s.lienPaiement) out.push(court ? 'paiement en ligne : ' + s.lienPaiement : '- en ligne, par carte : ' + s.lienPaiement);
    if (s.iban) out.push(court ? 'virement : ' + s.iban : '- par virement : IBAN ' + s.iban + (s.bic ? ' · BIC ' + s.bic : '') + (s.qrVirement !== false ? ' (le QR code imprimé sur la facture remplit tout dans votre application bancaire)' : ''));
    return out;
  }
  function emailFor(d) {
    var s = st(), c = findClient(d.clientId), total = eur(C.docTotal(d)), isF = d.type === 'facture';
    var sign = '\n\nBien cordialement,\n' + (s.nom || '') + (s.nomCommercial ? '\n' + s.nomCommercial : '') + (s.tel ? '\n' + s.tel : '');
    var hello = 'Bonjour' + (c && c.type !== 'pro' ? ' ' + c.nom : '') + ',\n\n';
    if (d.type === 'avoir') {
      return {
        subject: 'Avoir ' + (d.numero || '') + ' · ' + (s.nomCommercial || s.nom), to: c && c.email || '',
        body: hello + 'Veuillez trouver ci-joint l\'avoir ' + d.numero + ' d\'un montant de ' + eur(Math.abs(C.docTotal(d))) + (d.origine ? ', sur la facture ' + d.origine.numero + ' du ' + C.fmtDate(d.origine.date) : '') + '.\n' +
          (d.statut === 'a_rembourser' ? 'Le remboursement vous sera versé très prochainement.\n' : d.statut === 'emis' ? 'Cette facture est annulée : vous n\'avez rien à régler.\n' : '') + sign
      };
    }
    if (isF) {
      var p = payLines(d);
      return {
        subject: 'Facture ' + (d.numero || '') + ' · ' + (s.nomCommercial || s.nom), to: c && c.email || '',
        body: hello + 'Veuillez trouver ci-joint la facture ' + d.numero + ' d\'un montant de ' + total + (d.objet ? ', pour : ' + d.objet.toLowerCase() : '') + '.\n' +
          (d.echeance && d.echeance !== d.date ? 'Le règlement est attendu avant le ' + C.fmtDateLong(d.echeance) + '.' : 'Le règlement est attendu à réception.') +
          (p.length ? '\n\nVous pouvez régler :\n' + p.join('\n') + '\n' : '\n') +
          '\nJe reste à votre disposition pour toute question.' + sign
      };
    }
    return {
      subject: 'Devis ' + d.numero + ' · ' + (d.objet || s.nomCommercial || s.nom), to: c && c.email || '',
      body: hello + 'Suite à notre échange, voici le devis ' + d.numero + (d.objet ? ' pour : ' + d.objet.toLowerCase() : '') + ', d\'un montant de ' + total + '.\n' +
        'Il est valable jusqu\'au ' + C.fmtDateLong(d.validite) + '.\n\n' +
        'Pour l\'accepter, renvoyez-le daté et signé avec la mention « Bon pour accord »' + (d.acompte ? ', accompagné d\'un acompte de ' + d.acompte + ' %' : '') + '.' +
        '\n\nN\'hésitez pas si vous avez des questions.' + sign
    };
  }
  function smsFor(d) {
    var s = st(), total = eur(C.docTotal(d)), sign = prenom(s) || s.nom || '';
    if (d.type === 'facture') {
      return 'Bonjour, voici la facture ' + d.numero + ' de ' + total + (d.objet ? ' (' + d.objet + ')' : '') + '. Merci de la régler ' +
        (d.echeance && d.echeance !== d.date ? 'avant le ' + C.fmtDate(d.echeance) : 'à réception') + (payLines(d, true).length ? ' (' + payLines(d, true).join(' ou ') + ')' : '') + '. Bonne journée, ' + sign;
    }
    if (d.type === 'avoir') {
      return 'Bonjour, voici l\'avoir ' + d.numero + ' de ' + eur(Math.abs(C.docTotal(d))) + (d.origine ? ' sur la facture ' + d.origine.numero : '') + '. Bonne journée, ' + sign;
    }
    return 'Bonjour, voici mon devis ' + d.numero + (d.objet ? ' pour : ' + d.objet.toLowerCase() : '') + ', ' + total + ', valable jusqu\'au ' + C.fmtDate(d.validite) +
      '. Pour l\'accepter, renvoyez-le signé avec « Bon pour accord »' + (d.acompte ? ' et un acompte de ' + d.acompte + ' %' : '') + '. Merci, ' + sign;
  }
  function smsBlock(body, c) {
    return (c && c.tel ? '<div class="kv"><span>Numéro</span><b style="user-select:all">' + esc(c.tel) + '</b></div>' : '<div class="callout warn" style="margin-bottom:8px">' + icon('info', 18) + '<div>Aucun numéro pour ce client. Ajoutez-le dans sa fiche.</div></div>') +
      '<div class="copybox" style="margin-top:10px"><textarea class="input" data-copy-src data-m="body" aria-label="Message" style="min-height:140px">' + esc(body) + '</textarea></div>';
  }
  function relanceFor(d, ton) {
    var s = st(), c = findClient(d.clientId), total = eur(C.docTotal(d)), e = C.etat(d, today()), pro = c && c.type === 'pro';
    var sign = '\n\n' + (s.nom || '') + (s.nomCommercial ? '\n' + s.nomCommercial : '') + (s.tel ? '\n' + s.tel : '');
    var ref = 'la facture ' + d.numero + ' du ' + C.fmtDate(d.date) + ', d\'un montant de ' + total;
    if (ton === 'demeure') {
      return {
        subject: 'Mise en demeure de payer · facture ' + d.numero,
        body: 'Madame, Monsieur,\n\nMalgré mes relances, ' + ref + ', échue le ' + C.fmtDate(d.echeance) + ', reste impayée à ce jour.\n\n' +
          'Par la présente, je vous mets en demeure de régler cette somme dans un délai de 8 jours à compter de la réception de ce courrier. ' +
          'Des pénalités de retard au taux de trois fois le taux d\'intérêt légal sont exigibles' + (pro ? ', ainsi qu\'une indemnité forfaitaire de 40 € pour frais de recouvrement' : '') + '.\n\n' +
          'À défaut de paiement dans ce délai, je serai contraint(e) d\'engager une procédure de recouvrement (injonction de payer).\n\nVeuillez agréer, Madame, Monsieur, mes salutations distinguées.' + sign,
        note: 'À envoyer de préférence en lettre recommandée avec accusé de réception.'
      };
    }
    if (ton === 'ferme') {
      return {
        subject: 'Deuxième relance · facture ' + d.numero + ' impayée',
        body: 'Bonjour,\n\nSauf erreur de ma part, ' + ref + ' reste impayée, avec ' + (e.jours || 0) + ' jours de retard sur l\'échéance du ' + C.fmtDate(d.echeance) + '.\n\n' +
          'Je vous remercie de procéder au règlement sous 8 jours' + (s.iban ? ' par virement (IBAN ' + s.iban + ')' : '') + '. ' +
          'Je vous rappelle que tout retard entraîne des pénalités au taux de trois fois le taux d\'intérêt légal' + (pro ? ' et une indemnité forfaitaire de 40 € pour frais de recouvrement' : '') + '.\n\nBien cordialement,' + sign
      };
    }
    return {
      subject: 'Rappel · facture ' + d.numero,
      body: 'Bonjour,\n\nSauf erreur de ma part, ' + ref + ', arrivée à échéance le ' + C.fmtDate(d.echeance) + ', n\'a pas encore été réglée.\n\n' +
        'Pourriez-vous procéder au règlement' + (s.iban ? ' par virement (IBAN ' + s.iban + ')' : '') + ' ? Si c\'est déjà fait, merci de ne pas tenir compte de ce message.\n\nBonne journée,' + sign
    };
  }
  function copyBlock(subject, body, c) {
    var m = S.modal || {};
    return '<div class="form-grid mail-fields"><label class="field"><span>À</span><input class="input" type="email" id="m-to" data-m="to" value="' + esc(m.to != null ? m.to : (c && c.email) || '') + '" placeholder="adresse@client.fr"></label>' +
      '<label class="field"><span>Objet</span><input class="input" id="m-subject" data-m="subject" value="' + esc(subject) + '"></label></div>' +
      '<div class="copybox" style="margin-top:10px"><textarea class="input" data-copy-src data-m="body" aria-label="Message">' + esc(body) + '</textarea></div>' +
      '<p class="note" style="margin:6px 0 0">' + icon('doc', 14) + ' ' + (S.caps.mcp ? 'Le PDF est joint automatiquement quand vous envoyez avec Gmail.' : SHARE ? '« Partager » joint le PDF à ce message dans Mail, WhatsApp ou l\'appli de votre choix.' : 'Téléchargez le PDF et joignez-le à votre e-mail.') + '</p>';
  }
  function gmailButtons(act, draftAct, label) {
    var m = S.modal || {};
    if (!S.caps.mcp) return '';
    return '<button class="btn" data-act="' + draftAct + '"' + (m.busy ? ' disabled' : '') + '>' + (m.busy === 'draft' ? 'Création…' : 'Brouillon Gmail') + '</button>' +
      '<button class="btn btn-primary" data-act="' + act + '"' + (m.busy ? ' disabled' : '') + '>' + icon('send', 18) + (m.busy === 'send' ? 'Envoi…' : label) + '</button>';
  }
  function modalHtml() {
    var m = S.modal;
    if (!m) return '';
    var inner = '';
    var head = function (title, sub) { return '<div class="modal-h"><div style="flex:1"><h2 id="modal-title">' + esc(title) + '</h2>' + (sub ? '<p class="note" style="margin:4px 0 0">' + sub + '</p>' : '') + '</div><button class="btn btn-ghost btn-icon" data-act="close" aria-label="Fermer">' + icon('x', 20) + '</button></div>'; };
    var d = m.id ? findDoc(m.id) : null, c = d ? findClient(d.clientId) : null;
    if (m.kind === 'welcome') {
      inner = head('Bienvenue sur Picaillon', 'Devis, factures et URSSAF pour les auto-entrepreneurs.') + '<div class="choice">' +
        '<button data-act="welcome-start"><span class="ic">' + icon('plus', 22) + '</span><span><b>Créer mon espace</b><span>3 minutes pour renseigner votre activité : vos devis et factures seront conformes</span></span></button>' +
        '<button data-act="welcome-demo"><span class="ic">' + icon('doc', 22) + '</span><span><b>Voir un exemple d\'abord</b><span>L\'espace de Camille, artisan peintre, déjà rempli. Testez tout librement : rien n\'est enregistré</span></span></button></div>' +
        (WEB ? '<p class="note" style="margin:14px 0 0">' + icon('check', 14) + ' Pas de compte à créer : tout reste sur cet appareil, personne d\'autre n\'y a accès.</p>' : '');
    } else if (m.kind === 'new') {
      inner = head('Créer') + '<div class="choice">' +
        '<button data-act="new" data-v="devis"><span class="ic">' + icon('doc', 22) + '</span><span><b>Devis</b><span>À faire signer avant les travaux</span></span></button>' +
        '<button data-act="new" data-v="facture"><span class="ic">' + icon('check', 22) + '</span><span><b>Facture</b><span>Pour un travail terminé ou un paiement reçu</span></span></button>' +
        '<button data-act="go" data-v="client"><span class="ic">' + icon('users', 22) + '</span><span><b>Client</b><span>Ajouter une fiche client</span></span></button></div>';
    } else if (m.kind === 'pay' && d) {
      var tx = C.tauxAt(st(), m.date || today()), tot = C.docTotal(d), part = C.round2(tot * tx.total / 100);
      if (d.type === 'avoir') {
        inner = head('Remboursement effectué', esc(d.numero) + ' · ' + esc(clientName(d.clientId)) + ' · ' + eur(Math.abs(tot))) +
          '<div class="form-grid"><div class="field full"><span>Date du remboursement</span>' + dateSel('m-date', m.date, 'm', 'date', { from: -3, to: 0 }) + '</div>' +
          '<label class="field"><span>Mode</span><select class="input" id="m-mode" data-m="mode">' + MODES.map(function (x) { return '<option' + (x === m.mode ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label></div>' +
          '<div class="callout" style="margin-top:14px">' + icon('info', 18) + '<div>Ce montant sera retiré de votre chiffre d\'affaires à déclarer pour la période du remboursement.</div></div>' +
          '<div class="foot"><button class="btn btn-ghost" data-act="close">Annuler</button><button class="btn btn-ok" data-act="pay-ok">' + icon('check', 18) + 'Enregistrer le remboursement</button></div>';
      } else
      inner = head('Paiement reçu', esc(d.numero || 'Facture brouillon') + ' · ' + esc(clientName(d.clientId)) + ' · ' + eur(tot)) +
        '<div class="form-grid"><div class="field full"><span>Date d\'encaissement</span>' + dateSel('m-date', m.date, 'm', 'date', { from: -3, to: 0 }) + '</div>' +
        '<label class="field"><span>Mode de règlement</span><select class="input" id="m-mode" data-m="mode">' + MODES.map(function (x) { return '<option' + (x === m.mode ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label></div>' +
        '<div class="callout ok" style="margin-top:14px">' + icon('info', 18) + '<div>Sur ' + eur(tot) + ', mettez <b>' + eur(part) + '</b> de côté pour l\'URSSAF' + (tx.vl ? ' et l\'impôt' : '') + '. Il vous reste ' + eur(tot - part) + '.</div></div>' +
        (!d.numero ? '<p class="note">La facture recevra son numéro définitif.</p>' : '') +
        '<div class="foot"><button class="btn btn-ghost" data-act="close">Annuler</button><button class="btn btn-ok" data-act="pay-ok">' + icon('check', 18) + 'Enregistrer le paiement</button></div>';
    } else if (m.kind === 'finalize' && d) {
      inner = head('Finaliser la facture', 'Elle recevra le numéro <b class="mono">' + esc(C.nextNumero(data().docs, 'facture', +d.date.slice(0, 4))) + '</b>.') +
        '<p class="note">Une fois numérotée, une facture ne peut plus être supprimée ni modifiée : c\'est la règle de la numérotation continue. Vérifiez le client, les montants et les dates.</p>' + legalWarnings(d, c) +
        '<div class="foot"><button class="btn btn-ghost" data-act="close">Vérifier encore</button><button class="btn btn-primary" data-act="finalize-ok">' + icon('check', 18) + 'Finaliser</button></div>';
    } else if (m.kind === 'send' && d) {
      var sms = m.canal === 'sms';
      inner = head(d.type === 'facture' ? 'Envoyer la facture' : d.type === 'avoir' ? 'Envoyer l\'avoir' : 'Envoyer le devis', sms ? 'Envoyez le PDF puis ce court message, par SMS ou WhatsApp.' : 'Joignez le PDF à votre e-mail. Le message est prêt à copier.') +
        '<div class="seg tone" role="group" aria-label="Moyen d\'envoi"><button data-act="canal" data-v="email" aria-pressed="' + !sms + '">E-mail</button><button data-act="canal" data-v="sms" aria-pressed="' + sms + '">SMS ou WhatsApp</button></div>' +
        (sms ? smsBlock(m.body, c) : copyBlock(m.subject, m.body, c)) + legalWarnings(d, c) +
        (m.err ? '<div class="callout bad" style="margin-top:12px">' + icon('alert', 18) + '<div>' + esc(m.err) + '</div></div>' : '') +
        (m.shared && d.statut === 'brouillon' ? '<div class="callout ok" style="margin-top:12px">' + icon('check', 18) + '<div>Message parti ? Confirmez ci-dessous : Picaillon suivra le ' + (d.type === 'devis' ? 'devis' : 'paiement') + ' pour vous.</div></div>' : '') +
        (!sms && S.caps.mcp ? '<div class="foot">' + gmailButtons('gmail-send', 'gmail-draft', 'Envoyer avec Gmail') + '</div><div class="foot alt"><span class="note">Ou à la main :</span>'
          : SHARE ? '<div class="foot"><button class="btn btn-primary" data-act="send-share">' + icon('share', 18) + 'Partager le PDF et le message</button></div><div class="foot alt"><span class="note">Ou :</span>'
          : '<div class="foot">') +
        (canDownload() ? '<button class="btn btn-sm" data-act="pdf" data-id="' + d.id + '">' + icon('dl', 16) + 'PDF</button>' : '') +
        (WEB && !sms ? '<button class="btn btn-sm" data-act="mailto">' + icon('mail', 16) + 'Ma messagerie</button>' : '') +
        (WEB && sms && c && c.tel ? '<button class="btn btn-sm" data-act="sms">' + icon('chat', 16) + 'Ouvrir les SMS</button>' : '') +
        '<button class="btn btn-sm" data-act="copy">' + icon('copy', 16) + 'Copier le message</button>' +
        '<button class="btn btn-sm' + ((!sms && S.caps.mcp) || (SHARE && !m.shared) ? '' : ' btn-primary') + '" data-act="sent-ok">' + icon('check', 16) + (d.statut === 'brouillon' ? (m.shared ? 'C\'est envoyé' : 'Je l\'ai envoyé moi-même') : 'Fermer') + '</button></div>';
    } else if (m.kind === 'relance' && d) {
      var tons = [['cordial', 'Rappel cordial'], ['ferme', 'Relance ferme'], ['demeure', 'Mise en demeure']];
      var r = relanceFor(d, m.ton);
      inner = head('Relancer ' + clientName(d.clientId), esc(d.numero) + ' · ' + eur(C.docTotal(d)) + ' · ' + esc(C.etat(d, today()).label)) +
        '<div class="seg tone" role="group" aria-label="Ton">' + tons.map(function (x) { return '<button data-act="tone" data-v="' + x[0] + '" aria-pressed="' + (m.ton === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>' +
        copyBlock(m.subject, m.body, c) + (r.note ? '<p class="note">' + esc(r.note) + '</p>' : '') +
        (m.err ? '<div class="callout bad" style="margin-top:12px">' + icon('alert', 18) + '<div>' + esc(m.err) + '</div></div>' : '') +
        (S.caps.mcp ? '<div class="foot">' + gmailButtons('relance-gmail', 'relance-draft', 'Envoyer la relance') + '</div><div class="foot alt"><span class="note">Ou à la main :</span>' : '<div class="foot">') +
        '<button class="btn btn-sm" data-act="copy">' + icon('copy', 16) + 'Copier</button><button class="btn btn-sm' + (S.caps.mcp ? '' : ' btn-primary') + '" data-act="relance-ok">' + icon('check', 16) + 'Noter la relance</button></div>';
    } else if (m.kind === 'install') {
      inner = head('Installer Picaillon', 'Une icône sur votre écran d\'accueil, l\'appli en plein écran, même sans réseau.') +
        (IOS ? '<ol class="howto"><li>Ouvrez cette page dans <b>Safari</b>.</li><li>Touchez le bouton <b>Partager</b> ' + icon('share', 16) + ' en bas de l\'écran.</li><li>Choisissez <b>Sur l\'écran d\'accueil</b>, puis <b>Ajouter</b>.</li></ol>'
          : '<ol class="howto"><li>Ouvrez le menu du navigateur <b>⋮</b> en haut à droite.</li><li>Choisissez <b>Installer l\'application</b> ou <b>Ajouter à l\'écran d\'accueil</b>.</li><li>Confirmez : Picaillon apparaît avec vos autres applis.</li></ol>') +
        '<p class="note">' + (IOS ? 'Sur iPhone, l\'appli installée a son propre espace, séparé de Safari. Si vous avez déjà saisi des données ici, exportez une sauvegarde (Réglages), puis importez-la dans l\'appli installée.' : 'L\'appli installée et cette page partagent les mêmes données sur ce téléphone.') + '</p>' +
        '<div class="foot"><button class="btn btn-primary" data-act="close">J\'ai compris</button></div>';
    } else if (m.kind === 'confirm') {
      inner = head(m.title, m.text) + '<div class="foot"><button class="btn btn-ghost" data-act="close">Annuler</button><button class="btn ' + (m.danger ? 'btn-primary' : 'btn-primary') + '" data-act="confirm-ok" style="' + (m.danger ? 'background:var(--bad);border-color:var(--bad);color:#fff' : '') + '">' + esc(m.ok) + '</button></div>';
    } else if (m.kind === 'avoir' && d) {
      var paid = d.statut === 'payee';
      inner = head('Créer un avoir', 'Sur la facture ' + esc(d.numero) + ' · ' + esc(clientName(d.clientId)) + ' · ' + eur(C.docTotal(d))) +
        (paid ? '<p class="note" style="margin-top:0">Cette facture a été payée : l\'avoir correspond à un remboursement au client. Il sera retiré de votre chiffre d\'affaires le jour du remboursement.</p>' +
          '<div class="choice"><button data-act="avoir-full" data-id="' + d.id + '"><span class="ic">' + icon('undo', 22) + '</span><span><b>Rembourser toute la facture</b><span>' + eur(C.docTotal(d)) + '</span></span></button>' +
          '<button data-act="avoir-partial" data-id="' + d.id + '"><span class="ic">' + icon('edit', 22) + '</span><span><b>Rembourser une partie</b><span>Geste commercial, prestation non réalisée…</span></span></button></div>'
        : '<p class="note" style="margin-top:0">La facture n\'a pas été payée : l\'avoir l\'annule entièrement, et elle sort de vos montants à encaisser. Vous pourrez ensuite établir une facture corrigée.</p>' +
          '<div class="foot"><button class="btn btn-ghost" data-act="close">Annuler</button><button class="btn btn-primary" data-act="avoir-full" data-id="' + d.id + '">' + icon('undo', 18) + 'Annuler la facture par un avoir</button></div>');
    } else if (m.kind === 'sign' && d) {
      inner = head('Signature du devis', esc(d.numero) + ' · ' + eur(C.docTotal(d))) +
        '<p class="note" style="margin-top:0">Tendez votre téléphone au client : il signe avec le doigt. En signant, il accepte ce devis (« bon pour accord »).</p>' +
        '<label class="field"><span>Nom du signataire</span><input class="input" id="m-signom" data-m="nom" value="' + esc(m.nom || '') + '"></label>' +
        '<div class="sign-pad"><canvas id="sign-canvas" aria-label="Zone de signature"></canvas><span class="sign-hint"' + ((m.strokes || []).length ? ' hidden' : '') + '>Signez ici</span></div>' +
        '<div class="foot"><button class="btn btn-ghost" data-act="sign-clear">Effacer</button><button class="btn btn-primary" data-act="sign-ok">' + icon('check', 18) + 'Valider la signature</button></div>';
    } else if (m.kind === 'banque') {
      if (!m.matches) {
        inner = head('Importer un relevé bancaire', 'Picaillon repère les virements qui correspondent à vos factures en attente.') +
          '<ol class="howto"><li>Dans l\'application ou le site de votre banque, exportez vos opérations récentes au format <b>CSV</b> ou <b>OFX</b>.</li><li>Choisissez ce fichier ci-dessous.</li><li>Vérifiez les correspondances proposées, puis validez.</li></ol>' +
          '<label class="btn btn-primary" for="bank-file">' + icon('up', 18) + 'Choisir le relevé<input type="file" id="bank-file" accept=".csv,.ofx,.qfx,.txt,text/csv" hidden></label>' +
          '<p class="note">Le fichier est lu sur votre appareil : il n\'est envoyé nulle part.</p>' +
          (m.err ? '<div class="callout bad">' + icon('alert', 18) + '<div>' + esc(m.err) + '</div></div>' : '');
      } else {
        var nb = m.matches.filter(function (x) { return x.checked; }).length;
        inner = head('Paiements reconnus', esc(m.fileName) + ' · ' + m.nbCredits + ' crédit' + (m.nbCredits > 1 ? 's' : '') + ' lu' + (m.nbCredits > 1 ? 's' : '') + ' · ' + m.nbAttente + ' facture' + (m.nbAttente > 1 ? 's' : '') + ' en attente') +
          (m.matches.length ? '<div class="bank-list">' + m.matches.map(function (x, i) {
            var f = findDoc(x.fid);
            return '<label class="bank-row"><input type="checkbox" data-bank="' + i + '"' + (x.checked ? ' checked' : '') + '><div class="bank-t"><b>' + esc(clientName(f.clientId)) + ' · <span class="mono">' + esc(f.numero) + '</span></b><span>' + C.fmtDate(x.date) + ' · ' + esc(x.libelle) + '</span>' +
              '<span class="chips">' + x.raisons.map(function (r) { return '<i>' + esc(r) + '</i>'; }).join('') + (x.sur ? '' : '<i class="warn">à vérifier</i>') + '</span></div><b class="num">' + eur(x.montant) + '</b></label>';
          }).join('') + '</div>' : '<div class="callout">' + icon('info', 18) + '<div>Aucun crédit du relevé ne correspond au montant exact d\'une facture en attente.</div></div>') +
          '<div class="foot"><button class="btn btn-ghost" data-act="bank-reset">Autre fichier</button><button class="btn btn-ok" data-act="bank-ok"' + (nb ? '' : ' disabled') + '>' + icon('check', 18) + 'Marquer ' + nb + ' facture' + (nb > 1 ? 's' : '') + ' payée' + (nb > 1 ? 's' : '') + '</button></div>';
      }
    } else if (m.kind === 'client') {
      inner = head('Nouveau client') + clientForm(m.form, 'm') + '<div class="foot"><button class="btn btn-ghost" data-act="close">Annuler</button><button class="btn btn-primary" data-act="mclient-ok">' + icon('check', 18) + 'Ajouter</button></div>';
    }
    return '<div class="overlay" data-act="overlay"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">' + inner + '</div></div>';
  }
  function openModal(m) { ensureTrap(); S.modal = m; render(); var el = document.querySelector('.modal input, .modal select, .modal textarea, .modal .btn-primary'); if (el && el.tagName !== 'TEXTAREA') el.focus(); }
  function closeModal() { if (S.modal && S.modal.kind === 'welcome') lsSet('welcome', 1); S.modal = null; render(); }
  // Premier lancement : on propose de créer son espace ou de visiter l'exemple
  function maybeWelcome() {
    if (S.real || S.modal || S.view !== 'home' || lsGet('welcome')) return;
    openModal({ kind: 'welcome' });
  }
  // Facture sans IBAN : pas de QR code de virement possible
  function ibanHint(d) {
    var s = st();
    if (d.type !== 'facture' || s.iban || s.qrVirement === false || d.statut === 'payee' || d.statut === 'annulee' || !(C.docTotal(d) > 0)) return '';
    return '<div class="callout remind iban-hint">' + icon('info', 18) + '<div class="grow"><b>Faites-vous payer plus vite.</b> Ajoutez votre IBAN : un QR code de virement s\'affichera sur la facture, et votre client paiera en le scannant avec son appli bancaire.</div>' +
      '<div class="btn-row"><button class="btn btn-sm btn-primary" data-act="add-iban">Ajouter mon IBAN</button></div></div>';
  }

  /* ---------- Actions ---------- */
  function noteRelance(d, ton) {
    var labels = { cordial: 'rappel cordial', ferme: 'relance ferme', demeure: 'mise en demeure' };
    d.relances = (d.relances || []).concat([{ date: today(), ton: labels[ton] || ton }]);
  }
  function creerAvoir(f, partiel) {
    var a = { type: 'avoir', numero: null, clientId: f.clientId, date: today(), objet: f.objet || '', origine: { id: f.id, numero: f.numero, date: f.date },
      lignes: (f.lignes || []).map(function (l) { return { designation: l.designation, qte: l.qte, unite: l.unite, pu: -C.num(l.pu) }; }),
      notes: '', statut: 'brouillon', adresseIntervention: f.adresseIntervention || '' };
    if (partiel) { S.draft = Object.assign(a, { id: null, _ai: '', _ech: true }); go('edit'); return; }
    a.id = uid(); a.createdAt = Date.now();
    upsertDoc(a); f.avoirId = a.id; upsertDoc(f);
    go('doc', a.id); toast('Avoir créé : vérifiez-le puis finalisez-le');
  }
  // Zone de signature : traits enregistrés en coordonnées 0..1
  function initSignPad() {
    var cv = document.getElementById('sign-canvas'); if (!cv || !S.modal) return;
    var m = S.modal, r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    m.ratio = r.width / r.height;
    var ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1a2a8c';
    var draw = function (st) { if (!st.length) return; ctx.beginPath(); ctx.moveTo(st[0][0] * r.width, st[0][1] * r.height); st.forEach(function (p) { ctx.lineTo(p[0] * r.width, p[1] * r.height); }); if (st.length === 1) ctx.lineTo(st[0][0] * r.width + 0.5, st[0][1] * r.height); ctx.stroke(); };
    (m.strokes || []).forEach(draw);
    var cur = null, hint = document.querySelector('.sign-hint');
    var pt = function (e) { var b = cv.getBoundingClientRect(); return [Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)), Math.max(0, Math.min(1, (e.clientY - b.top) / b.height))]; };
    cv.addEventListener('pointerdown', function (e) { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) { /* rien */ } cur = [pt(e)]; m.strokes = (m.strokes || []).concat([cur]); if (hint) hint.hidden = true; draw(cur); });
    cv.addEventListener('pointermove', function (e) {
      if (!cur) return; e.preventDefault();
      var p = pt(e), last = cur[cur.length - 1];
      if (Math.abs(p[0] - last[0]) + Math.abs(p[1] - last[1]) < 0.004) return;
      cur.push(p); ctx.beginPath(); ctx.moveTo(last[0] * r.width, last[1] * r.height); ctx.lineTo(p[0] * r.width, p[1] * r.height); ctx.stroke();
    });
    var end = function () { cur = null; };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end); cv.addEventListener('pointerleave', end);
  }
  function lireReleve(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var buf = new Uint8Array(reader.result), txt;
      try { txt = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { txt = new TextDecoder('windows-1252').decode(buf); }
      var credits = C.parseReleve(txt);
      if (!credits.length) { S.modal.err = 'Aucune opération lisible dans ce fichier. Exportez un relevé au format CSV ou OFX depuis votre banque.'; render(); return; }
      var attente = data().docs.filter(function (d) { return d.type === 'facture' && d.statut === 'envoyee'; });
      var res = C.rapprocher(credits, attente, data().clients);
      S.modal.fileName = file.name; S.modal.nbCredits = credits.filter(function (c) { return c.montant > 0; }).length; S.modal.nbAttente = attente.length;
      S.modal.matches = res.map(function (x) { return { fid: x.facture.id, date: x.credit.date, montant: x.credit.montant, libelle: x.credit.libelle, raisons: x.raisons, sur: x.sur, checked: x.sur }; });
      render();
    };
    reader.readAsArrayBuffer(file);
  }
  function markSent(d) {
    if (d.type === 'avoir') { if (!d.dateEnvoi) d.dateEnvoi = today(); upsertDoc(d); return; }
    if (d.type === 'facture' && !d.numero) d.numero = C.nextNumero(data().docs, 'facture', +d.date.slice(0, 4));
    if (d.statut === 'brouillon') { d.statut = d.type === 'facture' ? 'envoyee' : 'envoye'; d.dateEnvoi = today(); }
    upsertDoc(d);
  }
  var A = {
    go: function (el) { var v = el.dataset.v || 'home'; go(v, el.dataset.p || null); if (el.dataset.anchor) setTimeout(function () { var a = document.getElementById(el.dataset.anchor); if (a) a.scrollIntoView({ behavior: 'smooth' }); }, 30); },
    open: function (el) { go('doc', el.dataset.id); },
    'new-menu': function () { openModal({ kind: 'new' }); },
    'new': function (el) {
      S.draft = newDraft(el.dataset.v);
      if (el.dataset.client) S.draft.clientId = el.dataset.client;
      go('edit');
    },
    filter: function (el) { S.filter = el.dataset.v; render(); },
    start: function () {
      if (S.real && S.real.settings && S.real.settings.nom) { S.mode = 'real'; S.forcedDemo = false; go('home'); return; }
      S.real = { settings: Object.assign({}, DEFAULT_SETTINGS), clients: [], docs: [] };
      S.mode = 'real'; S.forcedDemo = false; go('onboarding');
    },
    'welcome-start': function () { lsSet('welcome', 1); S.modal = null; A.start(); },
    'welcome-demo': function () { closeModal(); },
    'add-iban': function () {
      go('settings');
      setTimeout(function () { var el = document.getElementById('s-iban'); if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); } }, 80);
    },
    'show-demo': function () { S.mode = 'demo'; S.forcedDemo = true; go('home'); },
    'cancel-onb': function () { if (!(S.real && S.real.settings && S.real.settings.nom)) { S.real = null; } S.mode = S.real ? 'real' : 'demo'; go('home'); },
    'onb-save': function () {
      var f = S.form;
      if (!String(f.nom || '').trim()) { toast('Indiquez votre prénom et votre nom.'); var el = document.getElementById('s-nom'); if (el) el.focus(); return; }
      S.real.settings = Object.assign({}, DEFAULT_SETTINGS, f, { nom: f.nom.trim() });
      S.real.settings.delaiPaiement = Math.max(0, parseInt(f.delaiPaiement, 10) || 0);
      S.real.settings.validiteDevis = Math.max(1, parseInt(f.validiteDevis, 10) || 30);
      S.real.settings.suiviDepuis = today();
      S.mode = 'real'; saveSettings();
      go('home'); toast('Votre espace est prêt. Créez votre premier devis avec le bouton +.');
    },
    'settings-save': function () {
      if (!String(S.form.nom || '').trim()) { toast('Indiquez votre prénom et votre nom.'); return; }
      clearTimeout(autoTimer); applySettings(); render();
      toast(S.mode === 'demo' ? 'Réglages de l\'exemple modifiés (non enregistrés)' : 'Réglages enregistrés');
    },
    'f-per': function (el) {
      S.form.periodicite = el.dataset.v; render();
      if (S.view === 'settings') autosave(el.dataset.v === 'mensuelle' ? 'Déclaration mensuelle enregistrée' : 'Déclaration trimestrielle enregistrée');
    },
    'f-type': function (el) { S.form.type = el.dataset.v; render(); },
    'm-type': function (el) { S.modal.form.type = el.dataset.v; render(); },
    'client-save': function () {
      var f = S.form;
      if (!String(f.nom || '').trim()) { toast('Indiquez le nom du client.'); return; }
      var isNew = !f.id;
      if (isNew) { f.id = uid(); f.createdAt = Date.now(); }
      f.nom = f.nom.trim();
      upsertClient(clone(f));
      toast(isNew ? 'Client ajouté' : 'Client enregistré');
      go('clients');
    },
    'client-del': function () {
      var f = S.form;
      openModal({ kind: 'confirm', title: 'Supprimer ' + f.nom + ' ?', text: 'La fiche client sera effacée.', ok: 'Supprimer', danger: true, run: function () { removeClient(f); toast('Client supprimé'); go('clients'); } });
    },
    'mclient-ok': function () {
      var f = S.modal.form;
      if (!String(f.nom || '').trim()) { toast('Indiquez le nom du client.'); return; }
      f.id = uid(); f.createdAt = Date.now(); f.nom = f.nom.trim();
      upsertClient(clone(f));
      if (S.draft) S.draft.clientId = f.id;
      S.modal = null; render(); toast('Client ajouté');
    },
    // Éditeur
    'ed-type': function (el) {
      var d = S.draft; d.type = el.dataset.v;
      if (d.type === 'facture') d.echeance = C.addDays(d.date, +st().delaiPaiement || 0);
      render();
    },
    'ed-add-line': function () {
      S.draft.lignes.push({ designation: '', qte: 1, unite: S.draft.lignes.length ? S.draft.lignes[S.draft.lignes.length - 1].unite || 'forfait' : 'forfait', pu: '' });
      render();
      var all = document.querySelectorAll('[data-k="designation"]'); if (all.length) all[all.length - 1].focus();
    },
    'ed-del-line': function (el) {
      var i = +el.dataset.i; S.draft.lignes.splice(i, 1);
      if (!S.draft.lignes.length) S.draft.lignes.push({ designation: '', qte: 1, unite: 'forfait', pu: '' });
      render();
    },
    'ed-save': function () { saveEditor(); },
    'ed-cancel': function () {
      var d = S.draft; S.draft = null;
      if (d && d.id) go('doc', d.id); else go('docs');
    },
    ai: function () { runAI(); },
    'ai-stop': function () { if (aiCtl) aiCtl.abort(); },
    // Documents
    edit: function (el) { var d = findDoc(el.dataset.id); if (!d) return; S.draft = Object.assign(clone(d), { _ai: '', _ech: true }); go('edit'); },
    dup: function (el) {
      var d = findDoc(el.dataset.id); if (!d) return;
      S.draft = newDraft(d.type, d); S.draft.devisId = null;
      go('edit'); toast('Copie créée : vérifiez le client et les dates.');
    },
    del: function (el) {
      var d = findDoc(el.dataset.id); if (!d) return;
      openModal({ kind: 'confirm', title: 'Supprimer ' + (d.type === 'avoir' ? 'cet avoir' : d.type === 'facture' ? 'cette facture' : 'le devis ' + d.numero) + ' ?', text: 'Cette action est définitive.', ok: 'Supprimer', danger: true, run: function () {
        removeDoc(d);
        data().docs.forEach(function (x) {
          if (x.factureId === d.id || x.acompteFactureId === d.id || x.avoirId === d.id) { if (x.factureId === d.id) x.factureId = null; if (x.acompteFactureId === d.id) x.acompteFactureId = null; if (x.avoirId === d.id) x.avoirId = null; upsertDoc(x); }
        });
        toast('Document supprimé'); go('docs');
      } });
    },
    pdf: function (el) { var d = findDoc(el.dataset.id); if (d) downloadPdf(d); },
    pay: function (el) { var d = findDoc(el.dataset.id); if (d) openModal({ kind: 'pay', id: d.id, date: today(), mode: d.modePaiement || 'Virement' }); },
    'pay-ok': function () {
      var m = S.modal, d = findDoc(m.id); if (!d) return closeModal();
      if (!m.date) { toast('Indiquez la date d\'encaissement.'); return; }
      if (d.type === 'avoir') {
        d.statut = 'rembourse'; d.datePaiement = m.date; d.modePaiement = m.mode || 'Virement'; upsertDoc(d);
        S.modal = null; render(); toast('Remboursement enregistré : ' + eur(Math.abs(C.docTotal(d)), 0) + ' retirés du chiffre d\'affaires'); return;
      }
      if (!d.numero) d.numero = C.nextNumero(data().docs, 'facture', +d.date.slice(0, 4));
      if (!d.dateEnvoi) d.dateEnvoi = d.date;
      d.statut = 'payee'; d.datePaiement = m.date; d.modePaiement = m.mode || 'Virement';
      upsertDoc(d);
      var tx = C.tauxAt(st(), m.date), tot = C.docTotal(d), part = C.round2(tot * tx.total / 100);
      S.modal = null; render();
      toast('+' + eur(tot, 0) + ' encaissés · ' + eur(tot - part, 0) + ' pour vous');
    },
    unpay: function (el) {
      var d = findDoc(el.dataset.id); if (!d) return;
      openModal({ kind: 'confirm', title: 'Annuler le paiement ?', text: 'La facture repassera en attente de paiement et sortira de votre livre des recettes.', ok: 'Annuler le paiement', run: function () {
        d.statut = 'envoyee'; d.datePaiement = null; upsertDoc(d); S.modal = null; render(); toast('Paiement annulé');
      } });
    },
    send: function (el) {
      var d = findDoc(el.dataset.id); if (!d) return;
      if (d.type === 'facture' && !d.numero) { openModal({ kind: 'finalize', id: d.id }); return; }
      var e = emailFor(d); openModal({ kind: 'send', id: d.id, subject: e.subject, body: e.body, to: e.to });
    },
    'finalize-ok': function () {
      var d = findDoc(S.modal.id); if (!d) return closeModal();
      d.numero = C.nextNumero(data().docs, 'facture', +d.date.slice(0, 4));
      upsertDoc(d);
      var e = emailFor(d); openModal({ kind: 'send', id: d.id, subject: e.subject, body: e.body, to: e.to });
      toast('Facture ' + d.numero + ' finalisée');
    },
    'sent-ok': function () {
      var d = findDoc(S.modal.id);
      if (d && d.statut === 'brouillon') { markSent(d); S.modal = null; render(); toast(d.type === 'facture' ? 'Facture marquée envoyée' : 'Devis marqué envoyé'); }
      else closeModal();
    },
    copy: function () { var ta = document.querySelector('[data-copy-src]'); var subj = S.modal && S.modal.subject; copyText((ta ? ta.value : '')); void subj; },
    relance: function (el) {
      var d = findDoc(el.dataset.id); if (!d) return;
      var n = (d.relances || []).length, ton = n === 0 ? 'cordial' : n === 1 ? 'ferme' : 'demeure';
      var r = relanceFor(d, ton), cl = findClient(d.clientId); openModal({ kind: 'relance', id: d.id, ton: ton, body: r.body, subject: r.subject, to: cl && cl.email || '' });
    },
    tone: function (el) { var m = S.modal, d = findDoc(m.id); m.ton = el.dataset.v; var r = relanceFor(d, m.ton); m.body = r.body; m.subject = r.subject; render(); },
    'relance-ok': function () {
      var m = S.modal, d = findDoc(m.id); if (!d) return closeModal();
      noteRelance(d, m.ton); upsertDoc(d); S.modal = null; render(); toast('Relance notée');
    },
    accept: function (el) {
      var d = findDoc(el.dataset.id); if (!d) return;
      d.statut = 'accepte'; d.dateAcceptation = today(); if (!d.dateEnvoi) d.dateEnvoi = d.date;
      upsertDoc(d); render(); toast('Devis accepté. Créez la facture quand le travail est fait.');
    },
    refuse: function (el) { var d = findDoc(el.dataset.id); if (!d) return; d.statut = 'refuse'; upsertDoc(d); render(); toast('Devis marqué refusé'); },
    reopen: function (el) { var d = findDoc(el.dataset.id); if (!d) return; d.statut = 'envoye'; upsertDoc(d); render(); },
    invoice: function (el) {
      var d = findDoc(el.dataset.id); if (!d) return;
      S.draft = newDraft('facture', d); S.draft.datePrestation = d.datePrestation || '';
      var acF = d.acompteFactureId && findDoc(d.acompteFactureId);
      if (acF) {
        S.draft.typeFacture = 'solde';
        S.draft.lignes.push({ designation: 'Acompte déjà facturé (facture ' + (acF.numero || 'brouillon') + ' du ' + C.fmtDate(acF.date) + ')', qte: 1, unite: 'forfait', pu: -C.docTotal(acF) });
      }
      go('edit'); toast(acF ? 'Facture de solde préremplie : l\'acompte est déjà déduit' : 'Facture préremplie à partir du devis ' + d.numero);
    },
    'invoice-acompte': function (el) {
      var d = findDoc(el.dataset.id); if (!d) return;
      var pctA = C.num(d.acompte), montant = C.round2(C.docTotal(d) * pctA / 100);
      var dr = newDraft('facture', null);
      dr.clientId = d.clientId; dr.devisId = d.id; dr.typeFacture = 'acompte';
      dr.objet = d.objet || '';
      dr.lignes = [{ designation: 'Acompte de ' + pctA + ' % sur le devis ' + d.numero + ' du ' + C.fmtDate(d.date) + (d.objet ? ' (' + d.objet + ')' : ''), qte: 1, unite: 'forfait', pu: montant }];
      dr.echeance = dr.date; dr._ech = true;
      S.draft = dr; go('edit'); toast('Facture d\'acompte de ' + eur(montant) + ' préremplie');
    },
    'guide-hide': function () { st().guideMasque = true; saveSettings(); render(); },
    'focus-charges': function () { var el = document.getElementById('cf-type'); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(function () { el.focus(); }, 350); } },
    canal: function (el) {
      var m = S.modal, d = findDoc(m.id); if (!d) return;
      m.canal = el.dataset.v; m.body = m.canal === 'sms' ? smsFor(d) : emailFor(d).body; m.err = null; render();
    },
    'copy-amount': function (el) { copyText(el.dataset.v, 'Montant copié : ' + el.dataset.v + ' €'); },
    // URSSAF
    declare: function (el) { var s = st(); s.declarations = Object.assign({}, s.declarations, {}); s.declarations[el.dataset.v] = true; saveSettings(); render(); toast('Période marquée déclarée'); },
    undeclare: function (el) { var s = st(); s.declarations = Object.assign({}, s.declarations); delete s.declarations[el.dataset.v]; saveSettings(); render(); },
    year: function (el) { S.year = +el.dataset.v; render(); },
    csv: function (el) { var y = +el.dataset.v; saveFile('livre-des-recettes-' + y + '.csv', C.livreRecettesCSV(data(), y)); },
    // Données
    export: function () {
      var d = data(), name = 'picaillon-sauvegarde-' + today() + '.json';
      var json = JSON.stringify({ app: 'picaillon', version: 1, exportedAt: new Date().toISOString(), settings: d.settings, clients: d.clients, docs: d.docs }, null, 2);
      if (WEB && S.mode === 'real') { lsSet('backup', Date.now()); lsSet('backup-snooze', null); }
      // iPhone : la feuille de partage permet « Enregistrer dans Fichiers » ou de s'envoyer le fichier
      if (SHARE && IOS) {
        try {
          var f = new File([json], name, { type: 'application/json' });
          if (navigator.canShare({ files: [f] })) {
            navigator.share({ files: [f], title: 'Sauvegarde Picaillon' }).then(function () { toast('Sauvegarde partagée'); render(); }, function (e) { if (!e || e.name !== 'AbortError') saveFile(name, json); });
            return;
          }
        } catch (e) { /* téléchargement classique */ }
      }
      saveFile(name, json);
      if (WEB) render();
    },
    mailto: function () {
      var m = S.modal; if (!m) return;
      var ta = document.querySelector('[data-copy-src]'), d = findDoc(m.id), c = d && findClient(d.clientId);
      var to = m.to != null ? m.to : (c && c.email) || '';
      toast('Pensez à joindre le PDF : bouton « PDF » pour le télécharger.');
      setTimeout(function () { window.location.href = mailtoHref(to, m.subject, ta ? ta.value : m.body); }, 50);
    },
    sms: function () {
      var m = S.modal, d = m && findDoc(m.id), c = d && findClient(d.clientId); if (!c || !c.tel) return;
      var ta = document.querySelector('[data-copy-src]'), tel = String(c.tel).replace(/[^\d+]/g, '');
      window.location.href = 'sms:' + tel + (IOS ? '&' : '?') + 'body=' + encodeURIComponent(ta ? ta.value : m.body);
    },
    'backup-later': function () { lsSet('backup-snooze', Date.now()); render(); },
    'share-pdf': function (el) { var d = findDoc(el.dataset.id); if (d) sharePdf(d); },
    'send-share': function () {
      var m = S.modal, d = m && findDoc(m.id); if (!d) return;
      var ta = document.querySelector('[data-copy-src]'), body = ta ? ta.value : m.body;
      sharePdf(d, body, m.canal === 'sms' ? '' : m.subject);
    },
    install: function () {
      var ev = S.installEvt;
      if (ev) {
        ev.prompt();
        (ev.userChoice || Promise.resolve({})).then(function (r) { if (r && r.outcome === 'accepted') { lsSet('install-hide', 1); toast('Picaillon est installé sur votre écran d\'accueil'); } S.installEvt = null; render(); });
        return;
      }
      openModal({ kind: 'install' });
    },
    'install-later': function () { lsSet('install-hide', Date.now()); render(); },
    wipe: function () {
      openModal({ kind: 'confirm', title: 'Effacer toutes vos données ?', text: 'Vos réglages, clients, devis et factures seront supprimés définitivement. Exportez une sauvegarde avant si besoin.', ok: 'Tout effacer', danger: true, run: function () {
        Store.wipe(); S.real = null; S.mode = 'demo'; S.forcedDemo = false; go('home'); toast('Données effacées');
      } });
    },
    'cf-freq': function (el) { S.chargeForm.freq = el.dataset.v; render(); },
    'charge-add': function () {
      var f = S.chargeForm, m = C.num(f.montant);
      if (!(m > 0)) { toast('Indiquez le montant de ce frais.'); var x = document.getElementById('cf-montant'); if (x) x.focus(); return; }
      var s = st(); s.charges = (s.charges || []).concat([{ id: uid(), type: f.type, label: chargeLabel(f.type), montant: C.round2(m), freq: f.freq }]);
      saveSettings();
      S.chargeForm = { type: f.type, montant: '', freq: f.freq };
      render(); toast(chargeLabel(f.type) + ' ajouté');
    },
    'charge-del': function (el) { var s = st(); s.charges = (s.charges || []).filter(function (c) { return c.id !== el.dataset.id; }); saveSettings(); render(); },
    'date-clear': function (el) { setDate(el.dataset.where, el.dataset.key, ''); },
    'gmail-send': function () { gmailSend({ draft: false }); },
    'gmail-draft': function () { gmailSend({ draft: true }); },
    'relance-gmail': function () { var ton = S.modal.ton; gmailSend({ draft: false, after: function (d) { noteRelance(d, ton); } }); },
    'relance-draft': function () { gmailSend({ draft: true }); },
    // Avoirs
    avoir: function (el) { var d = findDoc(el.dataset.id); if (d) openModal({ kind: 'avoir', id: d.id }); },
    'avoir-full': function (el) { var f = findDoc(el.dataset.id); if (f) creerAvoir(f, false); },
    'avoir-partial': function (el) { var f = findDoc(el.dataset.id); if (f) creerAvoir(f, true); },
    'avoir-finalize': function (el) {
      var d = findDoc(el.dataset.id); if (!d) return;
      var orig = d.origine && findDoc(d.origine.id), paid = orig && orig.statut === 'payee';
      if (orig && !paid && Math.abs(C.docTotal(d)) + 0.005 < C.docTotal(orig)) { toast('La facture n\'est pas payée : l\'avoir doit annuler tout son montant (' + eur(C.docTotal(orig)) + ').'); return; }
      var num = C.nextNumero(data().docs, 'avoir', +d.date.slice(0, 4));
      openModal({ kind: 'confirm', title: 'Finaliser l\'avoir ' + num + ' ?', text: paid ? 'Il sera numéroté et prêt à envoyer. Enregistrez le remboursement une fois le virement fait.' : 'Il sera numéroté et la facture ' + (orig ? orig.numero : '') + ' sera annulée. Cette opération est définitive.', ok: 'Finaliser', run: function () {
        d.numero = num; d.statut = paid ? 'a_rembourser' : 'emis';
        upsertDoc(d);
        if (orig && !paid) { orig.statut = 'annulee'; orig.avoirId = d.id; upsertDoc(orig); }
        S.modal = null; render(); toast('Avoir ' + num + ' finalisé');
      } });
    },
    // Signature sur place
    sign: function (el) { var d = findDoc(el.dataset.id); if (!d) return; var c = findClient(d.clientId); openModal({ kind: 'sign', id: d.id, nom: c ? c.nom : '', strokes: [] }); },
    'sign-clear': function () { S.modal.strokes = []; render(); },
    'sign-ok': function () {
      var m = S.modal, d = findDoc(m.id); if (!d) return closeModal();
      var pts = (m.strokes || []).reduce(function (x, s) { return x + s.length; }, 0);
      if (pts < 6) { toast('Le client doit signer dans le cadre.'); return; }
      if (!String(m.nom || '').trim()) { toast('Indiquez le nom du signataire.'); return; }
      var now = new Date();
      d.signature = { nom: String(m.nom).trim(), date: today(), heure: String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'), ratio: m.ratio || 3,
        strokes: m.strokes.map(function (s) { return s.map(function (p) { return [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000]; }); }) };
      d.statut = 'accepte'; d.dateAcceptation = today(); if (!d.dateEnvoi) d.dateEnvoi = today();
      upsertDoc(d); S.modal = null; render(); toast('Devis signé par ' + d.signature.nom);
    },
    // Relevé bancaire
    bank: function () { openModal({ kind: 'banque' }); },
    'bank-reset': function () { openModal({ kind: 'banque' }); },
    'bank-ok': function () {
      var m = S.modal, n = 0, tot = 0;
      m.matches.forEach(function (x) {
        if (!x.checked) return;
        var f = findDoc(x.fid); if (!f || f.statut !== 'envoyee') return;
        f.statut = 'payee'; f.datePaiement = x.date; f.modePaiement = /CHQ|CHEQUE|CHÈQUE/i.test(x.libelle) ? 'Chèque' : 'Virement';
        upsertDoc(f); n++; tot += C.docTotal(f);
      });
      S.modal = null; render(); toast(n + ' facture' + (n > 1 ? 's' : '') + ' marquée' + (n > 1 ? 's' : '') + ' payée' + (n > 1 ? 's' : '') + ' · +' + eur(tot, 0));
    },
    'confirm-ok': function () { var m = S.modal; if (m && m.run) m.run(); },
    close: function () { closeModal(); },
    overlay: function (el, ev) { if (ev.target === el) closeModal(); }
  };

  /* ---------- Événements ---------- */
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-act]');
    if (!el) return;
    var act = el.dataset.act;
    if (act === 'overlay' && ev.target !== el) return;
    if (el.tagName === 'A') ev.preventDefault();
    if (A[act]) A[act](el, ev);
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && S.modal) { closeModal(); return; }
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('[role="button"][data-act]')) { ev.preventDefault(); ev.target.click(); }
  });
  document.addEventListener('input', function (ev) {
    var el = ev.target, v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.dataset.li != null && S.draft) {
      var l = S.draft.lignes[+el.dataset.li]; if (!l) return;
      l[el.dataset.k] = v; updateTotals(); return;
    }
    if (el.dataset.ed && S.draft) {
      var k = el.dataset.ed;
      if (k === 'clientId') return;
      S.draft[k] = v;
      if (k === 'echeance' || k === 'validite') S.draft._ech = true;
      if (k === 'date' && v && !S.draft._ech) {
        S.draft.echeance = C.addDays(v, +st().delaiPaiement || 0); S.draft.validite = C.addDays(v, +st().validiteDevis || 30);
        var e1 = document.getElementById('ed-echeance'); if (e1) e1.value = S.draft.echeance;
        var e2 = document.getElementById('ed-validite'); if (e2) e2.value = S.draft.validite;
      }
      return;
    }
    if (el.dataset.f && S.form) { S.form[el.dataset.f] = v; return; }
    if (el.dataset.m && S.modal) {
      if (S.modal.form && el.dataset.m !== 'body') S.modal.form[el.dataset.m] = v; else S.modal[el.dataset.m] = v;
      if (S.modal.kind === 'pay' && el.dataset.m === 'date') { /* l'aperçu se met à jour à la validation */ }
      return;
    }
    if (el.dataset.q === 'docs') { S.q = v; document.getElementById('rows').innerHTML = docRows(); return; }
    if (el.dataset.q === 'clients') { S.cq = v; document.getElementById('rows').innerHTML = clientRows(); return; }
    if (el.dataset.cf === 'montant' && S.chargeForm) { S.chargeForm.montant = v; return; }
    if (el.hasAttribute('data-calc')) { S.calc = v; var o = document.getElementById('calc-out'); if (o) o.innerHTML = calcOut(); }
  });
  document.addEventListener('change', function (ev) {
    var el = ev.target;
    if (el.dataset.cf === 'type' && S.chargeForm) {
      S.chargeForm.type = el.value;
      for (var i = 0; i < CHARGES.length; i++) if (CHARGES[i][0] === el.value) S.chargeForm.freq = CHARGES[i][2];
      render(); return;
    }
    if (el.id === 'bank-file' && el.files && el.files[0] && S.modal) { lireReleve(el.files[0]); return; }
    if (el.dataset.bank != null && S.modal && S.modal.matches) { S.modal.matches[+el.dataset.bank].checked = el.checked; render(); return; }
    if (el.dataset.part) {
      var wrap = el.closest('.date-sel'), v = dateValue(wrap);
      if (v) setDate(wrap.dataset.where, wrap.dataset.key, v);
      return;
    }
    if (el.dataset.ed === 'clientId' && S.draft) {
      if (el.value === '__new') { el.value = S.draft.clientId || ''; openModal({ kind: 'client', form: { id: null, nom: '', type: 'particulier', email: '', tel: '', adresse: '', siren: '' } }); return; }
      S.draft.clientId = el.value; return;
    }
    if (el.dataset.f && S.form) {
      S.form[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value;
      if (S.view === 'settings') autosave();
      if (['acre', 'dateCreation', 'activite'].indexOf(el.dataset.f) >= 0) render();
      return;
    }
    if (el.dataset.m && S.modal && el.tagName === 'SELECT') { S.modal[el.dataset.m] = el.value; return; }
    if (el.id === 'import-file' && el.files && el.files[0]) {
      var reader = new FileReader();
      reader.onload = function () {
        var o = null;
        try { o = JSON.parse(String(reader.result)); } catch (e) { o = null; }
        if (!o || ['picaillon', 'pecule', 'encaisse'].indexOf(o.app) < 0 || !o.settings) { toast('Ce fichier n\'est pas une sauvegarde Picaillon.'); return; }
        openModal({ kind: 'confirm', title: 'Importer cette sauvegarde ?', text: (o.docs || []).length + ' documents et ' + (o.clients || []).length + ' clients remplaceront vos données actuelles.', ok: 'Importer', run: function () {
          var n = normalize(o);
          if (S.real) Store.wipe();
          S.real = n; S.mode = 'real';
          persist('settings', n.settings);
          n.clients.forEach(function (c) { persist('client', c); });
          n.docs.forEach(function (d) { persist('doc', d); });
          go('home'); toast('Sauvegarde importée');
        } });
      };
      reader.readAsText(el.files[0]);
    }
  });

  /* ---------- Démarrage ---------- */
  S.demo = Demo.demoState(today());
  try { var tab = localStorage.getItem(KEY + ':tab'); if (tab && tab !== 'home') S.view = tab; } catch (e) { /* rien */ }
  render();
  Store.boot();

  /* ---------- Version web : bouton retour, installation, hors ligne ---------- */
  if (WEB) {
    // Le bouton retour du téléphone ferme d'abord la fenêtre ouverte, revient à l'écran précédent, puis quitte
    try { history.replaceState({ picaillon: 'base' }, ''); } catch (e) { /* rien */ }
    ensureTrap();
    window.addEventListener('popstate', function () {
      if (!trapOn) return;
      trapOn = false;
      var handled = true;
      if (S.modal) closeModal();
      else {
        var backBtn = document.querySelector('.topbar [aria-label="Retour"]');
        if (backBtn) backBtn.click();
        else if (S.view !== 'home') go('home');
        else handled = false;
      }
      if (handled) ensureTrap();
      else if (standalone()) toast('Appuyez encore sur retour pour quitter Picaillon');
    });
    window.addEventListener('beforeinstallprompt', function (ev) { ev.preventDefault(); S.installEvt = ev; if (!S.modal && (S.view === 'home' || S.view === 'settings')) render(); });
    window.addEventListener('appinstalled', function () { lsSet('install-hide', 1); S.installEvt = null; render(); });
    // Données à l'abri du nettoyage automatique du navigateur dès qu'il y a quelque chose à protéger
    if (S.real && navigator.storage && navigator.storage.persist) { try { navigator.storage.persist(); } catch (e) { /* rien */ } }
    if (SITE && CFG.sw && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register(CFG.sw).then(function (reg) {
          reg.addEventListener('updatefound', function () {
            var w = reg.installing; if (!w || !navigator.serviceWorker.controller) return;
            w.addEventListener('statechange', function () { if (w.state === 'activated') toast('Picaillon a été mis à jour : la nouvelle version s\'affichera au prochain démarrage.'); });
          });
        }).catch(function () { /* hors ligne indisponible, l'appli marche quand même */ });
      });
    }
  }
})();
