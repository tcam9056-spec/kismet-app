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

/**
 * Compress & normalise an image file to a small base64 JPEG.
 * Max dimension: 300px, JPEG quality: 0.80 → ~40-80 KB per avatar.
 * Drawing through canvas also strips EXIF rotation metadata.
 */
export async function compressImageToBase64(file: File, maxDim = 300, quality = 0.80): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(""); };
    img.src = url;
  });
}

/**
 * Primary: store compressed base64 directly in Firestore `avatar` field.
 *   → All users see it immediately, no separate storage service needed.
 * Secondary: also try Firebase Storage upload (best-effort, for higher-res backup).
 * Returns the base64 string so the caller can update local state.
 */
export async function updateCharacterAvatar(charId: string, file: File): Promise<string> {
  const b64 = await compressImageToBase64(file);
  if (!b64) throw new Error("Image compression failed");

  await updateDoc(doc(db, "characters", charId), { avatar: b64 });

  uploadCharacterAvatarStorage(charId, file).catch(() => { /* best-effort */ });

  return b64;
}

async function uploadCharacterAvatarStorage(charId: string, file: File): Promise<string> {
  const storageRef = ref(storage, `avatars/characters/${charId}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export function isAvatarUrl(avatar: string): boolean {
  return avatar.startsWith("http") || avatar.startsWith("data:");
}
