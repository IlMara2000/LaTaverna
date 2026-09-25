import { shopStore, formatPrice } from '../services/shopStore.js';
import { orderMailto, orderReference, orderEmail } from '../services/shopOrder.js';
import './shopCommerce.css';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const statuses = { new: 'Da confermare', contacted: 'In lavorazione', completed: 'Completato', cancelled: 'Annullato' };

export function initShopCommerce(root, state, { refresh, onOrder }) {
    let disposed = false;
    const pendingKey = 'taverna_shop_pending_order';
    let requestKey = null;
    try { requestKey = sessionStorage.getItem(pendingKey); } catch { /* session storage optional */ }
    let editingProduct = null;
    let viewVersion = 0;
    const dialog = document.createElement('dialog');
    dialog.className = 'shop-commerce-dialog';
    dialog.setAttribute('aria-labelledby', 'commerce-title');
    root.append(dialog);
    const show = (title, content) => {
        viewVersion++;
        dialog.innerHTML = `<header><div><small>BOTTEGA DEL VIANDANTE</small><h2 id="commerce-title">${title}</h2></div><button type="button" data-close aria-label="Chiudi">×</button></header><div class="commerce-content">${content}</div><p class="commerce-feedback" role="status" aria-live="polite"></p>`;
        if (!dialog.open) dialog.showModal();
        dialog.querySelector('[data-close]').onclick = () => dialog.close();
    };
    const feedback = (message, error = false) => {
        const node = dialog.querySelector('.commerce-feedback');
        if (node) { node.textContent = message; node.classList.toggle('is-error', error); }
    };
    const summary = products => `<ul class="commerce-summary">${products.map(item => `<li><span>${esc(item.name)} <b>× ${item.quantity}</b></span><strong>${esc(formatPrice(item.price_cents == null ? null : item.price_cents * item.quantity))}</strong></li>`).join('')}</ul>`;
    const showReceipt = order => {
        show('Ordine registrato ✨', `<div class="commerce-receipt"><span class="commerce-order-ref">${orderReference(order)}</span><h3>Un ultimo passo: invia l’email</h3><p>L’ordine è salvato nella bottega. Tocca il pulsante e invia il messaggio dal tuo programma email per avvisare il venditore.</p>${summary(order.items)}<p>Pagamento, disponibilità e spedizione saranno concordati con te prima della conferma finale.</p><a class="shop-primary-action" href="${esc(orderMailto(order))}">APRI EMAIL DELL’ORDINE ↗</a><button type="button" class="shop-secondary-action" data-copy-order>COPIA RIEPILOGO</button><p class="commerce-hint">Puoi ritrovare l’ordine e il collegamento email in “I miei ordini”. L’app non può verificare l’invio dal tuo programma email.</p></div>`);
        dialog.querySelector('[data-copy-order]').onclick = async () => {
            try { await navigator.clipboard.writeText(orderEmail(order)); feedback('Riepilogo copiato.'); }
            catch { feedback('Copia non disponibile. Usa il pulsante per aprire l’email.', true); }
        };
    };
    const checkout = async () => {
        show('Il tuo ordine', '<p>Controllo il carrello…</p>');
        const version = viewVersion;
        try {
            const account = await shopStore.account();
            if (disposed || !dialog.open || version !== viewVersion) return;
            if (!account.user) { show('Accedi per ordinare', '<p>Per salvare l’ordine e ritrovarlo in seguito, accedi alla Taverna con il tuo account. Il carrello rimane sul dispositivo.</p>'); return; }
            const changed = await refresh();
            if (disposed || !dialog.open || version !== viewVersion) return;
            if (changed) throw new Error('Il carrello è cambiato: un prodotto non è più disponibile. Controlla la selezione prima di continuare.');
            const items = state.cart.map(item => ({ ...state.products.find(p => p.id === item.id), quantity: item.quantity }));
            if (!items.length || items.some(item => !item.id || item.stock === 0 || (item.stock != null && item.quantity > item.stock))) throw new Error('Un prodotto non è più disponibile nella quantità richiesta. Modifica il carrello.');
            const total = items.every(item => item.price_cents != null) ? items.reduce((sum, item) => sum + item.price_cents * item.quantity, 0) : null;
            requestKey ||= crypto.randomUUID();
            show('Completa il tuo ordine', `${summary(items)}<p class="commerce-total">Totale prodotti <strong>${esc(formatPrice(total))}</strong></p><p class="commerce-hint">Spedizione, eventuali personalizzazioni e pagamento da concordare. Nessun addebito online.</p><form id="commerce-checkout" class="commerce-form">
                <label>Nome e cognome<input name="name" autocomplete="name" required minlength="2" maxlength="120"></label>
                <label>Email per la risposta<input name="email" type="email" autocomplete="email" required maxlength="254" value="${esc(account.user.email)}"></label>
                <label>Telefono (facoltativo)<input name="phone" type="tel" autocomplete="tel" maxlength="40"></label>
                <label>Consegna o ritiro<textarea name="delivery" rows="2" required minlength="2" maxlength="1000" placeholder="Indica la città di consegna oppure se preferisci il ritiro"></textarea></label>
                <label>Note (facoltative)<textarea name="notes" rows="2" maxlength="2000" placeholder="Finitura, misure o personalizzazioni"></textarea></label>
                <label class="commerce-check"><input name="adult" type="checkbox" required>Confermo di avere almeno 18 anni.</label>
                <label class="commerce-check"><input name="agreement" type="checkbox" required>Invio una richiesta d’ordine. Prezzo finale, disponibilità, consegna e pagamento saranno concordati con la bottega. I dati inseriti saranno usati per gestire questa richiesta.</label>
                <button class="shop-primary-action" type="submit">REGISTRA ORDINE E PREPARA EMAIL →</button>
            </form>`);
            const form = dialog.querySelector('form');
            form.onsubmit = async event => {
                event.preventDefault();
                if (!form.reportValidity() || state.placingOrder) return;
                const button = form.querySelector('[type=submit]');
                state.placingOrder = true; button.disabled = true; button.textContent = 'REGISTRAZIONE…';
                dialog.querySelector('[data-close]').disabled = true;
                try {
                    const data = Object.fromEntries(new FormData(form));
                    data.adult = true; data.agreement = true;
                    try { sessionStorage.setItem(pendingKey, requestKey); } catch { /* optional */ }
                    const order = await shopStore.order(requestKey, state.cart.map(({id,quantity}) => ({id,quantity})), data);
                    requestKey = null;
                    try { sessionStorage.removeItem(pendingKey); } catch { /* optional */ }
                    onOrder();
                    if (!disposed) showReceipt(order);
                } catch (error) { if (!disposed) feedback(error.message, true); }
                finally {
                    state.placingOrder = false;
                    button.disabled = false; button.textContent = 'REGISTRA ORDINE E PREPARA EMAIL →';
                    dialog.querySelector('[data-close]')?.removeAttribute('disabled');
                }
            };
        } catch (error) { feedback(error.message, true); }
    };
    const showOrders = async (master = false) => {
        show(master ? 'Ordini della bottega' : 'I miei ordini', '<p>Caricamento ordini…</p>');
        const version = viewVersion;
        try {
            const orders = await shopStore.orders();
            if (disposed || !dialog.open || version !== viewVersion) return;
            dialog.querySelector('.commerce-content').innerHTML = `${master ? '<button type="button" data-products class="shop-secondary-action">← GESTIONE PRODOTTI</button>' : ''}${orders.length ? orders.map(order => `<article class="commerce-order"><header><strong>${orderReference(order)}</strong><time>${new Date(order.created_at).toLocaleDateString('it-IT')}</time></header><p>${esc(statuses[order.status])} · ${esc(order.customer_name)}</p>${summary(order.items)}<p><strong>Totale prodotti: ${esc(formatPrice(order.subtotal_cents))}</strong></p><p>${esc(order.delivery)}</p>${order.notes ? `<p>${esc(order.notes)}</p>` : ''}${master ? `<a href="mailto:${esc(order.customer_email)}">${esc(order.customer_email)}</a><p>${esc(order.customer_phone)}</p><label>Stato<select data-order-status="${order.id}">${Object.entries(statuses).map(([value,label]) => `<option value="${value}" ${value === order.status ? 'selected' : ''}>${label}</option>`).join('')}</select></label>` : `<a href="${esc(orderMailto(order))}">Apri email dell’ordine ↗</a>`}</article>`).join('') : '<p>Non ci sono ancora ordini.</p>'}`;
            dialog.querySelector('[data-products]')?.addEventListener('click', manage);
            dialog.querySelectorAll('[data-order-status]').forEach(select => select.onchange = async () => {
                const order = orders.find(o => o.id === select.dataset.orderStatus), previous = order.status;
                select.disabled = true;
                try { await shopStore.setOrderStatus(order.id, select.value); order.status = select.value; feedback('Stato aggiornato.'); }
                catch (error) { select.value = previous; feedback(error.message, true); }
                finally { select.disabled = false; }
            });
        } catch(error) { feedback(error.message, true); }
    };
    const edit = product => {
        editingProduct = product;
        show(product ? 'Modifica prodotto' : 'Nuovo prodotto', `<form id="commerce-product" class="commerce-form">
            <label>Nome<input name="name" required maxlength="120" value="${esc(product?.name)}"></label>
            <label>Descrizione<textarea name="description" rows="3" maxlength="3000">${esc(product?.description)}</textarea></label>
            <label>Categoria<input name="category" required maxlength="60" value="${esc(product?.category || 'artigianato')}"></label>
            <label>Collezione<input name="collection" maxlength="100" value="${esc(product?.collection || 'BOTTEGA DEL VIANDANTE')}"></label>
            <div class="commerce-two"><label>Prezzo in €<input name="price" type="number" min="0" max="100000" step="0.01" placeholder="Da concordare" value="${product?.price_cents == null ? '' : product.price_cents / 100}"></label><label>Disponibilità<input name="stock" type="number" min="0" max="100000" step="1" placeholder="Su richiesta" value="${product?.stock ?? ''}"></label></div>
            <p class="commerce-hint">Lascia prezzo o disponibilità vuoti per i pezzi su richiesta. Quantità 0 = non disponibile. Le richieste non scalano le scorte: aggiornale dopo aver concordato la vendita.</p>
            ${product ? `<img class="commerce-product-preview" src="${esc(product.image)}" alt="${esc(product.name)}">` : ''}
            <label>${product ? 'Sostituisci foto (facoltativo)' : 'Foto del prodotto'}<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" ${product ? '' : 'required'}></label>
            <small>JPG, PNG o WebP · massimo 5 MB</small>
            <label>Visibilità<select name="status"><option value="draft" ${product?.status !== 'active' ? 'selected' : ''}>Bozza — visibile solo a te</option><option value="active" ${product?.status === 'active' ? 'selected' : ''}>Pubblicato nel catalogo</option></select></label>
            <button class="shop-primary-action" type="submit">SALVA PRODOTTO</button><button class="shop-secondary-action" type="button" data-back>ANNULLA</button>
        </form>`);
        dialog.querySelector('[data-back]').onclick = manage;
        dialog.querySelector('form').onsubmit = async event => {
            event.preventDefault();
            const form = event.currentTarget;
            if (!form.reportValidity() || form.dataset.saving) return;
            form.dataset.saving = 'true';
            const targetProduct = editingProduct;
            const button = form.querySelector('[type=submit]'); button.disabled = true;
            try {
                const data = new FormData(form), file = data.get('photo');
                const image = file?.size ? await shopStore.uploadImage(file) : targetProduct?.image;
                const row = {
                    id: targetProduct?.id || crypto.randomUUID(), name: data.get('name').trim(), description: data.get('description').trim(),
                    category: data.get('category').trim().toLowerCase(), collection: data.get('collection').trim(),
                    image, image_alt: data.get('name').trim(), status: data.get('status'),
                    price_cents: data.get('price') === '' ? null : Math.round(Number(data.get('price')) * 100),
                    stock: data.get('stock') === '' ? null : Number(data.get('stock')), updated_at: new Date().toISOString()
                };
                if (file?.size) row.cutout = null;
                await shopStore.saveProduct(row);
                await refresh();
                if (!disposed && dialog.open && form.isConnected) { await manage(); feedback('Prodotto salvato.'); }
            } catch(error) { feedback(error.message, true); }
            finally { button.disabled = false; delete form.dataset.saving; }
        };
    };
    const manage = async () => {
        show('La tua bottega', '<p>Caricamento catalogo…</p>');
        const version = viewVersion;
        try {
            await refresh();
            if (disposed || !dialog.open || version !== viewVersion) return;
            dialog.querySelector('.commerce-content').innerHTML = `<div class="commerce-actions"><button type="button" class="shop-primary-action" data-new>+ NUOVO PRODOTTO</button><button type="button" class="shop-secondary-action" data-orders>ORDINI RICEVUTI</button></div><div class="commerce-product-list">${state.allProducts.map(product => `<button type="button" data-edit="${esc(product.id)}"><img src="${esc(product.image)}" alt=""><span><strong>${esc(product.name)}</strong><small>${product.status === 'active' ? 'Pubblicato' : 'Bozza'} · ${esc(formatPrice(product.price_cents))}</small></span><span aria-hidden="true">✎</span></button>`).join('')}</div>`;
            dialog.querySelector('[data-new]').onclick = () => edit(null);
            dialog.querySelector('[data-orders]').onclick = () => showOrders(true);
            dialog.querySelectorAll('[data-edit]').forEach(button => button.onclick = () => edit(state.allProducts.find(p => p.id === button.dataset.edit)));
        } catch(error) { feedback(error.message, true); }
    };
    dialog.addEventListener('cancel', event => { if (state.placingOrder) event.preventDefault(); });
    root.querySelector('#shop-master').onclick = manage;
    root.querySelector('#shop-orders').onclick = () => showOrders(false);
    return { checkout, reset: () => { viewVersion++; dialog.close(); dialog.innerHTML = ''; requestKey = null; }, cleanup: () => { disposed = true; dialog.close(); dialog.remove(); } };
}
