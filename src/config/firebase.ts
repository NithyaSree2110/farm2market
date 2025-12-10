import { initializeApp } from "firebase/app";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Always initialize Firebase ONCE
const app = initializeApp(firebaseConfig);

// Always create an Auth instance
const auth = getAuth(app);

// Debug logging
console.log("Firebase initialized successfully:", !!app);
console.log("Auth instance created:", !!auth);

export { auth, RecaptchaVerifier, signInWithPhoneNumber };
export type { ConfirmationResult };
