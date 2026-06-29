// Eindteksten die na het oplossen van een puzzel willekeurig getoond worden, gegroepeerd per
// situatie. Nieuwe tekst toevoegen? Voeg 'm toe aan de juiste array hieronder — verder hoeft
// er niets in app.js aangepast te worden. Houd ze kort (±60 tekens), luchtig en met maximaal
// één emoji.
export const FINISH_LINES = {
  // Nieuwe #1 op dit niveau (snelste tijd op de ranglijst).
  newFirst: [
    '👑 Nieuw record! Iedereen mag weer oefenen.',
    '🚀 Jij bent nu officieel de te kloppen speler.',
    '🏆 De kroon staat je goed.',
    '⚡ Die tijd blijft niet zomaar staan.',
    '🎯 Sneller kan bijna niet.',
  ],
  // Plek 2 of 3.
  top3: [
    '🥈 Podium! Daar hoort applaus bij.',
    '🎉 De top drie ziet er ineens mooier uit.',
    '👏 Netjes... heel netjes.',
    '⭐ Je schuift duidelijk met beleid.',
    '🏁 Het podium lonkt alweer.',
  ],
  // Plek 5 t/m 10.
  top10: [
    '🔥 Top 10! Niet verkeerd.',
    '😎 De top begint gezellig vol te raken.',
    '📈 We zien een stijgende lijn.',
    '🧩 Je hoort erbij.',
    '💪 Nog een klein zetje richting het podium.',
  ],
  // Plek 4 — net buiten het podium.
  almostPodium: [
    '🤏 Zo dichtbij...',
    '😅 Dat scheelde bijna niks.',
    '🎯 Nog één goede poging.',
    '👀 Het podium keek al even jouw kant op.',
    '🚀 Deze smaakt naar revanche.',
  ],
  // Geen ranglijst-plek, maar wel sneller dan je eigen vorige poging op deze foto/niveau.
  personalRecord: [
    '✨ Nieuw persoonlijk record!',
    '📈 Je vorige versie baalt een beetje.',
    '💥 Je wordt sneller.',
    '🚀 Lekker bezig!',
    '👏 Dat oefenen werkt dus echt.',
  ],
  // Geen van bovenstaande: een gewone, prima voltooiing.
  normal: [
    'Niet slecht. Je koffie was nog warm.',
    'Dat ging sneller dan je WiFi.',
    'Deze tegels zijn inmiddels duizelig.',
    'Schuifkampioen in opleiding.',
    'Je muis heeft overuren gedraaid.',
    'Die laatste tegel werkte niet echt mee.',
    'De tegels liggen weer op hun plek.',
    'Geen tegel is gewond geraakt.',
    'Weer een puzzel gered.',
    'Je scherm kan weer ontspannen.',
    'Netjes geschoven.',
    'Je vingers weten inmiddels de weg.',
    'Zelfs de lege tegel is tevreden.',
    'Dit was officieel een schuifsessie.',
    'De finish zag je al aankomen.',
    'Niet vloeken tegen de tegels hè.',
    'Deze puzzel geeft zich gewonnen.',
    'Dat zag er soepeltjes uit.',
    'Je hebt de chaos weer verslagen.',
    'De tegels mogen weer naar huis.',
    'Eén puzzel rijker.',
    'Zelfs de puzzel moest even bijkomen.',
    'De schuifmotor draait op volle toeren.',
    'Je bent officieel weer iets handiger.',
    'Nog eentje dan? 😉',
  ],
};

let lastLine = null;

// Kiest één willekeurige tekst uit de juiste categorie; herhaalt nooit dezelfde tekst die
// hiervoor getoond werd. Valt terug op 'normal' als de categorie niet bestaat of leeg is.
export function pickFinishLine(category) {
  const options = FINISH_LINES[category]?.length ? FINISH_LINES[category] : FINISH_LINES.normal;
  const pool = options.length > 1 ? options.filter((line) => line !== lastLine) : options;
  const choice = pool[Math.floor(Math.random() * pool.length)];
  lastLine = choice;
  return choice;
}
