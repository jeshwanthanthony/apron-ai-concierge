
CREATE TABLE public.restaurants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Step 1
  name TEXT,
  website_url TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  -- Step 2
  cuisine_type TEXT,
  story TEXT,
  popular_dishes TEXT,
  parking_info TEXT,
  delivery_pickup TEXT,
  -- Step 3
  reservation_link TEXT,
  order_online_link TEXT,
  catering_link TEXT,
  instagram_link TEXT,
  google_maps_link TEXT,
  -- Step 4
  menu_pdf_path TEXT,
  catering_menu_pdf_path TEXT,
  allergy_info TEXT,
  dietary_vegan BOOLEAN NOT NULL DEFAULT false,
  dietary_vegetarian BOOLEAN NOT NULL DEFAULT false,
  dietary_gluten_free BOOLEAN NOT NULL DEFAULT false,
  dietary_halal BOOLEAN NOT NULL DEFAULT false,
  -- Step 5
  concierge_name TEXT,
  brand_color TEXT DEFAULT '#7c3aed',
  welcome_message TEXT,
  reservation_button_label TEXT DEFAULT 'Reserve a Table',
  order_button_label TEXT DEFAULT 'Order Online',
  catering_button_label TEXT DEFAULT 'Catering Inquiry',
  -- Meta
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  onboarding_step INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurants TO authenticated;
GRANT ALL ON public.restaurants TO service_role;

ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own restaurant"
ON public.restaurants FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_restaurants_updated_at
BEFORE UPDATE ON public.restaurants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create restaurant row on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.restaurants (user_id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
