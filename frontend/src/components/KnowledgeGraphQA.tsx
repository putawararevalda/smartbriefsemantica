'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Share2,
  AlertCircle,
  RotateCcw,
  Tag,
  ShieldCheck,
  Bot,
  User,
  HelpCircle,
  Layers,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  CheckCircle2,
  X
} from 'lucide-react';
import { GraphConcept, RAGChatMessage, RAGQueryResponse, GraphContext, RAGProvenance } from '@/types';
import SubgraphEvidenceDrawer, { isInfrastructureTriple } from './SubgraphEvidenceDrawer';

export interface KnowledgeGraphQAProps {
  sessionId: string;
  concepts: GraphConcept[];
  documentTitle?: string;
  tripletCount?: number;
}

export default function KnowledgeGraphQA({
  sessionId,
  concepts,
  documentTitle = 'Current Document',
  tripletCount = 0,
}: KnowledgeGraphQAProps) {
  const [messages, setMessages] = useState<RAGChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<number>(1);
  const [errorToast, setErrorToast] = useState<{ message: string; isExpired?: boolean } | null>(null);

  // Subgraph Evidence Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [activeEvidence, setActiveEvidence] = useState<{
    graphContext?: GraphContext;
    provenance?: RAGProvenance;
    query?: string;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cycle loading traversal pipeline stages (SMAR-22)
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (isLoading) {
      setLoadingStep(1);
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev >= 3 ? 1 : prev + 1));
      }, 700);
    } else {
      setLoadingStep(1);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Generate dynamic suggestion chips based on extracted concepts
  const suggestionChips = useMemo(() => {
    const conceptNames = concepts
      .map((c) => c.label || c.name || c.id)
      .filter(Boolean);

    const chips: string[] = [];

    if (conceptNames.length >= 2) {
      chips.push(`How does ${conceptNames[0]} relate to ${conceptNames[1]}?`);
    }
    if (conceptNames.length >= 1) {
      chips.push(`What is the primary role of ${conceptNames[0]}?`);
    }
    if (conceptNames.length >= 3) {
      chips.push(`How are ${conceptNames[1]} and ${conceptNames[2]} interconnected?`);
    } else if (conceptNames.length >= 1) {
      chips.push(`What evidence in the knowledge graph supports ${conceptNames[0]}?`);
    }
    chips.push('What are the core asserted relationships in this document?');

    return chips.slice(0, 4);
  }, [concepts]);

  // Execute RAG Query
  const handleSendQuery = async (queryToSend?: string) => {
    const q = (queryToSend || inputQuery).trim();
    if (!q || isLoading) return;

    setErrorToast(null);

    // 1. Add user message
    const userMsg: RAGChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: q,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/rag/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId || 'proc_active_session',
          query: q,
          top_k_triples: 15,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 404 || errData.code === 'SESSION_EXPIRED') {
          setErrorToast({
            message: 'Knowledge graph session expired. Please re-analyze the article to refresh session state.',
            isExpired: true,
          });
        } else {
          setErrorToast({
            message: errData.error || `Query failed with status ${response.status}.`,
            isExpired: false,
          });
        }
        setIsLoading(false);
        return;
      }

      const data: RAGQueryResponse = await response.json();

      // 2. Add assistant message with typing animation
      const assistantMsgId = `assistant_${Date.now()}`;
      const assistantMsg: RAGChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: data.answer,
        timestamp: data.provenance?.timestamp || new Date().toISOString(),
        graph_context: data.graph_context,
        provenance: data.provenance,
        isStreaming: true,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setIsLoading(false);

      // Typing animation completion effect
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsgId ? { ...m, isStreaming: false } : m))
        );
      }, 400);
    } catch (err: any) {
      console.error('RAG query error:', err);
      setErrorToast({
        message: err.message || 'Network error occurred while querying the knowledge graph.',
        isExpired: false,
      });
      setIsLoading(false);
    }
  };

  const handleOpenEvidence = (msg: RAGChatMessage) => {
    setActiveEvidence({
      graphContext: msg.graph_context,
      provenance: msg.provenance,
      query: msg.content,
    });
    setIsDrawerOpen(true);
  };

  const handleClearChat = () => {
    setMessages([]);
    setErrorToast(null);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm flex flex-col h-[750px] lg:h-[calc(100vh-210px)] min-h-[500px] overflow-hidden">
      {/* Panel Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200/90 bg-slate-50/80 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                Ask Knowledge Graph
              </h3>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                <ShieldCheck className="w-3 h-3 text-indigo-600" />
                Oxigraph Grounded
              </span>
            </div>
            <p className="text-xs text-slate-500 truncate">
              Deterministic Q&amp;A anchored to asserted RDF triples &bull; W3C PROV-O audit trails
            </p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={handleClearChat}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-100 transition-colors shrink-0"
            title="Reset conversation"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Clear Chat</span>
          </button>
        )}
      </div>

      {/* Error Toast Alert */}
      {errorToast && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-1 shrink-0">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">{errorToast.message}</p>
              {errorToast.isExpired && (
                <p className="text-red-700/80">
                  Tip: Use the &ldquo;New Article&rdquo; button or re-run semantic synthesis to generate a fresh Oxigraph session.
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setErrorToast(null)}
            className="text-red-500 hover:text-red-800 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        {/* Welcome / Empty State */}
        {messages.length === 0 && (
          <div className="h-full flex flex-col justify-center items-center text-center p-4 max-w-md mx-auto space-y-4 animate-in fade-in duration-300">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-xs">
              <Sparkles className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h4 className="text-base font-bold text-slate-900">
                Explore &amp; Query the Knowledge Graph
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Ask targeted conceptual questions against the asserted RDF triplestore. Every response traverses the Oxigraph subgraph and cites cryptographic PROV-O audit details.
              </p>
            </div>

            {/* Suggested Question Chips */}
            <div className="w-full space-y-2 pt-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block text-left">
                Suggested Prompts
              </span>
              <div className="flex flex-col gap-2">
                {suggestionChips.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setInputQuery(chip);
                      handleSendQuery(chip);
                    }}
                    className="text-left text-xs p-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50/80 hover:text-indigo-900 border border-slate-200/90 hover:border-indigo-200 text-slate-700 transition-all flex items-center justify-between group shadow-2xs"
                  >
                    <span className="line-clamp-1 font-medium">{chip}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Message Stream */}
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const tripleCount = (msg.graph_context?.retrieved_triples || []).filter(
            (t) => !isInfrastructureTriple(t)
          ).length;
          const matchedCount = msg.graph_context?.matched_concepts?.length ?? 0;
          const firstConceptLabel =
            msg.graph_context?.matched_concepts?.[0]?.name ||
            msg.graph_context?.matched_concepts?.[0]?.id ||
            concepts[0]?.name ||
            concepts[0]?.label ||
            'Concept Grounding';
          const traversalHops = msg.graph_context?.traversal_hops ?? 2;

          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-1 duration-200`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 space-y-2.5 ${
                  isUser
                    ? 'bg-blue-600 text-white rounded-br-xs shadow-xs'
                    : 'bg-white border border-slate-200/90 text-slate-800 rounded-bl-xs shadow-xs'
                }`}
              >
                {/* Completed Hop Stepper Breadcrumb (SMAR-22) */}
                {!isUser && msg.graph_context && (
                  <div
                    role="region"
                    aria-label="Knowledge Graph Traversal Hop Breadcrumb"
                    className="p-2 sm:p-2.5 bg-indigo-50/80 border border-indigo-200 rounded-xl text-indigo-900 text-xs shadow-2xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-[10px] font-semibold text-indigo-700 uppercase tracking-wider">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-indigo-600" />
                        Traversal Hop Stepper
                      </span>
                      <span className="text-[10px] font-normal text-indigo-500 lowercase">
                        click to inspect evidence
                      </span>
                    </div>

                    <div className="flex items-center flex-wrap gap-1 sm:gap-1.5">
                      {/* Node 1: Matched Concept(s) */}
                      <button
                        type="button"
                        onClick={() => handleOpenEvidence(msg)}
                        title={`Matched Concept: ${firstConceptLabel}. Click to open evidence drawer.`}
                        aria-label={`Matched Concept: ${firstConceptLabel}`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-indigo-200/90 text-indigo-950 font-semibold hover:bg-indigo-100 hover:border-indigo-300 transition-all cursor-pointer shadow-2xs hover:scale-[1.02] active:scale-95 animate-in fade-in slide-in-from-left duration-300 motion-reduce:animate-none motion-reduce:transition-none motion-reduce:hover:scale-100"
                      >
                        <span className="text-xs">🌱</span>
                        <span className="truncate max-w-[130px] sm:max-w-[160px]">{firstConceptLabel}</span>
                        {matchedCount > 1 && (
                          <span className="text-[10px] text-indigo-600 bg-indigo-100/80 px-1 py-0.2 rounded font-normal">
                            +{matchedCount - 1}
                          </span>
                        )}
                      </button>

                      {/* Hop 1 Connector */}
                      <button
                        type="button"
                        onClick={() => handleOpenEvidence(msg)}
                        title="1-Hop SPARQL expansion. Click to inspect."
                        aria-label="1-Hop Traversal"
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold text-indigo-600 bg-indigo-100/70 border border-indigo-200 hover:bg-indigo-200/80 transition-all cursor-pointer animate-in fade-in slide-in-from-left duration-300 delay-75 motion-reduce:animate-none motion-reduce:transition-none"
                      >
                        <span>1-Hop</span>
                        <ArrowRight className="w-2.5 h-2.5 text-indigo-500" />
                      </button>

                      {/* Node 2: Traversed Triples */}
                      <button
                        type="button"
                        onClick={() => handleOpenEvidence(msg)}
                        title={`${tripleCount} Traversed Triples. Click to open evidence drawer.`}
                        aria-label={`${tripleCount} Traversed Triples`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-indigo-200/90 text-indigo-950 font-semibold hover:bg-indigo-100 hover:border-indigo-300 transition-all cursor-pointer shadow-2xs hover:scale-[1.02] active:scale-95 animate-in fade-in slide-in-from-left duration-300 delay-150 motion-reduce:animate-none motion-reduce:transition-none motion-reduce:hover:scale-100"
                      >
                        <span className="text-xs">🔗</span>
                        <span>{tripleCount} Triples</span>
                      </button>

                      {/* Hop 2 Connector */}
                      <button
                        type="button"
                        onClick={() => handleOpenEvidence(msg)}
                        title={`${traversalHops}-Hop expansion. Click to inspect.`}
                        aria-label={`${traversalHops}-Hop Traversal`}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold text-indigo-600 bg-indigo-100/70 border border-indigo-200 hover:bg-indigo-200/80 transition-all cursor-pointer animate-in fade-in slide-in-from-left duration-300 delay-200 motion-reduce:animate-none motion-reduce:transition-none"
                      >
                        <span>{traversalHops}-Hop</span>
                        <ArrowRight className="w-2.5 h-2.5 text-indigo-500" />
                      </button>

                      {/* Node 3: Evidence Subgraph */}
                      <button
                        type="button"
                        onClick={() => handleOpenEvidence(msg)}
                        title="Evidence Subgraph. Click to open evidence drawer."
                        aria-label="Evidence Subgraph"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-600 border border-indigo-700 text-white font-semibold hover:bg-indigo-700 transition-all cursor-pointer shadow-2xs hover:scale-[1.02] active:scale-95 animate-in fade-in slide-in-from-left duration-300 delay-300 motion-reduce:animate-none motion-reduce:transition-none motion-reduce:hover:scale-100"
                      >
                        <span className="text-xs">🎯</span>
                        <span>Evidence Subgraph</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Message Body */}
                <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </div>

                {/* Subgraph Evidence Badge & Action (For Assistant Answers) */}
                {!isUser && (
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEvidence(msg)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-all shadow-2xs hover:scale-[1.02] active:scale-95 cursor-pointer"
                      title="Inspect subgraph evidence triples and W3C PROV-O audit details"
                      aria-label={`Graph Evidence: ${tripleCount} Triples Used. Click to expand evidence drawer.`}
                    >
                      <Share2 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Graph Evidence: {tripleCount} Triples Used</span>
                      {matchedCount > 0 && (
                        <span className="text-[10px] text-indigo-500 font-normal">
                          &bull; {matchedCount} concept{matchedCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </button>

                    {msg.provenance?.checksum && (
                      <span className="text-[10px] font-mono text-slate-400 truncate max-w-[120px]">
                        sha256:{msg.provenance.checksum.slice(0, 8)}...
                      </span>
                    )}
                  </div>
                )}
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 shadow-xs">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Loading Skeleton Indicator */}
        {isLoading && (
          <div className="flex gap-3 justify-start animate-in fade-in duration-200">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Bot className="w-4 h-4" />
            </div>

            <div className="max-w-[85%] sm:max-w-[75%] bg-white border border-slate-200/90 rounded-2xl p-4 rounded-bl-xs shadow-xs space-y-3.5 w-full">
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 animate-pulse motion-reduce:animate-none">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-spin motion-reduce:animate-none" />
                <span>Traversing Oxigraph Subgraph &amp; Grounding Answer...</span>
              </div>

              {/* Multi-step Traversal Progress Pipeline (SMAR-22) */}
              <div
                role="status"
                aria-label="Oxigraph GraphRAG traversal pipeline in progress"
                className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-2.5"
              >
                <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-900 border-b border-indigo-100/80 pb-1.5">
                  <span className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75 motion-reduce:animate-none" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600" />
                    </span>
                    Live Graph Traversal Pipeline
                  </span>
                  <span className="text-[10px] text-indigo-600 font-mono">
                    Step {loadingStep} of 3
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {/* Step 1: Entity Grounding */}
                  <div
                    className={`p-2 rounded-lg border text-xs transition-all duration-300 motion-reduce:transition-none motion-reduce:animate-none ${
                      loadingStep === 1
                        ? 'bg-white border-indigo-300 shadow-xs ring-1 ring-indigo-400/30'
                        : 'bg-indigo-50/40 border-indigo-100/60 opacity-70'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-indigo-900">
                      <span className="text-xs">🌱</span>
                      <span className="truncate">Entity Grounding</span>
                      {loadingStep === 1 && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse motion-reduce:animate-none" />
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                      Matching concept anchors
                    </p>
                  </div>

                  {/* Step 2: Graph Traversal */}
                  <div
                    className={`p-2 rounded-lg border text-xs transition-all duration-300 motion-reduce:transition-none motion-reduce:animate-none ${
                      loadingStep === 2
                        ? 'bg-white border-indigo-300 shadow-xs ring-1 ring-indigo-400/30'
                        : 'bg-indigo-50/40 border-indigo-100/60 opacity-70'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-indigo-900">
                      <span className="text-xs">🔗</span>
                      <span className="truncate">Graph Traversal</span>
                      {loadingStep === 2 && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse motion-reduce:animate-none" />
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                      1-Hop &amp; 2-Hop SPARQL expansion
                    </p>
                  </div>

                  {/* Step 3: Answer Synthesis */}
                  <div
                    className={`p-2 rounded-lg border text-xs transition-all duration-300 motion-reduce:transition-none motion-reduce:animate-none ${
                      loadingStep === 3
                        ? 'bg-white border-indigo-300 shadow-xs ring-1 ring-indigo-400/30'
                        : 'bg-indigo-50/40 border-indigo-100/60 opacity-70'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-indigo-900">
                      <span className="text-xs">🎯</span>
                      <span className="truncate">Answer Synthesis</span>
                      {loadingStep === 3 && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse motion-reduce:animate-none" />
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                      Semantica context generation
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 animate-pulse motion-reduce:animate-none">
                <div className="h-3 bg-slate-200 rounded-md w-full" />
                <div className="h-3 bg-slate-200 rounded-md w-5/6" />
                <div className="h-3 bg-slate-200 rounded-md w-3/4" />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                <div className="h-5 bg-indigo-100 rounded-md w-48 animate-pulse motion-reduce:animate-none" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Chips Row (When messages exist) */}
      {messages.length > 0 && suggestionChips.length > 0 && !isLoading && (
        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50 flex items-center gap-2 overflow-x-auto text-xs shrink-0">
          <span className="text-[11px] font-semibold text-slate-500 shrink-0">Try asking:</span>
          {suggestionChips.slice(0, 2).map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setInputQuery(chip);
                handleSendQuery(chip);
              }}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-indigo-700 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all whitespace-nowrap text-xs shadow-2xs"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="p-3 sm:p-4 border-t border-slate-200/90 bg-white shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendQuery();
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask a question about concepts and relationships in this document..."
            disabled={isLoading}
            className="flex-1 py-2 px-3.5 text-xs sm:text-sm bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 placeholder-slate-400 transition-all disabled:opacity-60"
          />

          <button
            type="submit"
            disabled={!inputQuery.trim() || isLoading}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shrink-0"
            aria-label="Submit GraphRAG Question"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ask</span>
          </button>
        </form>
      </div>

      {/* Subgraph Evidence Drawer Component */}
      <SubgraphEvidenceDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        graphContext={activeEvidence?.graphContext}
        provenance={activeEvidence?.provenance}
        query={activeEvidence?.query}
      />
    </div>
  );
}
