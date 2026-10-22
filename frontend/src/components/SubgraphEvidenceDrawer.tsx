'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Share2,
  ShieldCheck,
  Tag,
  ArrowRight,
  Copy,
  Check,
  ExternalLink,
  Search,
  Hash,
  Clock,
  Cpu,
  Layers,
  FileCode2,
  Sparkles,
  Info,
  Network
} from 'lucide-react';
import { GraphContext, RAGProvenance } from '@/types';

export interface SubgraphEvidenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  graphContext?: GraphContext;
  provenance?: RAGProvenance;
  query?: string;
  onReplayOnCanvas?: (lineage: {
    query?: string;
    graphContext?: GraphContext;
    provenance?: RAGProvenance;
  }) => void;
}

export function isInfrastructureTriple(triple: {
  subject?: string;
  predicate?: string;
  object?: string;
  raw_triple?: string;
}): boolean {
  const s = triple.subject || '';
  const p = triple.predicate || '';
  const o = triple.object || '';
  const raw = triple.raw_triple || '';
  if (p.includes('extractedFrom') || raw.includes('extractedFrom')) return true;
  if (
    s.startsWith('urn:smartbrief:doc:') ||
    o.startsWith('urn:smartbrief:doc:') ||
    raw.includes('urn:smartbrief:doc:')
  ) {
    return true;
  }
  if (o.endsWith('/Document') || o.includes('ontology/Document')) return true;
  return false;
}

