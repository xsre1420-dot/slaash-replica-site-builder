import { describe, it, expect } from 'vitest';
import { mapDbProduct, parseJsonField } from '@/mappers/productMapper';

describe('productMapper', () => {
  it('maps database row to Product', () => {
    const product = mapDbProduct({
      id: 'p1',
      name: 'Test',
      description: 'Desc',
      category: 'cat',
      price: 1000,
      image_url: 'https://img.test/a.png',
      stock_quantity: 5,
      sizes: ['M', 'L'],
    });

    expect(product.id).toBe('p1');
    expect(product.name).toBe('Test');
    expect(product.price).toBe(1000);
    expect(product.image).toBe('https://img.test/a.png');
    expect(product.stockQuantity).toBe(5);
    expect(product.sizes).toEqual(['M', 'L']);
  });

  it('parses JSON string colors', () => {
    const colors = parseJsonField<{ name: string }[]>(
      '[{"name":"red","hex":"#f00"}]'
    );
    expect(colors).toHaveLength(1);
    expect(colors?.[0].name).toBe('red');
  });

  it('returns undefined for invalid JSON', () => {
    expect(parseJsonField('not-json')).toBeUndefined();
  });
});
