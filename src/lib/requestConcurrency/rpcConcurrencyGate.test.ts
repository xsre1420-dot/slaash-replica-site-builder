import { describe, it, expect, afterEach } from 'vitest';
import {
  acquireRpcSlot,
  resetRpcConcurrencyGateForTests,
  RpcConcurrencyRejectedError,
} from '@/lib/requestConcurrency/rpcConcurrencyGate';

describe('rpcConcurrencyGate', () => {
  afterEach(() => {
    resetRpcConcurrencyGateForTests();
  });

  it('shares slots sequentially for background traffic', async () => {
    const releaseA = await acquireRpcSlot('background');
    await expect(acquireRpcSlot('background')).rejects.toBeInstanceOf(RpcConcurrencyRejectedError);
    releaseA();
    const releaseB = await acquireRpcSlot('background');
    releaseB();
  });

  it('queues critical traffic ahead of standard backlog', async () => {
    const criticalSlots = await Promise.all([
      acquireRpcSlot('critical'),
      acquireRpcSlot('critical'),
      acquireRpcSlot('critical'),
      acquireRpcSlot('critical'),
    ]);

    await expect(acquireRpcSlot('background')).rejects.toBeInstanceOf(RpcConcurrencyRejectedError);

    const criticalPromise = acquireRpcSlot('critical');

    for (const release of criticalSlots) release();

    const criticalRelease = await criticalPromise;
    criticalRelease();
  });
});
