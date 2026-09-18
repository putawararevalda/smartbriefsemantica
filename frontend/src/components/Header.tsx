import React from 'react';
import { BookOpen, Sparkles, Network } from 'lucide-react';

export default function Header() {
  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">SmartBrief</h1>
              <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Semantica Powered
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">AI-Powered Article Summarizer & Knowledge Graph with Provenance</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            <Network className="w-3.5 h-3.5 text-indigo-600" />
            <span>Oxigraph Graph Store</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Audit Trail Active</span>
          </div>
        </div>
      </div>
    </header>
  );
}
