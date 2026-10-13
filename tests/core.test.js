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

test('ACRE Cipav : taux officiels 13,4 % avant le 1er juillet 2026, 17,4 % ensuite', () => {
  const avant = C.tauxAt({ activite: 'cipav', acre: true, dateCreation: '2026-03-15' }, '2026-04-01');
  assert.equal(avant.acre, true);
  assert.equal(avant.social, 13.4);
  const apres = C.tauxAt({ activite: 'cipav', acre: true, dateCreation: '2026-07-01' }, '2026-08-01');
  assert.equal(apres.acre, true);
  assert.equal(apres.social, 17.4);
  // Hors période ACRE : taux normal
  assert.equal(C.tauxAt({ activite: 'cipav', acre: true, dateCreation: '2026-03-15' }, '2027-01-02').social, 23.2);
});

test('ACRE : 50 % / 75 % selon la date de début d\'activité, jusqu\'à la fin du 3e trimestre civil suivant', () => {
  const s = { activite: 'artisan', acre: true, dateCreation: '2026-03-15' };
  assert.equal(C.acreInfo(s).fin, '2026-12-31');
  assert.equal(C.tauxAt(s, '2026-10-01').social, 10.6);
  assert.equal(C.tauxAt({ activite: 'artisan', acre: true, dateCreation: '2026-07-01' }, '2026-08-01').social, 15.9);
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

// Texte d'un PDF généré par documentPDF (polices WinAnsi, donc lecture en latin1)
function textePDF(d, client) {
  const s = { nom: 'Camille Test', activite: 'service', siret: '12345678900011' };
  const pdf = Buffer.from(C.documentPDF(d, client, s, {})).toString('latin1');
  return [...pdf.matchAll(/\((.*?)\) Tj/g)].map((m) => m[1].replace(/\\([()\\])/g, '$1')).join('\n');
}
const factureTest = { type: 'facture', numero: 'F-2026-001', date: '2026-10-01', echeance: '2026-10-31', statut: 'envoyee', lignes: [{ designation: 'Pose', qte: 1, pu: 1000 }] };

test('facture à un client pro : échéance, pénalités de retard et indemnité de 40 €', () => {
  const t = textePDF(factureTest, { nom: 'SARL Exemple', type: 'pro' });
  assert.match(t, /Conditions de paiement : à régler avant le 31\/10\/2026\./);
  assert.match(t, /pénalités au taux de trois fois le taux d'intérêt légal/);
  assert.match(t, /Indemnité forfaitaire pour frais de recouvrement : 40 \x80/);
});

test('facture à un particulier : pas d\'indemnité forfaitaire de 40 €', () => {
  const t = textePDF(factureTest, { nom: 'Jean Martin', type: 'particulier' });
  assert.match(t, /Conditions de paiement : à régler avant le 31\/10\/2026\./);
  assert.doesNotMatch(t, /Indemnité forfaitaire/);
  assert.doesNotMatch(t, /40 \x80/);
});

test('facture sans délai : paiement à réception écrit sur la facture', () => {
  const t = textePDF({ ...factureTest, echeance: factureTest.date }, { nom: 'SARL Exemple', type: 'pro' });
  assert.match(t, /Conditions de paiement : à réception de facture\./);
});
