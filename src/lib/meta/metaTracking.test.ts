import { describe, expect, it } from 'vitest';
import { createMetaEventId, purchaseEventId } from '@/lib/meta/eventIds';
import { buildPurchase } from '@/lib/meta/standardEvents';

describe('meta eventIds', () => {
  it('purchase uses stable order id for deduplication', () => {
    expect(purchaseEventId('ord-123')).toBe('ord-123');
  });

  it('creates unique ids for funnel events', () => {
    const a = createMetaEventId('cart');
    const b = createMetaEventId('cart');
    expect(a).not.toBe(b);
    expect(a.startsWith('cart:')).toBe(true);
  });
});

describe('meta standardEvents', () => {
  it('buildPurchase includes contents and shared event id', () => {
    const built = buildPurchase(50000, ['p1', 'p2'], 'order-abc');
    expect(built.event).toBe('Purchase');
    expect(built.options.eventId).toBe('order-abc');
    expect(built.data.content_ids).toEqual(['p1', 'p2']);
    expect(built.data.contents).toHaveLength(2);
  });
});
