export interface ColorOption {
  name: string;
  value: string; // hex color code
}

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  image: string; // صورة رئيسية
  additionalImages?: string[]; // صور إضافية
  sizes?: string[]; // قياسات اختيارية
  colors?: ColorOption[]; // ألوان اختيارية مع أكواد الألوان
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
