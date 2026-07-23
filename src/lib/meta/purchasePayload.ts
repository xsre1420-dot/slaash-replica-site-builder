/** Aggregate cart line items for Meta Purchase contents (sum quantities per product id). */

export interface MetaPurchaseLine {
  id: string;
  quantity: number;
}

export function buildMetaPurchaseContents(
  items: Array<{ productId: string; quantity: number }>
): { contents: MetaPurchaseLine[]; contentIds: string[]; numItems: number } {
  const qtyByProduct = new Map<string, number>();
  for (const item of items) {
    if (!item.productId || item.quantity <= 0) continue;
    qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) ?? 0) + item.quantity);
  }
  const contents = Array.from(qtyByProduct.entries()).map(([id, quantity]) => ({ id, quantity }));
  const numItems = contents.reduce((sum, line) => sum + line.quantity, 0);
  return { contents, contentIds: contents.map((c) => c.id), numItems };
}
