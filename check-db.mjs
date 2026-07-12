import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: cps, error: err1 } = await supabase.from('channel_partners').select('*');
  console.log("Channel Partners:", cps);
  if (err1) console.error(err1);
  
  const { data: profs, error: err2 } = await supabase.from('profiles').select('id, name, phone, role').in('role', ['agent', 'builder']);
  console.log("Profiles:", profs);
  if (err2) console.error(err2);
}
check();
