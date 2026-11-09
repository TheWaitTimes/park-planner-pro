-- Social media links shown in the site footer; editable by admins only
CREATE TABLE public.social_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.social_links TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.social_links TO authenticated;
GRANT ALL ON public.social_links TO service_role;

ALTER TABLE public.social_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Social links are viewable by everyone"
ON public.social_links FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Admins can insert social links"
ON public.social_links FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update social links"
ON public.social_links FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete social links"
ON public.social_links FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Seed the four platforms with empty links so the admin form has rows to fill in
INSERT INTO public.social_links (platform, url, sort_order) VALUES
  ('twitter', '', 1),
  ('instagram', '', 2),
  ('tiktok', '', 3),
  ('youtube', '', 4);

CREATE TRIGGER social_links_set_updated_at
BEFORE UPDATE ON public.social_links
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();