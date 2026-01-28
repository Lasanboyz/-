import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function normalizeCode(code) {
  return String(code || "").trim().replace(/\s+/g, "").toUpperCase();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    let { volunteer_code, pin } = req.body || {};
    volunteer_code = normalizeCode(volunteer_code);
    pin = String(pin || "").trim();

    if (!volunteer_code || !pin) {
      return res.status(400).json({ error: "volunteer_code and pin required" });
    }
    if (!/^\d{4}$/.test(pin)) {
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

    // ✅ ตั้งได้ครั้งแรกเท่านั้น
    if (volunteer.pin_hash) {
      return res.status(409).json({ error: "PIN already set" });
    }

    const hash = await bcrypt.hash(pin, 10);

    // ✅ กัน race + กัน overwrite
    const { data: updatedRows, error: uErr } = await supabase
      .from("volunteers")
      .update({ pin_hash: hash, pin_set_at: new Date().toISOString() })
      .eq("id", volunteer.id)
      .is("pin_hash", null)
      .select("id");

    if (uErr) return res.status(500).json({ error: uErr.message });
    if (!updatedRows || updatedRows.length === 0) {
      return res.status(409).json({ error: "PIN already set" });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
}
