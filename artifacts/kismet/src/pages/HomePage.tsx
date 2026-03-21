import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCharacters } from "@/hooks/useCharacters";
import type { Character } from "@/lib/types";
import CharacterProfile from "./CharacterProfile";
import { Settings, Plus, LogOut, Loader2 } from "lucide-react";

interface Props {
  onChat: (character: Character) => void;
  onSettings: () => void;
  onAddCharacter: () => void;
}

export default function HomePage({ onChat, onSettings, onAddCharacter }: Props) {
  const { user, logout } = useAuth();
  const { characters, loading } = useCharacters();
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);

  const handleAvatarClick = (char: Character) => {
    setSelectedChar(char);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h1 className="text-xl font-bold text-gray-800 tracking-tight">🔮 KISMET</h1>
            <p className="text-xs text-gray-400">{user?.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onSettings}
              className="w-9 h-9 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors"
              title="Cài đặt"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={() => logout()}
              className="w-9 h-9 rounded-xl bg-gray-50 hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-400 transition-colors"
              title="Đăng xuất"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-6 pt-6 pb-2">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Nhân Vật
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <Loader2 className="w-6 h-6 text-violet-400 animate-spin mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Đang triệu hồi nhân vật...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {characters.map((char) => (
                <div
                  key={char.id}
                  className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 hover:border-violet-200 hover:bg-violet-50/30 transition-all group cursor-pointer"
                  onClick={() => onChat(char)}
                >
                  <button
                    className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center text-3xl flex-shrink-0 hover:scale-105 transition-transform"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAvatarClick(char);
                    }}
                    title="Xem hồ sơ"
                  >
                    {char.avatar}
                  </button>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-800 truncate">{char.name}</h3>
                    <p className="text-xs text-gray-400 italic truncate mt-0.5">
                      "{char.slogan}"
                    </p>
                    {char.isPublic && (
                      <span className="inline-block mt-1 text-xs text-emerald-500">✦ Công khai</span>
                    )}
                  </div>
                  <div className="text-gray-200 group-hover:text-violet-300 transition-colors">
                    <span className="text-lg">›</span>
                  </div>
                </div>
              ))}

              <button
                onClick={onAddCharacter}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border border-dashed border-gray-200 hover:border-violet-300 hover:bg-violet-50/30 transition-all group"
              >
                <div className="w-14 h-14 rounded-2xl bg-gray-50 group-hover:bg-violet-50 flex items-center justify-center flex-shrink-0 transition-colors">
                  <Plus className="w-5 h-5 text-gray-300 group-hover:text-violet-400 transition-colors" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-400 group-hover:text-violet-600 transition-colors">
                    Tạo nhân vật mới
                  </p>
                  <p className="text-xs text-gray-300">Triệu hồi linh hồn của riêng bạn</p>
                </div>
              </button>
            </div>
          )}
        </div>

        <div className="px-6 py-6 mt-4 text-center">
          <p className="text-xs text-gray-200 italic">
            "Mọi cuộc gặp gỡ đều là số phận đã định"
          </p>
        </div>
      </div>

      {selectedChar && (
        <CharacterProfile
          character={selectedChar}
          onClose={() => setSelectedChar(null)}
          onChat={() => onChat(selectedChar)}
        />
      )}
    </div>
  );
}
