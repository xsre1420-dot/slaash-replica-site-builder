const ProductSkeleton = ({ viewMode = "grid" }: { viewMode?: "grid" | "list" }) => {
  if (viewMode === "list") {
    return (
      <div className="bg-card rounded-2xl overflow-hidden border border-border/50 animate-pulse flex gap-3 p-3">
        <div className="w-28 h-28 rounded-xl bg-muted flex-shrink-0" />
        <div className="flex-1 space-y-2 py-1">
          <div className="h-4 bg-muted rounded-lg w-3/4" />
          <div className="h-3 bg-muted rounded-lg w-1/2" />
          <div className="h-5 bg-muted rounded-lg w-1/3 mt-2" />
          <div className="h-8 bg-muted rounded-xl w-full mt-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl overflow-hidden border border-border/50 animate-pulse">
      <div className="aspect-square bg-muted" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-muted rounded-lg w-3/4" />
        <div className="h-3 bg-muted rounded-lg w-1/2" />
        <div className="h-5 bg-muted rounded-lg w-2/3" />
        <div className="h-8 bg-muted rounded-xl w-full" />
      </div>
    </div>
  );
};

export default ProductSkeleton;
