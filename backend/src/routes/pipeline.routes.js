import { Router } from "express";
import {
  completeJobController,
  failJobController,
  createGenerationJobController,
  getImportController,
  getJobController,
  importNewsController,
  listImportsController,
  listJobsController,
  listLatestGeneratedDebatesController,
  listLatestImportsController,
  listPendingNewsController,
  relaunchLatestJobController
} from "../controllers/pipeline.controller.js";

const pipelineRouter = Router();

pipelineRouter.post("/news/import", importNewsController);
pipelineRouter.get("/news/imports", listImportsController);
pipelineRouter.get("/news/imports/latest", listLatestImportsController);
pipelineRouter.get("/news/imports/:importId", getImportController);
pipelineRouter.get("/news/pending", listPendingNewsController);

pipelineRouter.post("/generation/jobs", createGenerationJobController);
pipelineRouter.post("/generation/jobs/relaunch-latest", relaunchLatestJobController);
pipelineRouter.get("/generation/jobs", listJobsController);
pipelineRouter.get("/generation/jobs/:jobId", getJobController);
pipelineRouter.post("/generation/jobs/:jobId/complete", completeJobController);
pipelineRouter.post("/generation/jobs/:jobId/fail", failJobController);

pipelineRouter.get("/debates/latest", listLatestGeneratedDebatesController);

export default pipelineRouter;
