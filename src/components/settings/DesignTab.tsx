
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface DesignTabProps {
  settings: {
    menuBackgroundColor: string;
    menuTextColor: string;
    menuAccentColor: string;
  };
  setSettings: React.Dispatch<React.SetStateAction<any>>;
}

const DesignTab = ({ settings, setSettings }: DesignTabProps) => {
  return (
    <Card className="border-0 shadow-none bg-gray-50 rounded-2xl">
      <CardHeader>
        <CardTitle className="text-right text-xl text-black">ألوان المنيو</CardTitle>
        <CardDescription className="text-right text-gray-600">
          خصص ألوان صفحة المنيو لتناسب هوية متجرك
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-3">
            <Label className="text-right block text-black font-medium">لون الخلفية</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.menuBackgroundColor}
                onChange={(e) => setSettings((prev: any) => ({ ...prev, menuBackgroundColor: e.target.value }))}
                className="w-16 h-12 rounded-2xl border border-gray-200"
              />
              <Input
                value={settings.menuBackgroundColor}
                onChange={(e) => setSettings((prev: any) => ({ ...prev, menuBackgroundColor: e.target.value }))}
                className="text-left rounded-2xl text-black"
                placeholder="#ffffff"
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-right block text-black font-medium">لون النص</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.menuTextColor}
                onChange={(e) => setSettings((prev: any) => ({ ...prev, menuTextColor: e.target.value }))}
                className="w-16 h-12 rounded-2xl border border-gray-200"
              />
              <Input
                value={settings.menuTextColor}
                onChange={(e) => setSettings((prev: any) => ({ ...prev, menuTextColor: e.target.value }))}
                className="text-left rounded-2xl text-black"
                placeholder="#333333"
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-right block text-black font-medium">اللون المميز</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.menuAccentColor}
                onChange={(e) => setSettings((prev: any) => ({ ...prev, menuAccentColor: e.target.value }))}
                className="w-16 h-12 rounded-2xl border border-gray-200"
              />
              <Input
                value={settings.menuAccentColor}
                onChange={(e) => setSettings((prev: any) => ({ ...prev, menuAccentColor: e.target.value }))}
                className="text-left rounded-2xl text-black"
                placeholder="#6366f1"
              />
            </div>
          </div>
        </div>

        <div className="mt-8 p-8 rounded-2xl border border-gray-200" style={{ backgroundColor: settings.menuBackgroundColor }}>
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
