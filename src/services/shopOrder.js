export const SHOP_EMAIL = 'marangoni.daniele@icloud.com';
export const orderReference = order => `TV-${order.id.slice(0, 8).toUpperCase()}`;
export function orderEmail(order) {
    const euro = cents => cents == null ? 'prezzo da concordare' : `${(cents / 100).toFixed(2)} EUR`;
    return [
        `Ordine ${orderReference(order)} — Bottega del Viandante`,
        `Nome: ${order.customer_name}`, `Email: ${order.customer_email}`,
        order.customer_phone ? `Telefono: ${order.customer_phone}` : '', '',
        ...order.items.map(item => `${item.name} × ${item.quantity} — ${euro(item.price_cents)} cad.`), '',
        `Totale prodotti: ${euro(order.subtotal_cents)}`,
        `Consegna / ritiro: ${order.delivery}`,
        order.notes ? `Note: ${order.notes}` : '', '',
        'Pagamento, disponibilità, eventuali spese di spedizione e conferma finale da concordare con la bottega. Nessun pagamento eseguito online.'
    ].filter(line => line !== '').join('\n');
}
export const orderMailto = order => `mailto:${SHOP_EMAIL}?subject=${encodeURIComponent(`Ordine ${orderReference(order)} — Bottega del Viandante`)}&body=${encodeURIComponent(orderEmail(order))}`;
