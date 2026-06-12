import { useStoreBootstrap } from '@/hooks/useStoreBootstrap';

/** Invisible component — wires store bootstrap on auth session. */
const StoreBootstrap = () => {
  useStoreBootstrap();
  return null;
};

export default StoreBootstrap;
