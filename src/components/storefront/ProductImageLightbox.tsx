import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ZoomIn } from "lucide-react";

interface ProductImageLightboxProps {
  src: string;
  alt: string;
  className?: string;
  onLoad?: () => void;
}

const ProductImageLightbox = ({ src, alt, className = "", onLoad }: ProductImageLightboxProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`relative group w-full h-full ${className}`}
        aria-label="تكبير الصورة"
      >
        <img src={src} alt={alt} className="w-full h-full object-cover" loading="lazy" onLoad={onLoad} />
        <span className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-foreground/70 text-background text-[10px] font-medium px-2.5 py-1 opacity-90">
          <ZoomIn className="w-3 h-3" />
          تكبير
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] p-2 bg-background border-border">
          <img src={src} alt={alt} className="w-full h-full max-h-[85vh] object-contain rounded-lg" />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProductImageLightbox;
