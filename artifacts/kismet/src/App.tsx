import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth, getLocalSession } from "@/contexts/AuthContext";
import AuthPage from "@/pages/AuthPage";
import HomePage from "@/pages/HomePage";
import ChatPage from "@/pages/ChatPage";
import SettingsPage from "@/pages/SettingsPage";
import AddCharacterPage from "@/pages/AddCharacterPage";
import UserPage from "@/pages/UserPage";
import type { Character } from "@/lib/types";

const queryClient = new QueryClient();

type Screen = "home" | "chat" | "settings" | "addCharacter" | "userPage";

/* ── Elegant KISMET Splash ── */
function SplashScreen() {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "radial-gradient(ellipse at 50% 60%, #1a0a3e 0%, #0c0720 55%, #06040f 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "'Georgia', 'Times New Roman', serif",
    }}>
      <div style={{ position: "absolute", width: 320, height: 320, borderRadius: "50%", border: "1px solid rgba(180,150,255,0.06)", animation: "pulse 4s ease-in-out infinite" }} />
      <div style={{ position: "absolute", width: 220, height: 220, borderRadius: "50%", border: "1px solid rgba(180,150,255,0.09)", animation: "pulse 4s ease-in-out infinite 0.5s" }} />
      <div style={{ position: "absolute", width: 140, height: 140, borderRadius: "50%", border: "1px solid rgba(180,150,255,0.14)", animation: "pulse 4s ease-in-out infinite 1s" }} />

      <div style={{ width: 72, height: 72, marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, filter: "drop-shadow(0 0 28px rgba(212,175,55,0.5))", animation: "floatGate 3s ease-in-out infinite" }}>
        🌌
      </div>

      <h1 style={{ margin: 0, padding: 0, fontSize: "clamp(42px, 12vw, 64px)", fontWeight: 700, letterSpacing: "0.18em", background: "linear-gradient(180deg, #f5e6a3 0%, #d4af37 40%, #b8860b 80%, #a07000 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", textShadow: "none", filter: "drop-shadow(0 0 32px rgba(212,175,55,0.35))", lineHeight: 1 }}>
        KISMET
      </h1>

      <div style={{ width: 60, height: 1, background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.5), transparent)", margin: "14px auto 12px" }} />

      <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.35em", textTransform: "uppercase", color: "rgba(212,175,55,0.5)", fontFamily: "'Segoe UI', system-ui, sans-serif", fontStyle: "italic" }}>
        AI Character Chat
      </p>

      <div style={{ display: "flex", gap: 6, marginTop: 40 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(212,175,55,0.5)", animation: `dotPulse 1.4s ease-in-out infinite`, animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>

      <p style={{ position: "absolute", bottom: 32, fontSize: 11, color: "rgba(255,255,255,0.15)", fontStyle: "italic", letterSpacing: "0.05em" }}>
        Số phận đã an bài. Hãy bước vào.
      </p>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:0.4;transform:scale(1)} 50%{opacity:1;transform:scale(1.04)} }
        @keyframes floatGate { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes dotPulse { 0%,80%,100%{opacity:0.2;transform:scale(0.8)} 40%{opacity:1;transform:scale(1)} }
      `}</style>
    </div>
  );
}

function AppContent() {
  const { user, loading } = useAuth();
  const [screen, setScreen] = useState<Screen>("home");
  const [activeCharacter, setActiveCharacter] = useState<Character | null>(null);
  const [viewUserId, setViewUserId] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(true);

  const hasLocalSession = !!getLocalSession();

  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 1800);
    return () => clearTimeout(t);
  }, []);

  /* Handle deep-link ?profile=uid on load */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const profileUid = params.get("profile");
    if (profileUid && user) {
      setViewUserId(profileUid);
      setScreen("userPage");
      /* Clean URL */
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [user]);

  if (showSplash || (loading && !hasLocalSession)) {
    return <SplashScreen />;
  }

  if (!user) return <AuthPage />;

  if (screen === "chat" && activeCharacter) {
    return (
      <ChatPage
        character={activeCharacter}
        onBack={() => { setScreen("home"); setActiveCharacter(null); }}
      />
    );
  }

  if (screen === "settings") {
    return <SettingsPage onBack={() => setScreen("home")} />;
  }

  if (screen === "addCharacter") {
    return <AddCharacterPage onBack={() => setScreen("home")} />;
  }

  if (screen === "userPage" && viewUserId) {
    return (
      <UserPage
        uid={viewUserId}
        isSelf={viewUserId === user.uid}
        onBack={() => { setScreen("home"); setViewUserId(null); }}
        onChat={char => { setActiveCharacter(char); setScreen("chat"); }}
      />
    );
  }

  return (
    <HomePage
      onChat={(char) => { setActiveCharacter(char); setScreen("chat"); }}
      onSettings={() => setScreen("settings")}
      onAddCharacter={() => setScreen("addCharacter")}
      onViewUser={(uid) => { setViewUserId(uid); setScreen("userPage"); }}
    />
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  );
}
