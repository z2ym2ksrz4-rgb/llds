-- 0040: resend_key() accepts the secret under 'resend_api_key' or 'resend-api-key' (the Vault UI suggests hyphens).
create or replace function resend_key() returns text language plpgsql security definer set search_path = public as $$
declare k text; begin
  begin select decrypted_secret into k from vault.decrypted_secrets where name in ('resend_api_key', 'resend-api-key') order by created_at desc limit 1; exception when others then k := null; end;
  return nullif(trim(k), '');
end $$;
