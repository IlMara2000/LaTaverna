// Limite di richieste AI per rete, prima della quota per utente. L'IP viene
// pseudonimizzato con HMAC usando la chiave service role come segreto: senza
// quel segreto l'hash di un IPv4 sarebbe reversibile per tentativi.
//
// Su Vercel e in produzione il controllo deve riuscire prima dell'inferenza.
// Solo lo sviluppo locale senza configurazione può saltare questo limite.

import {createHmac} from 'node:crypto';

let warned = false;

const warnOnce = () => {
    if (warned) return;
    warned = true;
    console.warn('[oracolo] limite AI per rete non attivo: manca SUPABASE_SERVICE_ROLE_KEY.');
};

const firstValue = value => String(value || '').split(',')[0].trim();
const budgetUnavailable = () => Object.assign(new Error('Verifica dei limiti AI temporaneamente non disponibile. Riprova più tardi.'), {
    statusCode: 503,
    code: 'ip_budget_unavailable'
});

// Vercel popola x-real-ip e x-forwarded-for all'edge; il client non può
// sovrascriverli. In assenza di entrambi non inventiamo un IP.
export const clientIp = request => {
    const headers = request?.headers || {};
    const raw = firstValue(headers['x-real-ip'] || headers['X-Real-Ip'])
        || firstValue(headers['x-forwarded-for'] || headers['X-Forwarded-For']);
    if (!raw) return '';
    // Attenzione: un IPv6 non incapsulato contiene già i due punti, quindi la
    // porta si toglie solo dalle forme che la esprimono davvero ([v6]:porta,
    // v4:porta). Uno strip generico mutilerebbe 2001:db8::1 in 2001:db8:.
    const withoutPort = raw
        .replace(/^\[(.+)\](?::\d+)?$/,'$1')
        .replace(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/,'$1');
    return /^[0-9a-fA-F:.]{3,45}$/.test(withoutPort) ? withoutPort.toLowerCase() : '';
};

export const ipHash = (ip, secret) => createHmac('sha256',secret).update(ip).digest('hex');

export async function assertAiIpBudget(request) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const deployed = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
    if (!url || !key) {
        if (deployed) throw budgetUnavailable();
        warnOnce();
        return null;
    }
    const ip = clientIp(request);
    if (!ip) {
        if (deployed) throw budgetUnavailable();
        return null;
    }

    let response;
    try {
        response = await fetch(`${url}/rest/v1/rpc/take_ai_ip_quota`,{
            method: 'POST',
            headers: {apikey: key,Authorization: `Bearer ${key}`,'Content-Type': 'application/json'},
            body: JSON.stringify({p_ip_hash: ipHash(ip,key)}),
            signal: AbortSignal.timeout(8000)
        });
    } catch (error) {
        console.warn('[oracolo] controllo quota di rete non raggiungibile.');
        throw budgetUnavailable();
    }

    const data = await response.json().catch(() => null);
    if (response.ok && Number.isInteger(data) && data >= 0) return {remaining: data};

    // PostgREST segnala con 400 l'eccezione sollevata dalla funzione.
    if (response.status === 400 && /rete/i.test(String(data?.message || ''))) {
        throw Object.assign(new Error('Troppe richieste AI da questa rete. Riprova più tardi.'),{
            statusCode: 429,
            code: 'ip_rate_limited',
            retryAfterMs: 3600000
        });
    }
    console.warn('[oracolo] risposta quota di rete non valida:',response.status);
    throw budgetUnavailable();
}
