
// This file has been replaced with secure Supabase authentication
// The insecure custom authentication system has been removed for security

import { supabase } from "@/integrations/supabase/client";

export interface RestaurantOwner {
  id: string;
  username: string;
  restaurant_name?: string;
  restaurant_logo?: string;
}

// DEPRECATED: This entire custom auth system has been replaced
// Use the AuthContext for all authentication needs
// All functions below are deprecated and should not be used

export const loginUser = async (username: string, password: string) => {
  console.warn('DEPRECATED: loginUser function has been removed for security. Use AuthContext instead.');
  return { error: 'هذه الطريقة مُعطلة لأسباب أمنية. استخدم نظام المصادقة الجديد.' };
};

export const registerUser = async (username: string, password: string, restaurantName?: string) => {
  console.warn('DEPRECATED: registerUser function has been removed for security. Use AuthContext instead.');
  return { error: 'هذه الطريقة مُعطلة لأسباب أمنية. استخدم نظام المصادقة الجديد.' };
};

export const initializeOwnerContext = async (ownerId: string) => {
  console.warn('DEPRECATED: initializeOwnerContext is no longer needed. Owner context is now handled by Supabase RLS.');
};
