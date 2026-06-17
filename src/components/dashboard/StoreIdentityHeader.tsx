import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, PencilLine, Sparkles, Store } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useStore } from '@/context/StoreContext';
import { getAuthenticatedUserId } from '@/lib/authSession';
import { uploadImage } from '@/utils/imageUpload';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const StoreIdentityHeader = () => {
  const { storeName, storeLogo, storeGovernorate, updateStore } = useStore();
  const [nameDraft, setNameDraft] = useState(storeName || 'متجري');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNameDraft(storeName || 'متجري');
  }, [storeName]);

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const userId = await getAuthenticatedUserId();
    if (!userId) {
      toast.error('يجب تسجيل الدخول أولاً');
      return;
    }

    setUploadingLogo(true);
    try {
      const publicUrl = await uploadImage(file, userId);
      await updateStore(publicUrl, nameDraft.trim() || storeName || 'متجري', storeGovernorate);
      toast.success('تم تحديث شعار المتجر');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'فشل في رفع الشعار');
    } finally {
      setUploadingLogo(false);
      event.target.value = '';
    }
  };

  const saveStoreName = async () => {
    const trimmed = nameDraft.trim() || 'متجري';
    setNameDraft(trimmed);
    if (trimmed === (storeName || 'متجري')) return;

    setSavingName(true);
    try {
      await updateStore(storeLogo, trimmed, storeGovernorate);
      toast.success('تم حفظ اسم المتجر');
    } catch {
      toast.error('فشل في حفظ اسم المتجر');
      setNameDraft(storeName || 'متجري');
    } finally {
      setSavingName(false);
    }
  };

  const handleNameKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    }
  };

  return (
    <div className="flex items-center gap-4 flex-1 min-w-0">
      <div className="flex flex-col items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingLogo}
          title="اضغط لتغيير شعار المتجر"
          className={cn(
            'relative w-14 h-14 rounded-2xl overflow-hidden',
            'flex items-center justify-center',
            'group transition-all duration-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25',
            storeLogo
              ? 'border border-border/50 shadow-sm hover:border-primary/30'
              : cn(
                  'bg-primary/5 border-2 border-dashed border-primary/25',
                  'hover:border-primary/45 hover:bg-primary/8'
                )
          )}
          aria-label="تغيير شعار المتجر"
        >
          {storeLogo ? (
            <img
              src={storeLogo}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <Store className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
          )}

          <div
            className={cn(
              'absolute inset-0 flex items-center justify-center rounded-2xl transition-opacity duration-200',
              storeLogo ? 'bg-foreground/40' : 'bg-foreground/45',
              uploadingLogo ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            )}
          >
            {uploadingLogo ? (
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            ) : (
              <Camera className="w-5 h-5 text-white" />
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={handleLogoUpload}
          />
        </button>
        <span className="text-[10px] font-medium text-primary/80">تغيير الشعار</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="inline-flex items-center gap-1.5 text-xs text-primary font-medium mb-1">
          <Sparkles className="w-3.5 h-3.5" />
          لوحة التحكم
        </div>

        <div
          className={cn(
            'group/name relative flex items-center gap-2 max-w-full',
            'rounded-lg border border-dashed border-border/70 bg-muted/15 px-2.5 py-1.5',
            'transition-colors hover:border-primary/35 hover:bg-muted/25',
            'focus-within:border-primary/40 focus-within:bg-muted/25'
          )}
        >
          <PencilLine
            className="w-3.5 h-3.5 shrink-0 text-primary/70 group-hover/name:text-primary group-focus-within/name:text-primary"
            aria-hidden
          />
          <Input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => void saveStoreName()}
            onKeyDown={handleNameKeyDown}
            disabled={savingName}
            placeholder="اسم متجرك"
            title="اضغط لتعديل اسم المتجر"
            className={cn(
              'h-auto min-w-0 flex-1 border-0 bg-transparent shadow-none px-0 py-0',
              'text-xl sm:text-2xl font-semibold text-foreground tracking-tight',
              'focus-visible:ring-0 rounded-none',
              'placeholder:text-muted-foreground/60 placeholder:font-normal'
            )}
            aria-label="اسم المتجر — قابل للتعديل"
          />
          {savingName && (
            <Loader2 className="w-4 h-4 shrink-0 animate-spin text-muted-foreground" />
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
          <PencilLine className="w-3 h-3 text-primary/60" />
          اضغط على الاسم أو الشعار للتعديل
        </p>
      </div>
    </div>
  );
};

export default StoreIdentityHeader;
