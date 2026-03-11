import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { storageService } from '../services/storageService';
import { Goal, Exam, Topic, Exercise } from '../types';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ConfirmModal } from '../components/ConfirmModal';

export const ExamView: React.FC = () => {
    const { id, examId } = useParams<{ id: string; examId: string }>();
    const navigate = useNavigate();

    const [goal, setGoal] = useState<Goal | null>(null);
    const [exam, setExam] = useState<Exam | null>(null);
    const [topics, setTopics] = useState<Topic[]>([]);
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [loading, setLoading] = useState(true);

    // Modals
    const [showExerciseModal, setShowExerciseModal] = useState(false);
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        isDestructive: boolean;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        isDestructive: false,
    });

    // Exercise Form State
    const [exLocation, setExLocation] = useState('');
    const [exDueDate, setExDueDate] = useState('');
    const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
    const [isBulkMode, setIsBulkMode] = useState(false);
    const [bulkList, setBulkList] = useState('');

    const [isGlobalEditMode, setIsGlobalEditMode] = useState(false);
    const [pendingEdits, setPendingEdits] = useState<Record<string, { location: string, topicIds: string[] }>>({});

    useEffect(() => {
        loadData();
    }, [id, examId]);

    const loadData = async () => {
        if (id && examId) {
            setLoading(true);
            const [allGoals, allExams, allTopics, allExercises] = await Promise.all([
                storageService.getGoals(),
                storageService.getExams(id),
                storageService.getTopics(id),
                storageService.getAllExercises(id, examId),
            ]);

            setGoal(allGoals.find(g => g.id === id) || null);
            setExam(allExams.find(e => e.id === examId) || null);
            setTopics(allTopics);
            setExercises(allExercises.filter(ex => ex.examId === examId));

            setLoading(false);
        }
    };

    const handleAddExercise = async () => {
        if (!id || !examId) return;

        const GROUP_NAME = 'שאלות ממבחנים';
        const examTitle = exam?.title || '';

        const buildLocation = (rawLocation: string) => {
            if (selectedTopics.length > 0) {
                return `${GROUP_NAME}::${examTitle ? examTitle + ' - ' : ''}${rawLocation}`;
            }
            return rawLocation;
        };

        let toSave: Exercise[] = [];

        if (!isBulkMode) {
            if (!exLocation.trim()) return;
            toSave.push({
                id: '',
                topicIds: selectedTopics,
                examId: examId,
                goalId: id,
                location: buildLocation(exLocation.trim()),
                status: 'new',
                consecutiveSuccesses: 0,
                dueDate: exDueDate ? new Date(exDueDate).getTime() : undefined,
                lastAttemptedAt: undefined,
                nextReviewAt: undefined,
            });
        } else {
            if (!bulkList.trim()) return;
            const items = bulkList
                .split(/[\n,]+/)
                .map(i => i.trim())
                .filter(i => i.length > 0);

            toSave = items.map(item => ({
                id: '',
                topicIds: selectedTopics,
                examId: examId,
                goalId: id,
                location: buildLocation(item),
                status: 'new',
                consecutiveSuccesses: 0,
                dueDate: exDueDate ? new Date(exDueDate).getTime() : undefined,
                lastAttemptedAt: undefined,
                nextReviewAt: undefined,
            }));
        }

        if (toSave.length > 0) {
            try {
                await storageService.saveExercises(toSave);
                setExLocation('');
                setBulkList('');
                setExDueDate('');
                setSelectedTopics([]);
                setShowExerciseModal(false);
                loadData();
            } catch (err) {
                console.error(err);
                alert('שגיאה בשמירת השאלות. ודא שמחוקה העמודה topic_id ב-Supabase שכן זו שגיאה נפוצה, ואם לא, בדוק בקונסול.');
            }
        }
    };

    const handleStatusChange = async (exerciseId: string, status: 'new' | 'green' | 'red' | 'orange') => {
        const exItem = exercises.find(e => e.id === exerciseId);
        if (!exItem) return;

        const updated = {
            ...exItem,
            status,
            lastAttemptedAt: Date.now(),
            consecutiveSuccesses: status === 'green' ? exItem.consecutiveSuccesses + 1 : 0
        };

        // Optimistic update
        setExercises(prev => prev.map(e => e.id === exerciseId ? updated : e));

        await storageService.updateExercise(updated);
        await storageService.logAttempt({
            id: '',
            exerciseId,
            result: status === 'green' ? 'success' : 'failure',
            timestamp: Date.now()
        });
        loadData();
    };

    const handleDeleteExercise = (exerciseId: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'מחיקת תרגיל',
            message: 'האם אתה בטוח שברצונך למחוק תרגיל זה?',
            isDestructive: true,
            onConfirm: async () => {
                await storageService.deleteExercise(exerciseId);
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                loadData();
            },
        });
    };

    const toggleTopicSelection = (topicId: string) => {
        setSelectedTopics(prev =>
            prev.includes(topicId) ? prev.filter(t => t !== topicId) : [...prev, topicId]
        );
    };

    const handleEnterEditMode = () => {
        const initialEdits: Record<string, { location: string, topicIds: string[] }> = {};
        exercises.forEach(ex => {
            initialEdits[ex.id] = { location: ex.location, topicIds: ex.topicIds || [] };
        });
        setPendingEdits(initialEdits);
        setIsGlobalEditMode(true);
    };

    const handleSaveEdits = async () => {
        setLoading(true);
        const GROUP_NAME = 'שאלות ממבחנים';
        const examTitle = exam?.title || '';
        const promises = [];
        for (const ex of exercises) {
            const edit = pendingEdits[ex.id];
            if (!edit) continue;
            const originalTopics = [...(ex.topicIds || [])].sort().join(',');
            const newTopics = [...edit.topicIds].sort().join(',');

            // Update location based on topic assignment changes
            let newLocation = edit.location;
            const hadTopics = (ex.topicIds || []).length > 0;
            const hasTopicsNow = edit.topicIds.length > 0;
            const isAlreadyGrouped = edit.location.startsWith(`${GROUP_NAME}::`);

            if (hasTopicsNow && !isAlreadyGrouped) {
                // Gained topic(s): wrap in group
                newLocation = `${GROUP_NAME}::${examTitle ? examTitle + ' - ' : ''}${edit.location}`;
            } else if (!hasTopicsNow && hadTopics && isAlreadyGrouped) {
                // Lost all topics: strip group prefix
                newLocation = edit.location.replace(`${GROUP_NAME}::`, '').replace(`${examTitle} - `, '');
            }

            if (newLocation !== ex.location || originalTopics !== newTopics) {
                promises.push(storageService.updateExerciseFull({
                    ...ex,
                    location: newLocation,
                    topicIds: edit.topicIds
                }));
            }
        }
        if (promises.length > 0) {
            await Promise.all(promises);
            await loadData();
        } else {
            setLoading(false);
        }
        setIsGlobalEditMode(false);
    };

    if (loading || !goal || !exam) {
        return <div className="text-center p-8 text-slate-500">טוען נתונים...</div>;
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(`/goal/${id}`)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <svg className="w-5 h-5 text-slate-600 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">{exam.title}</h1>
                        <div className="text-slate-500 mt-1 flex items-center gap-2">
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-sm">{goal.title}</span>
                            {exam.description && <span>• {exam.description}</span>}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isGlobalEditMode ? (
                        <>
                            <Button variant="secondary" onClick={() => setIsGlobalEditMode(false)}>ביטול</Button>
                            <Button onClick={handleSaveEdits}>שמור שינויים</Button>
                        </>
                    ) : (
                        <>
                            <Button variant="secondary" onClick={handleEnterEditMode}>עריכת שאלות</Button>
                            <Button onClick={() => setShowExerciseModal(true)}>+ הוסף שאלות למבחן</Button>
                        </>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {exercises.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-dashed border-slate-300">
                        עדיין לא נוספו שאלות/תרגילים למבחן זה.
                    </div>
                ) : (
                    exercises.map(ex => {
                        const exTopics = topics.filter(t => ex.topicIds?.includes(t.id)).map(t => t.title).join(', ');
                        // Show original question name: strip "שאלות ממבחנים::" prefix and exam title prefix
                        const GROUP_NAME = '\u05e9\u05d0\u05dc\u05d5\u05ea \u05de\u05de\u05d1\u05d7\u05e0\u05d9\u05dd';
                        let displayLocation: string;
                        if (ex.location.startsWith(`${GROUP_NAME}::`)) {
                            const afterGroup = ex.location.slice(`${GROUP_NAME}::`.length);
                            const examPrefix = exam.title ? `${exam.title} - ` : '';
                            displayLocation = examPrefix && afterGroup.startsWith(examPrefix)
                                ? afterGroup.slice(examPrefix.length)
                                : afterGroup;
                        } else {
                            displayLocation = ex.location.split('::').join(': ').replace(/\s+/g, ' ').trim();
                        }

                        return (
                            <Card key={ex.id} className="hover:shadow-md transition-shadow">
                                {!isGlobalEditMode ? (
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-semibold text-slate-800">{displayLocation}</h4>
                                            {exTopics && (
                                                <p className="text-sm text-slate-500 mt-1">
                                                    נושאים: {exTopics}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-2 mt-3 z-[50]">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        handleStatusChange(ex.id, 'red');
                                                    }}
                                                    title="סמן כנכשל/בוצע בקושי"
                                                    className={`p-1.5 rounded hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors ${ex.status === 'red' ? 'text-red-500 bg-red-50' : ''}`}
                                                >
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        handleStatusChange(ex.id, 'green');
                                                    }}
                                                    title="סמן כבוצע בהצלחה"
                                                    className={`p-1.5 rounded hover:bg-green-100 text-slate-400 hover:text-green-600 transition-colors ${ex.status === 'green' ? 'text-green-500 bg-green-50' : ''}`}
                                                >
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </button>

                                                {ex.status === 'new' && (
                                                    <span className="text-xs font-medium text-slate-400 mr-2 flex items-center gap-1">
                                                        <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                                                        שאלה חדשה
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteExercise(ex.id)}
                                            className="p-2 text-slate-300 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors"
                                            title="מחק תרגיל"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-4">
                                        <div className="flex justify-between items-center">
                                            <input
                                                className="font-semibold text-slate-800 border-b border-slate-300 focus:border-blue-500 outline-none px-1 py-0.5 w-full bg-transparent"
                                                value={pendingEdits[ex.id]?.location || ''}
                                                onChange={(e) => setPendingEdits(prev => ({ ...prev, [ex.id]: { ...prev[ex.id], location: e.target.value } }))}
                                            />
                                            <button
                                                onClick={() => handleDeleteExercise(ex.id)}
                                                className="p-2 text-slate-300 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors mr-2"
                                                title="מחק תרגיל"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {topics.map(t => {
                                                const isSelected = pendingEdits[ex.id]?.topicIds.includes(t.id);
                                                return (
                                                    <label key={t.id} className={`cursor-pointer px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${isSelected ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                                                        <input
                                                            type="checkbox"
                                                            className="hidden"
                                                            checked={isSelected}
                                                            onChange={() => {
                                                                setPendingEdits(prev => {
                                                                    const currentIds = prev[ex.id]?.topicIds || [];
                                                                    const newIds = isSelected ? currentIds.filter(id => id !== t.id) : [...currentIds, t.id];
                                                                    return { ...prev, [ex.id]: { ...prev[ex.id], topicIds: newIds } };
                                                                });
                                                            }}
                                                        />
                                                        {t.title}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </Card>
                        );
                    })
                )}
            </div>

            {showExerciseModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
                            <h3 className="text-xl font-semibold text-slate-800">הוספת שאלות למבחן</h3>
                            <button
                                onClick={() => {
                                    setShowExerciseModal(false);
                                    setIsBulkMode(false);
                                    setExLocation('');
                                    setBulkList('');
                                    setSelectedTopics([]);
                                }}
                                className="text-slate-400 hover:text-slate-600 bg-white hover:bg-slate-100 rounded-full p-2 transition-colors shadow-sm"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-6 space-y-6 overflow-y-auto flex-1">
                            <div className="flex items-center gap-4 p-1 bg-slate-100 rounded-xl">
                                <button
                                    onClick={() => setIsBulkMode(false)}
                                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${!isBulkMode ? 'bg-white shadow-sm text-blue-600' : 'text-slate-600 hover:bg-slate-200/50'
                                        }`}
                                >
                                    הזנה בודדת
                                </button>
                                <button
                                    onClick={() => setIsBulkMode(true)}
                                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${isBulkMode ? 'bg-white shadow-sm text-blue-600' : 'text-slate-600 hover:bg-slate-200/50'
                                        }`}
                                >
                                    הזנה מרובה
                                </button>
                            </div>

                            {!isBulkMode ? (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                            זיהוי השאלה
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="למשל: שאלה 1, או תרגיל 5"
                                            value={exLocation}
                                            onChange={(e) => setExLocation(e.target.value)}
                                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors shadow-sm"
                                            autoFocus
                                        />
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-4 animate-fade-in">
                                    <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm leading-relaxed">
                                        צור רשימת שאלות שייכנסו למבחן.
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                            מספרי שאלות (מופרדים בפסיק, רווח או אנטר)
                                        </label>
                                        <textarea
                                            placeholder={"לדוגמה:\n1, 2, 3\nאו\n1א\n1ב"}
                                            value={bulkList}
                                            onChange={(e) => setBulkList(e.target.value)}
                                            rows={4}
                                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors shadow-sm resize-none"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Topic Selection for Exercises in Exam */}
                            <div className="border-t border-slate-100 pt-5">
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    שיוך לנושאים (אופציונלי)
                                </label>
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-48 overflow-y-auto">
                                    {topics.length === 0 ? (
                                        <p className="text-sm text-slate-500 text-center py-2">אין נושאים מוגדרים למטרה זו.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {topics.map(topic => (
                                                <label key={topic.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                        checked={selectedTopics.includes(topic.id)}
                                                        onChange={() => toggleTopicSelection(topic.id)}
                                                    />
                                                    <span className="text-sm text-slate-700">{topic.title}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>

                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 flex-shrink-0">
                            <Button variant="ghost" onClick={() => {
                                setShowExerciseModal(false);
                                setIsBulkMode(false);
                                setExLocation('');
                                setBulkList('');
                                setSelectedTopics([]);
                            }}>
                                ביטול
                            </Button>
                            <Button onClick={handleAddExercise} disabled={(!isBulkMode && !exLocation.trim()) || (isBulkMode && !bulkList.trim())}>
                                שמור שאלו{isBulkMode ? 'ת' : 'ה'} במבחן
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                onConfirm={confirmModal.onConfirm}
                onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                isDestructive={confirmModal.isDestructive}
            />
        </div>
    );
};
