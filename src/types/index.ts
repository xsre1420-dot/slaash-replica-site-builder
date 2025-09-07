export interface ColorOption {
  name?: string; // اسم اللون (اختياري)
  value: string; // hex color code
  image?: string; // صورة خاصة باللون
}

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  cost?: number; // تكلفة المنتج لحساب الأرباح
  image: string; // صورة رئيسية
  additionalImages?: string[]; // صور إضافية
  sizes?: string[]; // قياسات اختيارية
  colors?: ColorOption[]; // ألوان اختيارية مع أكواد الألوان
  stockQuantity?: number; // الكمية الإجمالية
  variants?: ProductVariant[]; // تفاصيل الكمية لكل تركيبة
}

export interface ProductVariant {
  color?: string; // لون المنتج
  size?: string; // قياس المنتج
  quantity: number; // الكمية المتاحة
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedSize?: string;
  selectedColor?: string;
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
  governorate?: string;
}

export interface Order {
  id: string;
  items: CartItem[];
  customerInfo: CustomerInfo;
  total: number;
  date: string;
  status: 'pending' | 'completed' | 'cancelled';
}
