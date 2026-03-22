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

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#0a0a0f",
        color: "#fff",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 20px 16px",
            borderBottom: "1px solid rgba(108,92,231,0.15)",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 20,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                background: "linear-gradient(90deg, #c4b5fd, #a78bfa, #7c3aed)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                marginBottom: 2,
              }}
            >
              🔮 KISMET
            </h1>
            <p style={{ fontSize: 11, color: "rgba(167,139,250,0.45)" }}>
              {user?.email}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onSettings}
              title="Cài đặt"
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.05)",
                color: "rgba(167,139,250,0.7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <Settings size={15} />
            </button>
            <button
              onClick={() => logout()}
              title="Đăng xuất"
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.05)",
                color: "rgba(167,139,250,0.7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>

        {/* Character List */}
        <div style={{ padding: "20px 16px" }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "rgba(167,139,250,0.4)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 14,
              paddingLeft: 4,
            }}
          >
            Nhân Vật
          </p>

          {loading ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "60px 0",
                gap: 10,
              }}
            >
              <Loader2
                size={22}
                style={{ color: "#a78bfa", animation: "spin 1s linear infinite" }}
              />
              <p style={{ fontSize: 13, color: "rgba(167,139,250,0.4)", fontStyle: "italic" }}>
                Đang triệu hồi nhân vật...
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {characters.map((char) => (
                <div
                  key={char.id}
                  onClick={() => onChat(char)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "14px 16px",
                    borderRadius: 16,
                    border: "1px solid rgba(108,92,231,0.15)",
                    background: "rgba(255,255,255,0.03)",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    position: "relative",
                    overflow: "hidden",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(108,92,231,0.4)";
                    (e.currentTarget as HTMLDivElement).style.background = "rgba(108,92,231,0.07)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(108,92,231,0.15)";
                    (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)";
                  }}
                >
                  <button
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #1a0a3e 0%, #6c5ce7 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 26,
                      flexShrink: 0,
                      border: "1.5px solid rgba(108,92,231,0.4)",
                      boxShadow: "0 0 16px rgba(108,92,231,0.25)",
                      cursor: "pointer",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedChar(char);
                    }}
                    title="Xem hồ sơ"
                  >
                    {char.avatar}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: "#fff",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        marginBottom: 3,
                      }}
                    >
                      {char.name}
                    </p>
                    <p
                      style={{
                        fontSize: 12,
                        color: "rgba(167,139,250,0.55)",
                        fontStyle: "italic",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      "{char.slogan}"
                    </p>
                    {char.isPublic && (
                      <span
                        style={{
                          display: "inline-block",
                          marginTop: 4,
                          fontSize: 10,
                          color: "#34d399",
                          background: "rgba(52,211,153,0.1)",
                          border: "1px solid rgba(52,211,153,0.2)",
                          borderRadius: 20,
                          padding: "1px 8px",
                        }}
                      >
                        ✦ Công khai
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 18, color: "rgba(108,92,231,0.4)", flexShrink: 0 }}>
                    ›
                  </span>
                </div>
              ))}

              <button
                onClick={onAddCharacter}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 16px",
                  borderRadius: 16,
                  border: "1px dashed rgba(108,92,231,0.25)",
                  background: "transparent",
                  cursor: "pointer",
                  width: "100%",
                  transition: "all 0.15s",
                  color: "#fff",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(108,92,231,0.5)";
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(108,92,231,0.07)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(108,92,231,0.25)";
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: "50%",
                    border: "1.5px dashed rgba(108,92,231,0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Plus size={20} style={{ color: "rgba(108,92,231,0.5)" }} />
                </div>
                <div>
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "rgba(167,139,250,0.6)",
                      marginBottom: 2,
                    }}
                  >
                    Tạo nhân vật mới
                  </p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>
                    Triệu hồi linh hồn của riêng bạn
                  </p>
                </div>
              </button>
            </div>
          )}
        </div>

        <p
          style={{
            textAlign: "center",
            fontSize: 11,
            color: "rgba(167,139,250,0.2)",
            fontStyle: "italic",
            paddingBottom: 24,
          }}
        >
          "Mọi cuộc gặp gỡ đều là số phận đã định"
        </p>
      </div>

      {selectedChar && (
        <CharacterProfile
          character={selectedChar}
          onClose={() => setSelectedChar(null)}
          onChat={() => onChat(selectedChar)}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
