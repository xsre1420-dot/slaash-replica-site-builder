-- Add security improvements with existence checks

-- Add constraint to prevent self-referencing in suggested products (with check)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'prevent_self_suggestion' 
    AND table_name = 'suggested_products'
  ) THEN
    ALTER TABLE public.suggested_products 
    ADD CONSTRAINT prevent_self_suggestion 
    CHECK (product_id != suggested_product_id);
  END IF;
END $$;

-- Add constraint to prevent duplicate suggestions (with check)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'unique_product_suggestion' 
    AND table_name = 'suggested_products'
  ) THEN
    ALTER TABLE public.suggested_products 
    ADD CONSTRAINT unique_product_suggestion 
    UNIQUE (product_id, suggested_product_id);
  END IF;
END $$;

-- Add constraint to limit review text length (with check)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'review_comment_length' 
    AND table_name = 'product_reviews'
  ) THEN
    ALTER TABLE public.product_reviews 
    ADD CONSTRAINT review_comment_length 
    CHECK (char_length(comment) >= 10 AND char_length(comment) <= 2000);
  END IF;
END $$;

-- Add constraint to limit reviewer name length (with check)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'reviewer_name_length' 
    AND table_name = 'product_reviews'
  ) THEN
    ALTER TABLE public.product_reviews 
    ADD CONSTRAINT reviewer_name_length 
    CHECK (char_length(reviewer_name) >= 2 AND char_length(reviewer_name) <= 100);
  END IF;
END $$;

-- Add email validation constraint (with check)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'valid_reviewer_email' 
    AND table_name = 'product_reviews'
  ) THEN
    ALTER TABLE public.product_reviews 
    ADD CONSTRAINT valid_reviewer_email 
    CHECK (reviewer_email IS NULL OR reviewer_email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
  END IF;
END $$;

-- Add function to validate product ownership
CREATE OR REPLACE FUNCTION public.validate_product_ownership(p_product_id UUID, p_owner_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.products 
    WHERE id = p_product_id AND owner_id = p_owner_id
  );
$$;

-- Create RLS policies (with existence checks)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'product_reviews' 
    AND policyname = 'Public can view approved product reviews'
  ) THEN
    CREATE POLICY "Public can view approved product reviews" 
    ON public.product_reviews 
    FOR SELECT 
    TO anon, authenticated
    USING (is_approved = true);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'suggested_products' 
    AND policyname = 'Public can view suggested products'
  ) THEN
    CREATE POLICY "Public can view suggested products" 
    ON public.suggested_products 
    FOR SELECT 
    TO anon, authenticated
    USING (true);
  END IF;
END $$;

-- Enhanced validation policies
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'product_reviews' 
    AND policyname = 'Validate product ownership for reviews'
  ) THEN
    CREATE POLICY "Validate product ownership for reviews" 
    ON public.product_reviews 
    FOR INSERT 
    WITH CHECK (
      auth.uid() = owner_id AND 
      public.validate_product_ownership(product_id, owner_id)
    );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'suggested_products' 
    AND policyname = 'Validate product ownership for suggestions'
  ) THEN
    CREATE POLICY "Validate product ownership for suggestions" 
    ON public.suggested_products 
    FOR INSERT 
    WITH CHECK (
      auth.uid() = owner_id AND 
      public.validate_product_ownership(product_id, owner_id) AND
      public.validate_product_ownership(suggested_product_id, owner_id)
    );
  END IF;
END $$;

-- Add audit logging function
CREATE OR REPLACE FUNCTION public.audit_review_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log review modifications for security monitoring
  INSERT INTO public.store_visits (owner_id, visitor_ip, page_path, user_agent)
  VALUES (
    COALESCE(NEW.owner_id, OLD.owner_id),
    'system-audit',
    'review_' || TG_OP || '_' || COALESCE(NEW.id::text, OLD.id::text),
    'review-audit-system'
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create audit trigger (with check)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'audit_product_reviews_changes'
    AND event_object_table = 'product_reviews'
  ) THEN
    CREATE TRIGGER audit_product_reviews_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.product_reviews
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_review_changes();
  END IF;
END $$;

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_product_reviews_approved_created 
ON public.product_reviews(product_id, is_approved, created_at DESC) 
WHERE is_approved = true;

CREATE INDEX IF NOT EXISTS idx_product_reviews_owner_status 
ON public.product_reviews(owner_id, is_approved, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_suggested_products_order 
ON public.suggested_products(product_id, display_order);

-- Add cleanup functions
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_reviews()
RETURNS INTEGER
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  WITH deleted AS (
    DELETE FROM public.product_reviews 
    WHERE product_id NOT IN (SELECT id FROM public.products)
    RETURNING 1
  )
  SELECT COUNT(*) FROM deleted;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_orphaned_suggestions()
RETURNS INTEGER
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  WITH deleted AS (
    DELETE FROM public.suggested_products 
    WHERE product_id NOT IN (SELECT id FROM public.products)
       OR suggested_product_id NOT IN (SELECT id FROM public.products)
    RETURNING 1
  )
  SELECT COUNT(*) FROM deleted;
$$;