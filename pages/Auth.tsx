import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Button } from '../components/Button';
import { Card } from '../components/Card';

export const Auth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage({ text: 'הרשמה בוצעה בהצלחה! בדוק את המייל שלך לאימות.', type: 'success' });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        // Success handled by Auth state change listener in App.tsx
      }
    } catch (error: any) {
      setMessage({ text: error.message || 'אירעה שגיאה', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-500 to-teal-400 bg-clip-text text-transparent">
          StudyPath
        </h1>
        <p className="text-slate-500 mt-2">התחבר כדי לנהל את הלמידה שלך</p>
      </div>

      <Card className="w-full max-w-md p-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">
          {mode === 'login' ? 'כניסה למערכת' : 'הרשמה'}
        </h2>

        {message && (
          <div className={`p-3 rounded-lg mb-4 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
            {message.text}
          </div>
        )}

        <div className="space-y-4">
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">אימייל</label>
              <input
                type="email"
                required
                className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">סיסמה</label>
              <input
                type="password"
                required
                minLength={6}
                className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <Button type="submit" className="w-full" isLoading={loading}>
              {mode === 'login' ? 'התחבר' : 'הירשם'}
            </Button>
          </form>
        </div>

        <div className="mt-6 text-center text-sm text-slate-600">
          {mode === 'login' ? 'אין לך חשבון? ' : 'יש לך כבר חשבון? '}
          <button
            onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setMessage(null);
            }}
            className="text-blue-600 font-medium hover:underline"
          >
            {mode === 'login' ? 'הירשם כאן' : 'התחבר כאן'}
          </button>
        </div>
      </Card>
    </div>
  );
};