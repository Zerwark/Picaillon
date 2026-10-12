// Tests du cœur métier (calculs URSSAF). Lancer : node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/core.js');

test('taux 2026 des services commerciaux, sans ACRE ni versement libératoire', () => {
  const t = C.tauxAt({ activite: 'service' }, '2026-03-10');
  assert.equal(t.social, 21.2);
  assert.equal(t.cfp, 0.1);
  assert.equal(t.vl, 0);
  assert.equal(t.total, 21.3);
  assert.equal(t.acre, false);
});

test('cotisations sur 1 000 € encaissés en services', () => {
  const r = C.cotisations([{ date: '2026-03-10', montant: 1000 }], { activite: 'service' });
  assert.deepEqual([r.ca, r.social, r.cfp, r.vl, r.total, r.net], [1000, 212, 1, 0, 213, 787]);
});

test('versement libératoire ajouté quand il est choisi', () => {
  const t = C.tauxAt({ activite: 'liberal', vl: true }, '2026-05-02');
  assert.equal(t.social, 25.6);
  assert.equal(t.vl, 2.2);
  assert.equal(t.total, 28);
});

test('ACRE : taux social divisé par deux pour une création avant le 1er juillet 2026', () => {
  const s = { activite: 'service', acre: true, dateCreation: '2026-02-10' };
  const t = C.tauxAt(s, '2026-03-01');
  assert.equal(t.acre, true);
  assert.equal(t.social, 10.6);
});

test('règles 2025 encore appliquées aux encaissements de 2025', () => {
  assert.equal(C.tauxAt({ activite: 'liberal' }, '2025-06-01').social, 24.6);
  assert.equal(C.activite({ activite: 'service' }, 2025).plafond, 77700);
});

test('plafonds et franchise de TVA 2026', () => {
  const v = C.activite({ activite: 'vente' }, 2026), s = C.activite({ activite: 'service' }, 2026);
  assert.equal(v.plafond, 203100);
  assert.equal(v.tva, 85000);
  assert.equal(s.plafond, 83600);
  assert.equal(s.tva, 37500);
});
