import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { storageService } from '../services/storageService';
import { Exercise, Attempt } from '../types';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { computeNextReviewDay } from '../utils/dateUtils';

function formatExerciseLocation(location: string) {
  // Normalize our internal "::" delimiter to a single colon for display,
  // and collapse any excess whitespace.
  return location.split('::').join(': ').replace(/\s+/g, ' ').trim();
}

export const ReviewSession: React.FC = () => {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<Exercise[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastAnswer, setLastAnswer] = useState<'success' | 'failure' | null>(null);
  const [lastAnswerStatus, setLastAnswerStatus] = useState<'success' | 'error' | null>(null);

  useEffect(() => {
    loadQueue();
  }, []);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const q = await storageService.getReviewQueue();
      setQueue(q);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    if (isSaving) return;
    if (currentIndex >= queue.length - 1) return;

    setCurrentIndex((prev) => prev + 1);
    setLastAnswer(null);
    setLastAnswerStatus(null);
  };

  const handleResult = async (success: boolean) => {
    if (isSaving) return;
    setIsSaving(true);
    setLastAnswer(success ? 'success' : 'failure');

    const currentEx = queue[currentIndex];
    const now = Date.now();
    
    // Update Attempt History
    try {
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
        updatedEx.nextReviewAt = computeNextReviewDay(now);
      }
      
      await storageService.updateExercise(updatedEx);

      // Update Goal counts
      const allGoals = await storageService.getGoals();
      const goal = allGoals.find(g => g.id === updatedEx.goalId);
      
      if (goal) {
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

      setLastAnswerStatus('success');
      // Clear feedback after a short delay so it doesn't linger too long
      setTimeout(() => {
        setLastAnswer(null);
        setLastAnswerStatus(null);
      }, 1200);
    } catch (e) {
      console.error('Error saving review result', e);
      setLastAnswerStatus('error');
    } finally {
      setIsSaving(false);
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
           
           <div
             className={`
               bg-slate-50 p-6 rounded-xl border w-full mb-10 transition-colors
               ${lastAnswerStatus === 'success' && lastAnswer === 'success' ? 'border-green-400 bg-green-50' : ''}
               ${lastAnswerStatus === 'success' && lastAnswer === 'failure' ? 'border-red-400 bg-red-50' : ''}
               ${lastAnswerStatus === 'error' ? 'border-red-500 bg-red-50' : 'border-slate-200'}
             `}
           >
             <p className="text-2xl md:text-3xl font-medium text-slate-800">
               {formatExerciseLocation(currentExercise.location)}
             </p>
           </div>
           
           <div className="w-full">
               <p className="text-slate-500 mb-4 text-sm">האם הצלחת לפתור נכון?</p>
               <div className="flex flex-col sm:flex-row gap-4 justify-center items-center w-full">
                  <Button
                    variant="secondary"
                    size="lg"
                    className="w-16 h-12 sm:w-12 sm:h-12 rounded-full p-0 order-3 sm:order-1 flex items-center justify-center"
                    onClick={handleSkip}
                    disabled={isSaving || currentIndex >= queue.length - 1}
                  >
                    <span aria-hidden="true" className="text-lg">
                      →
                    </span>
                  </Button>
                  <Button 
                    variant="danger" 
                    size="lg"
                    className="w-full sm:w-40 order-1 sm:order-2" 
                    onClick={() => handleResult(false)}
                    isLoading={isSaving && lastAnswer === 'failure'}
                  >
                    לא (מחר)
                  </Button>
                  <Button 
                    variant="success" 
                    size="lg"
                    className="w-full sm:w-40 order-2 sm:order-3" 
                    onClick={() => handleResult(true)}
                    isLoading={isSaving && lastAnswer === 'success'}
                  >
                    כן (הצלחה)
                  </Button>
               </div>
               {lastAnswerStatus === 'success' && (
                 <div className="mt-3 text-center text-xs">
                   <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
                     נשמר בהצלחה ✔
                   </span>
                 </div>
               )}
               {lastAnswerStatus === 'error' && (
                 <div className="mt-3 text-center text-xs">
                   <span className="inline-flex items-center px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
                     שגיאה בשמירה, נסה שוב
                   </span>
                 </div>
               )}
           </div>
        </Card>
      </div>
    </div>
  );
};