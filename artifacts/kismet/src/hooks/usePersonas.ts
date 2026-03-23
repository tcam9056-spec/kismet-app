import { useState, useEffect, useCallback } from "react";
import type { Persona } from "@/lib/types";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api";

export async function fetchPersonaById(id: string): Promise<Persona | null> {
  try {
    const res = await fetch(`${API_BASE}/personas/${id}`);
    if (!res.ok) return null;
    const data = await res.json() as { persona: Persona };
    return data.persona;
  } catch {
    return null;
  }
}

export async function fetchPersonasByUser(userId: string): Promise<Persona[]> {
  try {
    const res = await fetch(`${API_BASE}/personas?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) return [];
    const data = await res.json() as { personas: Persona[] };
    return data.personas ?? [];
  } catch {
    return [];
  }
}

export async function createPersona(payload: {
  userId: string;
  name: string;
  gender?: string;
  personality?: string;
  description?: string;
  appearance?: string;
}): Promise<Persona | null> {
  try {
    const res = await fetch(`${API_BASE}/personas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const data = await res.json() as { persona: Persona };
    return data.persona;
  } catch {
    return null;
  }
}

export function usePersonas(userId: string | null) {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) { setPersonas([]); return; }
    setLoading(true);
    setError(null);
    try {
      const list = await fetchPersonasByUser(userId);
      setPersonas(list);
    } catch {
      setError("Không thể tải danh sách persona");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (payload: Omit<Parameters<typeof createPersona>[0], "userId">) => {
    if (!userId) return null;
    const result = await createPersona({ ...payload, userId });
    if (result) setPersonas(prev => [result, ...prev]);
    return result;
  }, [userId]);

  return { personas, loading, error, reload: load, create };
}
