-- RLS policy expressions are evaluated as the querying role, so any policy that
-- calls has_role() (user_roles, posts, social_links) needs that function to be
-- executable by authenticated. Revoke it from anon: admin-only policies are all
-- scoped TO authenticated, so anon requests never evaluate them.
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM anon;