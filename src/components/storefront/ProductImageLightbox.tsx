import { useState, type ReactNode } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ZoomIn } from "lucide-react";
import { buildResponsiveImageSources } from "@/utils/cdnMediaUtils";
import { cn } from "@/lib/utils";

interface ProductImageLightboxProps {
  src: string;
  alt: string;
  className?: string;
  onLoad?: () => void;
  zoomOnHover?: boolean;
  priority?: boolean;
  /** Custom render for gallery slide (keeps img visible while enabling zoom dialog) */
  renderImage?: (props: { alt: string; onLoad?: () => void; priority?: boolean }) => ReactNode;
}

const ProductImageLightbox = ({
  src,
  alt,
  className = "",
  onLoad,
  zoomOnHover = true,
  priority = false,
  renderImage,
}: ProductImageLightboxProps) => {
  const [open, setOpen] = useState(false);
  const sources = buildResponsiveImageSources(src, { variant: "display" });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "relative group w-full h-full flex items-center justify-center overflow-hidden cursor-zoom-in",
          className
        )}
        aria-label="تكبير الصورة"
      >
        {renderImage ? (
          renderImage({ alt, onLoad, priority })
        ) : (
          <img
            src={sources.src}
            alt={alt}
            className={cn(
              "max-h-full max-w-full w-full h-full object-contain transition-transform duration-500 ease-out",
              zoomOnHover && "group-hover:scale-[1.04]"
            )}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            {...(priority ? { fetchPriority: "high" as const } : {})}
            {...(sources.srcSet ? { srcSet: sources.srcSet, sizes: sources.sizes } : {})}
            onLoad={onLoad}
            onError={(e) => {
              if (e.currentTarget.src !== src) e.currentTarget.src = src;
            }}
          />
        )}
        <span className="absolute bottom-3 left-3 z-10 flex items-center gap-1 rounded-full bg-background/85 backdrop-blur-sm text-foreground text-[10px] font-medium px-2.5 py-1 opacity-0 group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-sm border border-border/30 pointer-events-none">
          <ZoomIn className="w-3 h-3" />
          تكبير
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[min(95vw,900px)] max-h-[90vh] p-2 sm:p-4 bg-background border-border/40 shadow-xl">
          {open && (
            <img
              src={sources.src}
              alt={alt}
              className="w-full h-full max-h-[85vh] object-contain rounded-lg"
              loading="lazy"
              decoding="async"
              {...(sources.srcSet ? { srcSet: sources.srcSet, sizes: "90vw" } : {})}
              onError={(e) => {
                if (e.currentTarget.src !== src) e.currentTarget.src = src;
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProductImageLightbox;
