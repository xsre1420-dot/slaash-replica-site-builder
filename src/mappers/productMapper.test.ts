import { describe, it, expect } from 'vitest';
import { mapDbProduct, mapStorefrontProduct, parseJsonField } from '@/mappers/productMapper';

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

  it('maps slim storefront list RPC row', () => {
    const product = mapStorefrontProduct({
      id: 'p2',
      name: 'Slim',
      price: 5000,
      sale_price: 4000,
      thumbnail: 'https://img.test/thumb.png',
      slug: 'slim-product',
      stock_status: 'low',
      qty: 2,
      has_options: true,
      rating: 4.5,
      category: 'shoes',
      discount_type: 'percentage',
      discount_value: 20,
    });

    expect(product.image).toBe('https://img.test/thumb.png');
    expect(product.productSlug).toBe('slim-product');
    expect(product.stockQuantity).toBe(2);
    expect(product.hasOptions).toBe(true);
    expect(product.rating).toBe(4.5);
    expect(product.price).toBe(4000);
    expect(product.originalPrice).toBe(5000);
  });

  it('returns undefined for invalid JSON', () => {
    expect(parseJsonField('not-json')).toBeUndefined();
  });
});
