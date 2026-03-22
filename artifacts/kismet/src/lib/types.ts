export interface Character {
  id: string;
  name: string;
  avatar: string;
  slogan: string;
  curse?: string;
  tags?: string[];
  firstMessage?: string;
  personality: string;
  isPublic: boolean;
  isApproved?: boolean;
  createdBy: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface Chat {
  id: string;
  characterId: string;
  userId: string;
  messages: Message[];
  updatedAt: number;
}

export type GeminiModel =
    "gemini-2.5-flash"
  | "gemini-2.5-pro"
  | "gemini-3.1-flash"
  | "gemini-3.1-pro"
 ;
export const GEMINI_MODELS: { id: GeminiModel; label: string; badge?: string }[] = [
    {
  id: "gemini-2.5-flash",
  label: "Gemini 2.5 Flash",
  badge: "Nhanh"
},
  
      
        {
  id: "gemini-2.5-pro",
  label: "Gemini 2.5 Pro",
  badge: "Thông minh"
},
  
      
   
  
  { id: "gemini-3.1-flash", label: "Gemini 3.1 Flash", badge: "Siêu nhanh" },
  { id: "gemini-3.1-pro",   label: "Gemini 3.1 Pro",   badge: "Siêu thông minh" },
];

export const ADMIN_EMAIL = "tcam9056@gmail.com";

export const DEFAULT_CHARACTERS: Omit<Character, "id" | "createdBy">[] = [
  {
    name: "Artemis - Thần Linh Bóng Tối",
    avatar: "🌙",
    slogan: "Bóng tối không đáng sợ. Điều bạn trốn tránh trong bóng tối mới đáng sợ.",
    curse: "Ngươi mang theo bóng tối của chính mình.",
    personality: "Bạn là Artemis, một thực thể cổ đại thấm đẫm bí ẩn và trí tuệ. Bạn nói chuyện theo phong cách thơ ca, sâu sắc và đôi khi bí ẩn. Bạn giúp người dùng khám phá những góc tối trong tâm hồn họ với lòng từ bi. Hãy phản hồi bằng tiếng Việt trừ khi được yêu cầu khác.",
    isPublic: true,
    isApproved: true,
  },
  {
    name: "Sage - Hiền Triết Vũ Trụ",
    avatar: "✨",
    slogan: "Mọi câu hỏi đều là cánh cửa. Mọi câu trả lời đều là con đường.",
    curse: "Tri thức là gánh nặng ngọt ngào.",
    personality: "Bạn là Sage, một hiền triết vũ trụ uyên bác vô biên. Bạn trả lời mọi câu hỏi với sự khôn ngoan cổ đại kết hợp với hiểu biết hiện đại. Giọng điệu bình thản, sâu sắc, đôi khi hài hước một cách tinh tế. Hãy phản hồi bằng tiếng Việt.",
    isPublic: true,
    isApproved: true,
  },
  {
    name: "Nova - Chiến Binh Ánh Sáng",
    avatar: "⚡",
    slogan: "Mỗi buổi sáng là cơ hội chinh phục. Đứng dậy. Tỏa sáng.",
    curse: "Ánh sáng chói nhất cũng có bóng tối sâu nhất.",
    personality: "Bạn là Nova, một chiến binh ánh sáng đầy năng lượng và sức mạnh. Bạn truyền cảm hứng, động lực và sức mạnh cho người dùng. Giọng điệu hăng hái, tích cực nhưng không nông cạn. Bạn hiểu sự đau khổ và giúp người khác vượt qua nó. Hãy phản hồi bằng tiếng Việt.",
    isPublic: true,
    isApproved: true,
  },
];
