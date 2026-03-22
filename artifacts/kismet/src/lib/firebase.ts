import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, updateDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

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
export const storage = getStorage(app);

export async function uploadCharacterAvatar(charId: string, file: File): Promise<string> {
  const storageRef = ref(storage, `avatars/characters/${charId}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function updateCharacterAvatar(charId: string, file: File): Promise<string> {
  const url = await uploadCharacterAvatar(charId, file);
  await updateDoc(doc(db, "characters", charId), { avatar: url });
  return url;
}

export function isAvatarUrl(avatar: string): boolean {
  return avatar.startsWith("http");
}
