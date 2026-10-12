/* Picaillon — données d'exemple, générées autour de la date du jour */
(function (root) {
  'use strict';
  var Core = root.Core || (typeof require !== 'undefined' ? require('./core.js') : null);

  function demoState(today) {
    var y = +today.slice(0, 4), mNow = +today.slice(5, 7), dNow = +today.slice(8, 10);
    var iso = Core.iso, addDays = Core.addDays;
    var settings = {
      nom: 'Camille Roux',
      nomCommercial: 'Atelier Roux · Peinture & rénovation',
      adresse: '14 rue des Tanneurs\n69007 Lyon',
      siret: '912 345 678 00019',
      email: 'contact@atelier-roux.fr',
      tel: '06 12 34 56 78',
      iban: 'FR76 3000 4000 0312 3456 7890 143',
      bic: '',
      assurance: 'Décennale MAAF n° 123456 · France métropolitaine',
      activite: 'artisan',
      dateCreation: (y - 1) + '-03-02',
      acre: false,
      vl: true,
      periodicite: 'trimestrielle',
      delaiPaiement: 30,
      validiteDevis: 30,
      mentionTva: '',
      charges: [
        { id: 'ch1', type: 'assurance', label: 'Assurance pro (RC, décennale)', montant: 1200, freq: 'an' },
        { id: 'ch2', type: 'mutuelle', label: 'Mutuelle', montant: 65, freq: 'mois' },
        { id: 'ch3', type: 'vehicule', label: 'Véhicule et carburant', montant: 180, freq: 'mois' }
      ],
      declarations: {}
    };
    var clients = [
      { id: 'c1', nom: 'Sophie et Marc Lefèvre', type: 'particulier', email: 'sophie.lefevre@exemple.fr', tel: '06 22 41 18 90', adresse: '3 montée du Gourguillon\n69005 Lyon' },
      { id: 'c2', nom: 'Agence Saône Immobilier', type: 'pro', siren: '834 112 907', email: 'gestion@saone-immo.fr', tel: '04 78 00 12 34', adresse: '21 quai Saint-Antoine\n69002 Lyon' },
      { id: 'c3', nom: 'Karim Benali', type: 'particulier', email: 'k.benali@exemple.fr', tel: '07 61 09 33 20', adresse: '8 rue Paul Bert\n69003 Lyon' },
      { id: 'c4', nom: 'Café Le Comptoir', type: 'pro', siren: '901 554 218', email: 'bonjour@lecomptoir-lyon.fr', tel: '04 72 55 10 10', adresse: '45 rue de Marseille\n69007 Lyon' },
      { id: 'c5', nom: 'Hélène Morel', type: 'particulier', email: 'helene.morel@exemple.fr', tel: '06 87 40 51 26', adresse: '12 chemin de Montessuy\n69300 Caluire-et-Cuire' },
      { id: 'c6', nom: 'SCI Les Tilleuls', type: 'pro', siren: '512 780 344', email: 'sci.tilleuls@exemple.fr', tel: '04 78 61 72 80', adresse: '6 avenue Berthelot\n69007 Lyon' }
    ];
    var T = [
      ['Peinture salon et séjour (murs + plafonds)', [['Préparation des supports, rebouchage, ponçage', 38, 'm²', 9], ['Peinture murs, 2 couches mat', 86, 'm²', 18], ['Peinture plafond, 2 couches', 38, 'm²', 21]]],
      ['Rafraîchissement appartement locatif', [['Lessivage et sous-couche', 1, 'forfait', 480], ['Peinture murs, 2 couches', 104, 'm²', 17], ['Remplacement plinthes', 32, 'ml', 14]]],
      ['Pose de papier peint chambre', [['Dépose ancien revêtement', 1, 'forfait', 240], ['Pose papier peint intissé', 46, 'm²', 26]]],
      ['Façade intérieure du café', [['Main d\'œuvre', 5, 'jour', 380], ['Fournitures peinture lessivable', 1, 'forfait', 640]]],
      ['Réfection cage d\'escalier', [['Échafaudage et protection', 1, 'forfait', 450], ['Peinture murs et sous-face', 74, 'm²', 19], ['Laquage main courante', 12, 'ml', 22]]],
      ['Bandes et enduits placo', [['Pose bandes et enduits', 58, 'm²', 16], ['Ponçage et finition', 58, 'm²', 7]]]
    ];
    var docs = [], seqF = 0, seqD = 0;
    function lignes(t) { return t[1].map(function (l) { return { designation: l[0], qte: l[1], unite: l[2], pu: l[3] }; }); }
    function fact(o) {
      seqF++;
      var d = {
        id: 'f' + seqF, type: 'facture', numero: 'F-' + y + '-' + String(seqF).padStart(3, '0'), clientId: o.c, date: o.date,
        datePrestation: addDays(o.date, -3), echeance: addDays(o.date, 30), objet: T[o.t][0], lignes: lignes(T[o.t]),
        statut: o.statut || 'payee', datePaiement: o.paye || null, modePaiement: o.mode || 'Virement', notes: '', exemple: true
      };
      docs.push(d); return d;
    }
    // Factures réglées, du début de l'année jusqu'au mois dernier
    var plan = [[0, 1, 'c1'], [1, 2, 'c2'], [5, 2, 'c3'], [3, 3, 'c4'], [2, 3, 'c5'], [4, 4, 'c6'], [0, 5, 'c3'], [1, 5, 'c2'], [5, 6, 'c5'], [2, 6, 'c1'], [1, 7, 'c2'], [4, 8, 'c6'], [1, 9, 'c2'], [0, 9, 'c4']];
    plan.forEach(function (p, i) {
      var m = p[1];
      if (m >= mNow) return;
      var date = iso(y, m, 6 + (i * 5) % 17);
      fact({ t: p[0], c: p[2], date: date, paye: addDays(date, 9 + (i * 7) % 18), mode: i % 4 === 2 ? 'Chèque' : 'Virement' });
    });
    // Une facture en retard et une en attente
    fact({ t: 3, c: 'c4', date: addDays(today, -44), statut: 'envoyee' });
    fact({ t: 5, c: 'c5', date: addDays(today, -8), statut: 'envoyee' });
    // Devis
    function devis(o) {
      seqD++;
      var d = {
        id: 'd' + seqD, type: 'devis', numero: 'D-' + y + '-' + String(seqD).padStart(3, '0'), clientId: o.c, date: o.date,
        datePrestation: addDays(o.date, 20), validite: addDays(o.date, 30), objet: T[o.t][0], lignes: lignes(T[o.t]),
        statut: o.statut, acompte: 30, notes: '', exemple: true
      };
      docs.push(d); return d;
    }
    devis({ t: 4, c: 'c6', date: addDays(today, -6), statut: 'envoye' });
    devis({ t: 2, c: 'c3', date: addDays(today, -2), statut: 'envoye' });
    devis({ t: 0, c: 'c5', date: addDays(today, -1), statut: 'brouillon' });
    // Les trimestres échus avant le dernier sont déclarés
    var curKey = Core.periodKey(today, 'trimestrielle');
    for (var k = Core.periodShift(curKey, -2), n = 0; n < 8; n++, k = Core.periodShift(k, -1)) settings.declarations[k] = true;
    return { settings: settings, clients: clients, docs: docs };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { demoState: demoState }; else root.Demo = { demoState: demoState };
})(this);
