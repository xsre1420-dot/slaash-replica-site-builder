
-- Create orders table to track all orders
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES public.restaurant_owners(id) NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  total_amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT DEFAULT 'cash_on_delivery',
  delivery_time INTEGER DEFAULT 30,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create order_items table to track individual items in each order
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  product_name TEXT NOT NULL,
  product_price DECIMAL(10,2) NOT NULL,
  quantity INTEGER NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create customers table to track customer information and behavior
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES public.restaurant_owners(id) NOT NULL,
  phone TEXT NOT NULL,
  name TEXT,
  address TEXT,
  first_order_date TIMESTAMP WITH TIME ZONE,
  last_order_date TIMESTAMP WITH TIME ZONE,
  total_orders INTEGER DEFAULT 0,
  total_spent DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(owner_id, phone)
);

-- Create store_visits table to track website visits
CREATE TABLE public.store_visits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES public.restaurant_owners(id) NOT NULL,
  visitor_ip TEXT,
  user_agent TEXT,
  page_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_visits ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for orders
CREATE POLICY "Restaurant owners can view their orders" 
  ON public.orders FOR SELECT 
  USING (owner_id = auth.uid());

CREATE POLICY "Restaurant owners can create orders" 
  ON public.orders FOR INSERT 
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Restaurant owners can update their orders" 
  ON public.orders FOR UPDATE 
  USING (owner_id = auth.uid());

-- Create RLS policies for order_items
CREATE POLICY "Restaurant owners can view their order items" 
  ON public.order_items FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.owner_id = auth.uid()));

CREATE POLICY "Restaurant owners can create order items" 
  ON public.order_items FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.owner_id = auth.uid()));

-- Create RLS policies for customers
CREATE POLICY "Restaurant owners can view their customers" 
  ON public.customers FOR SELECT 
  USING (owner_id = auth.uid());

CREATE POLICY "Restaurant owners can manage their customers" 
  ON public.customers FOR ALL 
  USING (owner_id = auth.uid());

-- Create RLS policies for store_visits
CREATE POLICY "Restaurant owners can view their store visits" 
  ON public.store_visits FOR SELECT 
  USING (owner_id = auth.uid());

CREATE POLICY "Restaurant owners can create store visits" 
  ON public.store_visits FOR INSERT 
  WITH CHECK (owner_id = auth.uid());

-- Create indexes for better performance
CREATE INDEX idx_orders_owner_id ON public.orders(owner_id);
CREATE INDEX idx_orders_created_at ON public.orders(created_at);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_order_items_product_id ON public.order_items(product_id);
CREATE INDEX idx_customers_owner_id ON public.customers(owner_id);
CREATE INDEX idx_customers_phone ON public.customers(phone);
CREATE INDEX idx_store_visits_owner_id ON public.store_visits(owner_id);
CREATE INDEX idx_store_visits_created_at ON public.store_visits(created_at);

-- Create a function to update customer statistics when orders are inserted/updated
CREATE OR REPLACE FUNCTION update_customer_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update or insert customer record
  INSERT INTO public.customers (owner_id, phone, name, first_order_date, last_order_date, total_orders, total_spent)
  VALUES (NEW.owner_id, NEW.customer_phone, NEW.customer_name, NEW.created_at, NEW.created_at, 1, NEW.total_amount)
  ON CONFLICT (owner_id, phone) 
  DO UPDATE SET
    name = COALESCE(EXCLUDED.name, customers.name),
    last_order_date = EXCLUDED.last_order_date,
    total_orders = customers.total_orders + 1,
    total_spent = customers.total_spent + EXCLUDED.total_spent,
    updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update customer stats
CREATE TRIGGER trigger_update_customer_stats
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_stats();
