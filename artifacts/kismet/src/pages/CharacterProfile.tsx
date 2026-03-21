import { Character } from "@/lib/types";

interface Props {
  character: Character;
  onClose: () => void;
  onChat: () => void;
}

export default function CharacterProfile({ character, onClose, onChat }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
        >
          ✕
        </button>

        <div className="text-7xl mb-4">{character.avatar}</div>
        <h2 className="text-xl font-bold text-gray-800 mb-1">{character.name}</h2>

        <div className="inline-block px-3 py-1 rounded-full bg-violet-50 border border-violet-100 mb-4">
          <p className="text-violet-600 text-xs font-medium italic">"{character.slogan}"</p>
        </div>

        <div className="bg-gray-50 rounded-2xl p-4 mb-4 text-left">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Lời Nguyền</p>
          <p className="text-gray-600 text-sm italic">"{character.curse}"</p>
        </div>

        {character.isPublic && (
          <div className="inline-block px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 mb-4">
            <span className="text-emerald-600 text-xs">✦ Nhân vật công khai</span>
          </div>
        )}

        <button
          onClick={() => { onClose(); onChat(); }}
          className="w-full py-3.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm transition-all shadow-md shadow-violet-200"
        >
          Bắt đầu tâm giao →
        </button>
      </div>
    </div>
  );
}
