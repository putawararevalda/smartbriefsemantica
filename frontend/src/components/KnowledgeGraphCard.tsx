import React from 'react';
import { Network, Tag, Share2 } from 'lucide-react';
import { GraphConcept } from '@/types';

interface KnowledgeGraphCardProps {
  concepts?: GraphConcept[];
}

export default function KnowledgeGraphCard({ concepts }: KnowledgeGraphCardProps) {
  if (!concepts || concepts.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Network className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">Extracted Knowledge Graph Concepts</h3>
            <p className="text-xs text-slate-500">Entities and semantic triples captured in Oxigraph</p>
          </div>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
          {concepts.length} Concepts
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {concepts.map((concept, idx) => {
          const label = concept.label || concept.name || concept.id || `Concept ${idx + 1}`;
          const type = concept.type || 'Entity';
          const description = concept.description || '';
          const relations = concept.relations || [];

          return (
            <div
              key={concept.id || idx}
              className="p-4 rounded-xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/50 hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                    <Tag className="w-3 h-3" />
                    {type}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 truncate max-w-[120px]">
                    {concept.id}
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-slate-800 line-clamp-2">
                  {label}
                </h4>
                {description && (
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                    {description}
                  </p>
                )}
              </div>

              {relations && relations.length > 0 && (
                <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-slate-500">
                  <Share2 className="w-3 h-3 text-slate-400" />
                  <span className="truncate">{relations.join(', ')}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
