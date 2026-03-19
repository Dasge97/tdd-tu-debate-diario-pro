import { Router } from "express";
import { listRecentActivityController } from "../controllers/activity.controller.js";

const activityRouter = Router();

activityRouter.get("/recent", listRecentActivityController);

export default activityRouter;
