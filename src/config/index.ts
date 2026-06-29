/**
 * Application configuration — single import surface for env, flags, and constants.
 */
export { env, isProduction, isStaging, isObservabilityClientEnabled, type AppEnv } from '@/lib/env';
export { features, isFeatureEnabled } from '@/config/features';
export { APP_CONSTANTS } from '@/config/constants';
