import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Ganti nilai di bawah dengan config dari Firebase Console
// Project Settings → Your apps → Web App → Config
const firebaseConfig = {
  apiKey: "GANTI_DENGAN_MILIK_ANDA",
  authDomain: "GANTI_DENGAN_MILIK_ANDA",
  projectId: "GANTI_DENGAN_MILIK_ANDA",
  storageBucket: "GANTI_DENGAN_MILIK_ANDA",
  messagingSenderId: "GANTI_DENGAN_MILIK_ANDA",
  appId: "GANTI_DENGAN_MILIK_ANDA",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
