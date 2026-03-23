import { Router, type IRouter } from "express";
import {
  createChatProfile,
  getChatProfiles,
  deleteChatProfile,
} from "../controllers/chatProfileController";

const router: IRouter = Router();

router.post("/chat-profiles/create", createChatProfile);
router.get("/chat-profiles", getChatProfiles);
router.delete("/chat-profiles/:id", deleteChatProfile);

export default router;
