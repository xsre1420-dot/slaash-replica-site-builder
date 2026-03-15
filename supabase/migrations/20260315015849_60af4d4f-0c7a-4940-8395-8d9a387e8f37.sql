DROP FUNCTION IF EXISTS public.get_store_by_slug(text);

CREATE FUNCTION public.get_store_by_slug(p_slug text)
 RETURNS TABLE(owner_id uuid, store_name text, store_logo text, store_slug text, menu_background_color text, menu_text_color text, menu_accent_color text, store_font text, banner_images text[], primary_banner_index integer, delivery_prices jsonb, whatsapp_number text, facebook_url text, instagram_url text, return_policy text, privacy_policy text, payment_methods jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    s.owner_id, s.store_name, s.store_logo, s.store_slug,
    s.menu_background_color, s.menu_text_color, s.menu_accent_color,
    s.store_font,
    s.banner_images, s.primary_banner_index, s.delivery_prices,
    s.whatsapp_number, s.facebook_url, s.instagram_url,
    s.return_policy, s.privacy_policy, s.payment_methods
  FROM public.store_settings s
  WHERE LOWER(s.store_slug) = LOWER(p_slug)
  LIMIT 1;
$function$;