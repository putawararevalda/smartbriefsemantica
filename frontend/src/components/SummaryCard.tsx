import React from 'react';
import { AlignLeft, CheckCircle } from 'lucide-react';

interface SummaryCardProps {
  summary: string;
}

export default function SummaryCard({ summary }: SummaryCardProps) {
  if (!summary) return null;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-100">
        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
          <AlignLeft className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-900">Executive Summary</h3>
          <p className="text-xs text-slate-500">Synthesized overview derived from article semantics</p>
        </div>
      </div>
      <div className="prose prose-slate max-w-none text-sm leading-relaxed text-slate-700 bg-slate-50/70 p-4 rounded-xl border border-slate-200/60">
        {summary}
      </div>
    </div>
  );
}
