import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  getMetaDiagnostics,
  getMetaRuntimeState,
  subscribeMetaDiagnostics,
  clearMetaDiagnostics,
} from '@/lib/meta/diagnostics';
import { isMetaPixelLoaded } from '@/lib/meta/pixelClient';

interface MetaDiagnosticsPanelProps {
  pixelConfigured: boolean;
  capiConfigured: boolean;
  marketingEnabled: boolean;
}

export default function MetaDiagnosticsPanel({
  pixelConfigured,
  capiConfigured,
  marketingEnabled,
}: MetaDiagnosticsPanelProps) {
  const [, tick] = useState(0);
  const runtime = getMetaRuntimeState();
  const entries = getMetaDiagnostics();
  const pixelLoaded = isMetaPixelLoaded();

  useEffect(() => subscribeMetaDiagnostics(() => tick((n) => n + 1)), []);

  const browserEvents = entries.filter((e) => e.channel === 'browser');
  const serverEvents = entries.filter((e) => e.channel === 'server');
  const lastPurchase = entries.find((e) => e.eventName === 'Purchase');
  const dedupOk = lastPurchase?.deduplicationKey && lastPurchase.eventId === lastPurchase.deduplicationKey;

  return (
    <Card className="border-border/20 rounded-2xl bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <Button variant="ghost" size="sm" onClick={clearMetaDiagnostics} className="rounded-lg text-xs">
          مسح السجل
        </Button>
        <CardTitle className="text-right text-base">تشخيص Meta Tracking</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-right">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {[
            { label: 'التتبع مفعّل', ok: marketingEnabled },
            { label: 'Pixel مُكوَّن', ok: pixelConfigured },
            { label: 'Pixel محمّل', ok: pixelLoaded || runtime.loaded },
            { label: 'CAPI Token', ok: capiConfigured },
          ].map((item) => (
            <div key={item.label} className="p-2 rounded-lg border border-border/20 bg-muted/20">
              <p className="text-muted-foreground mb-1">{item.label}</p>
              <Badge variant={item.ok ? 'default' : 'secondary'} className="text-[10px]">
                {item.ok ? 'نعم' : 'لا'}
              </Badge>
            </div>
          ))}
        </div>

        {runtime.pixelId && (
          <p className="text-xs text-muted-foreground">
            Pixel ID: <span className="font-mono text-foreground">{runtime.pixelId}</span>
          </p>
        )}

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="p-2 rounded-lg border border-border/20">
            <p className="text-muted-foreground">أحداث المتصفح</p>
            <p className="text-lg font-bold">{browserEvents.length}</p>
          </div>
          <div className="p-2 rounded-lg border border-border/20">
            <p className="text-muted-foreground">أحداث الخادم</p>
            <p className="text-lg font-bold">{serverEvents.length}</p>
          </div>
          <div className="p-2 rounded-lg border border-border/20">
            <p className="text-muted-foreground">إلغاء التكرار</p>
            <Badge variant={dedupOk ? 'default' : 'secondary'} className="text-[10px] mt-1">
              {lastPurchase ? (dedupOk ? 'event_id متطابق' : '—') : 'بانتظار Purchase'}
            </Badge>
          </div>
        </div>

        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            لا توجد أحداث مسجّلة بعد. زُر متجرك وفعّل وضع التصحيح لرؤية التفاصيل.
          </p>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-2">
            {entries.slice(0, 20).map((entry) => (
              <div
                key={entry.id}
                className="p-2 rounded-lg border border-border/10 text-[11px] font-mono bg-muted/10"
              >
                <div className="flex justify-between gap-2 mb-1">
                  <Badge variant={entry.success ? 'default' : 'destructive'} className="text-[9px]">
                    {entry.channel}
                  </Badge>
                  <span>{entry.eventName}</span>
                </div>
                <p className="text-muted-foreground truncate">event_id: {entry.eventId}</p>
                {entry.matchQualityHints?.length ? (
                  <p className="text-muted-foreground">EMQ: {entry.matchQualityHints.join(', ')}</p>
                ) : null}
                {entry.error && <p className="text-destructive">{entry.error}</p>}
              </div>
            ))}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground">
          التشخيص يُسجَّل في لوحة التاجر عند تفعيل وضع التصحيح أو عند أحداث CAPI من هذا المتصفح.
          لاختبار Purchase كاملاً: أكمل طلباً حقيقياً من متجرك مع Pixel + Token مُكوَّنين.
        </p>
      </CardContent>
    </Card>
  );
}
