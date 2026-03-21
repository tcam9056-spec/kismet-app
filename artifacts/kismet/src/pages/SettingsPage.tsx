import { useState, useEffect } from "react";
import { useKeys } from "@/hooks/useKeys";
import { GEMINI_MODELS } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Plus, Trash2, ArrowLeft, Key, Bot, Zap } from "lucide-react";

interface Props {
  onBack: () => void;
}

export default function SettingsPage({ onBack }: Props) {
  const { user } = useAuth();
  const { keys, selectedModel, loading, saveKeys } = useKeys();
  const [localKeys, setLocalKeys] = useState<string[]>([]);
  const [localModel, setLocalModel] = useState("gemini-2.5-flash");
  const [newKey, setNewKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [serverKeyAvailable, setServerKeyAvailable] = useState(false);
  const [loadingServerKey, setLoadingServerKey] = useState(false);

  useEffect(() => {
    if (!loading) {
      setLocalKeys(keys);
      setLocalModel(selectedModel);
    }
  }, [loading, keys, selectedModel]);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => {
        if (data.hasDefaultKey) setServerKeyAvailable(true);
      })
      .catch(() => {});
  }, []);

  const useServerKey = async () => {
    setLoadingServerKey(true);
    try {
      const r = await fetch("/api/config");
      const data = await r.json();
      if (data.defaultGeminiKey && !localKeys.includes(data.defaultGeminiKey)) {
        setLocalKeys((prev) => [data.defaultGeminiKey, ...prev]);
      }
    } catch {
    }
    setLoadingServerKey(false);
  };

  const addKey = () => {
    const k = newKey.trim();
    if (!k || localKeys.includes(k)) return;
    setLocalKeys((prev) => [...prev, k]);
    setNewKey("");
  };

  const removeKey = (index: number) => {
    setLocalKeys((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    await saveKeys(localKeys, localModel);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-800">Cài đặt</h1>
            <p className="text-xs text-gray-400">{user?.email}</p>
          </div>
        </div>

        <div className="p-6 space-y-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Bot className="w-4 h-4 text-violet-500" />
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Model AI
              </h2>
            </div>
            <div className="space-y-2">
              {GEMINI_MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setLocalModel(m.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                    localModel === m.id
                      ? "border-violet-300 bg-violet-50 text-violet-700"
                      : "border-gray-100 bg-gray-50 text-gray-600 hover:border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{m.label}</span>
                    {localModel === m.id && (
                      <span className="text-violet-500 text-xs font-semibold">✓ Đang dùng</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">models/{m.id}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Key className="w-4 h-4 text-violet-500" />
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                API Keys (Pháp Khí)
              </h2>
            </div>
            <p className="text-xs text-gray-400 mb-3">
              Thêm nhiều key để tự động xoay vòng khi gặp lỗi 429/400.
              Lấy key tại{" "}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-500 underline"
              >
                aistudio.google.com/apikey
              </a>
            </p>

            {serverKeyAvailable && (
              <button
                onClick={useServerKey}
                disabled={loadingServerKey}
                className="w-full mb-3 flex items-center gap-2 px-4 py-3 rounded-xl border border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-700 transition-all text-sm font-medium"
              >
                {loadingServerKey ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                <span>Dùng Google API Key từ hệ thống (tự động)</span>
              </button>
            )}

            <div className="space-y-2 mb-3">
              {localKeys.map((key, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 border border-gray-100"
                >
                  <Key className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                  <span className="text-sm text-gray-600 font-mono flex-1 truncate">
                    {key.slice(0, 8)}••••••••{key.slice(-4)}
                  </span>
                  <button
                    onClick={() => removeKey(i)}
                    className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {localKeys.length === 0 && (
                <div className="text-center py-4 text-gray-300 text-sm border border-dashed border-gray-200 rounded-xl">
                  Chưa có API Key nào
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="password"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addKey()}
                placeholder="AIza... (Dán API Key vào đây)"
                autoComplete="off"
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent text-sm transition-all"
              />
              <button
                onClick={addKey}
                disabled={!newKey.trim()}
                className="w-12 h-12 rounded-xl bg-violet-100 hover:bg-violet-200 text-violet-600 flex items-center justify-center transition-colors disabled:opacity-40"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-600 space-y-1">
            <p className="font-semibold">📋 Firestore Security Rules</p>
            <p>Nếu không tải được chat, vào Firestore Console → Rules → dán:</p>
            <pre className="bg-white rounded-lg p-2 mt-2 text-xs text-gray-600 overflow-x-auto">{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}`}</pre>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-md shadow-violet-200"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang lưu...</span>
              </>
            ) : saved ? (
              "✓ Đã lưu thành công!"
            ) : (
              "Lưu cài đặt"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
