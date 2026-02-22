import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | undefined;
let auth: Auth;
let db: Firestore;

// Only initialize if we have an API key (prevents build-time crashes on Vercel)
const canInitialize = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || typeof window !== "undefined";

if (canInitialize) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
} else {
  // During static build (prerendering) on Vercel, if keys are missing, 
  // we provide mock objects so the build doesn't crash.
  auth = {
    onAuthStateChanged: () => () => { }, // Mock unsubscribe
  } as unknown as Auth;
  db = {} as Firestore;
}

export { app, auth, db };
