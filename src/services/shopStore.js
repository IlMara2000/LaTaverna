import { supabase } from './supabase.js';
export const formatPrice = cents => cents == null ? 'Prezzo da concordare' : new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100);
export const productFromRow = row => ({
    ...row, imageAlt: row.image_alt || row.name, viewerAngle: row.viewer_angle || '0deg',
    cutout: row.cutout || row.image, hasCutout: Boolean(row.cutout),
    facts: Array.isArray(row.facts) ? row.facts.map(String) : [],
    availability: row.stock === 0 ? 'NON DISPONIBILE' : row.stock == null ? 'SU RICHIESTA' : `${row.stock} DISPONIBILI`
});
const checked = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
export const shopStore = {
    onAuthChange(callback) { return supabase.auth.onAuthStateChange?.((event, session) => setTimeout(() => callback(event, session), 0))?.data?.subscription; },
    async account() {
        const { data } = await supabase.auth.getUser();
        const user = data?.user;
        if (!user || user.is_anonymous) return { user: null, master: false };
        return { user, master: Boolean(checked(await supabase.rpc('is_shop_manager'))) };
    },
    async products() { return checked(await supabase.from('shop_products').select('*').order('created_at', { ascending: true })); },
    async saveProduct(product) { return checked(await supabase.from('shop_products').upsert(product).select().single()); },
    async uploadImage(file) {
        if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Scegli una foto JPG, PNG o WebP fino a 5 MB.');
        const extension = { 'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp' }[file.type];
        const path = `${crypto.randomUUID()}.${extension}`;
        checked(await supabase.storage.from('shop-images').upload(path, file, { upsert: false, contentType: file.type }));
        return supabase.storage.from('shop-images').getPublicUrl(path).data.publicUrl;
    },
    async orders() { return checked(await supabase.from('shop_orders').select('*').order('created_at', { ascending: false }).limit(100)); },
    async setOrderStatus(id, status) { return checked(await supabase.from('shop_orders').update({ status }).eq('id', id).select().single()); },
    async order(key, items, customer) {
        return checked(await supabase.rpc('place_shop_order', { p_key: key, p_items: items, p_customer: customer }));
    }
};
