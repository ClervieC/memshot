# Memshot 📸

Application Angular mobile-first pour partager des photos lors d'événements via QR code.

## Concept

- **Organisateur** crée un événement → génère un QR code + mot de passe
- **Participants** scannent le QR code → entrent le mot de passe → prennent des photos
- **Galerie en temps réel** : tout le monde voit les photos instantanément
- **Stockage photos** : Cloudinary (gratuit jusqu'à 25 GB)
- **Base de données & Auth** : Firebase (gratuit)

---

## 🚀 Installation

### 1. Installer les dépendances

```bash
cd photoevent
npm install
```

---

### 2. Configurer Firebase (Auth + Base de données)

#### Créer un projet Firebase

1. Aller sur [https://console.firebase.google.com](https://console.firebase.google.com)
2. Créer un nouveau projet (ex: `memshot`)

#### Activer les services Firebase

**Authentication :**
- Menu `Authentication` → `Sign-in method`
- Activer **Email/Password**

**Firestore :**
- Menu `Firestore Database` → `Créer une base de données`
- Choisir mode **Production**
- Ajouter ces règles de sécurité :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /events/{eventId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update: if request.auth != null &&
        (resource.data.organizerId == request.auth.uid ||
         request.resource.data.diff(resource.data).affectedKeys().hasOnly(['photoCount']));

      match /photos/{photoId} {
        allow read: if true;
        allow create: if true;
      }
    }
  }
}
```

#### Récupérer la config Firebase

1. `Paramètres du projet` (⚙️) → `Vos applications` → `Ajouter une application web`
2. Copier les valeurs dans `src/environments/environment.ts`

> ⚠️ **Firebase Storage n'est pas utilisé** — pas besoin de l'activer ni d'ajouter `storageBucket`.

---

### 3. Configurer Cloudinary (Stockage photos — gratuit)

Cloudinary gère tous les uploads de photos. **25 GB gratuits**, aucune carte bancaire.

#### Créer un compte

1. Aller sur [https://cloudinary.com](https://cloudinary.com) → **Sign Up Free**
2. Choisir un **Cloud Name** (ex: `memshot-ton-nom`)

#### Créer un Upload Preset non signé

Les participants uploadent directement depuis leur mobile, sans backend.

1. Dashboard Cloudinary → ⚙️ **Settings** → **Upload**
2. Descendre jusqu'à **Upload presets** → **Add upload preset**
3. Configurer :
   - **Preset name** : `memshot_unsigned` (ou ce que tu veux)
   - **Signing Mode** : `Unsigned` ← **important**
   - **Folder** : laisser vide (l'app gère les dossiers par event ID)
   - **Allowed formats** : `jpg, jpeg, png, webp`
   - **Max file size** : `10000000` (10 MB)
4. **Save**

#### Remplir la config dans l'app

Dans `src/environments/environment.ts` :

```typescript
export const environment = {
  production: false,
  firebase: {
    apiKey: "AIzaSy...",
    authDomain: "votre-projet.firebaseapp.com",
    projectId: "votre-projet",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc..."
  },
  cloudinary: {
    cloudName: "memshot-ton-nom",     // ton Cloud Name Cloudinary
    uploadPreset: "memshot_unsigned"  // le preset créé ci-dessus
  }
};
```

---

### 4. Lancer l'application

```bash
npm start
```

L'app sera disponible sur `http://localhost:4200`

---

## 📱 Tester sur téléphone (développement)

```bash
# Option 1 : ngrok (recommandé, HTTPS requis pour la caméra)
npx ngrok http 4200

# Option 2 : réseau local
ng serve --host 0.0.0.0
# Puis ouvrir http://[IP-de-ton-ordi]:4200 sur le mobile
```

> ⚠️ L'accès à la caméra nécessite **HTTPS**. ngrok le fournit automatiquement.

---

## 🏗️ Structure du projet

```
src/app/
├── models/
│   └── event.model.ts              # Types Event et Photo
├── services/
│   ├── auth.service.ts             # Firebase Authentication
│   ├── event.service.ts            # Firestore + appels Cloudinary
│   ├── cloudinary.service.ts       # Upload direct vers Cloudinary
│   └── qr.service.ts               # Génération QR code
├── guards/
│   └── auth.guard.ts               # Protection routes admin
└── pages/
    ├── home/                       # Page d'accueil
    ├── admin/
    │   ├── login/                  # Connexion organisateur
    │   ├── dashboard/              # Liste des événements
    │   └── create-event/           # Créer + générer QR code
    └── event/
        ├── event.component.ts      # Saisie mot de passe participants
        ├── camera/                 # Caméra + upload Cloudinary
        └── gallery/                # Galerie temps réel
```

---

## ☁️ Architecture de stockage

```
Photo prise sur mobile
        │
        ▼
Cloudinary (upload direct, HTTPS)
  └─ URL sécurisée retournée
        │
        ▼
Firestore (stocke URL + métadonnées)
  └─ events/{eventId}/photos/{photoId}
        │
        ▼
Galerie Angular (temps réel via AngularFire)
```

---

## 🌐 Déploiement (Firebase Hosting)

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
# Public directory: dist/photoevent/browser
# Single-page app: Yes

npm run build
firebase deploy
```

---

## 📦 Technologies

- **Angular 17** (Standalone components, Signals)
- **Firebase** (Auth + Firestore uniquement)
- **Cloudinary** (stockage et CDN des photos — gratuit 25 GB)
- **AngularFire**
- **qrcode** (génération QR)
- **Fraunces + DM Sans** (polices)
