import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import scenesRouter from "./scenes";
import shootDaysRouter from "./shootDays";
import takesRouter from "./takes";
import cutsRouter from "./cuts";
import deliverablesRouter from "./deliverables";
import evidenceLogRouter from "./evidenceLog";
import seedDemoRouter from "./seedDemo";
import demoSessionRouter from "./demoSession";

const router: IRouter = Router();

router.use(healthRouter);
router.use(projectsRouter);
router.use(scenesRouter);
router.use(shootDaysRouter);
router.use(takesRouter);
router.use(cutsRouter);
router.use(deliverablesRouter);
router.use(evidenceLogRouter);
router.use(seedDemoRouter);
router.use(demoSessionRouter);

export default router;
