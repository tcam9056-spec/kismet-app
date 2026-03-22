import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth, getLocalSession } from "@/contexts/AuthContext";
import AuthPage from "@/pages/AuthPage";
import HomePage from "@/pages/HomePage";
import ChatPage from "@/pages/ChatPage";
import SettingsPage from "@/pages/SettingsPage";
import AddCharacterPage from "@/pages/AddCharacterPage";
import type { Character } from "@/lib/types";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

type Screen = "home" | "chat" | "settings" | "addCharacter";

function AppContent() {
  const { user, loading } = useAuth();
  const [screen, setScreen] = useState<Screen>("home");
  const [activeCharacter, setActiveCharacter] = useState<Character | null>(null);

  const hasLocalSession = !!getLocalSession();

  if (loading && !hasLocalSession) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          background: "linear-gradient(135deg, #0f0520 0%, #1a0a3e 40%, #2d1060 70%, #1a0535 100%)",
        }}
      >
        <div className="text-center">
          <div
            className="text-5xl mb-5"
            style={{ filter: "drop-shadow(0 0 20px rgba(167,139,250,0.6))" }}
          >
            🔮
          </div>
          <Loader2 className="w-5 h-5 mx-auto animate-spin" style={{ color: "#a78bfa" }} />
          <p className="text-sm mt-2 italic" style={{ color: "rgba(167,139,250,0.5)" }}>
            Đang kết nối tâm giao...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  if (screen === "chat" && activeCharacter) {
    return (
      <ChatPage
        character={activeCharacter}
        onBack={() => {
          setScreen("home");
          setActiveCharacter(null);
        }}
      />
    );
  }

  if (screen === "settings") {
    return <SettingsPage onBack={() => setScreen("home")} />;
  }

  if (screen === "addCharacter") {
    return <AddCharacterPage onBack={() => setScreen("home")} />;
  }

  return (
    <HomePage
      onChat={(char) => {
        setActiveCharacter(char);
        setScreen("chat");
      }}
      onSettings={() => setScreen("settings")}
      onAddCharacter={() => setScreen("addCharacter")}
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
