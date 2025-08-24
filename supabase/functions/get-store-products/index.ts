import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role for secure access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the store owner ID from the request
    const { ownerId } = await req.json();
    
    if (!ownerId) {
      return new Response(
        JSON.stringify({ error: 'Owner ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Securely fetch products for a specific store owner
    // This bypasses RLS with service role but only returns data for the specified owner
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, description, category, price, image_url, additional_images')
      .eq('owner_id', ownerId);

    if (productsError) {
      console.error('Error fetching products:', productsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch products' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Fetch categories for the store
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('id, name, display_order')
      .eq('owner_id', ownerId)
      .order('display_order');

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch categories' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get store settings (public info only)
    const { data: storeSettings, error: settingsError } = await supabase
      .from('store_settings')
      .select('store_name, store_logo, menu_background_color, menu_text_color, menu_accent_color, banner_images, primary_banner_index')
      .eq('owner_id', ownerId)
      .single();

    // Store settings might not exist, so don't error if not found
    const storeInfo = settingsError ? null : storeSettings;

    return new Response(
      JSON.stringify({
        products,
        categories,
        storeInfo,
        success: true
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});