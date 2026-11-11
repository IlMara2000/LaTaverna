// Bridge condiviso con gli handler delle server function (le stesse rotte di api/).
// Lo usano il plugin Vite di sviluppo e il server statico di scripts/serve-dist.mjs,
// così la guardia sull'origine e il limite di body restano in un solo posto.
export const API_ENV_ALLOWLIST = ['FREELLMAPI_BASE_URL','FREELLMAPI_API_KEY','FREELLMAPI_MODEL','FREELLMAPI_VISION_MODEL','FREELLMAPI_TEMPERATURE','FREELLMAPI_MAX_TOKENS','FREELLMAPI_TIMEOUT_MS','VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY','SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY'];

export const API_ROUTES = {
    '/api/oracle/chat': () => import('../api/oracle/chat.js'),
    '/api/rpg/ai-chat': () => import('../api/rpg/ai-chat.js'),
    '/api/rpg/session-event': () => import('../api/rpg/session-event.js'),
    '/api/rpg/ai-health': () => import('../api/rpg/ai-health.js'),
    '/api/magic/scan': () => import('../api/magic/scan.js'),
    '/api/magic/translate': () => import('../api/magic/translate.js'),
    '/api/magic/prices': () => import('../api/magic/prices.js')
};

// Copia solo le variabili server ammesse: nessun'altra finisce in process.env.
export function applyApiEnv(env, target = process.env){
    for(const name of API_ENV_ALLOWLIST)if(env[name])target[name]=env[name];
}

// Restituisce un gestore (req,res)=>Promise<boolean>: true se la rotta è stata gestita.
export function createApiMiddleware({ maxBodyBytes = 3 * 1024 * 1024, routes = API_ROUTES } = {}){
    return async function handleApiRequest(req, res){
        const load = routes[req.url?.split('?')[0]];
        if(!load)return false;
        const origin = req.headers.origin;
        if(origin && origin !== `http://${req.headers.host}` && origin !== `https://${req.headers.host}`){res.statusCode = 403;res.end();return true;}
        res.status = code => {res.statusCode = code;return res;};
        res.json = data => {res.setHeader('Content-Type', 'application/json');res.end(JSON.stringify(data));};
        try{
            let size = 0;const chunks = [];
            for await (const chunk of req){
                size += chunk.length;
                if(size > maxBodyBytes){res.status(413).json({ok:false,error:'File troppo grande.'});return true;}
                chunks.push(chunk);
            }
            req.body = Buffer.concat(chunks).toString('utf8');
            const { default: handler } = await load();
            await handler(req, res);
        }
        catch(err){
            console.error(`[api] ${req.url} fallita:`, err?.message || err);
            if(!res.writableEnded)res.status(500).json({ok:false,error:'Servizio locale non disponibile.'});
        }
        return true;
    };
}
