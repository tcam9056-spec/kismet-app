import { Character } from "@/lib/types";
import { X } from "lucide-react";

interface Props {
  character: Character;
  onClose: () => void;
  onChat: () => void;
}

export default function CharacterProfile({ character, onClose, onChat }: Props) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(8px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "linear-gradient(180deg, #1a1825 0%, #13101f 100%)",
          border: "1px solid rgba(108,92,231,0.3)",
          borderRadius: 24,
          maxWidth: 360,
          width: "100%",
          padding: 32,
          textAlign: "center",
          position: "relative",
          boxShadow: "0 25px 50px rgba(0,0,0,0.6), 0 0 60px rgba(108,92,231,0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            width: 30,
            height: 30,
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.05)",
            color: "rgba(255,255,255,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <X size={13} />
        </button>

        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #1a0a3e 0%, #6c5ce7 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 44,
            margin: "0 auto 16px",
            border: "2.5px solid rgba(108,92,231,0.5)",
            boxShadow: "0 0 30px rgba(108,92,231,0.35)",
          }}
        >
          {character.avatar}
        </div>

        <h2
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: "#fff",
            marginBottom: 10,
          }}
        >
          {character.name}
        </h2>

        <div
          style={{
            display: "inline-block",
            padding: "5px 14px",
            borderRadius: 20,
            background: "rgba(108,92,231,0.12)",
            border: "1px solid rgba(108,92,231,0.3)",
            marginBottom: 20,
          }}
        >
          <p
            style={{
              color: "#c4b5fd",
              fontSize: 12,
              fontStyle: "italic",
            }}
          >
            "{character.slogan}"
          </p>
        </div>

        <div
          style={{
            background: "rgba(0,0,0,0.3)",
            borderRadius: 14,
            padding: "14px 16px",
            marginBottom: 20,
            textAlign: "left",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "rgba(167,139,250,0.5)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 6,
            }}
          >
            Lời Nguyền
          </p>
          <p
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.6)",
              fontStyle: "italic",
              lineHeight: 1.5,
            }}
          >
            {character.curse ? `"${character.curse}"` : character.slogan}
          </p>
        </div>

        {character.isPublic && (
          <div
            style={{
              display: "inline-block",
              padding: "3px 12px",
              borderRadius: 20,
              background: "rgba(52,211,153,0.1)",
              border: "1px solid rgba(52,211,153,0.2)",
              marginBottom: 20,
            }}
          >
            <span style={{ fontSize: 11, color: "#34d399" }}>✦ Nhân vật công khai</span>
          </div>
        )}

        <button
          onClick={() => {
            onClose();
            onChat();
          }}
          style={{
            width: "100%",
            padding: "14px 0",
            borderRadius: 14,
            border: "none",
            background: "linear-gradient(135deg, #7c3aed, #6c5ce7)",
            color: "#fff",
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 6px 20px rgba(108,92,231,0.4)",
          }}
        >
          Bắt đầu tâm giao →
        </button>
      </div>
    </div>
  );
}
