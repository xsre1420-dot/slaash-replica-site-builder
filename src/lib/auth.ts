
import { supabase } from "@/integrations/supabase/client";
import bcrypt from 'bcryptjs';

export interface RestaurantOwner {
  id: string;
  username: string;
  restaurant_name?: string;
  restaurant_logo?: string;
}

export const loginUser = async (username: string, password: string) => {
  try {
    // البحث عن المستخدم
    const { data: user, error: fetchError } = await supabase
      .from('restaurant_owners')
      .select('*')
      .eq('username', username)
      .single();

    if (fetchError || !user) {
      return { error: 'اسم المستخدم غير موجود' };
    }

    // التحقق من كلمة المرور
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return { error: 'كلمة المرور غير صحيحة' };
    }

    // تعيين معرف المالك في الجلسة
    await supabase.rpc('set_config', {
      setting_name: 'app.current_owner_id',
      setting_value: user.id
    });

    return { 
      user: {
        id: user.id,
        username: user.username,
        restaurant_name: user.restaurant_name,
        restaurant_logo: user.restaurant_logo
      }
    };
  } catch (error) {
    console.error('Login error:', error);
    return { error: 'حدث خطأ أثناء تسجيل الدخول' };
  }
};

export const registerUser = async (username: string, password: string, restaurantName?: string) => {
  try {
    // التحقق من وجود المستخدم
    const { data: existingUser } = await supabase
      .from('restaurant_owners')
      .select('id')
      .eq('username', username)
      .single();

    if (existingUser) {
      return { error: 'اسم المستخدم موجود بالفعل' };
    }

    // تشفير كلمة المرور
    const passwordHash = await bcrypt.hash(password, 10);

    // إنشاء المستخدم الجديد
    const { data: newUser, error: insertError } = await supabase
      .from('restaurant_owners')
      .insert({
        username,
        password_hash: passwordHash,
        restaurant_name: restaurantName || username
      })
      .select()
      .single();

    if (insertError) {
      console.error('Registration error:', insertError);
      return { error: 'حدث خطأ أثناء إنشاء الحساب' };
    }

    return { 
      user: {
        id: newUser.id,
        username: newUser.username,
        restaurant_name: newUser.restaurant_name,
        restaurant_logo: newUser.restaurant_logo
      }
    };
  } catch (error) {
    console.error('Registration error:', error);
    return { error: 'حدث خطأ أثناء إنشاء الحساب' };
  }
};
