import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus,
  Save,
  Image,
  Type,
  DollarSign,
  Package,
  Palette,
  Search,
  Tag,
  Loader2,
  Eye,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import ProductImagesManager from '@/components/ProductImagesManager';
import SizesManager from '@/components/SizesManager';
import ColorSwatchPicker from '@/components/ColorSwatchPicker';
import CategoryDialog from '@/components/CategoryDialog';
import ProductFormProgress from '@/components/add-product/ProductFormProgress';
import ProductPreviewCard from '@/components/add-product/ProductPreviewCard';
import ProductFormSection from '@/components/add-product/ProductFormSection';
import { useAddProductForm } from '@/hooks/useAddProductForm';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const AddProduct = () => {
  const { state, actions } = useAddProductForm();
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);

  return (
    <DashboardLayout>
      <PageHeader
        title="إضافة منتج"
        description="4 حقول مطلوبة: صورة، اسم، فئة، سعر — الباقي يحسّن تجربة البيع"
        backTo="/products"
        backLabel="المنتجات"
        breadcrumbs={[{ label: 'المنتجات', href: '/products' }, { label: 'إضافة منتج' }]}
        actions={
          <div className="flex flex-wrap gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={state.isSaveDisabled}
              onClick={actions.handleSaveDraft}
              className="rounded-xl gap-1.5 min-h-[44px]"
            >
              {state.isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {state.isSubmitting ? 'جاري الحفظ…' : 'حفظ فقط'}
            </Button>
            <Button
              type="button"
              disabled={state.isSaveDisabled}
              onClick={actions.handleSaveAndPublish}
              className="rounded-xl gap-1.5 min-h-[44px] shadow-brand"
            >
              {state.isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
              {state.isSubmitting ? 'جاري الحفظ…' : 'حفظ ونشر'}
            </Button>
          </div>
        }
      />

      <div className="ds-page max-w-6xl pb-28 lg:pb-8">
        <form id="add-product-form" onSubmit={actions.handleSubmit} className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Main column — Shopify order */}
          <div className="space-y-5 min-w-0">
            {/* Title first (Shopify pattern) */}
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
              description="الصورة الأولى تظهر في المتجر والبحث"
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
              description="ساعد العميل على فهم المنتج"
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

            <ProductFormSection
              id="price"
              icon={<DollarSign className="w-4 h-4" />}
              title="التسعير"
            >
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
                <div className="mt-4 rounded-xl bg-success/10 border border-success/20 p-3 flex items-center justify-between text-sm">
                  <span className="font-bold text-success">{state.profitInfo.margin}% هامش</span>
                  <span className="text-muted-foreground">
                    ربح تقديري: <strong className="text-foreground">{state.profitInfo.profit.toLocaleString()} د.ع</strong>
                  </span>
                </div>
              )}
            </ProductFormSection>

            <ProductFormSection
              icon={<Package className="w-4 h-4" />}
              title="المخزون"
              optional
              defaultOpen={false}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sku" className="text-right block mb-1.5 text-sm">SKU / رمز المنتج</Label>
                  <Input id="sku" value={state.sku} onChange={(e) => actions.setSku(e.target.value)} className="text-right rounded-xl font-mono" dir="ltr" placeholder="SKU-001" />
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
              defaultOpen={false}
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

            <ProductFormSection
              icon={<Search className="w-4 h-4" />}
              title="تحسين محركات البحث (SEO)"
              optional
              defaultOpen={false}
            >
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

          {/* Sidebar */}
          <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
            <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-2">
              <h3 className="font-bold text-foreground text-right">حالة النشر</h3>
              <p className="text-xs text-muted-foreground text-right leading-relaxed">
                <strong className="text-foreground">حفظ فقط:</strong> مسودة مخفية عن الزبائن.
                <br />
                <strong className="text-foreground">حفظ ونشر:</strong> يظهر فوراً في متجرك.
              </p>
            </section>

            <section id="category" className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 justify-end">
                <h3 className="font-bold text-foreground">التصنيف</h3>
                <Tag className="w-4 h-4 text-primary" />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="icon" className="rounded-xl shrink-0" onClick={() => setIsCategoryDialogOpen(true)} aria-label="فئة جديدة">
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
                <Label className="text-right block mb-1.5 text-sm text-muted-foreground">الوسوم</Label>
                <Input
                  value={state.tagsInput}
                  onChange={(e) => actions.setTagsInput(e.target.value)}
                  placeholder="صيف، هدايا، الأكثر مبيعاً"
                  className="text-right rounded-xl text-sm"
                />
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
              isActive={true}
              profitMargin={state.profitInfo?.margin ?? null}
            />
          </div>
        </form>

        {/* Mobile sticky save */}
        <div className="fixed bottom-0 inset-x-0 p-3 bg-card/95 backdrop-blur border-t border-border lg:hidden z-40 safe-area-bottom">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={state.isSaveDisabled}
              onClick={actions.handleSaveDraft}
              className="flex-1 rounded-xl h-12 font-bold gap-2"
            >
              {state.isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {state.isSubmitting ? 'جاري…' : 'حفظ فقط'}
            </Button>
            <Button
              type="button"
              disabled={state.isSaveDisabled}
              onClick={actions.handleSaveAndPublish}
              className="flex-1 rounded-xl h-12 font-bold gap-2 shadow-brand"
            >
              {state.isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              {state.isSubmitting ? 'جاري…' : 'حفظ ونشر'}
            </Button>
          </div>
        </div>
      </div>

      <CategoryDialog
        categories={state.categories}
        onCategoryChange={actions.loadCategories}
        onAddLocalCategory={() => void actions.loadCategories()}
        open={isCategoryDialogOpen}
        onOpenChange={setIsCategoryDialogOpen}
      />
    </DashboardLayout>
  );
};

export default AddProduct;
