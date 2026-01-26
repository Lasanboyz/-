export default function handler(req, res) {
  return res.status(200).json({
    ok: true,
    hasJwt: !!process.env.APP_JWT_SECRET,
    hasAdminKey: !!process.env.ADMIN_KEY,
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
