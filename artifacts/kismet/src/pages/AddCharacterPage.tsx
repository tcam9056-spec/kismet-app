import { useState } from "react";
import { useCharacters } from "@/hooks/useCharacters";
import { ArrowLeft, Loader2 } from "lucide-react";

interface Props {
  onBack: () => void;
}

const AVATAR_OPTIONS = ["🔮", "🌙", "⚡", "✨", "🌸", "🦋", "🐉", "👁️", "🌊", "🔥", "🧿", "💫", "🌌", "🗡️", "🌿"];

export default function AddCharacterPage({ onBack }: Props) {
  const { addCharacter } = useCharacters();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("🔮");
  const [slogan, setSlogan] = useState("");
  const [curse, setCurse] = useState("");
  const [personality, setPersonality] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !slogan || !curse || !personality) {
      setError("Vui lòng điền đầy đủ thông tin.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await addCharacter({ name, avatar, slogan, curse, personality, isPublic: false });
      onBack();
    } catch {
      setError("Không thể tạo nhân vật. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

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
          <h1 className="text-lg font-bold text-gray-800">Tạo Nhân Vật Mới</h1>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">Chọn Avatar</label>
            <div className="grid grid-cols-5 gap-2">
              {AVATAR_OPTIONS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAvatar(a)}
                  className={`h-12 rounded-xl text-2xl flex items-center justify-center transition-all border-2 ${
                    avatar === a
                      ? "border-violet-400 bg-violet-50"
                      : "border-gray-100 bg-gray-50 hover:border-gray-200"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Tên Nhân Vật</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Elara - Phù Thủy Thời Gian"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent text-sm transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Slogan</label>
            <input
              type="text"
              value={slogan}
              onChange={(e) => setSlogan(e.target.value)}
              placeholder="Câu nói đặc trưng của nhân vật..."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent text-sm transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Lời Nguyền</label>
            <input
              type="text"
              value={curse}
              onChange={(e) => setCurse(e.target.value)}
              placeholder="Lời nguyền bí ẩn của nhân vật..."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent text-sm transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">
              Tính Cách & System Prompt
            </label>
            <textarea
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              placeholder="Mô tả chi tiết nhân vật này là ai, cách họ nói chuyện, thế giới quan của họ... (Đây là system prompt gửi đến AI)"
              rows={5}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent text-sm transition-all resize-none"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3">
              <p className="text-red-500 text-sm text-center">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-md shadow-violet-200"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang tạo nhân vật...</span>
              </>
            ) : (
              "✦ Triệu hồi Nhân Vật"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
