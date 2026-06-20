-- Fix remaining customer security issue: Remove public INSERT access entirely

-- 1. Remove the public customer creation policy that still allows data injection
DROP POLICY IF EXISTS "Public can create customers with valid owner context" ON public.customers;

-- 2. Remove the defensive deny policy as it's no longer needed
DROP POLICY IF EXISTS "Deny public SELECT access to customers" ON public.customers;

-- 3. Add RLS policies for user_access table to fix the warning (skip if legacy table absent)
DO $$
BEGIN
  IF to_regclass('public.user_access') IS NOT NULL THEN
    ALTER TABLE public.user_access ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users can view their own access records" ON public.user_access;
    CREATE POLICY "Users can view their own access records"
      ON public.user_access FOR SELECT USING (auth.uid() = user_id);
    DROP POLICY IF EXISTS "Users can insert their own access records" ON public.user_access;
    CREATE POLICY "Users can insert their own access records"
      ON public.user_access FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 4. Add RLS policies for legacy Bidaya table (skip if absent)
DO $$
BEGIN
  IF to_regclass('public."‏Bidaya"') IS NOT NULL THEN
    ALTER TABLE public."‏Bidaya" ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Deny all access to legacy Bidaya table" ON public."‏Bidaya";
    CREATE POLICY "Deny all access to legacy Bidaya table"
      ON public."‏Bidaya" FOR ALL USING (false);
  END IF;
END $$;