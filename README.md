# Schuifpuzzel

Een online schuifpuzzel met instelbare moeilijkheidsgraad (3×3 t/m 6×6), een kiesgalerij met 9 foto's, timer, zettenteller, applaus + confetti bij het oplossen, een gedeelde top 10 per niveau (met rank-context als je daarbuiten valt), en voortgang die bewaard blijft via een persoonlijke 6-cijferige code (geen account nodig).

## Lokaal bekijken

Open `index.html` direct in de browser. Zonder PHP-server werkt de puzzel volledig, maar wordt de ranglijst alleen lokaal (per browser, via `localStorage`) opgeslagen — zie "Scores en persistentie" hieronder voor wat dat in de praktijk betekent.

## Online zetten

**Automatisch (huidige setup):** elke push naar `main` op GitHub deployt automatisch via FTP naar de hostingserver (zie `.github/workflows/deploy.yml`). FTP-inloggegevens staan als GitHub Secrets (`FTP_SERVER`/`FTP_USERNAME`/`FTP_PASSWORD`/`FTP_PORT`); `data/*.json` en `README.md` worden bewust overgeslagen bij elke deploy.

**Handmatig (fallback, bijv. eerste keer of zonder GitHub Actions):**

1. Upload de hele map naar een server met PHP 8 of nieuwer.
2. Zorg dat de map `data` schrijfbaar is voor PHP (rechten `755`, bij sommige hosts `775`).
3. Open `index.html` via je domein. De ranglijst wordt dan automatisch gedeeld tussen alle spelers, per moeilijkheidsgraad, en blijft staan onafhankelijk van wie er langskomt.

### Scores en persistentie

- **Lokaal zonder PHP** (bijvoorbeeld tijdens het testen op je eigen computer): scores staan in de `localStorage` van die ene browser. Ze blijven bewaard tussen sessies in dezelfde browser, maar verdwijnen als je een andere browser/profiel gebruikt, en zijn nooit zichtbaar voor andere spelers.
- **Live met PHP**: scores staan server-side in `data/scores-{grootte}.json` en zijn voor iedereen gelijk, voor altijd — totdat een admin ze verwijdert via `admin.php`.
- **Bij het opnieuw uploaden/deployen** van een nieuwe versie: de map `data` staat in `.gitignore`, dus die gaat niet mee in git-commits. Zorg dat je deploymethode (FTP-sync, git pull op de server, etc.) de map `data` niet overschrijft of leegmaakt — anders verlies je de opgebouwde ranglijst. Bij een simpele FTP-sync betekent dit: sluit `/data` uit van de upload (alleen bij de allereerste keer hoeft de lege map met `.gitkeep` mee).

## Beheer en scores verwijderen

Open `admin.php` via je domein. Gebruikersnaam en wachtwoord staan in `config.php` (`$adminUsername` / `$adminPassword`) — verander ze gerust naar iets dat je makkelijker onthoudt. Je kunt per niveau (3×3 t/m 6×6) inloggen en scores definitief verwijderen.

De meegeleverde `.htaccess`-bestanden blokkeren op Apache directe toegang tot `config.php` en de map `data`. Gebruik je Nginx, blokkeer die paden dan in de serverconfiguratie.

## Bestandsoverzicht

