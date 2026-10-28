import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppState as RNAppState, Platform } from 'react-native';

// Set these in a file called .env.local (see SUPABASE_SETUP.md).
// Without them the app still works on a single shared phone.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

export const syncEnabled = supabase !== null;

// Keep the sign-in fresh only while the app is on screen.
if (supabase && Platform.OS !== 'web') {
  RNAppState.addEventListener('change', (s) => {
    if (s === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Every device signs in quietly, with no email or password. The family code is what links devices. */
export async function ensureSignedIn(): Promise<string> {
  if (!supabase) throw new Error('Family sync is not set up');
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;
  const { data: signedIn, error } = await supabase.auth.signInAnonymously();
  if (error || !signedIn.user) throw error ?? new Error('Could not sign in');
  return signedIn.user.id;
}
