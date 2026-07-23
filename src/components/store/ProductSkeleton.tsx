import { memo } from "react";

const ProductSkeleton = memo(function ProductSkeleton({
  viewMode = "grid",
  index = 0,
}: {
  viewMode?: "grid" | "list";
  index?: number;
}) {
  const style = { ['--sf-stagger' as string]: index } as React.CSSProperties;

  if (viewMode === "list") {
    return (
      <div className="sf-card flex gap-4 p-4 sf-enter" style={style} aria-hidden>
        <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-xl sf-skeleton shrink-0" />
        <div className="flex-1 space-y-3 py-1">
          <div className="h-4 sf-skeleton w-3/4 mr-auto" />
          <div className="h-3 sf-skeleton w-1/2 mr-auto" />
          <div className="h-5 sf-skeleton w-1/3 mr-auto mt-4" />
          <div className="h-10 sf-skeleton w-28 mr-auto rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="sf-card sf-enter overflow-hidden" style={style} aria-hidden>
      <div className="aspect-square m-2.5 sm:m-3 rounded-lg sf-skeleton" />
      <div className="px-3 sm:px-4 pb-2.5 space-y-2">
        <div className="h-3.5 sf-skeleton w-full" />
        <div className="h-3.5 sf-skeleton w-2/3 mr-auto" />
        <div className="h-4 sf-skeleton w-1/2 mr-auto" />
      </div>
      <div className="h-11 sf-skeleton rounded-none border-t border-border/20 mx-2.5 sm:mx-3 mb-2.5 rounded-b-lg" />
    </div>
  );
});

export default ProductSkeleton;
