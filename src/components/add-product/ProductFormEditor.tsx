import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Image, Type, DollarSign, Package, Palette, Search, Tag } from 'lucide-react';
import ProductImagesManager from '@/components/ProductImagesManager';
import SizesManager from '@/components/SizesManager';
import ColorSwatchPicker from '@/components/ColorSwatchPicker';
import ProductFormProgress from '@/components/add-product/ProductFormProgress';
import ProductPreviewCard from '@/components/add-product/ProductPreviewCard';
import ProductFormSection from '@/components/add-product/ProductFormSection';
import { PRODUCT_SAVE_LABELS } from '@/lib/productFormLabels';
import { cn } from '@/lib/utils';
import type { Category, ColorOption, ProductVariant } from '@/types';

export interface ProductFormState {
  mainImage: string | null;
  additionalImages: string[];
  name: string;
  description: string;
  shortDescription: string;
  category: string;
  price: string;
  compareAtPrice: string;
  cost: string;
  sku: string;
  sizes: string[];
  colors: ColorOption[];
  stockQuantity: string;
  lowStockThreshold: string;
  variants: ProductVariant[];
  categories: Category[];
  tagsInput: string;
  seoTitle: string;
  seoDescription: string;
  productSlug: string;
  fieldErrors: Record<string, string>;
  isSubmitting: boolean;
  pendingSaveMode: import('@/lib/productFormLabels').ProductSaveMode | null;
  isImagesUploading: boolean;
  isSaveDisabled: boolean;
  profitInfo: { profit: number; margin: number } | null;
  progressSteps: { label: string; completed: boolean; required?: boolean }[];
  completionPercentage: number;
  totalVariantStock: number;
  isActive?: boolean;
}

export interface ProductFormActions {
  setName: (v: string) => void;
  setDescription: (v: string) => void;
  setShortDescription: (v: string) => void;
  setCategory: (v: string) => void;
  setSku: (v: string) => void;
  setSizes: (v: string[]) => void;
  setColors: (v: ColorOption[]) => void;
  setLowStockThreshold: (v: string) => void;
  setTagsInput: (v: string) => void;
  setSeoTitle: (v: string) => void;
  setSeoDescription: (v: string) => void;
  setProductSlug: (v: string) => void;
  setSlugTouched: (v: boolean) => void;
  handleImagesChange: (main: string | null, additional: string[]) => void;
  handlePriceChange: (v: string) => void;
  handleCompareAtChange: (v: string) => void;
  handleCostChange: (v: string) => void;
  handleStockChange: (v: string) => void;
  handleVariantQuantityChange: (index: number, raw: string) => void;
  validateField: (field: string, value: string) => void;
  loadCategories: () => Promise<void>;
  setImagesUploading: (v: boolean) => void;
  handleSubmit: (e?: React.FormEvent) => void;
  handleSaveDraft: () => void;
  handleSaveAndPublish: () => void;
  formatDisplayPrice: (p: string) => string;
}

interface ProductFormEditorProps {
  formId: string;
  state: ProductFormState;
  actions: ProductFormActions;
  onOpenCategoryDialog: () => void;
  mode?: 'create' | 'edit';
}

