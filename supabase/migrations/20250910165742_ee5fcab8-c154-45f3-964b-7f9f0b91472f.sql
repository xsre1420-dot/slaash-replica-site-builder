-- Fix security issue: Add explicit denial of public access to customers table

CREATE POLICY "Deny public access to customers" 
ON public.customers 
FOR ALL 
USING (false);