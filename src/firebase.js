import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Ganti nilai di bawah dengan config dari Firebase Console
// Project Settings → Your apps → Web App → Config
const firebaseConfig = {
  apiKey: "AIzaSyCAFsYD8rHdjcZdXzSyKVex11byukAA4ZM",
  authDomain: "futsal-tournament-3d6a3.firebaseapp.com",
  projectId: "futsal-tournament-3d6a3",
  storageBucket: "futsal-tournament-3d6a3.firebasestorage.app",
  messagingSenderId: "855232861325",
  appId: "1:855232861325:web:3d0819616a4d043270bec4"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
