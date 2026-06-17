import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Settings } from "lucide-react";
import { RtlHeaderBar } from "@/components/layout/RtlHeaderBar";

const SettingsHeader = () => {
  return (
    <div className="bg-card border-b border-border sticky top-0 z-20 font-arabic">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
        <RtlHeaderBar
          title={
            <span className="inline-flex items-center gap-2">
              الإعدادات
              <Settings className="w-5 h-5 text-muted-foreground" />
            </span>
          }
          titleClassName="text-xl"
          startSlot={
            <Link to="/builder" aria-label="رجوع">
              <Button variant="ghost" size="icon" className="rounded-xl hover:bg-muted min-h-[44px] min-w-[44px]">
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          }
        />
      </div>
    </div>
  );
};

export default SettingsHeader;
