import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ATTENTION_EMPHASIS_MS,
  ATTENTION_FADE_MS,
  ATTENTION_PARAM,
  type AttentionKey,
  type AttentionVisualPhase,
} from '@/lib/attentionHighlight';

export const useAttentionHighlight = (expectedKey: AttentionKey) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const attention = searchParams.get(ATTENTION_PARAM);
  const active = attention === expectedKey;
  const zoneRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<AttentionVisualPhase>('idle');
  const timersRef = useRef<number[]>([]);

  const clearAttention = useCallback(() => {
    if (!searchParams.has(ATTENTION_PARAM)) return;
    const next = new URLSearchParams(searchParams);
    next.delete(ATTENTION_PARAM);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    clearTimers();

    if (!active) {
      setPhase('idle');
      return;
    }

    setPhase('emphasized');

    timersRef.current.push(
      window.setTimeout(() => setPhase('fading'), ATTENTION_EMPHASIS_MS)
    );

    timersRef.current.push(
      window.setTimeout(() => {
        clearAttention();
        setPhase('idle');
      }, ATTENTION_EMPHASIS_MS + ATTENTION_FADE_MS)
    );

    return clearTimers;
  }, [active, expectedKey, clearAttention, clearTimers]);

  useEffect(() => {
    if (phase !== 'emphasized' || !zoneRef.current) return;
    const timer = window.setTimeout(() => {
      zoneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [phase, expectedKey]);

  return {
    phase,
    isHighlighted: phase === 'emphasized' || phase === 'fading',
    zoneRef,
    clearAttention,
    attentionKey: attention as AttentionKey | null,
  };
};
