
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="border-0 shadow-none bg-muted/50 rounded-2xl">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-foreground/10 flex items-center justify-center">
            <Palette className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <CardTitle className="text-right text-xl text-foreground">ألوان المتجر</CardTitle>
            <CardDescription className="text-right text-muted-foreground">
              خصص ألوان صفحة المتجر لتناسب هوية متجرك
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Color Presets */}
        <div className="space-y-3">
          <Label className="text-right block text-foreground font-medium">ألوان مقترحة</Label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {colorPresets.map((preset) => (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset)}
                className="p-3 rounded-xl border border-border hover:border-foreground/30 transition-all text-center group"
              >
                <div className="flex gap-1 justify-center mb-2">
                  <div className="w-5 h-5 rounded-full border border-border" style={{ backgroundColor: preset.bg }} />
                  <div className="w-5 h-5 rounded-full border border-border" style={{ backgroundColor: preset.text }} />
                  <div className="w-5 h-5 rounded-full border border-border" style={{ backgroundColor: preset.accent }} />
                </div>
                <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">{preset.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-3">
            <Label className="text-right block text-foreground font-medium">لون الخلفية</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.menuBackgroundColor}
                onChange={(e) => setSettings((prev: any) => ({ ...prev, menuBackgroundColor: e.target.value }))}
                className="w-12 h-10 rounded-xl border border-border cursor-pointer"
              />
              <Input
                value={settings.menuBackgroundColor}
                onChange={(e) => setSettings((prev: any) => ({ ...prev, menuBackgroundColor: e.target.value }))}
                className="text-left rounded-xl text-foreground"
                placeholder="#ffffff"
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-right block text-foreground font-medium">لون النص</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.menuTextColor}
                onChange={(e) => setSettings((prev: any) => ({ ...prev, menuTextColor: e.target.value }))}
                className="w-12 h-10 rounded-xl border border-border cursor-pointer"
              />
              <Input
                value={settings.menuTextColor}
                onChange={(e) => setSettings((prev: any) => ({ ...prev, menuTextColor: e.target.value }))}
                className="text-left rounded-xl text-foreground"
                placeholder="#333333"
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-right block text-foreground font-medium">اللون المميز</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.menuAccentColor}
                onChange={(e) => setSettings((prev: any) => ({ ...prev, menuAccentColor: e.target.value }))}
                className="w-12 h-10 rounded-xl border border-border cursor-pointer"
              />
              <Input
                value={settings.menuAccentColor}
                onChange={(e) => setSettings((prev: any) => ({ ...prev, menuAccentColor: e.target.value }))}
                className="text-left rounded-xl text-foreground"
                placeholder="#6366f1"
              />
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="mt-8 p-8 rounded-2xl border border-border" style={{ backgroundColor: settings.menuBackgroundColor }}>
          <h3 className="text-xl font-bold mb-4" style={{ color: settings.menuTextColor }}>
            معاينة التصميم
          </h3>
          <p className="mb-4" style={{ color: settings.menuTextColor }}>
            هذا نص عادي بلون النص المختار
          </p>
          <div className="inline-block px-6 py-3 rounded-2xl" style={{ backgroundColor: settings.menuAccentColor, color: 'white' }}>
            نص باللون المميز
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DesignTab;
