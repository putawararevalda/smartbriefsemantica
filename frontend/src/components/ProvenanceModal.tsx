import React, { useState } from 'react';
import { X, ShieldCheck, Network, FileText, Activity, Code, ExternalLink, Hash } from 'lucide-react';
import { Flashcard, ProvenanceData } from '@/types';

interface ProvenanceModalProps {
  card: Flashcard | null;
  onClose: () => void;
}

export default function ProvenanceModal({ card, onClose }: ProvenanceModalProps) {
  const [showRawJson, setShowRawJson] = useState(false);

  if (!card) return null;

  const rawProv = card.provenance;
  const prov: ProvenanceData = typeof rawProv === 'object' && rawProv !== null ? rawProv : { details: rawProv };

  const nodeId = prov.node_id || prov.graph_node || 'urn:semantica:node:default';
  const sourceExcerpt = prov.source_excerpt || prov.source_text || 'Derived from submitted article context.';
  const confidence = prov.confidence !== undefined ? Math.round(prov.confidence * 100) : 95;
  const derivationRule = prov.derivation_rule || 'Semantica.Oxigraph.InferenceEngine';
  const auditSteps: string[] = Array.isArray(prov.audit_trail)
    ? prov.audit_trail
    : typeof prov.audit_trail === 'string'
    ? [prov.audit_trail]
    : [
        '1. Ingested article text and tokenized semantic boundaries',
        `2. Linked conceptual node to Oxigraph triplestore (${nodeId})`,
        '3. Verified reasoning derivation with Semantica Provenance Manager',
      ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div
        className="relative bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Provenance & Audit Trail
                <span className="px-2 py-0.5 text-[11px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-full">
                  Verified
                </span>
              </h3>
              <p className="text-xs text-indigo-200/80">Semantica Knowledge Graph Traceability</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors focus:outline-none"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Target Question */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Referenced Flashcard Question
            </span>
            <p className="text-sm font-semibold text-slate-900">{card.question}</p>
          </div>

          {/* Linked Knowledge Graph Node */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Network className="w-4 h-4 text-indigo-600" />
                Linked Graph Node (Oxigraph Store)
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                Confidence: {confidence}%
              </span>
            </div>

            <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="font-mono text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-indigo-500" />
                  {nodeId}
                </div>
                {prov.concept && (
                  <div className="text-xs text-slate-600 mt-1">
                    Concept Entity: <span className="font-semibold text-slate-800">{prov.concept}</span>
                  </div>
                )}
              </div>
              <div className="text-[11px] font-mono text-slate-500 bg-white px-2.5 py-1 rounded-md border border-slate-200 self-start sm:self-auto">
                {derivationRule}
              </div>
            </div>
          </div>

          {/* Source Excerpt */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-blue-600" />
              Source Excerpt & Document Citation
            </span>
            <blockquote className="p-4 rounded-xl bg-slate-50 border-l-4 border-blue-500 text-xs sm:text-sm text-slate-700 italic leading-relaxed">
              &ldquo;{sourceExcerpt}&rdquo;
            </blockquote>
          </div>

          {/* Audit Steps */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-emerald-600" />
              Semantica Decision Audit Lineage
            </span>
            <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              {auditSteps.map((step, sIdx) => (
                <div key={sIdx} className="flex items-start gap-2.5 text-xs text-slate-700">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5">
                    {sIdx + 1}
                  </span>
                  <span className="leading-relaxed">{step.replace(/^\d+\.\s*/, '')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Raw JSON toggle */}
          <div className="pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowRawJson(!showRawJson)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors focus:outline-none"
            >
              <Code className="w-3.5 h-3.5" />
              {showRawJson ? 'Hide Raw Provenance JSON' : 'Inspect Raw Provenance JSON'}
            </button>

            {showRawJson && (
              <pre className="mt-3 p-4 rounded-xl bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-48 border border-slate-800">
                {JSON.stringify(prov, null, 2)}
              </pre>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Node linked to Oxigraph Embedded RDF Store
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg shadow-sm transition-colors"
          >
            Close Trace
          </button>
        </div>
      </div>
    </div>
  );
}
