
import { Button } from "@/components/ui/button";

interface SettingsActionsProps {
  onSave: () => void;
}

const SettingsActions = ({ onSave }: SettingsActionsProps) => {
  return (
    <div className="flex justify-center mt-12">
      <Button
        onClick={onSave}
        className="text-white px-12 py-4 text-lg rounded-2xl border-0 shadow-lg"
        style={{ 
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          boxShadow: '0 8px 25px rgba(99, 102, 241, 0.3)'
        }}
      >
        حفظ جميع الإعدادات
      </Button>
    </div>
  );
};

export default SettingsActions;
