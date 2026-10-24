import { getApp, getApps, initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  // Paste the Firebase Web App configuration from Firebase Console here.
  apiKey: "AIzaSyBNc_f0-5cDT8myuSUMiN6mAbmf-Sa0jhM",
  authDomain: "post2-1e4dc.firebaseapp.com",
  databaseURL: "https://post2-1e4dc-default-rtdb.firebaseio.com",
  projectId: "post2-1e4dc",
  storageBucket: "post2-1e4dc.firebasestorage.app",
  messagingSenderId: "958232540863",
  appId: "1:958232540863:web:6de6cfd665ee28f4f7b80a"
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(
  (value) => value && !value.startsWith("PASTE_"),
);
export const firebaseDatabaseUrl = firebaseConfig.databaseURL;

const app = isFirebaseConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export const database = app ? getDatabase(app) : null;
