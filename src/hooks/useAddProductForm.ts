import { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuthenticatedUserId } from '@/lib/authSession';
import { createProductIdempotencyKey } from '@/lib/productCreateLock';
import { addProduct, getCategories } from '@/services/productService';
import { useToast } from '@/hooks/use-toast';
import { Product, Category, ColorOption, ProductVariant } from '@/types';
import { formatPriceInput, isValidPrice, convertArabicToEnglish } from '@/utils/numberUtils';
import { validateProductImages } from '@/utils/imageValidator';
import { computeProfit, formatDisplayPrice, parseTagsInput, slugifyProductName } from '@/lib/productFormUtils';
import { PRODUCT_SAVE_TOAST, type ProductSaveMode } from '@/lib/productFormLabels';
import { toast as sonnerToast } from 'sonner';

export type SaveMode = ProductSaveMode;

export function useAddProductForm() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const submitLockRef = useRef(false);
  const idempotencyKeyRef = useRef(createProductIdempotencyKey());

  const [mainImage, setMainImage] = useState<string | null>(null);
  const [additionalImages, setAdditionalImages] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [compareAtPrice, setCompareAtPrice] = useState('');
  const [cost, setCost] = useState('');
  const [sku, setSku] = useState('');
  const [sizes, setSizes] = useState<string[]>([]);
  const [colors, setColors] = useState<ColorOption[]>([]);
  const [stockQuantity, setStockQuantity] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('3');
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tagsInput, setTagsInput] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [productSlug, setProductSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingSaveMode, setPendingSaveMode] = useState<SaveMode | null>(null);
  const [isImagesUploading, setIsImagesUploading] = useState(false);
  const [saveSucceeded, setSaveSucceeded] = useState(false);

  const profitInfo = useMemo(() => {
    const p = parseFloat(price.replace(/,/g, ''));
    const c = cost ? parseFloat(cost.replace(/,/g, '')) : undefined;
    if (isNaN(p)) return null;
    return computeProfit(p, c);
  }, [price, cost]);

  useEffect(() => {
    if (!slugTouched && name.trim()) {
      setProductSlug(slugifyProductName(name));
    }
  }, [name, slugTouched]);

  useEffect(() => {
    if (colors.length === 0 && sizes.length === 0) {
      setVariants([]);
      return;
    }
    setVariants((prev) => {
      const next: ProductVariant[] = [];
      if (colors.length > 0 && sizes.length > 0) {
        colors.forEach((color) =>
          sizes.forEach((size) => {
            const ex = prev.find((v) => v.color === color.value && v.size === size);
            next.push({ color: color.value, size, quantity: ex?.quantity || 0 });
          })
        );
      } else if (colors.length > 0) {
        colors.forEach((color) => {
          const ex = prev.find((v) => v.color === color.value && !v.size);
          next.push({ color: color.value, quantity: ex?.quantity || 0 });
        });
      } else {
        sizes.forEach((size) => {
          const ex = prev.find((v) => v.size === size && !v.color);
          next.push({ size, quantity: ex?.quantity || 0 });
        });
      }
      return next;
    });
  }, [colors, sizes]);

  const totalVariantStock = useMemo(
    () => variants.reduce((sum, v) => sum + (v.quantity || 0), 0),
    [variants]
  );

  useEffect(() => {
    if (variants.length > 0) setStockQuantity(String(totalVariantStock));
  }, [totalVariantStock, variants.length]);

  const loadCategories = useCallback(async () => {
    try {
      const rows = await getCategories();
      setCategories(rows);
    } catch {
      /* fallback */
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const validateField = useCallback((field: string, value: string) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (field === 'name' && !value.trim()) next.name = 'اسم المنتج مطلوب';
      else if (field === 'name') delete next.name;
      if (field === 'price' && (!value || !isValidPrice(value))) next.price = 'سعر صحيح مطلوب';
      else if (field === 'price') delete next.price;
      return next;
    });
  }, []);

  const progressSteps = useMemo(
    () => [
      { label: 'الصور', completed: !!mainImage, required: true },
      { label: 'الاسم', completed: !!name.trim(), required: true },
      { label: 'الفئة', completed: !!category, required: true },
      { label: 'السعر', completed: !!price && isValidPrice(price), required: true },
      { label: 'المخزون', completed: !!stockQuantity, required: false },
      { label: 'المتغيرات', completed: colors.length > 0 || sizes.length > 0, required: false },
    ],
    [mainImage, name, category, price, stockQuantity, colors, sizes]
  );

  const completionPercentage = useMemo(() => {
    const required = progressSteps.filter((s) => s.required !== false);
    return Math.round((required.filter((s) => s.completed).length / required.length) * 100);
  }, [progressSteps]);

  const handleImagesChange = (newMain: string | null, newAdditional: string[]) => {
    setMainImage(newMain);
    setAdditionalImages(newAdditional);
    if (newMain) setFieldErrors((p) => { const n = { ...p }; delete n.image; return n; });
  };

  const handlePriceChange = (v: string) => {
    const f = formatPriceInput(v);
    setPrice(f);
    validateField('price', f);
  };

  const handleCompareAtChange = (v: string) => setCompareAtPrice(formatPriceInput(v));
  const handleCostChange = (v: string) => setCost(formatPriceInput(v));
  const handleStockChange = (v: string) =>
    setStockQuantity(convertArabicToEnglish(v).replace(/[^\d]/g, ''));

  const handleVariantQuantityChange = (index: number, rawValue: string) => {
    const quantity = parseInt(convertArabicToEnglish(rawValue).replace(/[^\d]/g, '')) || 0;
    setVariants((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], quantity };
      return updated;
    });
  };

  const scrollToFirstError = (errors: Record<string, string>) => {
    const order = ['image', 'name', 'category', 'price'];
    const first = order.find((k) => errors[k]);
    if (!first) return;
    document.getElementById(first === 'image' ? 'product-media' : first)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const saveProduct = async (publish: boolean) => {
    if (submitLockRef.current || isSubmitting || saveSucceeded) return;

    const userId = await getAuthenticatedUserId();
    if (!userId) {
      toast({ title: 'خطأ', description: 'يجب تسجيل الدخول أولاً', variant: 'destructive' });
      return;
    }

    const errors: Record<string, string> = {};
    if (!mainImage) errors.image = 'أضف صورة رئيسية للمنتج';
    if (!name.trim()) errors.name = 'اسم المنتج مطلوب';
    if (!category) errors.category = categories.length === 0 ? 'أنشئ فئة أولاً' : 'اختر فئة';
    if (!price || !isValidPrice(price)) errors.price = 'أدخل سعراً صحيحاً';

    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      scrollToFirstError(errors);
      toast({ title: 'أكمل الحقول المطلوبة', variant: 'destructive' });
      return;
    }

    if (isImagesUploading) {
      toast({ title: 'انتظر اكتمال رفع الصور', description: 'جاري رفع الصور — لا يمكن الحفظ الآن', variant: 'destructive' });
      return;
    }

    const imageValidation = await validateProductImages(mainImage, additionalImages);
    if (imageValidation.hasBlobUrls || !imageValidation.valid) {
      toast({
        title: 'خطأ في الصور',
        description: imageValidation.hasBlobUrls
          ? 'انتظر اكتمال رفع الصور ثم اضغط حفظ'
          : 'أضف صورة رئيسية للمنتج',
        variant: 'destructive',
      });
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    setPendingSaveMode(publish ? 'publish' : 'draft');

    try {
      const numericPrice = parseFloat(price.replace(/,/g, ''));
      const numericCost = cost ? parseFloat(cost.replace(/,/g, '')) : undefined;
      const numericCompare = compareAtPrice ? parseFloat(compareAtPrice.replace(/,/g, '')) : undefined;
      const originalPrice =
        numericCompare && numericCompare > numericPrice ? numericCompare : undefined;

      const newProduct: Product = {
        id: '',
        name: name.trim(),
        description: description.trim(),
        shortDescription: shortDescription.trim() || undefined,
        category,
        price: numericPrice,
        cost: numericCost,
        originalPrice,
        image: mainImage!,
        additionalImages,
        sizes: sizes.length > 0 ? sizes : undefined,
        colors: colors.length > 0 ? colors : undefined,
        stockQuantity: stockQuantity ? parseInt(stockQuantity, 10) : undefined,
        variants: variants.length > 0 ? variants : undefined,
        sku: sku.trim() || undefined,
        seoTitle: seoTitle.trim() || name.trim(),
        seoDescription: seoDescription.trim() || shortDescription.trim() || description.trim().slice(0, 160),
        productSlug: productSlug.trim() || slugifyProductName(name),
        tags: parseTagsInput(tagsInput),
        lowStockThreshold: parseInt(lowStockThreshold) || 3,
        isActive: publish,
      };

      const result = await addProduct(newProduct, { idempotencyKey: idempotencyKeyRef.current });

      if (result.success) {
        setSaveSucceeded(true);

        const stockMsg = newProduct.stockQuantity ? ` · المخزون: ${newProduct.stockQuantity}` : '';
        const saveMode: SaveMode = publish ? 'publish' : 'draft';
        if (publish) {
          sonnerToast.success(PRODUCT_SAVE_TOAST.publishSuccess, {
            description: `"${newProduct.name}" متاح الآن في متجرك${stockMsg}`,
            duration: 5000,
          });
        } else {
          sonnerToast.success(PRODUCT_SAVE_TOAST.draftSuccess, {
            description: `"${newProduct.name}" يظهر في إدارة المنتجات والمخزون${stockMsg}`,
            duration: 5000,
          });
        }

        navigate('/products', {
          replace: true,
          state: { refreshProducts: true, createdProductId: result.productId, saveMode },
        });
        return;
      }

      idempotencyKeyRef.current = createProductIdempotencyKey();
      const message = result.error || 'فشل في إضافة المنتج';
      toast({ title: 'لم يتم الحفظ', description: message, variant: 'destructive' });
      sonnerToast.error(message);
    } catch (err) {
      idempotencyKeyRef.current = createProductIdempotencyKey();
      console.error('[addProduct] submit failed:', err);
      const message = err instanceof Error ? err.message : 'فشل في إضافة المنتج';
      toast({ title: 'لم يتم الحفظ', description: message, variant: 'destructive' });
      sonnerToast.error(message);
    } finally {
      setIsSubmitting(false);
      setPendingSaveMode(null);
      submitLockRef.current = false;
    }
  };

  const handleSaveDraft = () => saveProduct(false);
  const handleSaveAndPublish = () => saveProduct(true);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
  };

  const isSaveDisabled = isSubmitting || isImagesUploading || saveSucceeded;

  return {
    state: {
      mainImage,
      additionalImages,
      name,
      description,
      shortDescription,
      category,
      price,
      compareAtPrice,
      cost,
      sku,
      sizes,
      colors,
      stockQuantity,
      lowStockThreshold,
      variants,
      categories,
      tagsInput,
      seoTitle,
      seoDescription,
      productSlug,
      fieldErrors,
      isSubmitting,
      pendingSaveMode,
      isImagesUploading,
      isSaveDisabled,
      saveSucceeded,
      profitInfo,
      progressSteps,
      completionPercentage,
      totalVariantStock,
    },
    actions: {
      setName,
      setDescription,
      setShortDescription,
      setCategory,
      setSku,
      setSizes,
      setColors,
      setLowStockThreshold,
      setTagsInput,
      setSeoTitle,
      setSeoDescription,
      setProductSlug,
      setSlugTouched,
      handleImagesChange,
      handlePriceChange,
      handleCompareAtChange,
      handleCostChange,
      handleStockChange,
      handleVariantQuantityChange,
      validateField,
      loadCategories,
      setImagesUploading: setIsImagesUploading,
      handleSubmit,
      handleSaveDraft,
      handleSaveAndPublish,
      formatDisplayPrice,
    },
  };
}
