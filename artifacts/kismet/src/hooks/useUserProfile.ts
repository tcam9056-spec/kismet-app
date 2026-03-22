import { useState, useEffect } from "react";
import { doc, getDoc, collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Character } from "@/lib/types";
import type { UserRole } from "@/components/UserBadge";

export interface UserProfileData {
  displayName: string;
  bio: string;
  gender: string;
  personality: string;
  appearance: string;
  avatarDataUrl?: string;
  socialLinks?: { label: string; url: string }[];
  coverDataUrl?: string;
  role?: UserRole;
}

const profileCache = new Map<string, UserProfileData>();

export async function fetchUserProfile(uid: string): Promise<UserProfileData | null> {
  if (profileCache.has(uid)) return profileCache.get(uid)!;
  try {
    const ref = doc(db, "users", uid, "profile", "data");
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data() as UserProfileData;
      profileCache.set(uid, data);
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

export function invalidateProfileCache(uid: string) {
  profileCache.delete(uid);
}

export async function fetchCreatorDisplayNames(uids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(uids)];
  await Promise.all(unique.map(async uid => {
    const p = await fetchUserProfile(uid);
    if (p?.displayName) map.set(uid, p.displayName);
  }));
  return map;
}

export async function fetchCreatorRoles(uids: string[]): Promise<Map<string, UserRole>> {
  const map = new Map<string, UserRole>();
  const unique = [...new Set(uids)];
  await Promise.all(unique.map(async uid => {
    const p = await fetchUserProfile(uid);
    if (p?.role) map.set(uid, p.role);
  }));
  return map;
}

export function useUserProfile(uid: string | null) {
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    setLoading(true);

    (async () => {
      const [profileData, charsSnap] = await Promise.all([
        fetchUserProfile(uid),
        getDocs(query(collection(db, "characters"), where("createdBy", "==", uid), where("isPublic", "==", true))),
      ]);

      setProfile(profileData);
      const chars: Character[] = [];
      charsSnap.docs.forEach(d => {
        const c = { id: d.id, ...d.data() } as Character;
        if (c.isApproved !== false) chars.push(c);
      });
      setCharacters(chars);
      setLoading(false);
    })();
  }, [uid]);

  return { profile, characters, loading };
}
