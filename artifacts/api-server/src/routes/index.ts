import { Router, type IRouter } from "express";
import healthRouter from "./health";
import configRouter from "./config";
import uploadRouter from "./upload";
import characterRouter from "./character";
import personaRouter from "./persona";
import chatProfileRouter from "./chatProfile";

const router: IRouter = Router();

router.use(healthRouter);
router.use(configRouter);
router.use(uploadRouter);
router.use(characterRouter);
router.use(personaRouter);
router.use(chatProfileRouter);

export default router;
