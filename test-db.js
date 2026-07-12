require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data: profile } = await supabase.from("profiles").select("id").limit(1).single();
  console.log("Using profile:", profile.id);
  
  const { data, error } = await supabase.from("documents").insert([{
    agent_id: profile.id,
    type: "document",
    url: "https://example.com",
    name: "test.pdf",
    send_count: 0,
    view_count: 0
  }]);
  
  console.log("Insert Data:", data);
  console.log("Insert Error:", error);
}
main();
