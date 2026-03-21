import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/config", (_req, res) => {
  const googleApiKey = process.env["GOOGLE_API_KEY"] || "";
  res.json({
    defaultGeminiKey: googleApiKey,
    hasDefaultKey: googleApiKey.length > 0,
  });
});

export default router;
