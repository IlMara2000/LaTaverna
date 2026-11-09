export function formatOracleQuota(remaining){
    const value=typeof remaining==='string'?Number(remaining.trim()):remaining;
    if((typeof remaining==='string'&&!remaining.trim())||!Number.isFinite(value))return 'Quota Oracolo non disponibile. Riprova più tardi.';
    if(value<=0)return 'Quota Oracolo esaurita per oggi. Torna domani per continuare la conversazione.';
    return `${value} ${value===1?'richiesta disponibile':'richieste disponibili'} oggi.`;
}
