import { memo } from "react";

const ProductSkeleton = memo(function ProductSkeleton({ viewMode = "grid" }: { viewMode?: "grid" | "list" }) {
  if (viewMode === "list") {
    return (
      <div className="sf-card flex gap-4 p-4 animate-pulse">
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
    <div className="sf-card animate-pulse">
      <div className="aspect-square m-3 rounded-lg sf-skeleton" />
      <div className="px-4 pb-3 space-y-2">
        <div className="h-4 sf-skeleton w-full" />
        <div className="h-4 sf-skeleton w-2/3 mr-auto" />
      </div>
      <div className="h-12 sf-skeleton rounded-none border-t border-border/30" />
    </div>
  );
});

export default ProductSkeleton;