const ProductFormEditor = ({
  formId,
  state,
  actions,
  onOpenCategoryDialog,
  mode = 'create',
}: ProductFormEditorProps) => {
  const previewActive = mode === 'edit' ? state.isActive !== false : true;

  return (
    <form id={formId} onSubmit={actions.handleSubmit} className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-5 min-w-0">
        <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
          <Label htmlFor="name" className="text-sm font-bold text-foreground block text-right mb-2">
            عنوان المنتج <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            value={state.name}
            onChange={(e) => {
              actions.setName(e.target.value);
              actions.validateField('name', e.target.value);
            }}
            placeholder="مثال: ساعة ذكية — أسود"
            className={cn('text-right text-lg font-semibold h-12 rounded-xl', state.fieldErrors.name && 'border-destructive')}
            aria-invalid={!!state.fieldErrors.name}
          />
          {state.fieldErrors.name && (
            <p className="text-destructive text-xs mt-1.5 text-right">{state.fieldErrors.name}</p>
          )}
        </section>

        <ProductFormSection
          id="product-media"
          icon={<Image className="w-4 h-4" />}
          title="الوسائط"
          description="الصورة الأولى تظهر في المتجر — اسحب لإعادة الترتيب"
        >
          <ProductImagesManager
            mainImage={state.mainImage}
            additionalImages={state.additionalImages}
            onImagesChange={actions.handleImagesChange}
            onUploadStateChange={actions.setImagesUploading}
          />
          {state.fieldErrors.image && (
            <p className="text-destructive text-xs text-right">{state.fieldErrors.image}</p>
          )}
        </ProductFormSection>

        <ProductFormSection
          icon={<Type className="w-4 h-4" />}
          title="الوصف"
          description="وصف مختصر للبطاقة + تفاصيل كاملة"
        >
          <div className="space-y-4">
            <div>
              <Label htmlFor="shortDescription" className="text-right block mb-1.5 text-sm">وصف مختصر</Label>
              <Input
                id="shortDescription"
                value={state.shortDescription}
                onChange={(e) => actions.setShortDescription(e.target.value)}
                placeholder="سطر واحد يظهر في بطاقة المنتج"
                className="text-right rounded-xl"
                maxLength={160}
              />
              <p className="text-[11px] text-muted-foreground mt-1 text-right">{state.shortDescription.length}/160</p>
            </div>
            <div>
              <Label htmlFor="description" className="text-right block mb-1.5 text-sm">الوصف التفصيلي</Label>
              <Textarea
                id="description"
                value={state.description}
                onChange={(e) => actions.setDescription(e.target.value)}
                placeholder="المواصفات، المواد، طريقة الاستخدام…"
                className="text-right rounded-xl min-h-[140px] resize-y"
              />
            </div>
          </div>
        </ProductFormSection>

        <ProductFormSection id="price" icon={<DollarSign className="w-4 h-4" />} title="التسعير">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="price-input" className="text-right block mb-1.5 text-sm">
                سعر البيع (د.ع) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="price-input"
                inputMode="numeric"
                value={actions.formatDisplayPrice(state.price)}
                onChange={(e) => actions.handlePriceChange(e.target.value)}
                placeholder="25,000"
                className={cn('text-right rounded-xl text-lg font-semibold', state.fieldErrors.price && 'border-destructive')}
              />
              {state.fieldErrors.price && (
                <p className="text-destructive text-xs mt-1 text-right">{state.fieldErrors.price}</p>
              )}
            </div>
            <div>
              <Label htmlFor="compareAt" className="text-right block mb-1.5 text-sm">سعر قبل الخصم (اختياري)</Label>
              <Input
                id="compareAt"
                inputMode="numeric"
                value={actions.formatDisplayPrice(state.compareAtPrice)}
                onChange={(e) => actions.handleCompareAtChange(e.target.value)}
                placeholder="30,000"
                className="text-right rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="cost" className="text-right block mb-1.5 text-sm">التكلفة (د.ع)</Label>
              <Input
                id="cost"
                inputMode="numeric"
                value={actions.formatDisplayPrice(state.cost)}
                onChange={(e) => actions.handleCostChange(e.target.value)}
                placeholder="15,000"
                className="text-right rounded-xl"
              />
            </div>
          </div>
          {state.profitInfo && (
            <div
              className={cn(
                'mt-4 rounded-xl p-3 flex items-center justify-between text-sm border',
                state.profitInfo.profit < 0
                  ? 'bg-destructive/10 border-destructive/25'
                  : 'bg-success/10 border-success/20'
              )}
            >
              <span
                className={cn(
                  'font-bold tabular-nums',
                  state.profitInfo.profit < 0 ? 'text-destructive' : 'text-success'
                )}
              >
                {state.profitInfo.margin}% هامش
                {state.profitInfo.profit < 0 && ' — خسارة'}
              </span>
              <span className="text-muted-foreground">
                {state.profitInfo.profit < 0 ? 'خسارة تقديرية:' : 'ربح تقديري:'}{' '}
                <strong
                  className={cn(
                    'tabular-nums',
                    state.profitInfo.profit < 0 ? 'text-destructive' : 'text-foreground'
                  )}
                >
                  {state.profitInfo.profit.toLocaleString()} د.ع
                </strong>
              </span>
            </div>
          )}
        </ProductFormSection>

        <ProductFormSection icon={<Package className="w-4 h-4" />} title="المخزون" optional defaultOpen={mode === 'edit'}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sku" className="text-right block mb-1.5 text-sm">SKU / رمز المنتج</Label>
              <Input
                id="sku"
                value={state.sku}
                onChange={(e) => actions.setSku(e.target.value)}
                className="text-right rounded-xl font-mono"
                dir="ltr"
                placeholder="SKU-001"
              />
            </div>
            <div>
              <Label htmlFor="stockQuantity" className="text-right block mb-1.5 text-sm">الكمية المتاحة</Label>
              <Input
                id="stockQuantity"
                inputMode="numeric"
                value={state.stockQuantity}
                onChange={(e) => actions.handleStockChange(e.target.value)}
                disabled={state.variants.length > 0}
                className="text-right rounded-xl"
                placeholder="0"
              />
              {state.variants.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1 text-right">محسوبة من المتغيرات: {state.totalVariantStock}</p>
              )}
            </div>
            <div>
              <Label htmlFor="lowStock" className="text-right block mb-1.5 text-sm">تنبيه مخزون منخفض عند</Label>
              <Input
                id="lowStock"
                inputMode="numeric"
                value={state.lowStockThreshold}
                onChange={(e) => actions.setLowStockThreshold(e.target.value.replace(/\D/g, ''))}
                className="text-right rounded-xl w-24"
              />
            </div>
          </div>
        </ProductFormSection>

        <ProductFormSection
          icon={<Palette className="w-4 h-4" />}
          title="الخيارات والمتغيرات"
          description="مقاسات، ألوان، وكميات لكل تركيبة"
          optional
          defaultOpen={mode === 'edit' && (state.sizes.length > 0 || state.colors.length > 0)}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border/50 p-4 bg-muted/20">
              <SizesManager sizes={state.sizes} onSizesChange={actions.setSizes} />
            </div>
            <div className="rounded-xl border border-border/50 p-4 bg-muted/20">
              <ColorSwatchPicker colors={state.colors} onColorsChange={actions.setColors} />
            </div>
          </div>
          {state.variants.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
              {state.variants.map((variant, index) => (
                <div key={index} className="p-3 border border-border rounded-xl bg-card text-center space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    {variant.color && (
                      <span className="w-5 h-5 rounded-full border" style={{ backgroundColor: variant.color }} />
                    )}
                    <span className="text-sm font-medium">{variant.size || '—'}</span>
                  </div>
                  <Input
                    inputMode="numeric"
                    value={variant.quantity || ''}
                    onChange={(e) => actions.handleVariantQuantityChange(index, e.target.value)}
                    className="text-center h-9 rounded-lg"
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          )}
        </ProductFormSection>

        <ProductFormSection icon={<Search className="w-4 h-4" />} title="تحسين محركات البحث (SEO)" optional defaultOpen={false}>
          <div className="space-y-4">
            <div>
              <Label className="text-right block mb-1.5 text-sm">عنوان SEO</Label>
              <Input
                value={state.seoTitle}
                onChange={(e) => actions.setSeoTitle(e.target.value)}
                placeholder={state.name || 'يُستخدم اسم المنتج إن تُرك فارغاً'}
                className="text-right rounded-xl"
              />
            </div>
            <div>
              <Label className="text-right block mb-1.5 text-sm">وصف SEO</Label>
              <Textarea
                value={state.seoDescription}
                onChange={(e) => actions.setSeoDescription(e.target.value)}
                placeholder="يظهر في نتائج Google — 150–160 حرف"
                className="text-right rounded-xl min-h-[80px]"
                maxLength={320}
              />
              <p className="text-[11px] text-muted-foreground mt-1 text-right">{state.seoDescription.length}/320</p>
            </div>
            <div>
              <Label className="text-right block mb-1.5 text-sm">رابط المنتج (slug)</Label>
              <Input
                value={state.productSlug}
                onChange={(e) => {
                  actions.setSlugTouched(true);
                  actions.setProductSlug(e.target.value);
                }}
                className="text-right rounded-xl font-mono text-sm"
                dir="ltr"
                placeholder="product-name"
              />
            </div>
          </div>
        </ProductFormSection>
      </div>

      <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
        <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-2">
          <h3 className="font-bold text-foreground text-right">حالة النشر</h3>
          {mode === 'edit' && (
            <p className="text-xs font-medium text-right">
              الحالة الحالية:{' '}
              <span className={state.isActive !== false ? 'text-success' : 'text-muted-foreground'}>
                {state.isActive !== false ? 'منشور في المتجر' : 'مسودة — مخفي عن العملاء'}
              </span>
            </p>
          )}
          <p className="text-xs text-muted-foreground text-right leading-relaxed">
            <strong className="text-foreground">{PRODUCT_SAVE_LABELS.saveDraft}:</strong> مسودة مخفية عن المتجر.
            <br />
            <strong className="text-foreground">{PRODUCT_SAVE_LABELS.saveAndPublish}:</strong> يظهر فوراً في متجرك.
          </p>
        </section>

        <section id="category" className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2 justify-end">
            <h3 className="font-bold text-foreground">التصنيف</h3>
            <Tag className="w-4 h-4 text-primary" />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="icon" className="rounded-xl shrink-0" onClick={onOpenCategoryDialog} aria-label="فئة جديدة">
              <Plus className="w-4 h-4" />
            </Button>
            <Select value={state.category} onValueChange={(v) => actions.setCategory(v)}>
              <SelectTrigger className={cn('rounded-xl text-right flex-1', state.fieldErrors.category && 'border-destructive')}>
                <SelectValue placeholder="اختر فئة *" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {state.categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {state.fieldErrors.category && (
            <p className="text-destructive text-xs text-right">{state.fieldErrors.category}</p>
          )}
          <div>
            <Label className="text-right block mb-1.5 text-sm">كلمات مفتاحية للمنتج</Label>
            <Input
              value={state.tagsInput}
              onChange={(e) => actions.setTagsInput(e.target.value)}
              placeholder="صيف، هدايا، الأكثر مبيعاً"
              className="text-right rounded-xl text-sm"
            />
            <p className="text-xs text-muted-foreground text-right mt-1.5 leading-relaxed">
              اكتب كلمات تصف منتجك (مثل الموسم أو الاستخدام). تظهر للعملاء أعلى صورة المنتج
              وتساعدهم على فهم المنتج بسرعة — افصل بين الكلمات بفاصلة.
            </p>
          </div>
        </section>

        <ProductFormProgress steps={state.progressSteps} completionPercentage={state.completionPercentage} />

        <ProductPreviewCard
          name={state.name}
          price={state.price}
          compareAtPrice={state.compareAtPrice}
          image={state.mainImage}
          category={state.category}
          shortDescription={state.shortDescription}
          isActive={previewActive}
          profitMargin={state.profitInfo?.margin ?? null}
        />
      </div>
    </form>
  );
};

export default ProductFormEditor;
