
-- Roles
create type public.app_role as enum ('student','vendor','chef','pantry_staff','moderator','admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Student',
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable by signed-in users" on public.profiles for select to authenticated using (true);
create policy "users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_staff_moderator(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('moderator','admin'))
$$;

create policy "users read own roles, admins read all" on public.user_roles for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

-- Signup: profile + self-selectable non-privileged role
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  requested text := coalesce(new.raw_user_meta_data->>'requested_role', 'student');
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), split_part(new.email, '@', 1)));
  if requested not in ('student','vendor','chef','pantry_staff') then
    requested := 'student';
  end if;
  insert into public.user_roles (user_id, role) values (new.id, requested::public.app_role);
  if requested <> 'student' then
    insert into public.user_roles (user_id, role) values (new.id, 'student');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Stores
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  name text not null check (char_length(name) between 2 and 120),
  vendor_type text not null default 'grocery' check (vendor_type in ('grocery','farmers_market','international_market')),
  description text not null default '',
  address text not null default '',
  distance_miles numeric(5,2) not null default 1.0,
  hours text not null default '',
  transit_modes text[] not null default '{}',
  accessibility_flags text[] not null default '{}',
  dietary_stock text[] not null default '{}',
  cuisines text[] not null default '{}',
  budget_friendly boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.stores to authenticated;
grant all on public.stores to service_role;
alter table public.stores enable row level security;
create policy "stores readable" on public.stores for select to authenticated using (true);
create policy "vendors create own stores" on public.stores for insert to authenticated
  with check (owner_id = auth.uid() and public.has_role(auth.uid(), 'vendor'));
create policy "owners update stores" on public.stores for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners delete stores" on public.stores for delete to authenticated using (owner_id = auth.uid());

create or replace function public.is_store_owner(_store_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.stores where id = _store_id and owner_id = _user_id)
$$;

-- Products
create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  category text not null default 'other',
  unit text not null default 'each',
  current_price numeric(8,2) not null check (current_price >= 0),
  promo_price numeric(8,2) check (promo_price is null or promo_price >= 0),
  promo_label text,
  promo_ends_at timestamptz,
  origin text not null default '',
  producer text not null default '',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "products readable" on public.products for select to authenticated using (true);
create policy "owners insert products" on public.products for insert to authenticated with check (public.is_store_owner(store_id, auth.uid()));
create policy "owners update products" on public.products for update to authenticated using (public.is_store_owner(store_id, auth.uid())) with check (public.is_store_owner(store_id, auth.uid()));
create policy "owners delete products" on public.products for delete to authenticated using (public.is_store_owner(store_id, auth.uid()));

create or replace function public.validate_product()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.promo_price is not null and new.promo_price >= new.current_price then
    raise exception 'Promo price must be lower than the regular price';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger products_validate before insert or update on public.products for each row execute function public.validate_product();

-- Vendor announcements
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  body text not null default '' check (char_length(body) <= 1000),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.announcements to authenticated;
grant all on public.announcements to service_role;
alter table public.announcements enable row level security;
create policy "announcements readable" on public.announcements for select to authenticated using (true);
create policy "owners post announcements" on public.announcements for insert to authenticated with check (public.is_store_owner(store_id, auth.uid()));
create policy "owners delete announcements" on public.announcements for delete to authenticated using (public.is_store_owner(store_id, auth.uid()));

