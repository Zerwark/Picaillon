/* Picaillon — site vitrine : en-tête, calculateur, formulaires */
(function () {
  'use strict';
  var top = document.querySelector('.top');
  if (top) {
    var onScroll = function () { top.classList.toggle('scrolled', window.scrollY > 8); };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }

  // Calculateur « si je reçois X, combien il me reste »
  var calc = document.getElementById('calc');
  if (calc) {
    var rates = {};
    try { rates = JSON.parse(calc.getAttribute('data-rates')); } catch (e) { rates = {}; }
    var fmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
    var fmt2 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
    var pct = function (n) { return String(n).replace('.', ',') + ' %'; };
    var $ = function (id) { return document.getElementById(id); };
    var parse = function (v) { var n = parseFloat(String(v).replace(/\s| | /g, '').replace(',', '.')); return isFinite(n) && n > 0 ? n : 0; };
    var update = function () {
      var a = rates[$('c-act').value] || rates.service, x = parse($('c-amount').value), vl = $('c-vl').checked;
      var soc = x * a.social / 100, cfp = x * a.cfp / 100, imp = vl ? x * a.vl / 100 : 0, net = x - soc - cfp - imp;
      $('c-net').textContent = fmt.format(Math.round(net));
      $('c-net-l').textContent = x ? 'vous restent sur ' + fmt.format(x) + ' encaissés, soit ' + pct(Math.round((net / x) * 1000) / 10) + '.' : 'Indiquez un montant encaissé.';
      $('c-soc').textContent = fmt2.format(soc); $('c-soc-l').textContent = 'Cotisations URSSAF · ' + pct(a.social);
      $('c-cfp').textContent = fmt2.format(cfp); $('c-cfp-l').textContent = 'Formation professionnelle · ' + pct(a.cfp);
      $('c-imp').textContent = vl ? fmt2.format(imp) : '—';
      $('c-imp-l').textContent = vl ? 'Impôt (versement libératoire) · ' + pct(a.vl) : 'Impôt sur le revenu : calculé à part';
      var w = function (v) { return x ? (v / x * 100).toFixed(2) + '%' : '0%'; };
      $('b-net').style.width = w(Math.max(net, 0)); $('b-soc').style.width = w(soc); $('b-cfp').style.width = w(cfp); $('b-vl').style.width = w(imp);
    };
    ['c-amount', 'c-act', 'c-vl'].forEach(function (id) { var el = $(id); el.addEventListener('input', update); el.addEventListener('change', update); });
    update();
  }

  // Formulaires : un seul envoi, et message clair dans l'aperçu (hors Netlify)
  var preview = document.documentElement.hasAttribute('data-preview');
  Array.prototype.forEach.call(document.querySelectorAll('form[data-netlify]'), function (f) {
    f.addEventListener('submit', function (ev) {
      var btn = f.querySelector('button[type="submit"]');
      if (preview) {
        ev.preventDefault();
        var msg = f.querySelector('.form-msg');
        if (msg) { msg.hidden = false; msg.textContent = 'Aperçu : ce formulaire fonctionnera une fois le site en ligne sur Netlify.'; }
        return;
      }
      if (btn) { btn.disabled = true; btn.textContent = 'Envoi…'; }
    });
  });

  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();
