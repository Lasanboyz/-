import { useState } from "react";

export default function PinLogin({ onSuccess }: { onSuccess: (data: any) => void }) {
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const login = async () => {
    setError("");
    const r = await fetch("/api/auth/loginPin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ volunteer_code: code, pin })
    });
    const data = await r.json();
    if (!r.ok) {
      setError(data.error || "login failed");
      return;
    }
    localStorage.setItem("auth_token", data.token);
    localStorage.setItem("auth_volunteer", JSON.stringify(data.volunteer));
    onSuccess(data.volunteer);
  };

  return (
    <div style={{ maxWidth: 360, margin: "40px auto" }}>
      <h2>เข้าสู่ระบบอาสา</h2>
      <input
        placeholder="รหัสอาสา"
        value={code}
        onChange={e => setCode(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 8 }}
      />
      <input
        placeholder="PIN 4 หลัก"
        type="password"
        value={pin}
        onChange={e => setPin(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 8 }}
      />
      <button onClick={login} style={{ width: "100%", padding: 10 }}>
        เข้าสู่ระบบ
      </button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
