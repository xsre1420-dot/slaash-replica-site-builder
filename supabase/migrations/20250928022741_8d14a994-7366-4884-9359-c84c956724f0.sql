-- Add additional security constraints and improvements (Fixed version)

-- Add constraint to prevent self-referencing in suggested products
ALTER TABLE public.suggested_products 
ADD CONSTRAINT prevent_self_suggestion 
CHECK (product_id != suggested_product_id);

-- Add constraint to prevent duplicate suggestions for same product
ALTER TABLE public.suggested_products 
ADD CONSTRAINT unique_product_suggestion 
UNIQUE (product_id, suggested_product_id);

-- Add constraint to limit review text length for security
ALTER TABLE public.product_reviews 
ADD CONSTRAINT review_comment_length 
CHECK (char_length(comment) >= 10 AND char_length(comment) <= 2000);

-- Add constraint to limit reviewer name length
ALTER TABLE public.product_reviews 
ADD CONSTRAINT reviewer_name_length 
CHECK (char_length(reviewer_name) >= 2 AND char_length(reviewer_name) <= 100);

-- Add email validation constraint
ALTER TABLE public.product_reviews 
ADD CONSTRAINT valid_reviewer_email 
CHECK (reviewer_email IS NULL OR reviewer_email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Add constraint to limit helpful count to reasonable range
ALTER TABLE public.product_reviews 
ADD CONSTRAINT reasonable_helpful_count 
CHECK (helpful_count >= 0 AND helpful_count <= 10000);

-- Add constraint to limit display order to reasonable range
ALTER TABLE public.suggested_products 
ADD CONSTRAINT reasonable_display_order 
CHECK (display_order >= 0 AND display_order <= 1000);

-- Create more restrictive RLS policies to prevent data exposure
-- Enhanced public read policy for reviews (only approved reviews can be read publicly)
CREATE POLICY "Public can view approved product reviews" 
ON public.product_reviews 
FOR SELECT 
TO anon, authenticated
USING (is_approved = true);

-- Enhanced public read policy for suggested products
CREATE POLICY "Public can view suggested products" 
ON public.suggested_products 
FOR SELECT 
TO anon, authenticated
USING (true);

-- Add function to validate product ownership before creating reviews/suggestions
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

-- Add validation policies using the ownership function
CREATE POLICY "Validate product ownership for reviews" 
ON public.product_reviews 
FOR INSERT 
WITH CHECK (
  auth.uid() = owner_id AND 
  public.validate_product_ownership(product_id, owner_id)
);

CREATE POLICY "Validate product ownership for suggestions" 
ON public.suggested_products 
FOR INSERT 
WITH CHECK (
  auth.uid() = owner_id AND 
  public.validate_product_ownership(product_id, owner_id) AND
  public.validate_product_ownership(suggested_product_id, owner_id)
);

-- Add audit logging for sensitive operations
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

-- Create triggers for audit logging
CREATE TRIGGER audit_product_reviews_changes
AFTER INSERT OR UPDATE OR DELETE ON public.product_reviews
FOR EACH ROW
EXECUTE FUNCTION public.audit_review_changes();

-- Add additional indexes for better performance (without CONCURRENTLY)
CREATE INDEX IF NOT EXISTS idx_product_reviews_approved_created 
ON public.product_reviews(product_id, is_approved, created_at DESC) 
WHERE is_approved = true;

CREATE INDEX IF NOT EXISTS idx_product_reviews_owner_status 
ON public.product_reviews(owner_id, is_approved, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_suggested_products_order 
ON public.suggested_products(product_id, display_order);

-- Add function to clean up orphaned records
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_reviews()
RETURNS INTEGER
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.product_reviews 
  WHERE product_id NOT IN (SELECT id FROM public.products)
  RETURNING (SELECT COUNT(*));
$$;

CREATE OR REPLACE FUNCTION public.cleanup_orphaned_suggestions()
RETURNS INTEGER
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.suggested_products 
  WHERE product_id NOT IN (SELECT id FROM public.products)
     OR suggested_product_id NOT IN (SELECT id FROM public.products)
  RETURNING (SELECT COUNT(*));
$$;