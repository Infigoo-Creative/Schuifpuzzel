# Schuifpuzzel

Een online schuifpuzzel met instelbare moeilijkheidsgraad (3×3 t/m 6×6), optionele eigen foto-upload, timer, zettenteller en een gedeelde top 10 per niveau.

## Lokaal bekijken

Open `index.html` direct in de browser. Zonder PHP-server werkt de puzzel volledig, maar wordt de ranglijst alleen lokaal (per browser) opgeslagen.

## Online zetten

1. Upload de hele map naar een server met PHP 8 of nieuwer.
2. Zorg dat de map `data` schrijfbaar is voor PHP (rechten `755`, bij sommige hosts `775`).
3. Open `index.html` via je domein. De ranglijst wordt dan automatisch gedeeld tussen alle spelers, per moeilijkheidsgraad.

## Beheer en scores verwijderen

Open `admin.php` via je domein. Het beheerwachtwoord staat in `config.php` — verander `$adminPassword` vóór publicatie naar een lang, uniek wachtwoord. Je kunt per niveau (3×3 t/m 6×6) inloggen en scores definitief verwijderen.

De meegeleverde `.htaccess`-bestanden blokkeren op Apache directe toegang tot `config.php` en de map `data`. Gebruik je Nginx, blokkeer die paden dan in de serverconfiguratie.

## Bestandsoverzicht

- `index.html`, `styles.css` — pagina en vormgeving.
- `app.js` — koppelt UI, instellingen en upload aan de puzzellogica.
- `puzzle.js` — pure puzzellogica (schudden, zetten, oplossing checken), los van de DOM.
- `api-client.js` — praat met `api.php`, met automatische fallback naar `localStorage`.
- `api.php`, `admin.php`, `config.php` — backend voor de gedeelde ranglijst en beheer.

## Eigen afbeelding

Spelers kunnen vóór het starten een eigen foto uploaden; die wordt alleen lokaal in de browser gebruikt (niet naar de server gestuurd). Zonder upload wordt `assets/puzzle-default.png` gebruikt.

## Voor livegang

- Pas titel en teksten aan naar wens.
- Voor een grote campagne is een database en rate limiting op `api.php` aan te raden.
