begin;
create or replace function public.claim_parasut_refresh(p_key text) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 insert into public.parasut_response_cache(cache_key,locked_until) values(p_key,now()+interval '30 seconds') on conflict(cache_key) do update set locked_until=now()+interval '30 seconds' where public.parasut_response_cache.locked_until<=now() and public.parasut_response_cache.expires_at<=now()+interval '3 hours 59 minutes';
 return found;
end $$;
revoke execute on function public.claim_parasut_refresh(text) from public,anon,authenticated;
grant execute on function public.claim_parasut_refresh(text) to service_role;
commit;
