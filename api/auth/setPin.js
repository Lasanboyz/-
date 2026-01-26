import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { volunteer_code, pin } = req.body || {};

    if (!volunteer_code || !pin) {
      return res.status(400).json({ error: "volunteer_code and pin required" });
    }

    if (!/^\d{4}$/.test(String(pin))) {
      return res.status(400).json({ error: "PIN must be 4 digits" });
    }

    const { data: volunteer, error: vErr } = await supabase
      .from("volunteers")
      .select("id, pin_hash")
      .eq("volunteer_code", volunteer_code)
      .single();

    if (vErr || !volunteer) {
      return res.status(404).json({ error: "Volunteer not found" });
    }

    const hash = await bcrypt.hash(String(pin), 10);

    const { error: uErr } = await supabase
      .from("volunteers")
      .update({
        pin_hash: hash,
        pin_set_at: new Date().toISOString(),
      })
      .eq("id", volunteer.id);

    if (uErr) {
      return res.status(500).json({ error: uErr.message });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
}
