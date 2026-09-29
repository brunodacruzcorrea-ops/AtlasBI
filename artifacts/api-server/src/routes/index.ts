import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import consultantsRouter from "./consultants";
import salesRouter from "./sales";
import goalsRouter from "./goals";
import dashboardRouter from "./dashboard";
import usersRouter from "./users";
import salesEventsRouter from "./sales-events";
import integrationsRouter from "./integrations";
import commissionsRouter from "./commissions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(consultantsRouter);
router.use(salesRouter);
router.use(goalsRouter);
router.use(dashboardRouter);
router.use(usersRouter);
router.use(salesEventsRouter);
router.use(integrationsRouter);
router.use(commissionsRouter);

export default router;
