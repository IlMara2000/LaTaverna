-- Run against a test database or inside this rollback-only transaction.
begin;
insert into auth.users(id, email, email_confirmed_at, is_anonymous) values
('00000000-0000-4000-8000-00000000aa01','shop-test@example.invalid',now(),false),
('00000000-0000-4000-8000-00000000aa02','shop-other@example.invalid',now(),false);
insert into public.shop_managers values ('00000000-0000-4000-8000-00000000aa02');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000aa02","role":"authenticated"}',true);
set local role authenticated;
insert into public.shop_products(id,name,image,status,price_cents,stock) values
('test-shop-draft','Private draft','/assets/shop/test.jpg','draft',2500,3),
('test-shop-active','Active item','/assets/shop/test.jpg','active',2500,3);
update public.shop_products set price_cents=2750 where id='test-shop-active';
do $$ begin
 if not public.is_shop_manager() then raise exception 'Master cannot manage'; end if;
 if (select price_cents from public.shop_products where id='test-shop-active') <> 2750 then raise exception 'Master update failed'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000aa01","role":"authenticated"}',true);
do $$
declare o public.shop_orders; retry public.shop_orders; n integer;
begin
 if public.is_shop_manager() then raise exception 'Base elevated'; end if;
 if exists(select 1 from public.shop_products where id='test-shop-draft') then raise exception 'Draft exposed'; end if;
 begin insert into public.shop_managers values(auth.uid()); raise exception 'Role escalation allowed'; exception when insufficient_privilege then null; end;
 begin insert into public.shop_products(id,name,image) values('test-hack','Hack','/assets/shop/hack.jpg'); raise exception 'Base write allowed'; exception when insufficient_privilege then null; end;
 update public.shop_products set price_cents=1 where id='test-shop-active'; get diagnostics n=row_count;
 if n<>0 then raise exception 'Base changed price'; end if;
 begin insert into storage.objects(bucket_id,name) values('shop-images','test-unauthorized.png'); raise exception 'Base image upload allowed'; exception when insufficient_privilege then null; end;
 o := public.place_shop_order('00000000-0000-4000-8000-00000000bb01', '[{"id":"test-shop-active","quantity":2,"price_cents":1}]', '{"name":"Test Customer","email":"shop-test@example.invalid","delivery":"Ritiro","adult":true,"agreement":true}');
 if o.subtotal_cents<>5500 or (o.items->0->>'price_cents')::int<>2750 then raise exception 'Untrusted price used'; end if;
 retry := public.place_shop_order('00000000-0000-4000-8000-00000000bb01', '[{"id":"test-shop-active","quantity":2}]', '{}');
 if retry.id<>o.id then raise exception 'Duplicate order'; end if;
 begin
  perform public.place_shop_order('00000000-0000-4000-8000-00000000bb02','[{"id":"test-shop-active","quantity":4}]','{"name":"Test Customer","email":"shop-test@example.invalid","delivery":"Ritiro","adult":true,"agreement":true}');
  raise exception 'TEST: stock exceeded';
 exception when raise_exception then if sqlerrm='TEST: stock exceeded' then raise; end if; end;
 begin
  perform public.place_shop_order('00000000-0000-4000-8000-00000000bb03','[{"id":"test-shop-active","quantity":1},{"id":"test-shop-active","quantity":1}]','{"name":"Test Customer","email":"shop-test@example.invalid","delivery":"Ritiro","adult":true,"agreement":true}');
  raise exception 'TEST: duplicate products allowed';
 exception when raise_exception then if sqlerrm='TEST: duplicate products allowed' then raise; end if; end;
 begin update public.shop_orders set subtotal_cents=1 where id=o.id; raise exception 'Order amount editable'; exception when insufficient_privilege then null; end;
 update public.shop_orders set status='completed' where id=o.id; get diagnostics n=row_count;
 if n<>0 then raise exception 'Customer updated status'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000aa02","role":"authenticated"}',true);
do $$ begin
 if not exists(select 1 from public.shop_orders where user_id='00000000-0000-4000-8000-00000000aa01') then raise exception 'Master cannot see orders'; end if;
 update public.shop_orders set status='contacted' where user_id='00000000-0000-4000-8000-00000000aa01';
end $$;
reset role;
delete from public.shop_managers where user_id='00000000-0000-4000-8000-00000000aa02';
set local role authenticated;
do $$ begin
 if exists(select 1 from public.shop_orders where user_id='00000000-0000-4000-8000-00000000aa01') then raise exception 'Other customer sees order'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $$ begin
 if not exists(select 1 from public.shop_products where id='test-shop-active') then raise exception 'Public catalog missing'; end if;
 if exists(select 1 from public.shop_products where id='test-shop-draft') then raise exception 'Anon sees draft'; end if;
 begin perform public.place_shop_order(gen_random_uuid(),'[]','{}'); raise exception 'Anonymous order allowed'; exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'PASS: catalog, master/base roles, image permissions, order snapshots, quantities, idempotence and order isolation' as result;
