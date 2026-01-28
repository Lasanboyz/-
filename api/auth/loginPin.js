import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

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

    // ✅ บังคับ PIN 4 หลักเสมอ (ทั้งตั้งครั้งแรกและล็อกอิน)
    if (!/^\d{4}$/.test(pin)) {
      return res.status(400).json({ error: "PIN must be 4 digits" });
    }

    // ✅ ดึงอาสา
    const { data: v, error: vErr } = await supabase
      .from("volunteers")
      .select("id, volunteer_code, name, branch, role, points, pin_hash")
      .eq("volunteer_code", volunteer_code)
      .single();

    if (vErr || !v) {
      return res.status(404).json({ error: "Volunteer not found" });
    }

    // ✅ ถ้ายังไม่มี PIN -> ตั้งจากที่กรอก แล้วให้ผ่านต่อทันที
    if (!v.pin_hash) {
      const hash = await bcrypt.hash(pin, 10);

      // สำคัญ: อัปเดตเฉพาะกรณี pin_hash ยังเป็น null จริง ๆ เพื่อกัน overwrite
      const { data: updatedRows, error: uErr } = await supabase
        .from("volunteers")
        .update({
          pin_hash: hash,
          pin_set_at: new Date().toISOString(),
        })
        .eq("id", v.id)
        .is("pin_hash", null)
        .select("id");

      if (uErr) {
        return res.status(500).json({ error: uErr.message });
      }

      // ถ้า update ไม่เกิด (มีคนตั้ง PIN แทรกพอดี) -> ต้องตรวจ pin กับค่าใหม่อีกครั้ง
      if (!updatedRows || updatedRows.length === 0) {
        const { data: v2, error: v2Err } = await supabase
          .from("volunteers")
          .select("id, volunteer_code, name, branch, role, points, pin_hash")
          .eq("id", v.id)
          .single();

        if (v2Err || !v2 || !v2.pin_hash) {
          return res.status(500).json({ error: "Could not set PIN" });
        }

        const ok2 = await bcrypt.compare(pin, v2.pin_hash);
        if (!ok2) return res.status(401).json({ error: "Invalid PIN" });

        const token2 = jwt.sign(
          { volunteer_id: v2.id, volunteer_code: v2.volunteer_code, role: v2.role || "VOLUNTEER" },
          process.env.APP_JWT_SECRET,
          { expiresIn: "7d" }
        );

        return res.status(200).json({
          ok: true,
          token: token2,
          volunteer: {
            id: v2.id,
            volunteer_code: v2.volunteer_code,
            name: v2.name,
            branch: v2.branch,
            role: v2.role,
            points: v2.points,
          },
        });
      }

      // ตั้งสำเร็จ -> ออก token ได้เลย (ไม่ต้อง compare เพราะเราพึ่งตั้งจาก pin นี้เอง)
      const token = jwt.sign(
        { volunteer_id: v.id, volunteer_code: v.volunteer_code, role: v.role || "VOLUNTEER" },
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
        first_time_pin_set: true, // เผื่ออยากโชว์ toast "ตั้ง PIN สำเร็จ"
      });
    }

    // ✅ มี PIN อยู่แล้ว -> ตรวจตามปกติ
    const ok = await bcrypt.compare(pin, v.pin_hash);
    if (!ok) return res.status(401).json({ error: "Invalid PIN" });

    const token = jwt.sign(
      { volunteer_id: v.id, volunteer_code: v.volunteer_code, role: v.role || "VOLUNTEER" },
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
