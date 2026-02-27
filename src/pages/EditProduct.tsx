
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Trash2 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { getCategories, getProductById, updateProduct, getCategoriesSync, deleteProduct } from "@/data/dummyData";
import { useToast } from "@/hooks/use-toast";
import { Product, Category, ColorOption } from "@/types";
import ProductImagesManager from "@/components/ProductImagesManager";
import SizesManager from "@/components/SizesManager";
import ColorSwatchPicker from "@/components/ColorSwatchPicker";
import { formatPriceInput, isValidPrice } from "@/utils/numberUtils";
import { useUndoDelete } from "@/hooks/useUndoDelete";
import { validateProductImages } from "@/utils/imageValidator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const EditProduct = () => {
  const { productId } = useParams<{ productId: string }>();
  const [mainImage, setMainImage] = useState<string | null>(null);
  const [additionalImages, setAdditionalImages] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [sizes, setSizes] = useState<string[]>([]);
  const [colors, setColors] = useState<ColorOption[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Load categories on mount
  useEffect(() => {
    const loadCategories = async () => {
      const cats = await getCategories();
      setCategories(cats);
    };
    loadCategories();
  }, []);

  useEffect(() => {
    if (productId) {
      const product = getProductById(productId);
      if (product) {
        setName(product.name);
        setDescription(product.description);
        setCategory(product.category);
        setPrice(product.price > 0 ? product.price.toString() : '');
        setMainImage(product.image);
        setAdditionalImages(product.additionalImages || []);
        setSizes(product.sizes || []);
        setColors(product.colors || []);
      } else {
        toast({
          title: "خطأ",
          description: "المنتج غير موجود",
          variant: "destructive"
        });
        navigate('/builder');
      }
    }
  }, [productId, navigate, toast]);

  const handleImagesChange = (newMainImage: string | null, newAdditionalImages: string[]) => {
    setMainImage(newMainImage);
    setAdditionalImages(newAdditionalImages);
  };

  const handlePriceChange = (inputValue: string) => {
    // Convert Arabic numerics to English and format
    const formattedValue = formatPriceInput(inputValue);
    setPrice(formattedValue);
  };

  const formatDisplayPrice = (priceValue: string): string => {
    if (!priceValue) return '';
    const numericValue = parseFloat(priceValue.replace(/,/g, ''));
    if (isNaN(numericValue) || numericValue === 0) return '';
    return numericValue.toLocaleString('en-US');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!name.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال اسم المنتج",
        variant: "destructive"
      });
      return;
    }
    
    if (!category) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار فئة المنتج",
        variant: "destructive"
      });
      return;
    }
    
    if (!price || !isValidPrice(price)) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال سعر صحيح",
        variant: "destructive"
      });
      return;
    }

    if (!mainImage) {
      toast({
        title: "خطأ",
        description: "يرجى إضافة صورة رئيسية للمنتج",
        variant: "destructive"
      });
      return;
    }

    // Update the product
    if (productId) {
      const updatedProduct: Product = {
        id: productId,
        name,
        description,
        category,
        price: Number(formatPriceInput(price)),
        image: mainImage,
        additionalImages,
        sizes: sizes.length > 0 ? sizes : undefined,
        colors: colors.length > 0 ? colors : undefined,
      };

      // Update the product using the updateProduct function
      const result = await updateProduct(productId, updatedProduct);

      if (result.success) {
        // Show success toast
        toast({
          title: "تم بنجاح",
          description: "تم تحديث بيانات المنتج",
        });
        // Navigate back to builder
        navigate('/builder');
      } else {
        toast({
          title: "خطأ",
          description: result.error || "فشل في تحديث المنتج",
          variant: "destructive"
        });
      }
    }
  };

  // Suggestion #18: Undo delete
  const { deleteWithUndo } = useUndoDelete();

  const handleDeleteProduct = async () => {
    if (!productId) return;
    
    const product = getProductById(productId);
    if (!product) return;

    // Remove from UI immediately
    navigate('/products');

    deleteWithUndo({
      item: product,
      itemName: product.name,
      onDelete: async () => deleteProduct(productId),
      onRestore: () => {
        toast({ title: "تم الاستعادة", description: "تم استعادة المنتج بنجاح" });
        navigate(`/edit-product/${productId}`);
      },
      timeoutMs: 5000,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white text-gray-800 p-4 flex justify-between items-center border-b border-gray-100">
        <Link to="/builder">
          <X className="w-6 h-6" />
        </Link>
        <h1 className="text-xl font-bold text-black">تعديل المنتج</h1>
        <div className="w-6" /> {/* Spacer for alignment */}
      </div>

      {/* Form */}
      <div className="max-w-xl mx-auto p-4">
        <form className="bg-white rounded-xl p-6 shadow-sm space-y-6" onSubmit={handleSubmit}>
          {/* Image Upload */}
          <ProductImagesManager 
            mainImage={mainImage}
            additionalImages={additionalImages}
            onImagesChange={handleImagesChange}
          />

          {/* Name */}
          <div className="space-y-2 text-right">
            <Label htmlFor="name" className="block text-black">اسم المنتج</Label>
            <Input 
              id="name" 
              className="text-right text-black focus:border-blue-500 focus:ring-blue-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2 text-right">
            <Label htmlFor="description" className="block text-black">الوصف</Label>
            <Textarea 
              id="description" 
              className="text-right text-black focus:border-blue-500 focus:ring-blue-500"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Price */}
          <div className="space-y-2 text-right">
            <Label htmlFor="price" className="block text-black">السعر (دينار عراقي)</Label>
            <Input 
              id="price" 
              type="text" 
              className="text-right text-black focus:border-blue-500 focus:ring-blue-500" 
              value={formatDisplayPrice(price)}
              onChange={(e) => handlePriceChange(e.target.value)}
              placeholder="أدخل السعر"
            />
          </div>

          {/* Sizes Manager */}
          <SizesManager sizes={sizes} onSizesChange={setSizes} />

          {/* Colors Manager */}
          <ColorSwatchPicker colors={colors} onColorsChange={setColors} />

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button 
              type="submit" 
              className="w-full text-white shadow-lg"
              style={{ 
                background: 'linear-gradient(135deg, #5b47f5, #4c3ef7)',
                boxShadow: '0 4px 15px rgba(91, 71, 245, 0.3)'
              }}
            >
              حفظ التغييرات
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  type="button"
                  variant="destructive"
                  className="w-full flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  حذف المنتج
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-right">هل أنت متأكد من حذف هذا المنتج؟</AlertDialogTitle>
                  <AlertDialogDescription className="text-right">
                    هذا الإجراء لا يمكن التراجع عنه. سيتم حذف المنتج نهائياً من قاعدة البيانات.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2">
                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDeleteProduct}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    نعم، احذف المنتج
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProduct;
