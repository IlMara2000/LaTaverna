import {callOracle,validImage} from '../_lib/oracle.js';
import {authorizeOracle} from '../_lib/oracleAccess.js';
import {methodNotAllowed,readJsonBody,sendJson,sanitizeText} from '../_lib/http.js';
export default async function handler(request,response){
    response.setHeader('Cache-Control','no-store');
    if(request.method!=='POST')return methodNotAllowed(response,['POST']);
    try{
        const body=await readJsonBody(request,3*1024*1024);
        const prompt=sanitizeText(body.prompt,3000);
        if(!prompt|| (body.image&&!validImage(body.image)))return sendJson(response,400,{ok:false,error:'Scrivi una domanda e scegli un’immagine JPG, PNG o WebP fino a 2 MB.'});
        if(body.image&&body.search)return sendJson(response,400,{ok:false,error:'Immagine e ricerca web vanno inviate in due domande separate.'});
        const quota=await authorizeOracle(request);
        const result=await callOracle({prompt,image:body.image,search:body.search===true,history:body.history,mode:body.mode==='scan'?'scan':'chat'});
        return sendJson(response,200,{ok:true,...result,...quota});
    }catch(error){return sendJson(response,error.statusCode||503,{ok:false,error:error.name==='TimeoutError'?'L’Oracolo sta impiegando troppo tempo. Riprova.':error.message});}
}
