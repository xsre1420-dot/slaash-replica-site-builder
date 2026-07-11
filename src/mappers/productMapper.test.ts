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

  it('parses JSON string sizes', () => {
    const product = mapDbProduct({
      id: 'p3',
      name: 'Sized',
      category: 'cat',
      price: 100,
      image_url: 'https://img.test/a.png',
      sizes: '["S","M","L"]',
    });
    expect(product.sizes).toEqual(['S', 'M', 'L']);
  });

  it('derives sizes and colors from variants when lists are missing', () => {
    const product = mapDbProduct({
      id: 'p4',
      name: 'Varianted',
      category: 'cat',
      price: 100,
      image_url: 'https://img.test/a.png',
      variants: [
        { size: 'M', color: '#ff0000', quantity: 2 },
        { size: 'L', color: '#ff0000', quantity: 1 },
        { size: 'M', color: '#0000ff', quantity: 3 },
      ],
    });
    expect(product.sizes).toEqual(['M', 'L']);
    expect(product.colors?.map((c) => c.value)).toEqual(['#ff0000', '#0000ff']);
  });
});
