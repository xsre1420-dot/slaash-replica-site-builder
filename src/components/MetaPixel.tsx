import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface MetaPixelProps {
  /** Store owner's ID — required on public storefronts so the correct merchant pixel loads */
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
  }
}

const MetaPixel = ({ storeOwnerId, event, data }: MetaPixelProps) => {
  const { user } = useAuth();
  const pixelOwnerId = storeOwnerId || user?.id;

  useEffect(() => {
    if (!pixelOwnerId) return;

    const loadPixelSettings = async () => {
      const { data: settings } = await supabase
        .from('marketing_settings')
        .select('meta_pixel_id')
        .eq('owner_id', pixelOwnerId)
        .single();

      const pixelId = String(settings?.meta_pixel_id || '').trim();
      if (!pixelId || !/^[0-9]+$/.test(pixelId)) return;

      const needsReinit = window._metaPixelOwnerId && window._metaPixelOwnerId !== pixelOwnerId;

      if (!window.fbq || needsReinit) {
        if (needsReinit && window.fbq) {
          window.fbq('init', pixelId);
          window.fbq('track', 'PageView');
          window._metaPixelOwnerId = pixelOwnerId;
          return;
        }

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
          window._metaPixelOwnerId = pixelOwnerId;
        };

        document.head.appendChild(script);

        const noscript = document.createElement('noscript');
        const img = document.createElement('img');
        img.height = 1;
        img.width = 1;
        img.style.display = 'none';
        img.src = `https://www.facebook.com/tr?id=${encodeURIComponent(pixelId)}&ev=PageView&noscript=1`;
        noscript.appendChild(img);
        document.body.appendChild(noscript);
      }

      if (event && window.fbq) {
        if (data) {
          window.fbq('track', event, data);
        } else {
          window.fbq('track', event);
        }
      }
    };

    loadPixelSettings();
  }, [pixelOwnerId, event, data]);

  return null;
};

export default MetaPixel;
