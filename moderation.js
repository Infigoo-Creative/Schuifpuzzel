// Eenvoudige blacklist tegen grove/seksistische/discriminerende namen.
// Dit is geen waterdicht filter (zie README) — vul deze lijst aan naar wens.
// Houd `api.php` (BANNED_WORDS) hiermee in lijn, want de server is de echte poortwachter.
export const BANNED_WORDS = [
  'hoer', 'hoeren', 'slet', 'sletje', 'kutwijf', 'teef',
  'kanker', 'kankerlijer', 'mongool', 'mongol', 'spast', 'retard',
  'neger', 'nikker', 'nigger', 'makak', 'pleurislijer',
  'kut', 'lul', 'klootzak', 'fuck', 'bitch', 'slut', 'whore', 'cunt', 'faggot',
];

function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // diakritische tekens weg
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't')
    .replace(/[^a-z]/g, '');
}

export function containsBannedWord(text) {
  const normalized = normalize(text);
  return BANNED_WORDS.some((word) => normalized.includes(word));
}
