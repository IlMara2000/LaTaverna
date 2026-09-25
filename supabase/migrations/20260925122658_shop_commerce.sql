-- Catalog, role-based management and immutable order snapshots.
create table public.shop_managers (
    user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.shop_managers enable row level security;
revoke all on public.shop_managers from anon, authenticated;
grant select on public.shop_managers to authenticated;
create policy shop_manager_self on public.shop_managers for select to authenticated using (user_id = (select auth.uid()));

create function public.is_shop_manager() returns boolean language sql stable security invoker set search_path = '' as $$
    select exists(select 1 from public.shop_managers where user_id = (select auth.uid()));
$$;
revoke all on function public.is_shop_manager() from public, anon;
grant execute on function public.is_shop_manager() to authenticated;

create table public.shop_products (
    id text primary key check (id ~ '^[a-z0-9-]{1,80}$'),
    name text not null check (length(trim(name)) between 1 and 120),
    description text not null default '' check(length(description) <= 3000),
    category text not null default 'artigianato' check(length(category) between 1 and 60),
    collection text not null default 'BOTTEGA DEL VIANDANTE' check(length(collection) <= 100),
    image text not null check (image ~ '^(/assets/shop/|https://)'),
    cutout text check(cutout is null or cutout ~ '^(/assets/shop/|https://)'),
    image_alt text not null default '' check(length(image_alt) <= 300),
    viewer_angle text not null default '0deg' check(viewer_angle ~ '^-?[0-9]{1,3}deg$'),
    facts jsonb not null default '[]' check(jsonb_typeof(facts) = 'array' and jsonb_array_length(facts) <= 10),
    price_cents integer check(price_cents between 0 and 10000000),
    stock integer check(stock between 0 and 100000),
    status text not null default 'draft' check(status in ('draft','active')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
alter table public.shop_products enable row level security;
revoke all on public.shop_products from anon, authenticated;
grant select on public.shop_products to anon, authenticated;
grant insert, update, delete on public.shop_products to authenticated;
create policy shop_catalog_public on public.shop_products for select to anon, authenticated using(status = 'active');
create policy shop_catalog_master on public.shop_products for all to authenticated using((select public.is_shop_manager())) with check((select public.is_shop_manager()));

create table public.shop_orders (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id),
    request_key uuid not null,
    customer_name text not null,
    customer_email text not null,
    customer_phone text not null default '',
    delivery text not null,
    notes text not null default '',
    items jsonb not null,
    subtotal_cents bigint,
    status text not null default 'new' check(status in ('new','contacted','completed','cancelled')),
    created_at timestamptz not null default now(),
    unique(user_id, request_key)
);
create index shop_orders_user_created on public.shop_orders(user_id, created_at desc);
alter table public.shop_orders enable row level security;
revoke all on public.shop_orders from anon, authenticated;
grant select on public.shop_orders to authenticated;
grant update(status) on public.shop_orders to authenticated;
create policy shop_orders_own on public.shop_orders for select to authenticated using(user_id = (select auth.uid()) or (select public.is_shop_manager()));
create policy shop_orders_master_update on public.shop_orders for update to authenticated using((select public.is_shop_manager())) with check((select public.is_shop_manager()));

-- Only this transaction can create orders. Prices, names and availability are
-- read from the catalog, never trusted from the browser. Retries are idempotent.
create function public.place_shop_order(p_key uuid, p_items jsonb, p_customer jsonb)
returns public.shop_orders language plpgsql security definer set search_path = '' as $$
declare
    v_user uuid := auth.uid();
    v_order public.shop_orders;
    v_product public.shop_products;
    v_item jsonb;
    v_snapshot jsonb := '[]';
    v_total bigint := 0;
    v_quote boolean := false;
    v_qty integer;
    v_name text := trim(coalesce(p_customer->>'name',''));
    v_email text := lower(trim(coalesce(p_customer->>'email','')));
    v_delivery text := trim(coalesce(p_customer->>'delivery',''));
begin
    if v_user is null or not exists(select 1 from auth.users where id = v_user and email_confirmed_at is not null and not coalesce(is_anonymous,false)) then
        raise exception 'Accedi con un account verificato per inviare un ordine.';
    end if;
    if p_key is null then raise exception 'Identificativo ordine mancante.'; end if;
    perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
    select * into v_order from public.shop_orders where user_id = v_user and request_key = p_key;
    if found then return v_order; end if;
    if (select count(*) from public.shop_orders where user_id=v_user and created_at > now()-interval '1 hour') >= 5 then
        raise exception 'Hai già inviato diversi ordini. Attendi prima di riprovare.';
    end if;
    if length(v_name) not between 2 and 120 or length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
        or length(v_delivery) not between 2 and 1000 or length(coalesce(p_customer->>'notes',''))>2000 or length(coalesce(p_customer->>'phone',''))>40
        or coalesce(p_customer->>'adult','false') <> 'true' or coalesce(p_customer->>'agreement','false') <> 'true' then
        raise exception 'Completa i dati e conferma le condizioni dell’ordine.';
    end if;
    if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30 then
        raise exception 'Il carrello deve contenere da 1 a 30 prodotti.';
    end if;
    if (select count(distinct x->>'id') from jsonb_array_elements(p_items) x) <> jsonb_array_length(p_items) then
        raise exception 'Il carrello contiene prodotti duplicati.';
    end if;
    for v_item in select value from jsonb_array_elements(p_items) order by value->>'id' loop
        if coalesce(v_item->>'quantity','') !~ '^[1-9]$' then raise exception 'Quantità non valida (1–9).'; end if;
        v_qty := (v_item->>'quantity')::integer;
        select * into v_product from public.shop_products where id=v_item->>'id' and status='active' for share;
        if not found then raise exception 'Un prodotto non è più disponibile. Aggiorna il carrello.'; end if;
        if v_product.stock is not null and v_qty > v_product.stock then raise exception 'Quantità non disponibile per %.',v_product.name; end if;
        v_quote := v_quote or v_product.price_cents is null;
        v_total := v_total + coalesce(v_product.price_cents,0)::bigint * v_qty;
        v_snapshot := v_snapshot || jsonb_build_array(jsonb_build_object('id',v_product.id,'name',v_product.name,'quantity',v_qty,'price_cents',v_product.price_cents));
    end loop;
    insert into public.shop_orders(user_id,request_key,customer_name,customer_email,customer_phone,delivery,notes,items,subtotal_cents)
    values(v_user,p_key,v_name,v_email,trim(coalesce(p_customer->>'phone','')),v_delivery,trim(coalesce(p_customer->>'notes','')),v_snapshot,case when v_quote then null else v_total end)
    returning * into v_order;
    return v_order;
end;
$$;
revoke all on function public.place_shop_order(uuid,jsonb,jsonb) from public, anon;
grant execute on function public.place_shop_order(uuid,jsonb,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('shop-images','shop-images',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy shop_images_master_insert on storage.objects for insert to authenticated with check(bucket_id='shop-images' and (select public.is_shop_manager()));
create policy shop_images_master_select on storage.objects for select to authenticated using(bucket_id='shop-images' and (select public.is_shop_manager()));
create policy shop_images_master_delete on storage.objects for delete to authenticated using(bucket_id='shop-images' and (select public.is_shop_manager()));

insert into public.shop_products(id,name,description,category,collection,image,cutout,image_alt,viewer_angle,facts,status) values('bruno-antico','Bruno Antico','Una lettura 3D del carattere più rustico: venatura profonda, profilo irregolare e impugnatura scandita.','scuri','FINITURA SCURA','/assets/shop/product-bruno-antico.jpg','/assets/shop/product-bruno-antico-cutout.webp','Render 3D completo del bocchino Bruno Antico, scuro e scolpito','-55deg','["Render indicativo","Misura da confermare","Finitura da definire"]','active');

insert into public.shop_products(id,name,description,category,collection,image,cutout,image_alt,viewer_angle,facts,status) values('spirale-chiara','Spirale Chiara','Il concept più luminoso, con un ritmo morbido di anelli scolpiti e una silhouette interamente visibile.','chiari','FINITURA CHIARA','/assets/shop/product-spirale-chiara.jpg','/assets/shop/product-spirale-chiara-cutout.webp','Render 3D completo del bocchino Spirale Chiara in legno chiaro','70deg','["Render indicativo","Profilo a spirale","Tonalità da confermare"]','active');

insert into public.shop_products(id,name,description,category,collection,image,cutout,image_alt,viewer_angle,facts,status) values('ametista-regale','Ametista Regale','Una variante scenografica ametista con riflessi profondi e sottili dettagli color ottone.','ametista','EDIZIONE AMETISTA','/assets/shop/product-ametista-regale.jpg','/assets/shop/product-ametista-regale-cutout.webp','Render 3D completo del bocchino Ametista Regale viola con dettagli color ottone','48deg','["Render indicativo","Accenti da concordare","Finitura speciale da verificare"]','active');

insert into public.shop_products(id,name,description,category,collection,image,cutout,image_alt,viewer_angle,facts,status) values('ossidiana-corvo','Ossidiana del Corvo','Nero materico, profilo affusolato e un unico accento color bronzo per la versione più austera.','ossidiana','EDIZIONE OSSIDIANA','/assets/shop/product-ossidiana.jpg','/assets/shop/product-ossidiana-cutout.webp','Render 3D completo del bocchino Ossidiana del Corvo nero con collare color bronzo','50deg','["Render indicativo","Profilo da confermare","Accento metallico opzionale"]','active');
