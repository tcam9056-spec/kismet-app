import { Router, type IRouter } from "express";
import healthRouter from "./health";
import configRouter from "./config";
import uploadRouter from "./upload";

const router: IRouter = Router();

router.use(healthRouter);
router.use(configRouter);
router.use(uploadRouter);

export default router;
