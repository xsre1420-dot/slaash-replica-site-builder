
export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  image: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Category {
  id: string;
  name: string;
  order: number;
}

export interface CustomerInfo {
  name: string;
  phone: string;
  address: string;
  notes?: string;
}

export interface Order {
  id: string;
  items: CartItem[];
  customerInfo: CustomerInfo;
  total: number;
  date: string;
  status: 'pending' | 'completed' | 'cancelled';
}
