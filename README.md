# Aether

<p align="center">
  <img src="./assets/images/icon.png" width="128" height="128" alt="Aether Logo" style="border-radius: 28px;" />
</p>

<h3 align="center">Aether — Le client Pronote moderne, libre et respectueux de votre vie privée.</h3>

<p align="center">
  Une application Android open-source, fluide et élégante dédiée à <b>Pronote</b>.<br />
  Conçue pour les élèves et les parents d'élèves, propulsée par un microservice <b>Python / pronotepy</b> moderne et sécurisé.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-GPL--3.0-blue.svg?style=flat-square" alt="License GPL-3.0" /></a>
  <a href="https://reactnative.dev"><img src="https://img.shields.io/badge/Platform-Android-green.svg?style=flat-square" alt="Platform Android" /></a>
  <a href="https://expo.dev"><img src="https://img.shields.io/badge/Expo-SDK%2057-black.svg?style=flat-square" alt="Expo SDK 57" /></a>
  <a href="https://github.com/bain3/pronotepy"><img src="https://img.shields.io/badge/Backend-pronotepy%20FastAPI-blueviolet.svg?style=flat-square" alt="pronotepy FastAPI" /></a>
  <a href="privacy.md"><img src="https://img.shields.io/badge/Telemetry-Zero%20%2F%20No%20Tracking-success.svg?style=flat-square" alt="Zero Telemetry" /></a>
</p>

---

## 🌟 Pourquoi Aether ?

