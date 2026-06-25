import { describe, it, expect } from 'vitest';
import {
  STORAGE_BUCKET,
  parseStorageObjectPath,
  isOurStorageUrl,
  thumbPathFor,
  collectProductImageUrls,
  diffRemovedStorageUrls,
  findOrphanObjectPaths,
  findDuplicateUrlReferences,
} from '@/utils/storageMediaUtils';

const owner = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const file = `${owner}/11111111-2222-3333-4444-555555555555.webp`;
const publicUrl = `https://xyz.supabase.co/storage/v1/object/public/${STORAGE_BUCKET}/${file}`;

describe('storageMediaUtils', () => {
  it('parses public storage URLs', () => {
    expect(parseStorageObjectPath(publicUrl)).toBe(file);
    expect(isOurStorageUrl(publicUrl)).toBe(true);
    expect(isOurStorageUrl('https://cdn.example.com/a.jpg')).toBe(false);
  });

  it('derives thumbnail path', () => {
    expect(thumbPathFor(file)).toBe(`${owner}/thumbs/11111111-2222-3333-4444-555555555555.webp`);
  });

  it('collects product image URLs from row shapes', () => {
    const urls = collectProductImageUrls({
      image_url: publicUrl,
      additional_images: ['https://other.com/x.jpg', publicUrl],
    });
    expect(urls).toHaveLength(2);
  });

  it('diffs removed storage URLs only', () => {
    const removed = publicUrl;
    const kept = `https://xyz.supabase.co/storage/v1/object/public/${STORAGE_BUCKET}/${owner}/22222222-2222-3333-4444-555555555555.webp`;
    const diff = diffRemovedStorageUrls(
      [removed, kept, 'https://external.com/a.jpg'],
      [kept]
    );
    expect(diff).toEqual([removed]);
  });

  it('finds orphan object paths', () => {
    const thumb = `${owner}/thumbs/11111111-2222-3333-4444-555555555555.webp`;
    const orphans = findOrphanObjectPaths(
      [file, thumb, `${owner}/33333333-3333-3333-3333-333333333333.webp`],
      [publicUrl]
    );
    expect(orphans).toEqual([`${owner}/33333333-3333-3333-3333-333333333333.webp`]);
  });

  it('detects duplicate URL references', () => {
    expect(findDuplicateUrlReferences([publicUrl, publicUrl])).toEqual([publicUrl]);
  });
});
