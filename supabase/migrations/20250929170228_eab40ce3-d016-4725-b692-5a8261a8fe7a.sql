-- Fix comment length constraint for product reviews to allow shorter comments
ALTER TABLE public.product_reviews DROP CONSTRAINT IF EXISTS review_comment_length;

-- Add a more reasonable constraint (minimum 2 characters)
ALTER TABLE public.product_reviews ADD CONSTRAINT review_comment_length 
CHECK (char_length(trim(comment)) >= 2 AND char_length(trim(comment)) <= 1000);