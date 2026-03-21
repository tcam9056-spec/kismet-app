import { useState, useEffect } from "react";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

export function useKeys() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("gemini-2.5-flash");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setKeys([]);
      setLoading(false);
      return;
    }
    const ref = doc(db, "users", user.uid, "settings", "config");
    getDoc(ref).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setKeys(data.keys || []);
        setSelectedModel(data.selectedModel || "gemini-2.5-flash");
      }
      setLoading(false);
    });
  }, [user]);

  const saveKeys = async (newKeys: string[], model: string) => {
    if (!user) return;
    const ref = doc(db, "users", user.uid, "settings", "config");
    await setDoc(ref, { keys: newKeys, selectedModel: model }, { merge: true });
    setKeys(newKeys);
    setSelectedModel(model);
  };

  const getNextKey = (currentKeyIndex: number): number => {
    if (keys.length === 0) return 0;
    return (currentKeyIndex + 1) % keys.length;
  };

  return { keys, selectedModel, loading, saveKeys, getNextKey };
}
