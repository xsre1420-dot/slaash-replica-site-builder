import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ImagePlus, Plus, X } from 'lucide-react';
import { ColorOption } from '@/types';
import { cn } from '@/lib/utils';

interface ColorSwatchPickerProps {
  colors: ColorOption[];
  onColorsChange: (colors: ColorOption[]) => void;
}

const slugColorValue = (name: string, index: number) => {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u0600-\u06FF-]/g, '');
  return slug || `color-${index + 1}`;
};

const ColorSwatchPicker = ({ colors, onColorsChange }: ColorSwatchPickerProps) => {
  const [draftName, setDraftName] = useState('');
  const [draftImage, setDraftImage] = useState<string | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetDraft = () => {
    setDraftName('');
    setDraftImage(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const readImageFile = (file: File, onDone: (dataUrl: string) => void) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') onDone(result);
    };
    reader.readAsDataURL(file);
  };

  const addColor = () => {
    const name = draftName.trim();
    if (!name) return;

    const value = slugColorValue(name, colors.length);
    const newColor: ColorOption = {
      name,
      value: colors.some((c) => c.value === value) ? `${value}-${colors.length + 1}` : value,
      image: draftImage,
    };
    onColorsChange([...colors, newColor]);
    resetDraft();
  };

  const updateColor = (index: number, patch: Partial<ColorOption>) => {
    const next = [...colors];
    next[index] = { ...next[index], ...patch };
    onColorsChange(next);
  };

  const removeColor = (index: number) => {
    onColorsChange(colors.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <Label className="text-right block font-medium text-foreground">الألوان المتاحة</Label>
      <p className="text-xs text-muted-foreground text-right leading-relaxed">
        أضف اسم اللون وصورة المنتج بهذا اللون — ستظهر للعميل بدون أكواد ألوان.
      </p>

      {colors.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {colors.map((color, index) => (
            <div
              key={`${color.value}-${index}`}
              className="relative rounded-xl border border-border bg-card p-2.5 space-y-2"
            >
              <button
                type="button"
                onClick={() => removeColor(index)}
                className="absolute top-2 left-2 z-10 rounded-full bg-background/90 p-1 text-muted-foreground hover:text-destructive transition-colors"
                aria-label="حذف اللون"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              <label className="block cursor-pointer group">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    readImageFile(file, (dataUrl) => updateColor(index, { image: dataUrl }));
                  }}
                />
                <div className="aspect-square rounded-lg overflow-hidden border border-border/60 bg-muted/30">
                  {color.image ? (
                    <img src={color.image} alt={color.name || 'لون'} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
                      <ImagePlus className="w-5 h-5" />
                      <span className="text-[10px]">أضف صورة</span>
                    </div>
                  )}
                </div>
              </label>

              <Input
                value={color.name ?? ''}
                onChange={(e) => updateColor(index, { name: e.target.value })}
                placeholder="اسم اللون"
                className="h-9 text-sm text-right rounded-lg"
              />
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-3 space-y-3">
        <p className="text-xs font-medium text-foreground text-right">إضافة لون جديد</p>

        <label className="block cursor-pointer">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              readImageFile(file, setDraftImage);
            }}
          />
          <div
            className={cn(
              'aspect-[4/3] max-h-36 rounded-xl overflow-hidden border-2 border-dashed border-border/60 bg-background flex flex-col items-center justify-center gap-2 transition-colors hover:border-primary/40 hover:bg-primary/5',
              draftImage && 'border-solid border-primary/30 p-0'
            )}
          >
            {draftImage ? (
              <img src={draftImage} alt="" className="w-full h-full object-cover" />
            ) : (
              <>
                <ImagePlus className="w-6 h-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">صورة المنتج بهذا اللون</span>
              </>
            )}
          </div>
        </label>

        <Input
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          placeholder="مثال: أحمر، أسود، بيج…"
          className="h-10 text-right rounded-xl"
          dir="rtl"
        />

        <Button
          type="button"
          onClick={addColor}
          disabled={!draftName.trim()}
          variant="outline"
          className="w-full rounded-xl gap-2"
        >
          <Plus className="w-4 h-4" />
          إضافة اللون
        </Button>
      </div>
    </div>
  );
};

export default ColorSwatchPicker;
