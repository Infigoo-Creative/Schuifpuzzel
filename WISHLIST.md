# WISHLIST.md

> Uitsluitend toekomstige ideeën. Niets hierin wordt automatisch uitgevoerd — alleen gebruiken
> als inspiratie of wanneer er expliciet om gevraagd wordt. Ontstaan uit de audit van juli 2026
> (zie ook `README.md` voor de actuele architectuur) en de losse ideeën uit de oude `BACKLOG.md`.

**Leidraad (blijft gelden voor alle onderstaande ideeën):** Slideo moet bewust simpel blijven.
Geen accounts, geen XP, geen levels-systeem, geen munten, geen ingewikkelde achievements. Nieuwe
functies moeten weinig uitleg nodig hebben, direct begrijpelijk zijn, optioneel blijven, en de
snelle/eenvoudige speelervaring niet verzwaren.

---

## Kleine verbeteringen (quick wins)

Weinig tijd, meteen merkbaar.

- **"Al gespeeld vandaag"-status terug op de Dagelijkse kaart.** Nu de kaart bewust rustig is
  gemaakt (alleen icoon/titel/tekst), ontbreekt een klein signaal dat je vandaag al gespeeld hebt.
  *Waarde:* voorkomt dat een speler een vergeefse poging start. *Impact:* klein maar concreet.
  *Complexiteit:* laag — één klein statusregel/badge-element, geen nieuwe logica (de data — sterren,
  tijd — wordt al bijgehouden via `getDailyRecord`).
- **Lazy loading + modernere compressie voor de galerij-foto's** (`loading="lazy"`, en overwegen
  om WebP/AVIF naast de JPG's te serveren). *Waarde:* snellere eerste weergave op mobiel netwerk.
  *Impact:* klein, merkbaar bij trage verbindingen. *Complexiteit:* laag.
- **Duidelijke foutstaat bij een ongeldige/verlopen spelerscode** (bijv. `localStorage` bevat een
  code die server-side niet meer bestaat na een data-reset). Nu faalt dat stil. *Waarde:* voorkomt
  verwarring in een randgeval. *Impact:* klein. *Complexiteit:* laag.
- **Persoonlijk record extra vieren** — korte gouden gloed of iets meer confetti bij een PR.
  *Waarde:* extra dopamine-moment zonder nieuwe mechaniek. *Impact:* klein. *Complexiteit:* laag.
- **Kleine "net gemist"-meldingen** ("🤏 Zo dichtbij...", "Nog één poging?") wanneer je net geen
  record haalt. *Complexiteit:* laag — sluit aan op de bestaande `finish-lines.js`-structuur.
- **Uitbreiding van de eindteksten-pool** (50–100 in plaats van de huidige ~24 in `normal`).
  *Waarde:* houdt de afsluiting fris voor veelspelers. *Complexiteit:* laag, puur tekstwerk.
- **Speelse teksten bij lang stilstaan / een leuke maandag-of-weekendtekst.** *Complexiteit:* laag.

## Middelgrote verbeteringen

Duidelijke waarde, wat meer werk.

- **Eén gedeelde woordenlijst voor moderatie** (nu gedupliceerd in `moderation.js` en
  `shared.php`). Bijvoorbeeld een `banned-words.json` die beide inladen. *Waarde:* voorkomt dat de
  lijsten uit sync raken. *Impact:* middel (voorkomt toekomstige bugs, geen zichtbare UI-impact).
  *Complexiteit:* middel — PHP kan JSON direct lezen, client-build is er niet dus JS zou 'm via
  `fetch` moeten laden (async-impact op moderation.js's huidige sync-API).
- **Eerste unit-tests voor `puzzle.js`** (shuffleWalk, trySwap, isSolved, solveBoard zijn pure
  functies, uitstekend testbaar zonder DOM). *Waarde:* vangt regressies in de kernlogica voordat ze
  live gaan. *Impact:* middel, onzichtbaar voor spelers maar groot voor onderhoudbaarheid.
  *Complexiteit:* middel — vereist keuze van een lichte test runner (bv. Node's ingebouwde
  `node --test`, geen extra dependency nodig).
- **Snelheidslabels na afloop** (🐌 Ontspannen t/m 🚀 Razendsnel), gebaseerd op tijd/formaat.
  *Waarde:* extra, luchtige feedbacklaag naast de sterren-efficiëntie. *Impact:* middel.
  *Complexiteit:* laag–middel (drempelwaarden per bordgrootte bepalen, zoals nu al bij
  `EFFICIENCY_THRESHOLDS`).
- **Easter eggs** (meerdere keren op het logo klikken, geheim toetsenbordwoord, verborgen
  animatie) — puur voor sfeer, geen invloed op gameplay. *Complexiteit:* middel qua bedenken/testen,
  laag qua code.
- **Seizoensgebonden teksten/confetti** (Kerst, Pasen, verjaardag van de site). *Waarde:*
  terugkerende reden om weer te kijken. *Complexiteit:* middel (datumlogica + contentbeheer).

## Grote uitbreidingen

Brengen de app naar een hoger niveau; alleen doen na expliciete keuze, niet automatisch.

- **`app.js` opsplitsen in cohesieve modules** (bijv. `audio.js`, `daily-challenge.js`,
  `profile-ui.js`, `onboarding.js`, los van de huidige 1300+ regels in één bestand). *Waarde:*
  beter overzicht en makkelijker onboarden van een nieuwe developer. *Impact:* geen zichtbare
  UX-impact, wel groot voor onderhoudbaarheid op lange termijn. *Complexiteit:* hoog — puur
  mechanisch maar foutgevoelig zonder tests (zie hierboven); pas doen ná de unit-tests-stap.
  **Let op:** geen technische noodzaak, dus alleen doen als de omvang van het bestand écht gaat
  hinderen — voorkom refactoren omwille van het refactoren.
- **Van file-based JSON-opslag naar een echte database** (bijv. SQLite) voor scores/voortgang.
  *Waarde:* schaalt beter bij veel gelijktijdige spelers/schrijfacties dan `flock()` op losse
  JSON-bestanden. *Impact:* groot bij een grote campagne, verwaarloosbaar bij de huidige schaal.
  *Complexiteit:* hoog — raakt `api.php`, `progress.php`, `admin.php` en het deploy-/backupproces.
- **Rate limiting op `api.php`/`progress.php`** — al genoemd in `README.md` als aandachtspunt "voor
  een grote campagne", nog niet gebouwd. *Waarde:* voorkomt misbruik/spam bij veel verkeer.
  *Complexiteit:* middel–hoog, afhankelijk van hostingmogelijkheden (IP-gebaseerd op file-niveau,
  of op serverconfiguratieniveau).
- **Grotere, willekeurige gameplay-teksten/humor-laag** zoals beschreven in de oude `BACKLOG.md`
  (mystery-meldingen, rubber-duck-easter-egg) — leuk, maar bewust laag geprioriteerd omdat het geen
  kernwaarde toevoegt.
