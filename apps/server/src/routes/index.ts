import { Hono } from "hono";
import { agentRouter } from "./v1/agent";

const apiRouter = new Hono();

// Mount v1 routes
apiRouter.route("/v1/agent", agentRouter);

export { apiRouter };