Aether est un fork indépendant, allégé et perfectionné de [Papillon](https://github.com/PapillonApp/Papillon), entièrement recentré sur l'écosystème **Pronote**. 

En remplaçant les bibliothèques non maintenues par un microservice **FastAPI** propulsé par la référence [**`pronotepy`**](https://github.com/bain3/pronotepy) et un cache distribué **Upstash Redis**, Aether offre une stabilité maximale, une compatibilité sans faille avec les ENT et une prise en charge complète des comptes **Parents** et **Élèves**.

- 🔒 **Vie privée absolue** : Aucun traqueur, aucune télémétrie, aucune publicité. PostHog et tout outil d'analyse tiers ont été définitivement retirés.
- ⚡ **Performance & Fluidité** : Architecture React Native / Expo moderne avec design Material 3, animations fluides et stockage local chiffré via MMKV.
- 👨‍👩‍👧‍👦 **Espace Parent natif** : Connexion dédiée, détection automatique des QR codes parents, et sélecteur multi-enfants en un tap direct depuis l'en-tête.
- 🛠️ **100% Maîtrisable & Auto-hébergeable** : Utilisez l'instance cloud par défaut ou pointez vers votre propre instance Vercel / Docker en modifiant l'URL dans les paramètres de l'application.

---

## ✨ Fonctionnalités

### 📚 Vie scolaire complète
- 📅 **Emploi du temps interactif** : Visualisation jour par jour ou par semaine, gestion des cours annulés, remplacements, salles, professeurs et sorties pédagogiques.
- 📊 **Notes & Moyennes** : Suivi des notes en temps réel, calculs des moyennes générales et par matière, gestion des périodes (trimestres/semestres), coefficients et détails complets des évaluations.
- 📝 **Cahier de textes & Devoirs** : Liste des devoirs avec échéances, pièces jointes téléchargeables, et synchronisation bidirectionnelle du statut « fait / à faire ».
- 🚨 **Assiduité & Vie Scolaire** : Suivi des absences (justifiées ou non), retards, punitions et sanctions avec motifs détaillés.
- 📢 **Actualités & Sondages** : Fil d'informations de l'établissement, sondages et accusés de lecture intégrés.
- 🍽️ **Menu de la Cantine** : Consultation des menus quotidiens et hebdomadaires de la restauration scolaire.
- 💬 **Messagerie & Discussions** : Lecture des discussions Pronote, fils de messages avec les enseignants/personnels et envoi de réponses directement depuis l'application.

### 👨‍👩‍👦 Espace Parent d'élève
- Détection automatique des comptes parents lors de l'onboarding (choix du profil, détection QR code ou redirection WebView sécurisée vers `mobile.parent.html`).
- Récupération dynamique de la liste des enfants rattachés.
- Sélecteur rapide d'enfant accessible en haut de l'écran d'accueil : basculez instantanément d'un enfant à l'autre pour afficher ses notes, son emploi du temps et ses devoirs.

### 🎨 Personnalisation & Ergonomie
- **Thèmes dynamiques** : Support des thèmes sombre, clair et AMOLED, avec palette dynamique et Liquid Glass UI.
- **Icônes Material 3** : Intégration soignée de `@expo/material-symbols`.
- **Mode Zen** : Possibilité de masquer temporairement les notes ou les moyennes pour réduire le stress scolaire.
- **Serveur API Pronote personnalisé** : Champ dans les paramètres permettant d'indiquer l'URL de son propre backend d'API.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Aether Mobile                         │
│             React Native (Expo SDK 57) / Android            │
│      MMKV Local Storage • WatermelonDB • Zustand Store       │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS (REST API)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Aether Backend Microservice              │
│                 Python 3.11+ • FastAPI • ASGI               │
│                  Hébergé sur Vercel Serverless              │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               │ Session Cache                │ Authentification & Scraping
               ▼                              ▼
┌──────────────────────────────┐ ┌─────────────────────────────┐
│         Upstash Redis        │ │           PRONOTE           │
│   (Mise en cache des tokens) │ │    (Serveurs Académiques    │
└──────────────────────────────┘ │      & ENT de France)       │
                                 └─────────────────────────────┘
```

---

## 🚀 Installation & Développement

### Prérequis

- [Bun](https://bun.sh) (recommandé) ou [Node.js](https://nodejs.org) (v20+)
- [Android Studio](https://developer.android.com/studio) avec le SDK Android configuré
- [Python 3.11+](https://www.python.org) (uniquement pour développer sur le backend)

### 1. Cloner le projet

```bash
git clone https://github.com/freroxx/Aether.git
cd Aether
```

### 2. Démarrer l'application mobile

```bash
# Installation des dépendances
bun install

# Lancer le serveur Metro Expo
bunx expo start

# Compiler et lancer sur un appareil ou émulateur Android
bunx expo run:android
```

### 3. Lancer le backend en local (optionnel)

Si vous souhaitez modifier ou déboguer le microservice Python :

```bash
cd backend

# Créer un environnement virtuel
python3 -m venv .venv
source .venv/bin/activate

# Installer les dépendances
pip install -r requirements.txt

# Créer le fichier .env
cp .env.example .env
# Renseigner UPSTASH_REDIS_REST_URL et UPSTASH_REDIS_REST_TOKEN si vous souhaitez tester le cache

# Démarrer le serveur FastAPI
uvicorn api.index:app --reload --port 8000
```

Dans l'application Aether, allez dans **Paramètres > Apparence > Serveur API Pronote** et indiquez : `http://10.0.2.2:8000` (sur émulateur Android) ou l'IP de votre machine sur votre réseau local.

---

## 🌐 Déploiement du Backend sur Vercel

Le backend d'Aether est nativement pré-configuré pour un déploiement sans serveur (Serverless) ultra-rapide et gratuit sur **Vercel** avec un cache **Upstash Redis**.

### 1. Base Redis Upstash (Gratuit)
1. Rendez-vous sur [console.upstash.com](https://console.upstash.com) et créez une base de données Redis.
2. Récupérez vos identifiants REST : `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN`.

### 2. Déploiement Vercel
1. Installez le CLI Vercel :
   ```bash
   npm i -g vercel
   ```
2. Déployez depuis le dossier `backend` :
   ```bash
   cd backend
   vercel
   ```
3. Dans votre dashboard Vercel (**Settings > Environment Variables**), ajoutez :
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
4. Déployez en production :
   ```bash
   vercel --prod
   ```
5. Indiquez l'URL obtenue (ex: `https://votre-aether-api.vercel.app`) dans les paramètres d'Aether !

---

## 🛡️ Vie privée & Sécurité

Aether a été créé selon un principe fondamental : **vos données scolaires vous appartiennent**.

- **Aucun traqueur ni télémétrie** : Aucun SDK tiers d'analyse comportementale (Google Analytics, Firebase Analytics, PostHog, Sentry, etc.).
- **Chiffrement local** : Vos identifiants de session et jetons sont stockés localement sur votre téléphone via MMKV avec chiffrement.
- **Réseau éphémère** : Les jetons envoyés au microservice API ne servent qu'à interroger Pronote et sont chiffrés en mémoire / cache temporaire Upstash. Aucune base de données d'utilisateurs n'est conservée.

Pour plus de détails, consultez notre politique complète : [**`privacy.md`**](privacy.md).

---

## ⚖️ Licence & Remerciements

Ce projet est distribué sous licence libre **GPL-3.0**. Consultez le fichier [LICENSE](LICENSE) pour plus d'informations.

- Dérivé avec respect de l'excellent travail initial de [Papillon](https://github.com/PapillonApp/Papillon) (GPL-3.0).
- Un immense merci à [bain3](https://github.com/bain3) et aux contributeurs de [pronotepy](https://github.com/bain3/pronotepy) pour leur travail remarquable sur le protocole Pronote.
