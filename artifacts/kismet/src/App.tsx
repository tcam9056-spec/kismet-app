import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
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

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🔮</div>
          <Loader2 className="w-5 h-5 text-violet-400 animate-spin mx-auto" />
          <p className="text-gray-300 text-sm mt-2">Đang kết nối tâm giao...</p>
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
        onBack={() => setScreen("home")}
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
