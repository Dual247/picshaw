-- Narrow future-object hardening for the verified application migration creator.
-- Changes no existing object ACLs, managed-role defaults, auth/storage schemas,
-- function defaults, global defaults or schema CREATE/USAGE permissions.
begin;
alter default privileges for role postgres in schema public
  revoke all privileges on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all privileges on sequences from public, anon, authenticated;
-- New functions still inherit PostgreSQL's global PUBLIC EXECUTE. Every function
-- migration MUST explicitly REVOKE EXECUTE from PUBLIC/anon/authenticated on
-- that function in the same transaction, before any required minimum GRANT.
-- Per-schema function-default REVOKE cannot remove global PUBLIC EXECUTE.
commit;

