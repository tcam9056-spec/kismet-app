import { useState, useEffect, useCallback } from "react";

export interface ChatProfile {
  _id: string;
  userId: string;
  name: string;
  gender: string;
  personality: string;
  bio: string;
  appearance: string;
  avatar: string;
  isDefault: boolean;
  createdAt: string;
}

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api";

export async function apiFetchProfiles(userId: string): Promise<ChatProfile[]> {
  try {
    const res = await fetch(`${API_BASE}/chat-profiles?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) return [];
    const data = await res.json() as { profiles: ChatProfile[] };
    return data.profiles ?? [];
  } catch {
    return [];
  }
}

export async function apiCreateProfile(payload: Omit<ChatProfile, "_id" | "createdAt">): Promise<ChatProfile | null> {
  try {
    const res = await fetch(`${API_BASE}/chat-profiles/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const data = await res.json() as { profile: ChatProfile };
    return data.profile;
  } catch {
    return null;
  }
}

export async function apiDeleteProfile(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/chat-profiles/${id}`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}

export function useChatProfiles(userId: string | null) {
  const [profiles, setProfiles] = useState<ChatProfile[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!userId) { setProfiles([]); return; }
    setLoading(true);
    const list = await apiFetchProfiles(userId);
    setProfiles(list);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (payload: Omit<ChatProfile, "_id" | "createdAt">) => {
    const result = await apiCreateProfile(payload);
    if (result) setProfiles(prev => [result, ...prev.map(p => payload.isDefault ? { ...p, isDefault: false } : p)]);
    return result;
  }, []);

  const remove = useCallback(async (id: string) => {
    const ok = await apiDeleteProfile(id);
    if (ok) setProfiles(prev => prev.filter(p => p._id !== id));
    return ok;
  }, []);

  return { profiles, loading, reload: load, create, remove };
}
