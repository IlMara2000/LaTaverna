// Development-only bridge for the same handlers deployed as server functions.
// Only these server environment variables are copied; none enter Vite define.
// La logica (rotte, allowlist, guardia origine) vive in scripts/local-api-bridge.js.
import { applyApiEnv, createApiMiddleware } from './local-api-bridge.js';

export function localApiPlugin(env){
    applyApiEnv(env);
    const handleApiRequest = createApiMiddleware();
    return {name:'taverna-local-api',configureServer(server){server.middlewares.use(async(req,res,next)=>{
        if(await handleApiRequest(req,res))return;
        next();
    });}};
}
