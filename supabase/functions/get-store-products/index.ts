import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting map to track requests per IP
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // Max 30 requests per minute per IP

function getRealIP(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0] || 
         req.headers.get('x-real-ip') || 
         'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = requestCounts.get(ip);
  
  if (!record || now > record.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return false;
  }
  
  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }
  
  record.count++;
  return false;
}

function validateUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

Deno.serve(async (req) => {
  const clientIP = getRealIP(req);
  const startTime = Date.now();
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Security: Rate limiting
  if (isRateLimited(clientIP)) {
    console.warn(`Rate limit exceeded for IP: ${clientIP}`);
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please try again later.' }),
      { 
        status: 429, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  // Security: Only allow POST requests
  if (req.method !== 'POST') {
    console.warn(`Invalid method ${req.method} from IP: ${clientIP}`);
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  try {
    // Initialize Supabase client with service role for secure access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse and validate request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (e) {
      console.warn(`Invalid JSON from IP: ${clientIP}, error: ${e.message}`);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { ownerId } = requestBody;
    
    // Security: Validate owner ID
    if (!ownerId || typeof ownerId !== 'string' || !validateUUID(ownerId)) {
      console.warn(`Invalid or missing owner ID from IP: ${clientIP}, ownerId: ${ownerId}`);
      return new Response(
        JSON.stringify({ error: 'Valid Owner ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Log the request for security monitoring
    console.log(`Store data request - IP: ${clientIP}, Owner: ${ownerId}, Timestamp: ${new Date().toISOString()}`);

    // Securely fetch products for a specific store owner
    // This bypasses RLS with service role but only returns data for the specified owner
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, description, category, price, image_url, additional_images')
      .eq('owner_id', ownerId);

    if (productsError) {
      console.error(`Error fetching products for owner ${ownerId}:`, productsError);
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
      console.error(`Error fetching categories for owner ${ownerId}:`, categoriesError);
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

    // Log successful response
    const responseTime = Date.now() - startTime;
    console.log(`Store data response - Owner: ${ownerId}, Products: ${products?.length || 0}, Categories: ${categories?.length || 0}, Response time: ${responseTime}ms`);

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
    console.error(`Unexpected error from IP ${clientIP}:`, error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});