-- Store / product reviews
create table public.store_reviews (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  user_id uuid not null,
  rating int not null check (rating between 1 and 5),
  body text not null default '' check (char_length(body) <= 1000),
  status text not null default 'visible' check (status in ('visible','hidden','removed')),
  owner_response text,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.store_reviews to authenticated;
grant all on public.store_reviews to service_role;
alter table public.store_reviews enable row level security;
create policy "reviews visible or own or owner or mod" on public.store_reviews for select to authenticated
  using (status = 'visible' or user_id = auth.uid() or public.is_store_owner(store_id, auth.uid()) or public.is_staff_moderator(auth.uid()));
create policy "users write own reviews" on public.store_reviews for insert to authenticated
  with check (user_id = auth.uid() and status = 'visible' and owner_response is null);
create policy "users delete own reviews" on public.store_reviews for delete to authenticated using (user_id = auth.uid());

-- Recipes
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  chef_id uuid,
  chef_name text not null default 'Nourish.ly Kitchen',
  title text not null check (char_length(title) between 2 and 120),
  description text not null default '',
  cuisine text not null default 'American',
  minutes int not null default 30 check (minutes > 0),
  servings int not null default 2 check (servings > 0),
  est_cost numeric(6,2) not null default 5 check (est_cost >= 0),
  ingredients text[] not null default '{}',
  steps text[] not null default '{}',
  allergen_tags text[] not null default '{}',
  dietary_tags text[] not null default '{}',
  religious_compliance text[] not null default '{}',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.recipes to authenticated;
grant all on public.recipes to service_role;
alter table public.recipes enable row level security;
create policy "recipes readable" on public.recipes for select to authenticated using (true);
create policy "chefs create recipes" on public.recipes for insert to authenticated with check (chef_id = auth.uid() and public.has_role(auth.uid(), 'chef'));
create policy "chefs update own" on public.recipes for update to authenticated using (chef_id = auth.uid()) with check (chef_id = auth.uid());
create policy "chefs delete own" on public.recipes for delete to authenticated using (chef_id = auth.uid());

create table public.recipe_feedback (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  user_id uuid not null,
  rating int not null check (rating between 1 and 5),
  body text not null default '' check (char_length(body) <= 1000),
  status text not null default 'visible' check (status in ('visible','hidden','removed')),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.recipe_feedback to authenticated;
grant all on public.recipe_feedback to service_role;
alter table public.recipe_feedback enable row level security;
create policy "feedback visible or own or mod" on public.recipe_feedback for select to authenticated
  using (status = 'visible' or user_id = auth.uid() or public.is_staff_moderator(auth.uid()));
create policy "users write own feedback" on public.recipe_feedback for insert to authenticated with check (user_id = auth.uid() and status = 'visible');
create policy "users delete own feedback" on public.recipe_feedback for delete to authenticated using (user_id = auth.uid());

-- Pantry
create table public.pantries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text not null default '',
  hours text not null default '',
  contact text not null default '',
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.pantries to authenticated;
grant all on public.pantries to service_role;
alter table public.pantries enable row level security;
create policy "pantries readable" on public.pantries for select to authenticated using (true);
create policy "staff manage pantries ins" on public.pantries for insert to authenticated with check (public.has_role(auth.uid(), 'pantry_staff'));
create policy "staff manage pantries upd" on public.pantries for update to authenticated using (public.has_role(auth.uid(), 'pantry_staff')) with check (public.has_role(auth.uid(), 'pantry_staff'));

create table public.pantry_posts (
  id uuid primary key default gen_random_uuid(),
  pantry_id uuid not null references public.pantries(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  body text not null default '',
  items text[] not null default '{}',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.pantry_posts to authenticated;
grant all on public.pantry_posts to service_role;
alter table public.pantry_posts enable row level security;
create policy "posts readable" on public.pantry_posts for select to authenticated using (true);
create policy "staff post" on public.pantry_posts for insert to authenticated with check (public.has_role(auth.uid(), 'pantry_staff'));
create policy "staff delete post" on public.pantry_posts for delete to authenticated using (public.has_role(auth.uid(), 'pantry_staff'));

create table public.pantry_events (
  id uuid primary key default gen_random_uuid(),
  pantry_id uuid not null references public.pantries(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  details text not null default '',
  location text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.pantry_events to authenticated;
grant all on public.pantry_events to service_role;
alter table public.pantry_events enable row level security;
create policy "events readable" on public.pantry_events for select to authenticated using (true);
create policy "staff create events" on public.pantry_events for insert to authenticated with check (public.has_role(auth.uid(), 'pantry_staff'));
create policy "staff delete events" on public.pantry_events for delete to authenticated using (public.has_role(auth.uid(), 'pantry_staff'));

create or replace function public.validate_event()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.ends_at is not null and new.ends_at <= new.starts_at then
    raise exception 'Event must end after it starts';
  end if;
  return new;
end $$;
create trigger pantry_events_validate before insert or update on public.pantry_events for each row execute function public.validate_event();

-- Flagged reports
create table public.flagged_reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('store_review','recipe_feedback')),
  target_id uuid not null,
  recipe_id uuid,
  target_author_id uuid,
  reporter_id uuid not null,
  reason text not null check (reason in ('inappropriate','inaccurate','spam','harassment','other')),
  details text not null default '' check (char_length(details) <= 500),
  status text not null default 'open' check (status in ('open','actioned','dismissed')),
  resolution text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);
grant select, insert, update on public.flagged_reports to authenticated;
grant all on public.flagged_reports to service_role;
alter table public.flagged_reports enable row level security;
create policy "reporters and mods read" on public.flagged_reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_staff_moderator(auth.uid()));
create policy "users file reports" on public.flagged_reports for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'open');

create or replace function public.prepare_report()
returns trigger language plpgsql security definer set search_path = public as $$
declare author uuid; rid uuid;
begin
  if new.target_type = 'store_review' then
    select user_id into author from public.store_reviews where id = new.target_id;
    rid := null;
  else
    select user_id, recipe_id into author, rid from public.recipe_feedback where id = new.target_id;
  end if;
  if author is null then raise exception 'Reported content not found'; end if;
  if author = new.reporter_id then raise exception 'You cannot report your own content'; end if;
  new.target_author_id := author;
  new.recipe_id := rid;
  new.status := 'open';
  new.resolution := null; new.resolved_by := null; new.resolved_at := null;
  return new;
end $$;
create trigger flagged_reports_prepare before insert on public.flagged_reports for each row execute function public.prepare_report();

-- RPC: store owner responds publicly to a review
create or replace function public.respond_to_review(_review_id uuid, _response text)
returns void language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if _response is null or char_length(trim(_response)) < 2 or char_length(_response) > 1000 then
    raise exception 'Response must be between 2 and 1000 characters';
  end if;
  select store_id into sid from public.store_reviews where id = _review_id;
  if sid is null then raise exception 'Review not found'; end if;
  if not public.is_store_owner(sid, auth.uid()) then raise exception 'Only the store owner can respond'; end if;
  update public.store_reviews set owner_response = trim(_response), responded_at = now() where id = _review_id;
end $$;

-- RPC: moderator action on a report (hide / remove / dismiss)
create or replace function public.moderate_report(_report_id uuid, _action text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.flagged_reports;
begin
  if not public.is_staff_moderator(auth.uid()) then raise exception 'Moderator access required'; end if;
  if _action not in ('hide','remove','dismiss') then raise exception 'Unknown action'; end if;
  select * into r from public.flagged_reports where id = _report_id;
  if r.id is null then raise exception 'Report not found'; end if;
  if _action in ('hide','remove') then
    if r.target_type = 'store_review' then
      update public.store_reviews set status = case when _action = 'hide' then 'hidden' else 'removed' end where id = r.target_id;
    else
      update public.recipe_feedback set status = case when _action = 'hide' then 'hidden' else 'removed' end where id = r.target_id;
    end if;
    update public.flagged_reports set status = 'actioned', resolution = _action, resolved_by = auth.uid(), resolved_at = now()
      where target_type = r.target_type and target_id = r.target_id and status = 'open';
  else
    update public.flagged_reports set status = 'dismissed', resolution = 'dismiss', resolved_by = auth.uid(), resolved_at = now()
      where id = _report_id;
  end if;
end $$;

revoke execute on function public.respond_to_review(uuid, text) from anon;
revoke execute on function public.moderate_report(uuid, text) from anon;

-- Seed data
insert into public.stores (id, name, vendor_type, description, address, distance_miles, hours, transit_modes, accessibility_flags, dietary_stock, cuisines, budget_friendly) values
('11111111-0000-0000-0000-000000000001','Campus Fresh Market','grocery','Full-service grocery two blocks from the quad.','120 College Ave',0.4,'Mon–Sun 7am–11pm','{walking,bus,shuttle}','{step_free_entry,accessible_aisles,accessible_restroom}','{halal,kosher}','{American,Mexican}',true),
('11111111-0000-0000-0000-000000000002','ValueMart Supercenter','grocery','Big-box discount grocery with student deals every Tuesday.','2400 Route 9',3.2,'Daily 6am–12am','{bus}','{step_free_entry,accessible_aisles,accessible_restroom}','{halal}','{American}',true),
('11111111-0000-0000-0000-000000000003','Green Leaf Organics','grocery','Organic and specialty foods.','58 Elm St',1.1,'Mon–Sat 8am–9pm','{walking,shuttle}','{step_free_entry}','{kosher}','{Mediterranean}',false),
('11111111-0000-0000-0000-000000000004','Riverside Farmers'' Market — Miller Farm Stand','farmers_market','Seasonal produce straight from Miller Family Farm.','Riverside Park, Stall 12',0.9,'Sat 8am–1pm, Wed 3pm–7pm','{walking,shuttle}','{step_free_entry}','{}','{American}',true),
('11111111-0000-0000-0000-000000000005','Riverside Farmers'' Market — Sunrise Greens','farmers_market','Hydroponic greens and free-range eggs.','Riverside Park, Stall 4',0.9,'Sat 8am–1pm','{walking,shuttle}','{step_free_entry}','{}','{American}',false),
('11111111-0000-0000-0000-000000000006','Global Pantry International Market','international_market','South Asian, East Asian and Middle Eastern ingredients.','310 Main St',1.8,'Daily 9am–9pm','{bus,walking}','{accessible_aisles}','{halal}','{Indian,Chinese,Korean,Middle Eastern,Mexican}',true);

insert into public.products (store_id, name, category, unit, current_price, promo_price, promo_label, promo_ends_at, origin, producer) values
('11111111-0000-0000-0000-000000000001','Eggs','dairy','dozen',4.29,3.49,'Student Tuesday',now() + interval '10 days','Pennsylvania','Valley Farms Co-op'),
('11111111-0000-0000-0000-000000000001','Milk','dairy','gallon',3.99,null,null,null,'New York','Hudson Dairy'),
('11111111-0000-0000-0000-000000000001','Bananas','produce','lb',0.69,null,null,null,'Ecuador','Del Monte'),
('11111111-0000-0000-0000-000000000001','Spinach','produce','bag',3.49,null,null,null,'California','Earthbound'),
('11111111-0000-0000-0000-000000000001','Rice','grains','5 lb',6.99,5.99,'Weekly deal',now() + interval '5 days','Arkansas','Riceland'),
('11111111-0000-0000-0000-000000000001','Chicken Breast','meat','lb',4.99,null,null,null,'Delaware','Perdue'),
('11111111-0000-0000-0000-000000000002','Eggs','dairy','dozen',3.79,null,null,null,'Ohio','Great Value'),
('11111111-0000-0000-0000-000000000002','Milk','dairy','gallon',3.29,null,null,null,'Ohio','Great Value'),
('11111111-0000-0000-0000-000000000002','Bananas','produce','lb',0.58,null,null,null,'Guatemala','Chiquita'),
('11111111-0000-0000-0000-000000000002','Rice','grains','5 lb',5.49,null,null,null,'Texas','Great Value'),
('11111111-0000-0000-0000-000000000002','Chicken Breast','meat','lb',3.99,3.49,'Rollback',now() + interval '7 days','Georgia','Tyson'),
('11111111-0000-0000-0000-000000000002','Tofu','protein','14 oz',2.49,null,null,null,'Massachusetts','Nasoya'),
('11111111-0000-0000-0000-000000000003','Eggs','dairy','dozen',6.49,null,null,null,'Vermont','Pete & Gerry''s'),
('11111111-0000-0000-0000-000000000003','Spinach','produce','bag',4.29,null,null,null,'California','Organic Girl'),
('11111111-0000-0000-0000-000000000003','Tofu','protein','14 oz',3.29,2.79,'Member price',now() + interval '14 days','Vermont','Vermont Soy'),
('11111111-0000-0000-0000-000000000004','Apples','produce','lb',1.50,null,null,null,'Local — 6 miles away','Miller Family Farm'),
('11111111-0000-0000-0000-000000000004','Spinach','produce','bag',2.75,null,null,null,'Local — 6 miles away','Miller Family Farm'),
('11111111-0000-0000-0000-000000000004','Eggs','dairy','dozen',4.50,3.75,'End-of-market deal',now() + interval '3 days','Local — 6 miles away','Miller Family Farm'),
('11111111-0000-0000-0000-000000000005','Eggs','dairy','dozen',5.00,null,null,null,'Local — 4 miles away','Sunrise Greens'),
('11111111-0000-0000-0000-000000000005','Spinach','produce','bag',3.00,null,null,null,'Local — hydroponic','Sunrise Greens'),
('11111111-0000-0000-0000-000000000006','Rice','grains','5 lb',4.99,null,null,null,'India','Daawat Basmati'),
('11111111-0000-0000-0000-000000000006','Tofu','protein','14 oz',1.99,null,null,null,'New Jersey','House Foods'),
('11111111-0000-0000-0000-000000000006','Halal Chicken Breast','meat','lb',5.49,4.99,'Weekend special',now() + interval '4 days','Pennsylvania','Crescent Foods'),
('11111111-0000-0000-0000-000000000006','Gochujang','pantry','17.6 oz',5.99,null,null,null,'South Korea','Chung Jung One');

insert into public.announcements (store_id, title, body) values
('11111111-0000-0000-0000-000000000004','First honeycrisp apples are in!','Picked this morning. $1.50/lb while they last — bring a tote bag.'),
('11111111-0000-0000-0000-000000000005','Fresh microgreens this Saturday','Pea shoots and sunflower greens, $3 a clamshell.'),
('11111111-0000-0000-0000-000000000001','Student Tuesday is back','Show your student ID for 15% off eggs and dairy every Tuesday.');

insert into public.recipes (title, chef_name, description, cuisine, minutes, servings, est_cost, ingredients, steps, allergen_tags, dietary_tags, religious_compliance) values
('One-Pan Chickpea Curry','Chef Amara Diallo','A cozy, budget curry that feeds you for days.','Indian',30,4,6.50,'{1 can chickpeas,1 can coconut milk,1 onion,2 tbsp curry powder,1 cup rice,Spinach}','{Sauté onion until soft.,Add curry powder and toast 1 minute.,Add chickpeas and coconut milk; simmer 15 minutes.,Stir in spinach and serve over rice.}','{}','{vegan,gluten_free,dairy_free}','{halal,kosher}'),
('Garlic Soy Tofu Rice Bowl','Chef Min-Jun Park','Crispy tofu with a 3-ingredient glaze.','Korean',25,2,4.25,'{1 block tofu,2 tbsp soy sauce,1 tbsp gochujang,1 tsp garlic,1 cup rice}','{Press and cube tofu.,Pan-fry until golden.,Toss with soy, gochujang and garlic.,Serve over rice.}','{soy,wheat}','{vegan,dairy_free}','{halal}'),
('Sheet-Pan Chicken & Veggies','Chef Laura Gómez','Ten minutes of prep, one pan to wash.','American',40,3,8.75,'{1 lb chicken breast,2 potatoes,1 bell pepper,2 tbsp olive oil,Salt and pepper}','{Heat oven to 425°F.,Chop everything into even pieces.,Toss with oil and seasoning.,Roast 30 minutes.}','{}','{gluten_free,dairy_free}','{}'),
('Shakshuka for Two','Chef Amara Diallo','Eggs poached in spiced tomato sauce.','Middle Eastern',20,2,3.80,'{4 eggs,1 can crushed tomatoes,1 onion,1 tsp cumin,1 tsp paprika}','{Soften onion.,Add spices and tomatoes; simmer 8 minutes.,Make wells and crack in eggs.,Cover until set.}','{eggs}','{vegetarian,gluten_free}','{kosher,halal}'),
('Peanut Noodle Salad','Chef Min-Jun Park','Cold noodles with crunchy veg — great for meal prep.','Chinese',15,3,4.60,'{8 oz spaghetti,3 tbsp peanut butter,2 tbsp soy sauce,1 tbsp vinegar,1 cucumber,1 carrot}','{Cook and rinse noodles.,Whisk peanut butter with soy and vinegar.,Toss with noodles and julienned veg.}','{peanuts,soy,wheat}','{vegan}','{}'),
('Black Bean Tacos','Chef Laura Gómez','Smoky beans, quick slaw, warm tortillas.','Mexican',20,3,5.10,'{1 can black beans,6 corn tortillas,1/4 cabbage,1 lime,1 tsp chili powder}','{Simmer beans with chili powder.,Shred cabbage and toss with lime.,Warm tortillas and fill.}','{}','{vegan,gluten_free,dairy_free}','{halal,kosher}');

insert into public.pantries (id, name, location, hours, contact) values
('22222222-0000-0000-0000-000000000001','Campus Community Pantry','Student Union, Room 104 (ground floor, step-free)','Mon & Wed 11am–3pm, Fri 1pm–5pm','pantry@university.edu');

insert into public.pantry_posts (pantry_id, title, body, items) values
('22222222-0000-0000-0000-000000000001','Fresh produce restock','Thanks to Miller Farm we have a big produce donation this week.','{Apples,Carrots,Potatoes,Onions}'),
('22222222-0000-0000-0000-000000000001','Shelf staples available','Grab-and-go bags ready at the front desk.','{Rice,Pasta,Canned beans,Peanut butter,Oatmeal}');

insert into public.pantry_events (pantry_id, title, details, location, starts_at, ends_at) values
('22222222-0000-0000-0000-000000000001','Thanksgiving Meal Kit Giveaway','Free meal kits for students staying on campus. No sign-up needed.','Student Union Lobby',now() + interval '9 days',now() + interval '9 days 3 hours'),
('22222222-0000-0000-0000-000000000001','Mobile Pantry at North Dorms','Fresh produce truck — bring a bag.','North Residence Hall Lot',now() + interval '3 days',now() + interval '3 days 2 hours');
