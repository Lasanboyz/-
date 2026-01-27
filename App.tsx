import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Profile } from "./pages/Profile";
import { Rewards } from "./pages/Rewards";
import { Admin } from "./pages/Admin";
import { Leaderboard } from "./pages/Leaderboard";

const App: React.FC = () => {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />

          {/* ✅ id = volunteer_code (เช่น 80010301) */}
          <Route path="/profile/:id" element={<Profile />} />

          {/* ✅ Rewards ใหม่: ไม่ต้องส่ง volunteerCode ใน URL */}
          <Route path="/rewards" element={<Rewards />} />

          {/* ✅ รองรับลิงก์เก่า /rewards/:volunteerCode ให้เด้งกลับไป /rewards (กันคนยังมี bookmark) */}
          <Route path="/rewards/:volunteerCode" element={<Navigate to="/rewards" replace />} />

          <Route path="/admin" element={<Admin />} />
          <Route path="/leaderboard" element={<Leaderboard />} />

          {/* กัน URL แปลก ๆ */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