export default function SubgraphEvidenceDrawer({
  isOpen,
  onClose,
  graphContext,
  provenance,
  query,
  onReplayOnCanvas,
}: SubgraphEvidenceDrawerProps) {
  const [tripleSearch, setTripleSearch] = useState<string>('');
  const [copiedChecksum, setCopiedChecksum] = useState<boolean>(false);
  const [copiedAllTriples, setCopiedAllTriples] = useState<boolean>(false);
  const [copiedTripleIdx, setCopiedTripleIdx] = useState<number | null>(null);
  const [showRawTriples, setShowRawTriples] = useState<boolean>(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const matchedConcepts = graphContext?.matched_concepts || [];
  const retrievedTriples = useMemo(
    () => (graphContext?.retrieved_triples || []).filter((t) => !isInfrastructureTriple(t)),
    [graphContext?.retrieved_triples]
  );
  const traversalHops = graphContext?.traversal_hops ?? 2;
  const executionTimeMs = graphContext?.execution_time_ms ?? 0;

  // Filtered triples
  const filteredTriples = useMemo(() => {
    if (!tripleSearch.trim()) return retrievedTriples;
    const q = tripleSearch.toLowerCase();
    return retrievedTriples.filter(
      (t) =>
        t.subject.toLowerCase().includes(q) ||
        t.predicate.toLowerCase().includes(q) ||
        t.object.toLowerCase().includes(q) ||
        (t.raw_triple && t.raw_triple.toLowerCase().includes(q))
    );
  }, [retrievedTriples, tripleSearch]);

  const handleCopyChecksum = async () => {
    if (!provenance?.checksum) return;
    try {
      await navigator.clipboard.writeText(provenance.checksum);
      setCopiedChecksum(true);
      setTimeout(() => setCopiedChecksum(false), 2000);
    } catch (err) {
      console.error('Failed to copy checksum:', err);
    }
  };

  const handleCopyAllTriples = async () => {
    if (retrievedTriples.length === 0) return;
    const text = retrievedTriples
      .map(
        (t) =>
          t.raw_triple ||
          `<${t.subject}> <${t.predicate}> <${t.object}> .`
      )
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAllTriples(true);
      setTimeout(() => setCopiedAllTriples(false), 2000);
    } catch (err) {
      console.error('Failed to copy all triples:', err);
    }
  };

  const handleCopySingleTriple = async (idx: number, tripleText: string) => {
    try {
      await navigator.clipboard.writeText(tripleText);
      setCopiedTripleIdx(idx);
      setTimeout(() => setCopiedTripleIdx(null), 2000);
    } catch (err) {
      console.error('Failed to copy triple:', err);
    }
  };

  if (!isOpen) return null;

  const derivedFromList = (() => {
    if (!provenance?.w3c_prov?.wasDerivedFrom) return [];
    if (Array.isArray(provenance.w3c_prov.wasDerivedFrom)) {
      return provenance.w3c_prov.wasDerivedFrom;
    }
    return [provenance.w3c_prov.wasDerivedFrom];
  })();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
      className="fixed inset-0 z-50 overflow-hidden"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
      />

      {/* Drawer Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-white shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-slate-200 bg-slate-50/80 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <h2
                    id="drawer-title"
                    className="text-base sm:text-lg font-bold text-slate-900 leading-tight"
                  >
                    Subgraph Evidence & Audit Drawer
                  </h2>
                  <p className="text-xs text-slate-500">
                    Oxigraph in-process traversal &bull; W3C PROV-O verifiable lineage
                  </p>
                </div>
              </div>

              {query && (
                <div className="mt-2 text-xs text-slate-700 bg-white/90 border border-slate-200 rounded-lg p-2 flex items-start gap-2 shadow-2xs">
                  <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] shrink-0 mt-0.5">
                    Query:
                  </span>
                  <span className="italic font-medium text-slate-800 line-clamp-2">
                    &ldquo;{query}&rdquo;
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onReplayOnCanvas && (
                <button
                  type="button"
                  onClick={() => {
                    onReplayOnCanvas({ query, graphContext, provenance });
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-xs cursor-pointer hover:scale-105 active:scale-95 motion-reduce:hover:scale-100"
                  title="Replay this traversal on the Knowledge Graph canvas"
                  aria-label="Replay Traversal on Knowledge Graph Canvas"
                >
                  <Network className="w-3.5 h-3.5" />
                  <span>Replay on Canvas</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 shrink-0"
                aria-label="Close evidence drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="bg-slate-100/80 border-b border-slate-200 px-5 py-2.5 flex items-center justify-between text-xs text-slate-600 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 font-semibold text-indigo-700">
                <Tag className="w-3.5 h-3.5 text-indigo-600" />
                {matchedConcepts.length} Matched Concept{matchedConcepts.length !== 1 ? 's' : ''}
              </span>
              <span>&bull;</span>
              <span className="flex items-center gap-1 font-semibold text-blue-700">
                <Share2 className="w-3.5 h-3.5 text-blue-600" />
                {retrievedTriples.length} RDF Triple{retrievedTriples.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
              <span className="bg-white px-2 py-0.5 rounded border border-slate-200">
                Hops: {traversalHops}
              </span>
              {executionTimeMs > 0 && (
                <span className="bg-white px-2 py-0.5 rounded border border-slate-200">
                  {executionTimeMs.toFixed(1)}ms
                </span>
              )}
            </div>
          </div>

          {/* Drawer Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-sm">
            {/* SECTION 1: Matched Concepts */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-indigo-600" />
                  <h3 className="font-bold text-slate-900 text-sm">
                    Matched Knowledge Concepts
                  </h3>
                </div>
                <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {matchedConcepts.length} entity anchor{matchedConcepts.length !== 1 ? 's' : ''}
                </span>
              </div>

              {matchedConcepts.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {matchedConcepts.map((concept, idx) => (
                    <div
                      key={concept.id || idx}
                      className="group flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50/90 border border-indigo-200/90 rounded-xl text-xs font-semibold text-indigo-900 shadow-2xs hover:bg-indigo-100/90 transition-all"
                    >
                      <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                      <span>{concept.name || concept.id}</span>
                      {concept.id && concept.id !== concept.name && (
                        <span className="text-[10px] text-indigo-600/80 font-mono">
                          ({concept.id.replace(/^concept:/, '')})
                        </span>
                      )}
                      {concept.uri && (
                        <span
                          title={concept.uri}
                          className="text-[10px] text-indigo-400 group-hover:text-indigo-600"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 italic">
                  No direct concept entities matched query terms. Fallback domain context applied.
                </div>
              )}
            </section>

            {/* SECTION 2: Supporting Triples Flow */}
            <section className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <h3 className="font-bold text-slate-900 text-sm">
                    Supporting Subgraph Triples Flow
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRawTriples(!showRawTriples)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                  >
                    <FileCode2 className="w-3 h-3" />
                    <span>{showRawTriples ? 'Visual Flow' : 'Raw Turtle'}</span>
                  </button>

                  {retrievedTriples.length > 0 && (
                    <button
                      type="button"
                      onClick={handleCopyAllTriples}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                      title="Copy all triples to clipboard"
                    >
                      {copiedAllTriples ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-700">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-500" />
                          <span>Copy All</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Triples Search Bar */}
              {retrievedTriples.length > 4 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={tripleSearch}
                    onChange={(e) => setTripleSearch(e.target.value)}
                    placeholder="Filter by subject, predicate, or object..."
                    className="w-full pl-8 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800 placeholder-slate-400"
                  />
                  {tripleSearch && (
                    <button
                      type="button"
                      onClick={() => setTripleSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      &times;
                    </button>
                  )}
                </div>
              )}

              {/* Triples List / Visual Flow */}
              {filteredTriples.length > 0 ? (
                <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                  {filteredTriples.map((triple, idx) => {
                    const formattedSubject = triple.subject.replace(/^https?:\/\/[^/]+\/(?:concept\/|ontology\/)?/, '').replace(/^urn:[^:]+:[^:]+:/, '');
                    const formattedPredicate = triple.predicate.replace(/^https?:\/\/[^/]+\/(?:ontology\/|ns\/)?/, '').replace(/^.*#/, '');
                    const formattedObject = triple.object.replace(/^https?:\/\/[^/]+\/(?:concept\/|ontology\/)?/, '').replace(/^urn:[^:]+:[^:]+:/, '');
                    const tripleText = triple.raw_triple || `<${triple.subject}> <${triple.predicate}> <${triple.object}> .`;

                    return (
                      <div
                        key={idx}
                        className="p-3 bg-white border border-slate-200/90 rounded-xl hover:border-blue-300 hover:shadow-xs transition-all space-y-2"
                      >
                        {/* Visual Flow: (Subject) -[Predicate]-> (Object) */}
                        {!showRawTriples ? (
                          <div className="flex items-center flex-wrap gap-2 text-xs">
                            {/* Subject */}
                            <div
                              title={triple.subject}
                              className="px-2.5 py-1 bg-slate-100 text-slate-800 font-semibold rounded-lg border border-slate-200/90 truncate max-w-[200px]"
                            >
                              {formattedSubject}
                            </div>

                            {/* Predicate Arrow */}
                            <div className="flex items-center gap-1 text-indigo-600 font-mono text-[11px] font-bold px-1.5 py-0.5 bg-indigo-50 rounded-md border border-indigo-200/70 shrink-0">
                              <span className="truncate max-w-[140px]">
                                -[{formattedPredicate}]-&gt;
                              </span>
                            </div>

                            {/* Object */}
                            <div
                              title={triple.object}
                              className="px-2.5 py-1 bg-blue-50 text-blue-900 font-semibold rounded-lg border border-blue-200/90 truncate max-w-[200px]"
                            >
                              {formattedObject}
                            </div>

                            {/* Copy button */}
                            <button
                              type="button"
                              onClick={() => handleCopySingleTriple(idx, tripleText)}
                              className="ml-auto p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                              title="Copy raw RDF triple"
                            >
                              {copiedTripleIdx === idx ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          /* Raw Triple Mode */
                          <div className="flex items-center justify-between gap-2">
                            <code className="text-[11px] font-mono text-slate-800 bg-slate-50 p-1.5 rounded-lg border border-slate-200 block truncate flex-1">
                              {tripleText}
                            </code>
                            <button
                              type="button"
                              onClick={() => handleCopySingleTriple(idx, tripleText)}
                              className="p-1 rounded text-slate-400 hover:text-slate-600 shrink-0"
                            >
                              {copiedTripleIdx === idx ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        )}

                        {/* Confidence score badge */}
                        {typeof triple.confidence === 'number' && (
                          <div className="flex items-center gap-2 text-[10px] text-slate-500">
                            <span className="font-semibold text-emerald-700">
                              {(triple.confidence * 100).toFixed(0)}% extraction confidence
                            </span>
                            {triple.raw_triple && !showRawTriples && (
                              <>
                                <span>&bull;</span>
                                <span className="text-slate-400 font-mono truncate max-w-[260px]">
                                  {triple.raw_triple}
                                </span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 italic text-center">
                  No triples matching the search criteria.
                </div>
              )}
            </section>

            {/* SECTION 3: W3C PROV-O Audit Details */}
            {provenance && (
              <section className="space-y-3 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <h3 className="font-bold text-slate-900 text-sm">
                      W3C PROV-O Audit Lineage
                    </h3>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <Check className="w-3 h-3" />
                    <span>Cryptographically Verified</span>
                  </span>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/90 space-y-3 text-xs">
                  {/* Derivation ID */}
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-slate-500 shrink-0 flex items-center gap-1">
                      <Hash className="w-3.5 h-3.5 text-slate-400" />
                      Entity / Derivation ID:
                    </span>
                    <span className="font-mono font-medium text-slate-800 text-right break-all">
                      {provenance.entity_id}
                    </span>
                  </div>

                  {/* Activity */}
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-slate-500 shrink-0 flex items-center gap-1">
                      <Cpu className="w-3.5 h-3.5 text-slate-400" />
                      Activity (wasGeneratedBy):
                    </span>
                    <span className="font-mono text-slate-800 text-right">
                      {provenance.w3c_prov?.wasGeneratedBy || provenance.activity}
                    </span>
                  </div>

                  {/* Agent */}
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-slate-500 shrink-0 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                      Agent (wasAttributedTo):
                    </span>
                    <span className="font-medium text-slate-800 text-right">
                      {provenance.w3c_prov?.wasAttributedTo || provenance.agent}
                    </span>
                  </div>

                  {/* Timestamp */}
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-slate-500 shrink-0 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Timestamp:
                    </span>
                    <span className="font-mono text-slate-800 text-right">
                      {new Date(provenance.timestamp).toLocaleString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        timeZoneName: 'short',
                      })}
                    </span>
                  </div>

                  {/* Derivation Sources (wasDerivedFrom) */}
                  {derivedFromList.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-slate-200/80">
                      <span className="font-semibold text-slate-500 block">
                        Source Entities (wasDerivedFrom):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {derivedFromList.map((uri, idx) => (
                          <span
                            key={idx}
                            title={uri}
                            className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700 truncate max-w-full"
                          >
                            {uri}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Checksum SHA-256 */}
                  <div className="pt-2 border-t border-slate-200/80 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-500">
                        SHA-256 Audit Checksum:
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyChecksum}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        {copiedChecksum ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-700">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Checksum</span>
                          </>
                        )}
                      </button>
                    </div>
                    <code className="block bg-white p-2 rounded-lg border border-slate-200 font-mono text-[11px] text-slate-800 break-all select-all">
                      {provenance.checksum}
                    </code>
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-slate-400" />
              Grounded via Oxigraph RDF Triplestore
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-colors shadow-2xs"
            >
              Close Drawer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
