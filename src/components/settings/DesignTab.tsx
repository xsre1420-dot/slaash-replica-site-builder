import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Palette, Type, Check } from "lucide-react";

interface DesignTabProps {
  settings: {
    menuBackgroundColor: string;
    menuTextColor: string;
    menuAccentColor: string;
    storeFont?: string;
  };
  setSettings: React.Dispatch<React.SetStateAction<any>>;
}

const themePresets = [
  { name: "كلاسيكي", bg: "#ffffff", text: "#333333", accent: "#000000", font: "Tajawal" },
  { name: "أزرق عصري", bg: "#f0f4ff", text: "#1e293b", accent: "#3b82f6", font: "Cairo" },
  { name: "أخضر طبيعي", bg: "#f0fdf4", text: "#1a2e1a", accent: "#22c55e", font: "Tajawal" },
  { name: "برتقالي دافئ", bg: "#fff7ed", text: "#1c1917", accent: "#f97316", font: "Almarai" },
  { name: "وردي أنيق", bg: "#fdf2f8", text: "#1f1f1f", accent: "#ec4899", font: "Cairo" },
  { name: "داكن فاخر", bg: "#1a1a2e", text: "#e0e0e0", accent: "#e94560", font: "Readex Pro" },
  { name: "ذهبي", bg: "#fffdf5", text: "#292524", accent: "#d97706", font: "Noto Kufi Arabic" },
  { name: "بنفسجي", bg: "#faf5ff", text: "#1e1b4b", accent: "#7c3aed", font: "IBM Plex Sans Arabic" },
  { name: "مينت", bg: "#f0fdfa", text: "#134e4a", accent: "#14b8a6", font: "Readex Pro" },
];

const fontOptions = [
  { name: "Tajawal", label: "تجوال", sample: "خط تجوال العربي" },
  { name: "Cairo", label: "القاهرة", sample: "خط القاهرة العربي" },
  { name: "Almarai", label: "المراعي", sample: "خط المراعي العربي" },
  { name: "Noto Kufi Arabic", label: "نوتو كوفي", sample: "خط نوتو كوفي" },
  { name: "IBM Plex Sans Arabic", label: "آي بي إم", sample: "خط آي بي إم" },
  { name: "Readex Pro", label: "ريدكس برو", sample: "خط ريدكس برو" },
];

const DesignTab = ({ settings, setSettings }: DesignTabProps) => {
  const currentFont = settings.storeFont || "Tajawal";

  const applyPreset = (preset: typeof themePresets[0]) => {
    setSettings((prev: any) => ({
      ...prev,
      menuBackgroundColor: preset.bg,
      menuTextColor: preset.text,
      menuAccentColor: preset.accent,
      storeFont: preset.font,
    }));
  };

  const setFont = (font: string) => {
    setSettings((prev: any) => ({ ...prev, storeFont: font }));
  };

  return (
    <div className="space-y-6">
      {/* Theme Presets */}
      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-2 justify-end">
          <h3 className="text-lg font-bold text-foreground">ثيمات جاهزة</h3>
          <Palette className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground text-right">اختر ثيم جاهز أو خصص الألوان يدوياً</p>

        <div className="grid grid-cols-3 gap-2">
          {themePresets.map((preset) => {
            const isActive =
              settings.menuBackgroundColor === preset.bg &&
              settings.menuTextColor === preset.text &&
              settings.menuAccentColor === preset.accent;
            return (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset)}
                className={`relative p-3 rounded-xl border transition-all text-center group ${
                  isActive
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-border hover:border-foreground/30"
                }`}
              >
                {isActive && (
                  <div className="absolute top-1.5 left-1.5 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-primary-foreground" />
                  </div>
                )}
                <div className="flex gap-1 justify-center mb-2">
                  <div className="w-5 h-5 rounded-full border border-border shadow-sm" style={{ backgroundColor: preset.bg }} />
                  <div className="w-5 h-5 rounded-full border border-border shadow-sm" style={{ backgroundColor: preset.text }} />
                  <div className="w-5 h-5 rounded-full border border-border shadow-sm" style={{ backgroundColor: preset.accent }} />
                </div>
                <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">{preset.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Colors */}
      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-2 justify-end">
          <h3 className="text-lg font-bold text-foreground">ألوان مخصصة</h3>
          <Palette className="w-5 h-5 text-muted-foreground" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { key: "menuBackgroundColor", label: "الخلفية", placeholder: "#ffffff" },
            { key: "menuTextColor", label: "النص", placeholder: "#333333" },
            { key: "menuAccentColor", label: "المميز", placeholder: "#000000" },
          ].map((item) => (
            <div key={item.key} className="space-y-2">
              <Label className="text-right block text-foreground font-medium text-sm">{item.label}</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={(settings as any)[item.key]}
                  onChange={(e) => setSettings((prev: any) => ({ ...prev, [item.key]: e.target.value }))}
                  className="w-9 h-9 rounded-lg border border-border cursor-pointer bg-transparent flex-shrink-0"
                />
                <Input
                  value={(settings as any)[item.key]}
                  onChange={(e) => setSettings((prev: any) => ({ ...prev, [item.key]: e.target.value }))}
                  className="text-left rounded-lg text-foreground text-sm h-9"
                  placeholder={item.placeholder}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Font Selection */}
      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-2 justify-end">
          <h3 className="text-lg font-bold text-foreground">الخط</h3>
          <Type className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground text-right">اختر خط المتجر</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {fontOptions.map((font) => (
            <button
              key={font.name}
              onClick={() => setFont(font.name)}
              className={`relative p-3 rounded-xl border transition-all text-right ${
                currentFont === font.name
                  ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                  : "border-border hover:border-foreground/30"
              }`}
            >
              {currentFont === font.name && (
                <div className="absolute top-1.5 left-1.5 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-primary-foreground" />
                </div>
              )}
              <p className="text-sm font-bold text-foreground mb-0.5" style={{ fontFamily: `'${font.name}', sans-serif` }}>
                {font.label}
              </p>
              <p className="text-xs text-muted-foreground" style={{ fontFamily: `'${font.name}', sans-serif` }}>
                {font.sample}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Live Preview */}
      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 space-y-4">
        <h3 className="text-lg font-bold text-foreground text-right">معاينة المتجر</h3>
        <div
          className="p-5 rounded-xl border border-border overflow-hidden"
          style={{
            backgroundColor: settings.menuBackgroundColor,
            fontFamily: `'${currentFont}', sans-serif`,
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-8 h-8 rounded-full" style={{ backgroundColor: settings.menuAccentColor }} />
            <h4 className="text-base font-bold" style={{ color: settings.menuTextColor }}>اسم المتجر</h4>
          </div>
          <p className="text-sm mb-4 text-right" style={{ color: settings.menuTextColor, opacity: 0.7 }}>
            وصف المنتج يظهر هنا بالخط المختار
          </p>
          <div className="flex gap-2 justify-end">
            <div
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ backgroundColor: settings.menuAccentColor, color: '#fff' }}
            >
              أضف للسلة
            </div>
            <div
              className="px-4 py-2 rounded-lg text-sm font-medium border"
              style={{ borderColor: settings.menuAccentColor, color: settings.menuTextColor }}
            >
              تفاصيل
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesignTab;
