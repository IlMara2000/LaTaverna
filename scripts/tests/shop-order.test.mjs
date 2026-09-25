import test from 'node:test';
import assert from 'node:assert/strict';
import { orderMailto, orderEmail, orderReference } from '../../src/services/shopOrder.js';
const order = {
 id:'acbd1234-5678-4000-8000-abcdef123456', customer_name:'Cliente & Famiglia', customer_email:'cliente@example.invalid',
 customer_phone:'', delivery:'Ritiro in bottega', notes:'Viola & oro? sì #1',
 items:[{name:'Tazza ametista',quantity:2,price_cents:2490}], subtotal_cents:4980
};
test('order email includes immutable items, agreed-payment terms and encoded customer notes',()=>{
 assert.equal(orderReference(order),'TV-ACBD1234');
 const url = new URL(orderMailto(order));
 assert.equal(url.protocol,'mailto:');
 assert.equal(url.searchParams.get('body'),orderEmail(order));
 assert.match(url.searchParams.get('body'),/49.80 EUR/);
 assert.match(url.searchParams.get('body'),/Viola & oro\? sì #1/);
 assert.match(url.searchParams.get('body'),/Nessun pagamento eseguito online/);
});
test('unpriced concepts are clearly quoted rather than shown as free',()=>{
 const text=orderEmail({...order,items:[{name:'Concept',quantity:1,price_cents:null}],subtotal_cents:null});
 assert.match(text,/Totale prodotti: prezzo da concordare/);
 assert.doesNotMatch(text,/0\.00 EUR/);
});
