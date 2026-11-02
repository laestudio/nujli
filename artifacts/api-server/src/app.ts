import express, { type Express } from "express";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { CLERK_PROXY_PATH, clerkProxyMiddleware, getClerkProxyHost } from "./middlewares/clerkProxyMiddleware";
import { rateLimit } from "express-rate-limit";
import { ZodError } from "zod";
import { HttpError } from "./lib/errors";
import webhooks from "./routes/webhooks";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.disable("x-powered-by");
app.set("trust proxy", "loopback");
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use("/api/webhooks",express.raw({type:"application/json",limit:"256kb"}),webhooks);
app.use(express.json({limit:"256kb"}));
app.use(clerkMiddleware((req)=>({
  publishableKey:publishableKeyFromHost(getClerkProxyHost(req)??"",process.env.CLERK_PUBLISHABLE_KEY),
})));
app.use("/api",(_req,res,next)=>{res.setHeader("Cache-Control","no-store");res.setHeader("X-Content-Type-Options","nosniff");next();});
app.use("/api",rateLimit({windowMs:60000,limit:180,standardHeaders:"draft-7",legacyHeaders:false}));
app.use("/api",(req,res,next)=>{
  if(!["GET","HEAD","OPTIONS"].includes(req.method)){
    const origin=req.get("origin");
    if(origin && new URL(origin).host!==req.get("host")){res.status(403).json({error:"Cross-origin request blocked."});return;}
  }
  next();
});

app.use("/api", router);
app.use((err:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
  if(err instanceof ZodError){res.status(400).json({error:"Invalid request or data.",details:err.issues.map(i=>({path:i.path,message:i.message}))});return;}
  if(err instanceof HttpError){res.status(err.status).json({error:err.message});return;}
  logger.error({error:err instanceof Error?err.name:"unknown"},"Request failed");
  res.status(500).json({error:"The request could not be completed. Nothing has been confirmed successful."});
});

export default app;
