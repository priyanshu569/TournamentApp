import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'https://mzwjpxmhaymphvlludcn.supabase.co';
const supabaseAnonKey = 'sb_publishable_5UTPVqweruxxoF_JyeVjmQ_HvfIDwKy';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});