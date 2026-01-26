import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

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

    const { data: v, error: vErr } = await supabase
      .from("volunteers")
      .select("id, volunteer_code, name, branch, role, points, pin_hash")
      .eq("volunteer_code", volunteer_code)
      .single();

    if (vErr || !v) {
      return res.status(404).json({ error: "Volunteer not found" });
    }

    if (!v.pin_hash) {
      return res.status(400).json({ error: "PIN not set yet" });
    }

    const ok = await bcrypt.compare(String(pin), v.pin_hash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid PIN" });
    }

    const token = jwt.sign(
      {
        volunteer_id: v.id,
        volunteer_code: v.volunteer_code,
        role: v.role || "VOLUNTEER",
      },
      process.env.APP_JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      ok: true,
      token,
      volunteer: {
        id: v.id,
        volunteer_code: v.volunteer_code,
        name: v.name,
        branch: v.branch,
        role: v.role,
        points: v.points,
      },
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
}
