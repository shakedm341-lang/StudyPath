import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { storageService } from '../services/storageService';
import { Exercise, Attempt } from '../types';
import { Button } from '../components/Button';
import { Card } from '../components/Card';

export const ReviewSession: React.FC = () => {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<Exercise[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQueue();
  }, []);

  const loadQueue = async () => {
    setLoading(true);
    const q = await storageService.getReviewQueue();
    setQueue(q);
    setLoading(false);
  };

  const handleResult = async (success: boolean) => {
    const currentEx = queue[currentIndex];
    const now = Date.now();
    
    // Update Attempt History
    const attempt: Attempt = {
      id: '', // DB generates
      exerciseId: currentEx.id,
      result: success ? 'success' : 'failure',
      timestamp: now
    };
    await storageService.logAttempt(attempt);

    // Update Exercise Status & Next Review
    const updatedEx = { ...currentEx };
    updatedEx.lastAttemptedAt = now;
    
    if (success) {
      updatedEx.status = 'green';
      updatedEx.consecutiveSuccesses += 1;
      // green = done (do not schedule again)
      updatedEx.nextReviewAt = null;
    } else {
      updatedEx.status = 'red';
      updatedEx.consecutiveSuccesses = 0;
      updatedEx.nextReviewAt = now + (24 * 60 * 60 * 1000);
    }
    
    await storageService.updateExercise(updatedEx);

    // Update Goal counts
    const allGoals = await storageService.getGoals();
    const goal = allGoals.find(g => g.id === updatedEx.goalId);
    
    if(goal) {
       const allEx = await storageService.getAllExercises(goal.id);
       const completed = allEx.filter(e => e.status !== 'new').length;
       
       const updatedGoal = { ...goal, completedExercises: completed };
       await storageService.updateGoal(updatedGoal);
    }

    if (currentIndex < queue.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setSessionComplete(true);
    }
  };

  if (loading) return <div className="text-center p-8">טוען תרגילים...</div>;

  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="bg-green-100 p-6 rounded-full mb-6">
          <svg className="w-16 h-16 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">הכל מעודכן!</h2>
        <p className="text-slate-500 max-w-md">
          אין לך תרגילים שממתינים לחזרה. בדוק שוב מאוחר יותר או הוסף מטרות חדשות כדי להמשיך ללמוד.
        </p>
        <Button className="mt-6" onClick={() => navigate('/')}>חזרה ללוח הבקרה</Button>
      </div>
    );
  }

  if (sessionComplete) {
     return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="bg-blue-100 p-6 rounded-full mb-6">
          <svg className="w-16 h-16 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">הסשן הסתיים!</h2>
        <p className="text-slate-500">
          עבודה מצוינת. סיימת את כל החזרות להיום.
        </p>
        <Button className="mt-6" onClick={() => navigate('/')}>חזרה ללוח הבקרה</Button>
      </div>
    );
  }

  const currentExercise = queue[currentIndex];

  return (
    <div className="max-w-2xl mx-auto pt-8">
      <div className="flex justify-between items-center mb-6">
        <span className="text-sm font-medium text-slate-500">
          סוקר {currentIndex + 1} מתוך {queue.length}
        </span>
        <button 
          onClick={() => navigate('/')} 
          className="text-slate-400 hover:text-slate-600"
        >
          יציאה
        </button>
      </div>

      <div className="relative">
        <Card className="min-h-[400px] flex flex-col justify-center items-center text-center p-8 md:p-12">
           <h3 className="text-slate-400 text-sm uppercase tracking-wider mb-6 font-semibold">פתור את התרגיל הבא</h3>
           
           <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 w-full mb-10">
               <p className="text-2xl md:text-3xl font-medium text-slate-800">
                 {currentExercise.location}
               </p>
           </div>
           
           <div className="w-full">
               <p className="text-slate-500 mb-4 text-sm">האם הצלחת לפתור נכון?</p>
               <div className="flex flex-col sm:flex-row gap-4 justify-center w-full">
                  <Button 
                    variant="danger" 
                    size="lg"
                    className="w-full sm:w-40" 
                    onClick={() => handleResult(false)}
                  >
                    לא (24ש)
                  </Button>
                  <Button 
                    variant="success" 
                    size="lg"
                    className="w-full sm:w-40" 
                    onClick={() => handleResult(true)}
                  >
                    כן (הצלחה)
                  </Button>
               </div>
           </div>
        </Card>
      </div>
    </div>
  );
};