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
