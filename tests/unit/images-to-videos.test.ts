import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractMediaIdFromUrl } from '@/lib/runners/video/images-to-videos';

describe('extractMediaIdFromUrl', () => {
  it('extracts image ID from standard library URL', () => {
    const url = 'https://xxx.supabase.co/storage/v1/object/public/attachments/library/img_abc12345.png';
    expect(extractMediaIdFromUrl(url)).toBe('img_abc12345');
  });

  it('extracts video ID from standard library URL', () => {
    const url = 'https://xxx.supabase.co/storage/v1/object/public/attachments/library/vdo_xyz98765.mp4';
    expect(extractMediaIdFromUrl(url)).toBe('vdo_xyz98765');
  });

  it('handles URLs with different extensions', () => {
    const jpegUrl = 'https://example.com/attachments/library/img_test1234.jpeg';
    expect(extractMediaIdFromUrl(jpegUrl)).toBe('img_test1234');

    const webmUrl = 'https://example.com/attachments/library/vdo_test5678.webm';
    expect(extractMediaIdFromUrl(webmUrl)).toBe('vdo_test5678');
  });

  it('returns null for non-library URLs', () => {
    const url = 'https://example.com/some/other/path/image.png';
    expect(extractMediaIdFromUrl(url)).toBeNull();
  });

  it('returns null for malformed URLs', () => {
    expect(extractMediaIdFromUrl('')).toBeNull();
    expect(extractMediaIdFromUrl('not-a-url')).toBeNull();
  });
});

describe('runImagesToVideos', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should throw error when items array is missing', async () => {
    const { runImagesToVideos } = await import('@/lib/runners/video/images-to-videos');

    const params = {
      prompt: {},
      promptRun: {},
      run: { variables: {} },
      inputImageUrl: null,
      supabase: {} as any,
    };

    await expect(runImagesToVideos(params)).rejects.toThrow('ImagesToVideos requires items array in variables');
  });

  it('should throw error when items is not an array', async () => {
    const { runImagesToVideos } = await import('@/lib/runners/video/images-to-videos');

    const params = {
      prompt: {},
      promptRun: {},
      run: { variables: { items: 'not-an-array' } },
      inputImageUrl: null,
      supabase: {} as any,
    };

    await expect(runImagesToVideos(params)).rejects.toThrow('ImagesToVideos requires items array in variables');
  });
});
