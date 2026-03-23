import { Router, type IRouter } from "express";
import {
  createPersona,
  getPersonas,
  getPersonaById,
} from "../controllers/personaController";

const router: IRouter = Router();

router.post("/personas", createPersona);
router.get("/personas", getPersonas);
router.get("/personas/:id", getPersonaById);

export default router;
