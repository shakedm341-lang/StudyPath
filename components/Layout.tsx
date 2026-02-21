import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { APP_VERSION } from '../version';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path 
    ? "bg-slate-800 text-white" 
    : "text-slate-400 hover:text-white hover:bg-slate-800";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-100 flex flex-col flex-shrink-0">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">
            StudyPath
          </h1>
          <p className="text-xs text-slate-500 mt-1">ניהול למידה אישי</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <Link to="/" className={`flex items-center px-4 py-3 rounded-lg transition-colors ${isActive('/')}`}>
            <svg className="w-5 h-5 ml-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            לוח בקרה
          </Link>
          <Link to="/review" className={`flex items-center px-4 py-3 rounded-lg transition-colors ${isActive('/review')}`}>
            <svg className="w-5 h-5 ml-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            חזרה יומית
          </Link>
        </nav>

        <div className="p-4 border-t border-slate-800 text-xs text-slate-500">
          <p>&copy; 2024 StudyPath</p>
          <p className="mt-1">גרסה {APP_VERSION}</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};