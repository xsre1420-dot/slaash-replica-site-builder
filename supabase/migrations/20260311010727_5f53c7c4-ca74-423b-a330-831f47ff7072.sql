
-- Insert missing profile for existing user
INSERT INTO public.profiles (user_id, username, store_name)
SELECT id, raw_user_meta_data->>'username', raw_user_meta_data->>'store_name'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.profiles)
ON CONFLICT DO NOTHING;
