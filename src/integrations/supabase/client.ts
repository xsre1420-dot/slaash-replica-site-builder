export { getSupabaseClient, resetSupabaseClient } from '@/lib/disasterRecovery/supabaseClient';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types.generated';
import { getSupabaseClient } from '@/lib/disasterRecovery/supabaseClient';

type AppSupabase = SupabaseClient<Database>;

/** Resilient Supabase client — always resolves latest endpoint config. */
export const supabase: AppSupabase = new Proxy({} as AppSupabase, {
  get(_target, prop) {
    const client = getSupabaseClient();
    const value = client[prop as keyof AppSupabase];
    if (typeof value === 'function') {
      return (value as (...args: unknown[]) => unknown).bind(client);
    }
    return value;
  },
});
