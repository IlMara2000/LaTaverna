// Development-only bridge for the same handlers deployed as server functions.
// Only these server environment variables are copied; none enter Vite define.
export function localApiPlugin(env){
    const names=['GROQ_LLM_API_KEY','GROQ_API_KEY','GROQ_LLM_MODEL','GROQ_VISION_MODEL','VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY'];
    for(const name of names)if(env[name])process.env[name]=env[name];
    const routes={
        '/api/oracle/chat':()=>import('../api/oracle/chat.js'),
        '/api/rpg/ai-chat':()=>import('../api/rpg/ai-chat.js'),
        '/api/rpg/session-event':()=>import('../api/rpg/session-event.js'),
        '/api/rpg/ai-health':()=>import('../api/rpg/ai-health.js'),
        '/api/magic/scan':()=>import('../api/magic/scan.js'),
        '/api/magic/translate':()=>import('../api/magic/translate.js')
    };
    return {name:'taverna-local-api',configureServer(server){server.middlewares.use(async(req,res,next)=>{
        const load=routes[req.url?.split('?')[0]];if(!load)return next();
        const origin=req.headers.origin;if(origin&&origin!==`http://${req.headers.host}`&&origin!==`https://${req.headers.host}`){res.statusCode=403;res.end();return;}
        res.status=code=>{res.statusCode=code;return res;};res.json=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
        try{let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>3*1024*1024){res.status(413).json({ok:false,error:'File troppo grande.'});return;}chunks.push(chunk);}req.body=Buffer.concat(chunks).toString('utf8');const {default:handler}=await load();await handler(req,res);}
        catch{if(!res.writableEnded)res.status(500).json({ok:false,error:'Servizio locale non disponibile.'});}
    });}};
}
