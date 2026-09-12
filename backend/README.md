# Aether Pronotepy Serverless API

Microservice FastAPI serverless pour l'application **Aether**, utilisant [pronotepy](https://github.com/bain3/pronotepy) pour se connecter à Pronote avec prise en charge complète des **comptes élèves** et des **comptes parents** (gestion multi-enfants).

---

## 🚀 Déploiement en 1 clic sur Vercel

1. **Prérequis** :
   - Un compte gratuit sur [Vercel](https://vercel.com)
   - Un compte gratuit sur [Upstash](https://upstash.com) (Redis)

2. **Créer une base Redis Upstash** :
   - Rendez-vous sur la console Upstash et créez une nouvelle base Redis (Global ou Régionale).
   - Copiez l'URL REST (`UPSTASH_REDIS_REST_URL`) et le token REST (`UPSTASH_REDIS_REST_TOKEN`).

3. **Déployer sur Vercel** :
   - **Option A (CLI Vercel)** :
     ```bash
     cd backend
     npx vercel
     ```
   - **Option B (GitHub)** :
     - Poussez votre dépôt sur GitHub.
     - Dans Vercel, cliquez sur **Add New > Project** et importez votre dépôt.
     - Dans les options du projet, réglez **Root Directory** sur `backend`.
     - Ajoutez les variables d'environnement suivantes :
       - `UPSTASH_REDIS_REST_URL`
       - `UPSTASH_REDIS_REST_TOKEN`
     - Cliquez sur **Deploy**.

4. Une fois déployé, Vercel vous donnera une URL du type :
   `https://aether-pronote-api.vercel.app`

---

## 💻 Exécution locale (Développement)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn api.index:app --reload --port 8000
```

Vous pouvez ensuite tester la documentation interactive Swagger sur `http://localhost:8000/docs`.

---

## 📱 Configuration dans Aether Mobile

Dans l'application Aether :
- Rendez-vous dans **Paramètres > Serveur Pronote API**.
- Renseignez l'URL de votre instance Vercel (ou `http://10.0.2.2:8000` si vous testez sur émulateur Android).
- Ou renseignez la variable d'environnement `EXPO_PUBLIC_PRONOTE_API_URL` avant la compilation.

---

## 🔐 Authentification

Toutes les routes (sauf `/`, `/health`, `/meta`, `/meta/ents`, `/auth/login`, `/auth/qrcode`, `/auth/token`) exigent le header :

```
X-Pronote-Auth: base64(json({url, username, password|token, uuid?, ent?, account_type, account_pin?, client_identifier?, device_name?}))
```

### MFA / 2FA (parité `pronotepy.ClientBase`)

Champs supportés sur `/auth/login`, `/auth/qrcode`, `/auth/token` (et retransmis par `init_client`) :

| Champ | Type | Rôle |
|---|---|---|
| `account_pin` | `str?` | Code PIN du compte (double-auth Pronote) |
| `client_identifier` | `str?` | Identifiant d'appareil persistant (rotation token) |
| `device_name` | `str?` | Nom d'appareil affiché côté Pronote |
| `skip_2fa` | `bool` (QR uniquement) | Passe la 2FA quand le QR est déjà validé |

Erreur MFA → **HTTP 428** (`Double authentification requise`), jamais un 401 générique.

### Rotation de token + `client_identifier`

- `POST /auth/qrcode` et `POST /auth/token` renvoient un **nouveau token** (`credentials` + `auth_token`) et `client_identifier`.
- Le client **doit persister** le nouveau `auth_token` (et `client_identifier`) après chaque login/token : Pronote fait tourner le secret (`client.password`).
- La clé de cache Redis (`_cache_key`) ne contient **jamais** `token`/`password` (hash SHA-256 de `url|username|uuid|account_type|parts`), donc la rotation n'invalide pas le cache et n'expose aucun secret.

---

## 📚 Référence des endpoints

| Méthode | Route | Auth | Description |
|---|---|---|---|
| GET | `/` | non | Statut + version + `redis_cached` |
| GET | `/health` | non | Healthcheck Vercel/uptime |
| POST | `/auth/login` | non | Login direct identifiants (+ `ent`, MFA) |
| POST | `/auth/qrcode` | non | Login QR mobile (`qr_data {login,jeton,url}`, `pin`, `uuid`) |
| POST | `/auth/token` | non | Re-login par token (`url,username,token,uuid`) |
| POST | `/auth/request-qr` | oui | **Nouveau** : génère un QR via `request_qr_code_data(pin)` |
| GET | `/periods/current` | oui | **Nouveau** : période courante (onglet `G==198`, parité `Client.current_period`) |
| GET | `/session/info` | oui | **Nouveau** : `start_day/week/logged_in/last_connection` (parité `ClientBase`) |
| GET | `/meta` | non | **Nouveau** : `pronotepy_version, grade_translate, ents, supported_account_types` |
| GET | `/meta/ents` | non | **Nouveau** : liste des ENT (`dir(pronotepy.ent)`) |
| GET | `/parent/children` | oui | Enfants du compte parent |
| GET | `/timetable?from_date&to_date&child?` | oui | EDT (fenêtre ≤ 62 j, `YYYY-MM-DD`) |
| POST | `/timetable/lesson-content` | oui | Contenu d'un cours (`lesson_id` ou `lesson_start`+`subject`, `date?`) |
| GET | `/timetable/contents?from_date&to_date` | oui | Contenus de la fenêtre (1 `PageCahierDeTexte`/semaine) |
| GET | `/timetable/pdf?day?&portrait?&overflow?&child?` | oui | **Params** : `day YYYY-MM-DD` (défaut année), `portrait bool=false`, `overflow 0..2` → `{url}` via `generate_timetable_pdf` |
| GET | `/grades?period?&child?` | oui | Notes + `status_code` (voir ci-dessous) |
| GET | `/grades/periods` | oui | Trimestres/semestres |
| GET | `/homework?from_date&to_date` | oui | Devoirs + pièces jointes |
| POST | `/homework/done` | oui | `set_done` (`homework_id, done, due_date?` indice ±7 j) |
| GET | `/attendance` | oui | Absences / retards / punitions |
| GET | `/news?only_unread?&date_from?&date_to?` | oui | **Filtres** : `only_unread bool=false`, `date_from/date_to YYYY-MM-DD` |
| POST | `/news/read` | oui | `mark_as_read(True)` |
| GET | `/canteen?from_date&to_date?` | oui | Menus |
| GET | `/chats?only_unread?&child?` | oui | **Filtre** : `only_unread bool=false` (passé à `client.discussions`) |
| GET | `/chats/{id}/messages` | oui | Messages d'une discussion |
| GET | `/chats/{id}/participants` | oui | **Nouveau** : `Discussion.participants()` |
| POST | `/chats/{id}/read` | oui | **Nouveau** : `Discussion.mark_as(read)` — body `{chat_id, read=true, child_name?}` |
| POST | `/chats/{id}/delete` | oui | **Nouveau** : `Discussion.delete()` (corbeille) — body `{chat_id, child_name?}` |
| POST | `/chats/send` | oui | Réponse (`chat_id, content, message_id?` → `Message.reply` ciblé) |
| GET | `/chats/recipients` | oui | Destinataires (`get_recipients`) |
| POST | `/chats/new` | oui | `new_discussion(subject, content, recipient_ids)` → résout le vrai id |
| GET | `/evaluations` | oui | Évaluations + paliers/acquisitions |
| GET | `/report` | oui | Bulletin (`comments, subjects`) |
| GET | `/teaching-staff` | oui | Équipe pédagogique |
| GET | `/ical-url` | oui | Export iCal (`export_ical`, `null` si indisponible) |
| GET | `/profile` | oui | `ClientInfo` (adresse, email, tél, INE, délégué) |
| GET | `/profile/picture` | oui | **Nouveau** : photo `Attachment → base64` (`{picture, mime, name}`, `null` si absente) |
| POST | `/files/download` | oui | Fichier base64 (`file_url|file_name`, `due_date?`, `child_name?`) |

Détail des nouveaux endpoints :

- `POST /auth/request-qr` — body `{pin: "1234", child_name?}`. `422` si PIN ≠ 4 chiffres. Retour `{qr: data}`.
- `GET /periods/current` — cache 300 s. `{period: {id, name, start, end}}`.
- `GET /session/info` — pas de cache (état vivant). `{start_day, week, logged_in, last_connection}` (ISO).
- `GET /meta` — **sans auth** (exprès, pour discovery client). Inclut `grade_translate` (table `|1..|8`).
- `GET /chats/{id}/participants|read|delete` — `404` si discussion introuvable.

Réponses listées exposent `X-Aether-Cache: HIT|MISS` quand servies par Redis (EDT, devoirs, notes, news, cantine, chats…).

---

## 📝 Notes : `grade status_code` (parité `Util.grade_parse`)

`GET /grades` renvoie par note : `value (float|None)`, `status_code (str|None)`, `raw_grade`, `out_of`, `average/max/min`, `coefficient`, `is_bonus/is_optionnal/is_out_of_20`.

| Brut Pronote | `value` | `status_code` |
|---|---|---|
| `"14,5"` (virgule FR) | `14.5` | `None` |
| `"12.5"` | `12.5` | `None` |
| `""` / `None` | `None` | `None` |
| `\|1` | `None` | `Absent` |
| `\|2` | `None` | `Dispense` |
| `\|3` | `None` | `NonNote` |
| `\|4` | `None` | `Inapte` |
| `\|5` | `None` | `NonRendu` |
| `\|6` | `None` | `AbsentZero` |
| `\|7` | `None` | `NonRenduZero` |
| `\|8` | `None` | `Felicitations` |

Table `GRADE_TRANSLATE` exposée via `GET /meta` — doit rester sync avec `pronotepy/dataClasses.py`.

---

## ⚠️ Limites & cas particuliers

- **Plafond 4 Mo** : `/files/download` et `/profile/picture` renvoient **413** au-delà de `4 * 1024 * 1024` octets (Vercel plafonne les réponses ~4,5 Mo ; le base64 exploserait sinon en 502 plateforme).
- **Comptes Vie Scolaire / Professeur → 501** : `init_client` et `/auth/login` rejettent `vie-scolaire|viescolaire|vie_scolaire|staff|professeur|teacher` (`élève` et `parent` uniquement).
- **ENT inconnu → 400** (`voir /meta/ents`), **PIN QR incorrect/expiré → 401**, **MFA → 428**.
- **Fenêtres de dates** : `parse_ymd` exige `YYYY-MM-DD` (`422` sinon) ; `clamp_window` exige `to_date ≥ from_date` et ≤ **62 jours** (`422` sinon).

## 🗺️ Exceptions pronotepy → HTTP (`_classify_pronote_error`)

Jamais de 401 générique quand un mapping précis existe :

| Exception pronotepy | HTTP | Détail |
|---|---|---|
| `QRCodeDecryptError` | 401 | PIN incorrect (QR indéchiffrable) |
| `CryptoError` | 401 | Identifiants incorrects (échec chiffrement) |
| *(défaut)* | 401 | Erreur d'initialisation Pronote |
| `MFAError` | 428 | Double authentification requise |
| `DiscussionClosed` | 403 | Discussion fermée |
| `ChildNotFound` | 404 | Enfant introuvable (compte parent) |
| `ExpiredObject` | 409 | Objet expiré (rouvrir la liste) |
| `UnsupportedOperation` | 501 | Fonction non supportée par l'établissement |
| `ENTLoginError` | 502 | Échec connexion ENT |
| `ParsingError` | 502 | Réponse Pronote inattendue |
| `DateParsingError` | 502 | Réponse Pronote inattendue |
| `ICalExportError` | 502 | Réponse Pronote inattendue |
| `DataError` | 401* | Fallback générique (pas de branche dédiée) |
| `PronoteAPIError` | 401* | Fallback générique (pas de branche dédiée) |
| *message* `429/too many/rate limit` | 429 | Pronote surchargé |
| *message* `timeout/connection error/502/503/504…` | 504 | Établissement injoignable |

\* `DataError` / `PronoteAPIError` avec message neutre → 401 ; avec message `429…`/`timeout…` → 429/504 via heuristique.

---

## 🧪 Tests offline

```bash
cd backend
python3 -m pytest tests/test_pronotepy_parity.py -v
```

`tests/test_pronotepy_parity.py` (aucun appel réseau, `pronotepy` stubé via `sys.modules` si absent) couvre : `grade_parse` (`|1..|8`, `"14,5"→14.5`, `""→None`), les **13** exceptions, stabilité `_cache_key` (aucun token/password), validation `clamp_window`/`parse_ymd`, préservation `id` de `_serialize_attachment`.
