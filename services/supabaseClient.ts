import { createClient } from '@supabase/supabase-js';

// IMPORTANT: Replace these with your actual Supabase project credentials
// You can find them in your Supabase Dashboard -> Project Settings -> API
const SUPABASE_URL = 'https://tsmrsejjhtlgjtyqeged.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_YR3ULs2UoNMZipc1zRYFuQ_0qfCvu9w';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);