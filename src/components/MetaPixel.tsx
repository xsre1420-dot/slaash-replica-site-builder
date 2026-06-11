import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cache, CacheTTL } from '@/lib/cache';

interface MetaPixelProps {
  storeOwnerId?: string | null;
  event?: 'ViewContent' | 'AddToCart' | 'Purchase' | 'CompleteRegistration';
  data?: {
    content_ids?: string[];
    content_type?: string;
    value?: number;
    currency?: string;
    content_name?: string;
  };
}

declare global {
  interface Window {
    fbq: any;
    _fbq?: any;
    _metaPixelOwnerId?: string;
    _metaPixelId?: string;
  }
}

const pixelCacheKey = (ownerId: string) => `marketing_pixel:${ownerId}`;

async function fetchPixelId(ownerId: string): Promise<string | null> {
  const cached = cache.get<string>(pixelCacheKey(ownerId));
  if (cached) return cached;

  const { data: settings } = await supabase
    .from('marketing_settings')
    .select('meta_pixel_id')
    .eq('owner_id', ownerId)
    .maybeSingle();

  const pixelId = String(settings?.meta_pixel_id || '').trim();
  if (!pixelId || !/^[0-9]+$/.test(pixelId)) return null;

  cache.set(pixelCacheKey(ownerId), pixelId, CacheTTL.LONG, CacheTTL.MEDIUM);
  return pixelId;
}

function initFbq(pixelId: string, ownerId: string) {
  const needsReinit = window._metaPixelOwnerId && window._metaPixelOwnerId !== ownerId;

  if (window.fbq && window._metaPixelId === pixelId && !needsReinit) return;

  if (needsReinit && window.fbq) {
    window.fbq('init', pixelId);
    window.fbq('track', 'PageView');
    window._metaPixelOwnerId = ownerId;
    window._metaPixelId = pixelId;
    return;
  }

  if (window.fbq) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';

  window.fbq = function () {
    if ((window.fbq as any).callMethod) {
      (window.fbq as any).callMethod.apply((window.fbq as any), arguments as any);
    } else {
      (window.fbq as any).queue.push(arguments);
    }
  } as any;
  if (!window._fbq) window._fbq = window.fbq;
  (window.fbq as any).push = window.fbq;
  (window.fbq as any).loaded = true;
  (window.fbq as any).version = '2.0';
  (window.fbq as any).queue = [];

  script.onload = () => {
    window.fbq('init', pixelId);
    window.fbq('track', 'PageView');
    window._metaPixelOwnerId = ownerId;
    window._metaPixelId = pixelId;
  };

  document.head.appendChild(script);
}

const MetaPixel = ({ storeOwnerId, event, data }: MetaPixelProps) => {
  const { user } = useAuth();
  const pixelOwnerId = storeOwnerId || user?.id;
  const initRef = useRef(false);

  // Init pixel once per store owner (cached settings lookup)
  useEffect(() => {
    if (!pixelOwnerId) return;

    let cancelled = false;
    fetchPixelId(pixelOwnerId).then((pixelId) => {
      if (cancelled || !pixelId) return;
      initFbq(pixelId, pixelOwnerId);
      initRef.current = true;
    });

    return () => { cancelled = true; };
  }, [pixelOwnerId]);

  // Track events without re-fetching marketing_settings
  useEffect(() => {
    if (!event || !window.fbq || !initRef.current) return;
    if (data) window.fbq('track', event, data);
    else window.fbq('track', event);
  }, [event, data]);

  return null;
};

export default MetaPixel;
