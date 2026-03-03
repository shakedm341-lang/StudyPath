import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './services/supabaseClient';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { GoalDetails } from './pages/GoalDetails';
import { ReviewSession } from './pages/ReviewSession';
import { WeeklyPlan } from './pages/WeeklyPlan';
import { DailyStats } from './pages/DailyStats';
import { Auth } from './pages/Auth';
import { ExamView } from './pages/ExamView';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="h-screen flex items-center justify-center bg-slate-50 text-slate-400">טוען...</div>;
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/goal/:id" element={<GoalDetails />} />
          <Route path="/goal/:id/exam/:examId" element={<ExamView />} />
          <Route path="/review" element={<ReviewSession />} />
          <Route path="/plan" element={<WeeklyPlan />} />
          <Route path="/stats" element={<DailyStats />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;