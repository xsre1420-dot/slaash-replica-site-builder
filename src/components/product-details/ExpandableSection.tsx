import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface ExpandableSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const ExpandableSection = ({ title, children, defaultOpen = false }: ExpandableSectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-4 text-right hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center">
          {isOpen ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </button>
      {isOpen && (
        <div className="pb-4 px-1 text-right">
          {children}
        </div>
      )}
    </div>
  );
};

export default ExpandableSection;