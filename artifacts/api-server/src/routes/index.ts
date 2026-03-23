import { Router, type IRouter } from "express";
import healthRouter from "./health";
import configRouter from "./config";
import uploadRouter from "./upload";
import characterRouter from "./character";

const router: IRouter = Router();

router.use(healthRouter);
router.use(configRouter);
router.use(uploadRouter);
router.use(characterRouter);

export default router;
