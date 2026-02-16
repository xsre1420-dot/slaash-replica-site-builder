import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Search, Package, AlertTriangle, CheckCircle, Edit, Download, Filter, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  image_url?: string;
  stock_quantity?: number;
  min_stock_level?: number;
  created_at: string;
}

type StockFilter = "all" | "good" | "low" | "out";

const stockFilters: { value: StockFilter; label: string; icon: React.ReactNode }[] = [
  { value: "all", label: "الكل", icon: <Package className="w-3.5 h-3.5" /> },
  { value: "good", label: "متوفر", icon: <CheckCircle className="w-3.5 h-3.5" /> },
  { value: "low", label: "منخفض", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  { value: "out", label: "نفد", icon: <XCircle className="w-3.5 h-3.5" /> },
];

function Inventory() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [newQuantity, setNewQuantity] = useState("");
  const [minStockLevel, setMinStockLevel] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (user) fetchProducts();
  }, [user]);

  const fetchProducts = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = supabase.from('products').select('*');
      if (user?.id) {
        query = query.eq('user_id', user.id);
      }
      const { data, error } = await query.order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error("خطأ في تحميل المنتجات");
    } finally {
      setLoading(false);
    }
  };

  const updateStock = async (productId: string, quantity: number, minLevel?: number) => {
    try {
      const updateData: Record<string, number> = { stock_quantity: quantity };
      if (minLevel !== undefined) {
        updateData.min_stock_level = minLevel;
      }

      const { error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', productId);

      if (error) throw error;
      
      toast.success("تم تحديث المخزون بنجاح");
      fetchProducts();
      setDialogOpen(false);
      setSelectedProduct(null);
      setNewQuantity("");
      setMinStockLevel("");
    } catch (error) {
      console.error('Error updating stock:', error);
      toast.error("خطأ في تحديث المخزون");
    }
  };

  const getStockStatus = (product: Product) => {
    const quantity = product.stock_quantity || 0;
    const minLevel = product.min_stock_level || 5;
    
    if (quantity === 0) return { status: 'out' as const, label: 'نفد المخزون' };
    if (quantity <= minLevel) return { status: 'low' as const, label: 'مخزون منخفض' };
    return { status: 'good' as const, label: 'متوفر' };
  };

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = stockFilter === "all" || getStockStatus(product).status === stockFilter;
      return matchesSearch && matchesFilter;
    });
  }, [products, searchTerm, stockFilter]);

  const stats = useMemo(() => ({
    total: products.length,
    good: products.filter(p => getStockStatus(p).status === 'good').length,
    low: products.filter(p => getStockStatus(p).status === 'low').length,
    out: products.filter(p => getStockStatus(p).status === 'out').length,
    totalStock: products.reduce((sum, p) => sum + (p.stock_quantity || 0), 0),
  }), [products]);

  const lowStockProducts = useMemo(() => 
    products.filter(p => {
      const s = getStockStatus(p);
      return s.status === 'low' || s.status === 'out';
    }), [products]);

  const exportCSV = () => {
    if (products.length === 0) {
      toast.error("لا توجد منتجات للتصدير");
      return;
    }
    const headers = ["اسم المنتج", "التصنيف", "السعر", "الكمية", "الحد الأدنى", "الحالة"];
    const rows = products.map(p => {
      const s = getStockStatus(p);
      return [p.name, p.category, p.price, p.stock_quantity || 0, p.min_stock_level || 5, s.label];
    });
    const csv = "\uFEFF" + [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير البيانات بنجاح");
  };

  const getStatusBadgeClasses = (status: string) => {
    switch (status) {
      case 'out': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'low': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      default: return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">جاري تحميل المخزون...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-arabic">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/builder">
                <Button variant="ghost" size="icon" className="rounded-xl">
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-foreground">إدارة المخزون</h1>
                <p className="text-xs text-muted-foreground">تتبع وإدارة مخزون المنتجات</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={exportCSV}
              className="rounded-xl border-border/30 hover:border-border/60"
            >
              <Download className="w-4 h-4 ml-2" />
              تصدير
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-5">
        {/* Low Stock Alert */}
        {lowStockProducts.length > 0 && (
          <div className="mb-5 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/15 animate-fade-in">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-semibold text-foreground">
                تنبيه: {lowStockProducts.length} منتج بحاجة لإعادة تعبئة
              </span>
            </div>
            <p className="text-xs text-muted-foreground mr-6">
              {lowStockProducts.slice(0, 3).map(p => p.name).join("، ")}
              {lowStockProducts.length > 3 && ` و${lowStockProducts.length - 3} آخرين`}
            </p>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { label: "إجمالي المنتجات", value: stats.total, sub: `${stats.totalStock} وحدة`, color: "text-foreground" },
            { label: "متوفر", value: stats.good, color: "text-emerald-600 dark:text-emerald-400" },
            { label: "مخزون منخفض", value: stats.low, color: "text-amber-600 dark:text-amber-400" },
            { label: "نفد المخزون", value: stats.out, color: "text-destructive" },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className="bg-card/80 backdrop-blur-sm p-4 rounded-2xl border border-border/20 animate-fade-in"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              {stat.sub && <p className="text-[10px] text-muted-foreground mt-0.5">{stat.sub}</p>}
            </div>
          ))}
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="البحث في المنتجات..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10 rounded-xl border-border/30 bg-card/80"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {stockFilters.map((f) => (
              <Button
                key={f.value}
                variant={stockFilter === f.value ? "default" : "outline"}
                size="sm"
                onClick={() => setStockFilter(f.value)}
                className={`rounded-xl whitespace-nowrap text-xs gap-1.5 ${
                  stockFilter !== f.value ? 'border-border/30 bg-card/80 hover:bg-muted' : ''
                }`}
              >
                {f.icon}
                {f.label}
                {f.value !== "all" && (
                  <span className="text-[10px] opacity-70">
                    ({f.value === "good" ? stats.good : f.value === "low" ? stats.low : stats.out})
                  </span>
                )}
              </Button>
            ))}
          </div>
        </div>

        {/* Products List */}
        <Card className="border-border/20 rounded-2xl overflow-hidden bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="w-4 h-4" />
              قائمة المنتجات
              <Badge variant="secondary" className="mr-auto text-[10px] rounded-lg">
                {filteredProducts.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Package className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm mb-4">
                  {searchTerm || stockFilter !== "all" ? "لا توجد نتائج مطابقة" : "لا توجد منتجات في المخزون"}
                </p>
                {!searchTerm && stockFilter === "all" && (
                  <Link to="/add-product">
                    <Button size="sm" className="rounded-xl">إضافة منتج جديد</Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border/10">
                {filteredProducts.map((product, i) => {
                  const stockStatus = getStockStatus(product);
                  return (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors animate-fade-in"
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-11 h-11 rounded-xl object-cover border border-border/10 flex-shrink-0"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                            <Package className="w-5 h-5 text-muted-foreground/40" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <h3 className="font-semibold text-foreground text-sm truncate">{product.name}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">{product.category}</span>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs font-medium text-foreground">{product.price} ر.س</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                        <div className="text-center min-w-[40px]">
                          <p className="text-lg font-bold text-foreground leading-none">
                            {product.stock_quantity || 0}
                          </p>
                          <p className="text-[9px] text-muted-foreground mt-0.5">وحدة</p>
                        </div>
                        
                        <Badge 
                          variant="outline" 
                          className={`text-[10px] px-2 py-0.5 rounded-lg border ${getStatusBadgeClasses(stockStatus.status)}`}
                        >
                          {stockStatus.label}
                        </Badge>

                        <Dialog open={dialogOpen && selectedProduct?.id === product.id} onOpenChange={(open) => {
                          setDialogOpen(open);
                          if (!open) {
                            setSelectedProduct(null);
                            setNewQuantity("");
                            setMinStockLevel("");
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-xl h-9 w-9"
                              onClick={() => {
                                setSelectedProduct(product);
                                setNewQuantity(String(product.stock_quantity || 0));
                                setMinStockLevel(String(product.min_stock_level || 5));
                                setDialogOpen(true);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="rounded-2xl">
                            <DialogHeader>
                              <DialogTitle className="text-right">تحديث مخزون {selectedProduct?.name}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="quantity">الكمية الحالية</Label>
                                <Input
                                  id="quantity"
                                  type="number"
                                  value={newQuantity}
                                  onChange={(e) => setNewQuantity(e.target.value)}
                                  min="0"
                                  className="rounded-xl mt-1.5"
                                />
                              </div>
                              <div>
                                <Label htmlFor="minLevel">الحد الأدنى للمخزون</Label>
                                <Input
                                  id="minLevel"
                                  type="number"
                                  value={minStockLevel}
                                  onChange={(e) => setMinStockLevel(e.target.value)}
                                  min="0"
                                  className="rounded-xl mt-1.5"
                                />
                              </div>
                              <Button
                                onClick={() => {
                                  if (selectedProduct) {
                                    updateStock(
                                      selectedProduct.id,
                                      parseInt(newQuantity) || 0,
                                      parseInt(minStockLevel) || 5
                                    );
                                  }
                                }}
                                className="w-full rounded-xl"
                              >
                                حفظ التغييرات
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Inventory;
