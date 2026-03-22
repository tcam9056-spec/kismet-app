import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { Character } from "@/lib/types";
import { DEFAULT_CHARACTERS } from "@/lib/types";

export function useCharacters() {
  const { user } = useAuth();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCharacters = async () => {
    if (!user) return;
    setLoading(true);

    const publicQuery = query(collection(db, "characters"), where("isPublic", "==", true));
    const userQuery = query(collection(db, "characters"), where("createdBy", "==", user.uid));

    const [publicSnap, userSnap] = await Promise.all([getDocs(publicQuery), getDocs(userQuery)]);

    const seen = new Set<string>();
    const all: Character[] = [];

    publicSnap.docs.forEach((d) => {
      seen.add(d.id);
      all.push({ id: d.id, ...d.data() } as Character);
    });

    userSnap.docs.forEach((d) => {
      if (!seen.has(d.id)) all.push({ id: d.id, ...d.data() } as Character);
    });

    if (all.length === 0) {
      await seedDefaultCharacters(user.uid);
      return fetchCharacters();
    }

    setCharacters(all);
    setLoading(false);
  };

  const seedDefaultCharacters = async (uid: string) => {
    const ref = collection(db, "characters");
    for (const char of DEFAULT_CHARACTERS) {
      await addDoc(ref, { ...char, createdBy: uid, createdAt: serverTimestamp() });
    }
  };

  useEffect(() => { if (user) fetchCharacters(); }, [user]);

  /* Returns new character ID so caller can save avatar */
  const addCharacter = async (char: Omit<Character, "id" | "createdBy">): Promise<string> => {
    if (!user) return "";
    const ref = collection(db, "characters");
    const docRef = await addDoc(ref, {
      ...char,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    });
    setCharacters((prev) => [...prev, { id: docRef.id, ...char, createdBy: user.uid }]);
    return docRef.id;
  };

  const removeCharacter = async (id: string) => {
    await deleteDoc(doc(db, "characters", id));
    setCharacters((prev) => prev.filter((c) => c.id !== id));
  };

  return { characters, loading, addCharacter, removeCharacter, refetch: fetchCharacters };
}