- `index.html`, `styles.css` — pagina en vormgeving (Apple-achtige stijl: rond, glaseffect, frisse kleuren).
- `app.js` — koppelt UI, instellingen en foto-kiezer aan de puzzellogica; regelt ook geluid, confetti en voortgang.
- `puzzle.js` — pure puzzellogica (schudden, zetten, oplossing checken), los van de DOM.
- `api-client.js` — praat met `api.php`, met automatische fallback naar `localStorage` (inclusief dezelfde rank/context-structuur).
- `progress.js` — clientside state voor de speler-code en voltooide foto×niveau-combinaties, praat met `progress.php`.
- `moderation.js` — clientside blacklist-check voor grove/seksistische namen (directe feedback; `shared.php` is de echte poortwachter).
- `shared.php` — gedeelde constanten/helpers (toegestane formaten/foto's, blacklist, JSON-bestanden lezen/schrijven) voor `api.php` en `progress.php`.
- `api.php`, `progress.php`, `admin.php`, `config.php` — backend voor de gedeelde ranglijst, voortgang en beheer.
- `manifest.json`, `assets/icon*.png`, `assets/apple-touch-icon.png` — "toevoegen aan beginscherm"/PWA-iconen voor mobiel (zie ook de `safe-area-top`-balk en headerpadding in `styles.css` voor de notch/camera-uitsparing).
- `version.json` — automatisch gegenereerd build-nummer + datum (zie `.git/hooks/pre-commit`), getoond als klein stempel onderaan de pagina.
- `BACKLOG.md` — ideeën voor latere uitbreidingen; alleen ter inspiratie, niet automatisch uitvoeren.

## Voortgang zonder account

Bij de eerste keer naam invullen genereert de server (via `progress.php`) een unieke 6-cijferige code (getoond als "ID" in de speler-balk), die lokaal (`localStorage`) onthouden wordt — op dat apparaat/browser is er dus nooit een code nodig. Voltooi je een foto op een niveau (los van leaderboard-positie, gewoon: opgelost), dan wordt die combinatie als "uitgespeeld" gemarkeerd:

- een trofee-badge op de foto in de kiesgalerij (per geselecteerd niveau),
- stipjes onder elke moeilijkheidsgraad (hoeveel van de 9 foto's op dat niveau klaar zijn),
- een totaalbalk op de hoofdpagina ("X van 36 levels voltooid").

Op een ander apparaat/browser klik je op "Heb je al een code?" en vul je de code in — de voortgang van die code wordt dan opgehaald en samengevoegd met wat er lokaal al stond. Zonder PHP-server (lokale demo) wordt een code alleen lokaal gegenereerd; cross-device herstel werkt dan niet (logisch, er is dan niets om te delen).

Wijzig je je naam tijdens het spelen (zelfde code/apparaat), dan wordt die nieuwe naam ook automatisch toegepast op alle eerder behaalde scores van die code — zowel server-side (`action: 'rename'` in `api.php`/`progress.php`) als in de lokale demo-fallback. Geldt alleen voor scores die zijn opgeslagen ná invoering van deze koppeling (oudere scores hebben nog geen `code`-veld).

Voortgang staat server-side in `data/progress/{code}.json` — zelfde aandachtspunt als bij scores: laat deze map ongemoeid bij het deployen van updates (zie "Scores en persistentie").

## Foto's kiezen

Spelers kiezen vóór het starten een foto uit een vaste galerij van 9 (zie `assets/gallery/`). Geen eigen foto-upload (meer) in de UI — die functionaliteit is bewust geparkeerd in `app.js` (zoek naar de uitgecommentarieerde `wireImageUpload`-functie) zodat hij later makkelijk terug te zetten is.

## Namen modereren

`moderation.js` (client) en `shared.php` (server, de echte poortwachter, gebruikt door zowel `api.php` als `progress.php`) controleren namen tegen een woordenlijst, met normalisatie tegen simpele omzeiltrucs (hoofdletters, cijfers i.p.v. letters zoals "k4nker"). Dit is geen waterdicht filter — creatieve omzeiling blijft mogelijk. Vul de lijst (`BANNED_WORDS`) in beide bestanden gerust aan; houd ze wel in lijn met elkaar. Voor naleving achteraf: gebruik `admin.php` om ongepaste scores handmatig te verwijderen.

## Testgereedschap: Help en Autosolve

Tijdens het spelen staan er naast "Stop poging" twee hulpknoppen:

- **Help** — toont de stuknummers op de tegels en laat de klok 2x zo snel lopen zolang hij actief is (een eerlijke prijs voor de hint).
- **Autosolve** — lost de actieve puzzel automatisch op (A*-zoekalgoritme in `puzzle.js`), met een willekeurige korte pauze tussen zetten, zodat je niet telkens handmatig hoeft te schuiven tijdens het testen. Werkt vlot op 3×3/4×4; op 5×5/6×6 lukt het niet altijd binnen de tijdslimiet (hij stopt dan netjes met een melding, in plaats van vast te lopen).

Zet `ENABLE_AUTOSOLVE = false` boven in `app.js` om die knop helemaal te verbergen vóór je live gaat — de Help-knop is wél bedoeld om te blijven staan, dat is een leuke speler-feature.

## Voor livegang

- Pas titel en teksten aan naar wens.
- Zet `ENABLE_AUTOSOLVE` in `app.js` op `false`.
- Voor een grote campagne is een database en rate limiting op `api.php`/`progress.php` aan te raden.
- Zie "Scores en persistentie" hierboven voordat je een update deployt.

## Workflow

Hoe ik (Claude) met dit project werk, sessie na sessie:

- Lees dit bestand aan het begin van iedere sessie.
- Houd dit bestand actueel: voeg alleen informatie toe die nuttig is voor een volgende sessie.
- Werk secties bij zodra functionaliteit of een belangrijke ontwerpkeuze wijzigt; verwijder wat niet meer klopt.
- Houd het document compact en overzichtelijk — dit is geen changelog. Geen geschiedenis van wat ooit gedaan is, alleen de actuele stand van zaken.
- Test wijzigingen (desktop én mobiel, licht én donker thema) voordat een taak als afgerond geldt.
- Maak na een volledig afgeronde taak één logische Git-commit met een Nederlandse, beschrijvende boodschap en push die naar GitHub — niet na elke kleine tussenstap of test.
