# Politique de Confidentialité — Aether
*Dernière mise à jour : 5 septembre 2026*

La protection de votre vie privée et de vos données scolaires est au cœur de la conception d'**Aether**. Cette politique de confidentialité explique en toute transparence quelles données sont utilisées par l'application, comment elles sont traitées, et pourquoi vos informations personnelles restent sous votre contrôle exclusif.

---

## 1. Notre engagement fondamental

> **Vos données scolaires et personnelles vous appartiennent.**  
> Aether ne vend pas, ne loue pas, ne partage pas et n'exploite pas vos données personnelles à des fins commerciales ou publicitaires. L'application est totalement exempte de publicité, de traceurs et d'outils de profilage.

---

## 2. Quelles données sont traitées et où sont-elles stockées ?

### A. Données d'authentification et identifiants
- **Ce qui est utilisé** : Votre identifiant Pronote/ENT, jetons d'accès de session (tokens d'authentification générés par Pronote), et un identifiant unique d'appareil (UUID) généré localement pour sécuriser la session mobile.
- **Où sont-elles stockées** : **Exclusivement sur votre appareil**, dans un stockage local chiffré via le moteur haute performance **MMKV** (`react-native-mmkv`).
- **Mots de passe** : Vos mots de passe saisis lors d'une connexion par navigateur (ENT) sont directement transmis au portail d'authentification officiel de votre établissement/académie et ne sont jamais enregistrés en clair par Aether.

### B. Données de scolarité
- **Ce qui est affiché** : Vos notes, moyennes, coefficients, emplois du temps, devoirs et cahiers de textes, relevés d'assiduité (absences, retards, punitions), menus de cantine, actualités de l'établissement et messages de la messagerie Pronote.
- **Traitement** : Ces informations sont interrogées directement auprès des serveurs Pronote de votre établissement scolaire via notre microservice d'API (ou votre propre serveur auto-hébergé).
- **Stockage local** : Elles sont mises en cache localement sur votre téléphone (via WatermelonDB / SQLite local) pour permettre une consultation ultra-rapide et un accès hors-ligne. Elles ne sont **jamais** conservées sur une base de données distante appartenant à Aether.

---

## 3. Rôle du microservice d'API et hébergement

Aether utilise un microservice open-source basé sur la bibliothèque reconnue [**`pronotepy`**](https://github.com/bain3/pronotepy) pour dialoguer avec les serveurs Pronote.

- **Nature du serveur** : Le microservice agit comme un simple relais sécurisé (passerelle de protocole / reverse-proxy chiffré en HTTPS) pour convertir les protocoles de Pronote en requêtes JSON exploitables par l'application mobile.
- **Cache transitoire (Upstash Redis)** : Pour éviter d'interroger Pronote inutilement à chaque interaction et respecter les serveurs de votre établissement, un cache de session à durée limitée (TTL court) peut conserver temporairement votre jeton de session chiffré.
- **Aucune persistance de profil** : Le serveur ne possède aucune base de données relationnelle d'utilisateurs, aucun compte utilisateur Aether, et n'enregistre aucun historique de vos notes ou messages.
- **Auto-hébergement total** : Vous n'êtes pas obligé d'utiliser le serveur cloud par défaut. Vous pouvez déployer votre propre instance du dossier `backend/` sur votre propre infrastructure (Vercel, VPS, Docker) et saisir son URL dans **Paramètres > Apparence > Serveur API Pronote**.

---

## 4. Zéro télémétrie, zéro traceur

Aether a fait le choix délibéré de supprimer tout outil d'analyse tiers :
- ❌ **Aucun outil analytique** : PostHog, Google Analytics, Firebase Analytics ont été entièrement retirés du code source.
- ❌ **Aucun outil de crash-reporting tiers** : Aucune donnée de plantage n'est transmise automatiquement à des services externes comme Sentry ou Bugsnag.
- 📁 **Journaux d'erreurs locaux** : Les logs de débogage sont strictement cantonnés à la console locale de votre appareil (`utils/logger/logger.ts`) et ne quittent jamais votre téléphone.

---

## 5. Permissions requises sur l'appareil

Aether demande uniquement les permissions strictement nécessaires au bon fonctionnement des fonctionnalités que vous choisissez d'utiliser :

| Permission | Pourquoi est-elle demandée ? | Caractère obligatoire |
| :--- | :--- | :--- |
| **Appareil photo** (`CAMERA`) | Permet de scanner le QR code d'association Pronote lors de la première connexion. Le flux vidéo est analysé en direct localement et aucune image n'est enregistrée. | Facultatif (vous pouvez vous connecter par identifiant ou ENT). |
| **Notifications** (`POST_NOTIFICATIONS`) | Permet de recevoir des rappels locaux pour vos devoirs et vos prochains cours. | Facultatif. |
| **Stockage / Fichiers** | Nécessaire uniquement si vous choisissez d'exporter ou de télécharger une pièce jointe d'un devoir ou d'un message. | À la demande. |

---

## 6. Traitements d'intelligence artificielle (Magic AI)

Aether intègre une fonctionnalité optionnelle d'analyse intelligente :
- **100% sur l'appareil (On-Device)** : Le modèle fonctionne localement grâce à TensorFlow Lite (`react-native-fast-tflite`).
- **Désactivé par défaut** : Cette fonction est purement optionnelle et doit être activée manuellement dans les paramètres.
- **Aucun envoi dans le cloud** : Aucune de vos données ou notes n'est transmise à des tiers (OpenAI, Google Gemini, Anthropic, etc.).

---

## 7. Vos droits et suppression de vos données (RGPD)

Conformément au Règlement Général sur la Protection des Données (RGPD) :
- **Droit d'accès et de portabilité** : Toutes vos données sont accessibles directement dans l'interface de l'application.
- **Droit à l'effacement immédiat** : En supprimant votre compte dans les paramètres de l'application ou en désinstallant Aether de votre appareil, **100% des données locales (comptes, identifiants, jetons, cache) sont définitivement et irréversiblement supprimées de votre téléphone**.

---

## 8. Code source libre et transparence

Aether est un logiciel libre distribué sous licence **GNU General Public License v3.0 (GPL-3.0)**.  
L'intégralité de son code source (client mobile et microservice backend) est publique et vérifiable par quiconque :  
👉 **[https://github.com/freroxx/Aether](https://github.com/freroxx/Aether)**

---

## 9. Contact & Sécurité

Pour toute question relative à cette politique de confidentialité ou pour signaler une vulnérabilité de sécurité :
- Ouvrez une issue ou une discussion sur le dépôt GitHub officiel.
- Pour les signalements de sécurité sensibles, contactez les mainteneurs via les coordonnées indiquées sur le profil GitHub.
