import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAgf1z4MwmXEbhUrVE0HnrmDHYBwJ4JP6E",
  authDomain: "ften-b9f63.firebaseapp.com",
  projectId: "ften-b9f63",
  storageBucket: "ften-b9f63.firebasestorage.app",
  messagingSenderId: "391113692455",
  appId: "1:391113692455:web:c04a1f3c91bbb21967c502",
  measurementId: "G-FT9BM7XSFB"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
