import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Palette } from "lucide-react";

interface DesignTabProps {
  settings: {
    menuBackgroundColor: string;
    menuTextColor: string;
    menuAccentColor: string;
  };
  setSettings: React.Dispatch<React.SetStateAction<any>>;
}

const colorPresets = [
  { name: "كلاسيكي", bg: "#ffffff", text: "#333333", accent: "#000000" },
  { name: "أزرق", bg: "#f0f4ff", text: "#1e293b", accent: "#3b82f6" },
  { name: "أخضر", bg: "#f0fdf4", text: "#1a2e1a", accent: "#22c55e" },
  { name: "برتقالي", bg: "#fff7ed", text: "#1c1917", accent: "#f97316" },
  { name: "وردي", bg: "#fdf2f8", text: "#1f1f1f", accent: "#ec4899" },
  { name: "داكن", bg: "#1a1a2e", text: "#e0e0e0", accent: "#e94560" },
];

const DesignTab = ({ settings, setSettings }: DesignTabProps) => {
  const applyPreset = (preset: typeof colorPresets[0]) => {
    setSettings((prev: any) => ({
      ...prev,
      menuBackgroundColor: preset.bg,
      menuTextColor: preset.text,
      menuAccentColor: preset.accent,
    }));
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 space-y-5">
      <div className="flex items-center gap-2 justify-end">
        <h3 className="text-lg font-bold text-foreground">ألوان المتجر</h3>
        <Palette className="w-5 h-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground text-right">خصص ألوان صفحة المتجر</p>

      {/* Presets */}
      <div className="space-y-2">
        <Label className="text-right block text-foreground font-medium text-sm">ألوان مقترحة</Label>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {colorPresets.map((preset) => (
            <button
              key={preset.name}
              onClick={() => applyPreset(preset)}
              className="p-2.5 rounded-xl border border-border hover:border-foreground/30 transition-all text-center group"
            >
              <div className="flex gap-1 justify-center mb-1.5">
                <div className="w-4 h-4 rounded-full border border-border" style={{ backgroundColor: preset.bg }} />
                <div className="w-4 h-4 rounded-full border border-border" style={{ backgroundColor: preset.text }} />
                <div className="w-4 h-4 rounded-full border border-border" style={{ backgroundColor: preset.accent }} />
              </div>
              <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">{preset.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Colors */}
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

      {/* Preview */}
      <div className="p-5 rounded-xl border border-border" style={{ backgroundColor: settings.menuBackgroundColor }}>
        <h4 className="text-base font-bold mb-2" style={{ color: settings.menuTextColor }}>معاينة التصميم</h4>
        <p className="text-sm mb-3" style={{ color: settings.menuTextColor }}>هذا نص بلون النص المختار</p>
        <div className="inline-block px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: settings.menuAccentColor, color: 'white' }}>
          زر باللون المميز
        </div>
      </div>
    </div>
  );
};

export default DesignTab;
