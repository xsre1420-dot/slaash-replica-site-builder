import { Eye, ImageOff } from "lucide-react";

interface ProductPreviewCardProps {
  name: string;
  price: string;
  image: string | null;
  category: string;
}

const ProductPreviewCard = ({ name, price, image, category }: ProductPreviewCardProps) => {
  const displayPrice = () => {
    if (!price) return "٠";
    const num = parseFloat(price.replace(/,/g, ""));
    if (isNaN(num) || num === 0) return "٠";
    return num.toLocaleString("en-US");
  };

  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Eye className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">معاينة المنتج</span>
      </div>
      <div className="p-4">
        <div className="rounded-xl overflow-hidden bg-muted aspect-square mb-3 flex items-center justify-center">
          {image ? (
            <img src={image} alt={name || "منتج"} className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <ImageOff className="w-10 h-10" />
              <span className="text-xs">لا توجد صورة</span>
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <h3 className="font-semibold text-foreground text-right truncate">
            {name || "اسم المنتج"}
          </h3>
          {category && (
            <span className="inline-block text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
              {category}
            </span>
          )}
          <p className="text-primary font-bold text-lg text-right direction-ltr">
            {displayPrice()} <span className="text-xs text-muted-foreground">د.ع</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProductPreviewCard;
