import { useState, useRef, useEffect } from "react";
import { useChat } from "@/hooks/useChat";
import { useKeys } from "@/hooks/useKeys";
import type { Character, GeminiModel } from "@/lib/types";
import { ArrowLeft, Send, Loader2, Trash2, AlertCircle } from "lucide-react";

interface Props {
  character: Character;
  onBack: () => void;
}

export default function ChatPage({ character, onBack }: Props) {
  const { keys, selectedModel } = useKeys();
  const { messages, loading, sending, statusText, error, send, clearHistory } = useChat(
    character,
    keys,
    selectedModel as GeminiModel
  );
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    send(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  const handleClear = () => {
    if (confirm("Xóa toàn bộ lịch sử chat với nhân vật này?")) {
      clearHistory();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 flex-shrink-0">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-xl">
            {character.avatar}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-800 leading-tight">{character.name}</h2>
            <p className="text-xs text-gray-400 leading-tight truncate max-w-48">{character.slogan}</p>
          </div>
        </div>
        <button
          onClick={handleClear}
          className="w-9 h-9 rounded-xl hover:bg-red-50 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors"
          title="Xóa lịch sử"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="w-6 h-6 text-violet-400 animate-spin mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Đang tải lịch sử...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center max-w-xs">
              <div className="text-5xl mb-4">{character.avatar}</div>
              <h3 className="text-gray-700 font-medium mb-1">{character.name}</h3>
              <p className="text-gray-400 text-sm italic mb-4">"{character.slogan}"</p>
              <p className="text-gray-300 text-xs">Hãy gửi tin nhắn đầu tiên để bắt đầu tâm giao...</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center text-base flex-shrink-0 mt-0.5">
                    {character.avatar}
                  </div>
                )}
                <div
                  className={`max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    msg.role === "user"
                      ? "bg-violet-600 text-white rounded-tr-sm"
                      : "bg-gray-50 text-gray-700 rounded-tl-sm border border-gray-100"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
          </>
        )}

        {sending && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center text-base flex-shrink-0">
              {character.avatar}
            </div>
            <div className="bg-gray-50 border border-gray-100 px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
              <span className="text-gray-400 text-sm italic">
                {statusText || "Đang phản hồi..."}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-500 text-sm">{error}</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="px-4 pb-4 pt-2 border-t border-gray-50 flex-shrink-0">
        {keys.length === 0 && (
          <div className="mb-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-xl">
            <p className="text-amber-600 text-xs text-center">
              ⚠️ Chưa có API Key. Vào Cài đặt để thêm.
            </p>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Nhập tin nhắn..."
            rows={1}
            disabled={sending}
            className="flex-1 px-4 py-3 rounded-2xl border border-gray-200 text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent text-sm transition-all resize-none disabled:opacity-50"
            style={{ minHeight: "48px", maxHeight: "120px" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="w-12 h-12 rounded-2xl bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 shadow-md shadow-violet-200"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
