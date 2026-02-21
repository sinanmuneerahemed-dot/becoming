# BECOMING

A daily reflection app with cyberpunk aesthetic. Reflect on your day, track habits, and see your growth over time.

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Framer Motion
- Firebase (Auth + Firestore)
- Sonner (toasts)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Firebase setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project named "BECOMING"
3. Add a Web app and copy the config values
4. Create `.env.local` from the example:

```bash
cp .env.local.example .env.local
```

5. Fill in your Firebase values in `.env.local`:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-flash-latest
```

### 3. Enable Google Sign-in

1. In Firebase Console, go to **Authentication** > **Sign-in method**
2. Click **Google** and enable it
3. Add your support email
4. Save

### 4. Create Firestore database

1. Go to **Firestore Database**
2. Click **Create database**
3. Start in **test mode** (or production with rules below)
4. Choose a region

### 5. Firestore Security Rules

In Firestore > Rules, use:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /users/{uid}/entries/{docId} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /users/{uid}/insights/{docId} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

### 6. Firestore Indexes

Create composite indexes for these queries (Firestore will prompt you when they are first used, or create manually):

- Collection: `users/{uid}/entries`
  - Fields: `date` (Ascending), `date` (Ascending) – for range queries
  - Fields: `date` (Descending) – for streak computation

### 7. Authorized domains

1. Go to **Project Settings** > **Your apps**
2. Under **Authorized domains**, add:
   - `localhost` (for development)
   - Your production domain

### 8. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
app/
  layout.tsx          # Root layout, providers
  page.tsx            # Landing
  signin/page.tsx     # Sign-in
  app/page.tsx        # Dashboard (protected)
  checkin/[step]/     # Check-in wizard (protected)
components/
  ui/                 # CyberBackground, GlassCard, NeonButton, NeonPill
  landing/            # Navbar, Hero, sections
  dashboard/          # Today, 7-day, 30-day, History views
  checkin/            # CheckinQuestion, StepNav
lib/
  firebase.ts         # Firebase init
  firestore.ts        # Firestore CRUD
  checkin-questions.ts
providers/
  AuthProvider.tsx    # Auth context
```

## Environment variables

| Variable | Description |
|----------|-------------|
| NEXT_PUBLIC_FIREBASE_API_KEY | Firebase API key |
| NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN | Auth domain |
| NEXT_PUBLIC_FIREBASE_PROJECT_ID | Project ID |
| NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET | Storage bucket |
| NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID | Messaging sender ID |
| NEXT_PUBLIC_FIREBASE_APP_ID | App ID |
| GEMINI_API_KEY | Server-side Gemini key used by `/api/ai/generate` |
| GEMINI_MODEL | Optional Gemini model override (default: `gemini-flash-latest`) |

---

Made by Sinan Muneer Ahmed
