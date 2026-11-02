import { Router, type IRouter } from "express";
import healthRouter from "./health";
import nujliRouter from "./nujli";

const router: IRouter = Router();

router.use(healthRouter);
router.use(nujliRouter);

export default router;
