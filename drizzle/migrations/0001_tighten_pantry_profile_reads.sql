create or replace function public.has_any_app_role(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id)
$$;

drop policy "pantries readable" on public.pantries;
create policy "members read pantries" on public.pantries for select to authenticated using (public.has_any_app_role(auth.uid()));
drop policy "posts readable" on public.pantry_posts;
create policy "members read pantry posts" on public.pantry_posts for select to authenticated using (public.has_any_app_role(auth.uid()));
drop policy "events readable" on public.pantry_events;
create policy "members read pantry events" on public.pantry_events for select to authenticated using (public.has_any_app_role(auth.uid()));

drop policy "profiles readable by signed-in users" on public.profiles;
create policy "users read own profile, mods read all" on public.profiles for select to authenticated
  using (auth.uid() = id or public.is_staff_moderator(auth.uid()));

create or replace function public.get_display_names(_ids uuid[])
returns table(id uuid, display_name text) language sql stable security definer set search_path = public as $$
  select p.id, p.display_name from public.profiles p
  where p.id = any(_ids) and auth.uid() is not null and public.has_any_app_role(auth.uid())
$$;
revoke execute on function public.get_display_names(uuid[]) from anon, public;
grant execute on function public.get_display_names(uuid[]) to authenticated;