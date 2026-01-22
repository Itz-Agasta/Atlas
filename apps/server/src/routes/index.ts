import { Hono } from "hono";
import { agentRouter } from "./v1/agent";
import { homeRouter } from "./v1/home-page";

const apiRouter = new Hono();

// Mount v1 routes
apiRouter.route("/v1/agent", agentRouter);
apiRouter.route("/v1/home", homeRouter);

export { apiRouter };
