import { Router, type IRouter } from "express";
import healthRouter from "./health";
import somobayRouter from "./somobay";

const router: IRouter = Router();

router.use(healthRouter);
router.use(somobayRouter);

export default router;
