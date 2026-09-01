import { useMemo } from 'react';
import { loadLandingPageBundle, peekLandingPageBundle } from '@/services/landingPageService';

export function useLandingPageBundle() {
  return useMemo(() => peekLandingPageBundle() ?? loadLandingPageBundle(), []);
}
