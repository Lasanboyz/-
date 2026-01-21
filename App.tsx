import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Profile } from './pages/Profile';
import { Rewards } from './pages/Rewards';
import { Admin } from './pages/Admin';
import { Leaderboard } from './pages/Leaderboard';

const App: React.FC = () => {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/profile/:volunteerCode" element={<Profile />} />
          <Route path="/rewards/:volunteerId" element={<Rewards />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
