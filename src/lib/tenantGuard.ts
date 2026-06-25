import { getAuthenticatedUserId } from '@/lib/authSession';

/** Client-side defense-in-depth: merchant APIs must match signed-in user. */
export async function assertMerchantOwner(ownerId: string): Promise<void> {
  const uid = await getAuthenticatedUserId();
  if (!uid || uid !== ownerId) {
    throw new Error('Unauthorized');
  }
}
