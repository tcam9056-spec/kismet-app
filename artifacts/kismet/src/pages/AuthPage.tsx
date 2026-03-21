import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getFirebaseError = (code: string): string => {
    switch (code) {
      case "auth/user-not-found":
        return "Tài khoản không tồn tại. Hãy đăng ký mới.";
      case "auth/wrong-password":
        return "Mật khẩu không đúng. Hãy thử lại.";
      case "auth/email-already-in-use":
        return "Email này đã được dùng. Hãy đăng nhập.";
      case "auth/weak-password":
        return "Mật khẩu quá yếu. Tối thiểu 6 ký tự.";
      case "auth/invalid-email":
        return "Email không hợp lệ.";
      case "auth/too-many-requests":
        return "Quá nhiều lần thử. Vui lòng đợi.";
      case "auth/invalid-credential":
        return "Email hoặc mật khẩu không đúng.";
      default:
        return `Lỗi: ${code}`;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "unknown";
      setError(getFirebaseError(code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">🔮</div>
          <h1 className="text-3xl font-bold text-gray-800 tracking-tight">KISMET</h1>
          <p className="text-gray-400 text-sm mt-1 font-light tracking-widest uppercase">
            AI Character Chat
          </p>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl shadow-lg p-8">
          <h2 className="text-xl font-semibold text-gray-700 mb-6 text-center">
            {mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent text-sm transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">
                Mật khẩu
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent text-sm transition-all"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                <p className="text-red-500 text-sm text-center">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white font-semibold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md shadow-violet-200"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang kết nối tâm giao...</span>
                </>
              ) : mode === "login" ? (
                "Đăng nhập"
              ) : (
                "Tạo tài khoản"
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError(null);
              }}
              className="text-sm text-violet-600 hover:text-violet-700 font-medium transition-colors"
            >
              {mode === "login"
                ? "Chưa có tài khoản? Đăng ký ngay"
                : "Đã có tài khoản? Đăng nhập"}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-300 mt-6">
          Số phận đã an bài. Hãy bước vào.
        </p>
      </div>
    </div>
  );
}
