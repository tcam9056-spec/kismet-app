import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { Character } from "@/lib/types";
import { DEFAULT_CHARACTERS, ADMIN_EMAIL } from "@/lib/types";

export function useCharacters() {
  const { user } = useAuth();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [pending, setPending] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.email === ADMIN_EMAIL;

  const fetchCharacters = async () => {
    if (!user) return;
    setLoading(true);

    const publicQuery = query(collection(db, "characters"), where("isPublic", "==", true));
    const userQuery = query(collection(db, "characters"), where("createdBy", "==", user.uid));

    const [publicSnap, userSnap] = await Promise.all([getDocs(publicQuery), getDocs(userQuery)]);

    const seen = new Set<string>();
    const all: Character[] = [];

    publicSnap.docs.forEach((d) => {
      const c = { id: d.id, ...d.data() } as Character;
      if (c.isApproved === true || isAdmin) {
        seen.add(d.id);
        all.push(c);
      }
    });

    userSnap.docs.forEach((d) => {
      if (!seen.has(d.id)) {
        all.push({ id: d.id, ...d.data() } as Character);
      }
    });

    if (all.length === 0) {
      await seedDefaultCharacters(user.uid);
      return fetchCharacters();
    }

    if (isAdmin) {
      const pendingChars = publicSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as Character))
        .filter(c => c.isApproved !== true);
      setPending(pendingChars);
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

  const addCharacter = async (char: Omit<Character, "id" | "createdBy">): Promise<string> => {
    if (!user) return "";
    const ref = collection(db, "characters");
    const isApproved = char.isPublic ? isAdmin : true;
    const docRef = await addDoc(ref, {
      ...char,
      isApproved,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    });
    if (isApproved) {
      setCharacters((prev) => [...prev, { id: docRef.id, ...char, isApproved, createdBy: user.uid }]);
    } else {
      setPending((prev) => [...prev, { id: docRef.id, ...char, isApproved, createdBy: user.uid }]);
    }
    return docRef.id;
  };

  const updateCharacter = async (id: string, updates: Partial<Omit<Character, "id" | "createdBy">>) => {
    if (!user) return;
    await updateDoc(doc(db, "characters", id), { ...updates, updatedAt: serverTimestamp() });
    const applyUpdate = (c: Character) => c.id === id ? { ...c, ...updates } : c;
    setCharacters(prev => prev.map(applyUpdate));
    setPending(prev => prev.map(applyUpdate));
  };

  const approveCharacter = async (id: string) => {
    if (!isAdmin) return;
    await updateDoc(doc(db, "characters", id), { isApproved: true });
    const approved = pending.find(c => c.id === id);
    if (approved) {
      setPending(prev => prev.filter(c => c.id !== id));
      setCharacters(prev => [...prev, { ...approved, isApproved: true }]);
    }
  };

  const rejectCharacter = async (id: string) => {
    if (!isAdmin) return;
    await updateDoc(doc(db, "characters", id), { isPublic: false, isApproved: false });
    setPending(prev => prev.filter(c => c.id !== id));
  };

  const removeCharacter = async (id: string) => {
    await deleteDoc(doc(db, "characters", id));
    setCharacters((prev) => prev.filter((c) => c.id !== id));
    setPending((prev) => prev.filter((c) => c.id !== id));
  };

  return {
    characters, pending, loading, isAdmin,
    addCharacter, updateCharacter,
    approveCharacter, rejectCharacter, removeCharacter,
    refetch: fetchCharacters,
  };
}
