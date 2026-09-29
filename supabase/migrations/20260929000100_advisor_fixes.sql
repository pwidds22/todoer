-- Supabase advisor follow-ups for the initial schema.

-- Read the signed-in email once per query, not once per row.
drop policy "shared_accounts: read involved" on public.shared_accounts;
drop policy "shared_accounts: invite" on public.shared_accounts;
drop policy "shared_accounts: invitee responds" on public.shared_accounts;

create policy "shared_accounts: read involved" on public.shared_accounts for select to authenticated
  using (
    owner_id = (select auth.uid())
    or shared_with_id = (select auth.uid())
    or lower(shared_with_email) = lower((select auth.jwt()) ->> 'email')
  );
create policy "shared_accounts: invite" on public.shared_accounts for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and status = 'pending'
    and shared_with_id is null
    and accepted_at is null
    and lower(shared_with_email) <> lower((select auth.jwt()) ->> 'email')
  );
create policy "shared_accounts: invitee responds" on public.shared_accounts for update to authenticated
  using (status = 'pending' and lower(shared_with_email) = lower((select auth.jwt()) ->> 'email'))
  with check (
    lower(shared_with_email) = lower((select auth.jwt()) ->> 'email')
    and ((status = 'accepted' and shared_with_id = (select auth.uid()))
      or (status = 'declined' and shared_with_id is null))
  );

-- Supabase's built-in event trigger that enables RLS on new tables. It only runs
-- as an event trigger, so API roles never need to call it. Revoke from PUBLIC too,
-- since anon and authenticated inherit that grant; firing triggers is unaffected.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
