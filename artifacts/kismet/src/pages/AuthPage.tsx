import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Eye, EyeOff } from "lucide-react";

interface Props {
  onBack?: () => void;
}

export default function AuthPage({ onBack }: Props) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getFirebaseError = (code: string): string => {
    switch (code) {
      case "auth/user-not-found":
        return "Tài khoản không tồn tại. Hãy bấm Đăng ký.";
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "Email hoặc mật khẩu không đúng.";
      case "auth/email-already-in-use":
        return "Email đã tồn tại. Hãy bấm Đăng nhập.";
      case "auth/weak-password":
        return "Mật khẩu quá yếu. Cần ít nhất 6 ký tự.";
      case "auth/invalid-email":
        return "Địa chỉ email không hợp lệ.";
      case "auth/too-many-requests":
        return "Quá nhiều lần thử sai. Vui lòng đợi vài phút.";
      case "auth/network-request-failed":
        return "Lỗi mạng. Kiểm tra kết nối internet.";
      default:
        return `Lỗi (${code}). Vui lòng thử lại.`;
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
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "linear-gradient(135deg, #0f0520 0%, #1a0a3e 40%, #2d1060 70%, #1a0535 100%)",
      }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div
            className="text-6xl mb-5 inline-block"
            style={{ filter: "drop-shadow(0 0 20px rgba(167,139,250,0.6))" }}
          >
            🔮
          </div>
          <h1
            className="text-4xl font-bold tracking-tight"
            style={{
              background: "linear-gradient(90deg, #c4b5fd, #a78bfa, #7c3aed)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            KISMET
          </h1>
          <p
            className="text-xs mt-2 tracking-widest uppercase font-light"
            style={{ color: "rgba(196,181,253,0.5)" }}
          >
            AI Character Chat
          </p>
        </div>

        <div
          className="rounded-2xl p-8"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(167,139,250,0.2)",
            backdropFilter: "blur(20px)",
            boxShadow: "0 25px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
          }}
        >
          <h2
            className="text-xl font-semibold mb-6 text-center"
            style={{ color: "rgba(255,255,255,0.9)" }}
          >
            {mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: "rgba(196,181,253,0.8)" }}
              >
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl text-sm transition-all outline-none"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(167,139,250,0.3)",
                  color: "rgba(255,255,255,0.9)",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "rgba(167,139,250,0.8)";
                  e.target.style.background = "rgba(255,255,255,0.1)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "rgba(167,139,250,0.3)";
                  e.target.style.background = "rgba(255,255,255,0.07)";
                }}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: "rgba(196,181,253,0.8)" }}
              >
                Mật khẩu
                {mode === "register" && (
                  <span
                    className="font-normal ml-1 text-xs"
                    style={{ color: "rgba(196,181,253,0.4)" }}
                  >
                    (tối thiểu 6 ký tự)
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className="w-full px-4 py-3 pr-12 rounded-xl text-sm transition-all outline-none"
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(167,139,250,0.3)",
                    color: "rgba(255,255,255,0.9)",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "rgba(167,139,250,0.8)";
                    e.target.style.background = "rgba(255,255,255,0.1)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "rgba(167,139,250,0.3)";
                    e.target.style.background = "rgba(255,255,255,0.07)";
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                  style={{ color: "rgba(167,139,250,0.6)" }}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div
                className="rounded-xl px-4 py-3 text-sm flex items-start gap-2"
                style={{
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  color: "#fca5a5",
                }}
              >
                <span className="flex-shrink-0 mt-0.5">⚠</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
              style={{
                background: loading
                  ? "rgba(124,58,237,0.5)"
                  : "linear-gradient(135deg, #7c3aed, #6d28d9)",
                color: "white",
                boxShadow: loading ? "none" : "0 8px 24px rgba(124,58,237,0.4)",
                cursor: loading ? "not-allowed" : "pointer",
              }}
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
                setPassword("");
              }}
              className="text-sm font-medium transition-colors"
              style={{ color: "rgba(167,139,250,0.8)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "rgba(196,181,253,1)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "rgba(167,139,250,0.8)")
              }
            >
              {mode === "login"
                ? "Chưa có tài khoản? Đăng ký ngay"
                : "Đã có tài khoản? Đăng nhập"}
            </button>
          </div>
        </div>

        {onBack && (
          <div className="text-center mt-4">
            <button
              onClick={onBack}
              className="text-xs transition-colors"
              style={{ color: "rgba(167,139,250,0.4)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "rgba(167,139,250,0.7)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "rgba(167,139,250,0.4)")
              }
            >
              ← Quay lại xem nhân vật
            </button>
          </div>
        )}

        <p
          className="text-center text-xs mt-4 italic"
          style={{ color: "rgba(167,139,250,0.3)" }}
        >
          Số phận đã an bài. Hãy bước vào.
        </p>
      </div>
    </div>
  );
}
