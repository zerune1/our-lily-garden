export const SUPABASE_URL = "https://bleejhbxqxdvnrrisdbm.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_Z2-9Gq6qgCY4GFhOJA7FjQ_DPS21aRg";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
