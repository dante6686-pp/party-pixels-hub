import {createClient, type SupabaseClient} from '@supabase/supabase-js';

let client: SupabaseClient | undefined;
export function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  client ??= createClient(url, key);
  return client;
}
export const avatars = {ghost: '👻', bolt: '⚡', cat: '🐱', planet: '🪐'} as const;
export type Profile = {player_id: string; handle: string; display_name: string; avatar_key: keyof typeof avatars};
