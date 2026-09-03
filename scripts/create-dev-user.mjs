// Usage: node scripts/create-dev-user.mjs <email> <password>
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (lấy từ `supabase status`)
import { createClient } from "@supabase/supabase-js";

const [email, password] = process.argv.slice(2);
if (!email || !password) { console.error("Usage: create-dev-user.mjs <email> <password>"); process.exit(1); }
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (error) { console.error(error.message); process.exit(1); }
console.log("Created user:", data.user.id);
