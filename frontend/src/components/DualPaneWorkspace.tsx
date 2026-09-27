'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  FileText,
  Layers,
  AlignLeft,
  Network,
  RotateCcw,
  Search,
  Check,
  Copy,
  ExternalLink,
  Tag,
  Share2,
  BookmarkCheck,
  SlidersHorizontal,
  Compass,
  Sparkles,
  BookOpen,
  ArrowRight
} from 'lucide-react';
import { ProcessResponse, Flashcard, GraphConcept } from '@/types';
import FlashcardDeck from './FlashcardDeck';
import KnowledgeGraphExplorer from './KnowledgeGraphExplorer';

export interface DualPaneWorkspaceProps {
  sourceText: string;
  result: ProcessResponse;
  onNewArticle: () => void;
  onTraceSource: (card: Flashcard) => void;
  documentTitle?: string;
}

type ActiveTab = 'flashcards' | 'summary' | 'concepts' | 'graph';
type MobileView = 'synthesis' | 'source';

export default function DualPaneWorkspace({
  sourceText,
  result,
  onNewArticle,
  onTraceSource,
  documentTitle = 'Source Document',
}: DualPaneWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('flashcards');
  const [mobileView, setMobileView] = useState<MobileView>('synthesis');
  const [activeCardIndex, setActiveCardIndex] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [conceptFilter, setConceptFilter] = useState<string>('');
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);
  const [highlightedConcept, setHighlightedConcept] = useState<string | null>(null);

  const leftPaneScrollRef = useRef<HTMLDivElement>(null);
  const anchorRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const flashcardDeckRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const conceptMatrixRef = useRef<HTMLDivElement>(null);
  const graphExplorerRef = useRef<HTMLDivElement>(null);

  const flashcards = result.flashcards || [];
  const concepts = useMemo(() => {
    return (result.graph_nodes || result.concepts || []) as GraphConcept[];
  }, [result.graph_nodes, result.concepts]);
  const summary = result.summary || '';
  const tripletCount = result.graph?.triplet_count || result.graph?.triplets?.length || (concepts.length > 0 ? concepts.length * 2 : 0);

  // Word count & paragraphs
  const trimmed = sourceText.trim();
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
  const paragraphs = useMemo(() => {
    if (!trimmed) return ['No article content available.'];
    return trimmed
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
  }, [trimmed]);

  // Current active card and its provenance excerpt
  const activeCard = flashcards[activeCardIndex] || flashcards[0];
  const activeExcerpt = useMemo(() => {
    if (!activeCard) return '';
    const prov =
      typeof activeCard.provenance === 'object' && activeCard.provenance !== null
        ? activeCard.provenance
        : {};
    return (prov.source_excerpt || prov.source_text || '').trim();
  }, [activeCard]);

  // Determine if paragraph contains the active excerpt
  const isParagraphProvenanceAnchor = (paragraph: string) => {
    if (!activeExcerpt) return false;
    const normP = paragraph.toLowerCase().replace(/\s+/g, ' ');
    const normE = activeExcerpt.toLowerCase().replace(/\s+/g, ' ');
    if (normP.includes(normE)) return true;
    const snippet = normE.slice(0, 45);
    return snippet.length >= 15 && normP.includes(snippet);
  };

  // Auto-scroll left pane to active provenance anchor when card index changes
  useEffect(() => {
    if (activeTab !== 'flashcards') return;
    const targetEl = anchorRefs.current[activeCardIndex];
    if (targetEl && leftPaneScrollRef.current) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeCardIndex, activeTab]);
 
  // Tab switching and contextual scroll/reset action
  const handleTabChange = (tab: ActiveTab) => {
    if (activeTab !== tab) {
      setActiveTab(tab);
    } else {
      // Re-clicking an active tab triggers contextual action
      if (tab === 'flashcards') {
        flashcardDeckRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (tab === 'concepts') {
        setConceptFilter('');
        conceptMatrixRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (tab === 'summary') {
        summaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (tab === 'graph') {
        graphExplorerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  };

  // Dedicated badge click handler ensuring event capture and stopPropagation
  const handleBadgeClick = (tab: ActiveTab, e: React.MouseEvent) => {
    e.stopPropagation();
    handleTabChange(tab);
  };

  // Copy executive summary
  const handleCopySummary = async () => {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
    } catch (err) {
      console.error('Failed to copy summary:', err);
    }
  };

  // Filtered concepts
  const filteredConcepts = useMemo(() => {
    if (!conceptFilter.trim()) return concepts;
    const q = conceptFilter.toLowerCase();
    return concepts.filter(
      (c) =>
        (c.label || c.name || c.id || '').toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q) ||
        (c.type || '').toLowerCase().includes(q)
    );
  }, [concepts, conceptFilter]);

  // Key takeaways extracted from summary
  const summaryKeyTakeaways = useMemo(() => {
    if (!summary) return [];
    // Split sentences or bullet points
    const sentences = summary
      .split(/(?<=[.?!])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20);
    return sentences.slice(0, 4);
  }, [summary]);

  return (
    <div className="w-full space-y-4">
      {/* Mobile / Tablet Segmented View Switcher (< 1024px) */}
      <div className="lg:hidden flex items-center p-1 bg-slate-200/80 rounded-xl border border-slate-300/80 max-w-md mx-auto">
        <button
          type="button"
          onClick={() => setMobileView('source')}
          className={`cursor-pointer flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            mobileView === 'source'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          aria-label="View Source Document Pane"
        >
          <FileText className="w-3.5 h-3.5 pointer-events-none shrink-0" />
          <span className="pointer-events-none select-none">Source Document ({wordCount} words)</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileView('synthesis')}
          className={`cursor-pointer flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            mobileView === 'synthesis'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          aria-label="View Synthesis and Study Hub Pane"
        >
          <Layers className="w-3.5 h-3.5 pointer-events-none shrink-0" />
          <span className="pointer-events-none select-none">Synthesis & Study Hub</span>
        </button>
      </div>

      {/* Main Dual-Pane Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ================= LEFT PANE: SYNCHRONIZED SOURCE READER ================= */}
        <div
          className={`bg-white rounded-2xl border border-slate-200/90 shadow-sm flex flex-col overflow-hidden transition-all ${
            mobileView === 'source' ? 'block' : 'hidden lg:flex'
          }`}
        >
          {/* Sticky Reader Header */}
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-slate-200/90 p-4 sm:p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                    {documentTitle}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-700">{wordCount} words</span>
                    <span>&bull;</span>
                    <span>{paragraphs.length} paragraphs</span>
                    <span>&bull;</span>
                    <span>~{Math.max(1, Math.ceil(wordCount / 200))} min read</span>
                  </div>
                </div>
              </div>

              {/* Action: New Article Reset */}
              <button
                type="button"
                onClick={onNewArticle}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/90 border border-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400/20 shrink-0"
                aria-label="New Article input reset"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden sm:inline">New Article</span>
              </button>
            </div>

            {/* In-Document Search / Filter */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search text in source document..."
                className="w-full pl-8 pr-8 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-slate-800 placeholder-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  &times;
                </button>
              )}
            </div>
          </div>

          {/* Document Content Area (Independent Smooth Scrolling) */}
          <div
            ref={leftPaneScrollRef}
            className="p-5 sm:p-6 overflow-y-auto max-h-[750px] lg:h-[calc(100vh-210px)] min-h-[500px] scroll-smooth space-y-4 text-slate-700 font-sans leading-relaxed text-sm sm:text-base"
          >
            {paragraphs.map((para, idx) => {
              const isAnchor = isParagraphProvenanceAnchor(para);
              if (isAnchor) {
                anchorRefs.current[activeCardIndex] = leftPaneScrollRef.current
                  ? (leftPaneScrollRef.current.querySelector(`#para-anchor-${idx}`) as HTMLDivElement)
                  : null;
              }

              // Highlight search query or concept
              let displayContent: React.ReactNode = para;
              const activeHighlight = searchQuery.trim() || highlightedConcept || '';
              if (activeHighlight) {
                const parts = para.split(new RegExp(`(${activeHighlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
                displayContent = parts.map((part, pIdx) =>
                  part.toLowerCase() === activeHighlight.toLowerCase() ? (
                    <mark
                      key={pIdx}
                      className={
                        searchQuery.trim()
                          ? 'bg-amber-200 text-slate-900 rounded px-0.5 font-medium'
                          : 'bg-indigo-100 text-indigo-950 ring-1 ring-indigo-300 rounded px-0.5 font-medium'
                      }
                    >
                      {part}
                    </mark>
                  ) : (
                    part
                  )
                );
              }

              const isConceptMatch = Boolean(
                highlightedConcept &&
                para.toLowerCase().includes(highlightedConcept.toLowerCase())
              );

              return (
                <div
                  key={idx}
                  id={`para-anchor-${idx}`}
                  className={`relative transition-all duration-300 rounded-xl p-3 sm:p-4 ${
                    isAnchor
                      ? 'bg-indigo-50/90 border-l-4 border-indigo-600 shadow-xs ring-1 ring-indigo-200/70'
                      : isConceptMatch
                      ? 'bg-indigo-50/50 border-l-4 border-indigo-400 ring-1 ring-indigo-200/50'
                      : 'bg-transparent border-l-2 border-transparent hover:bg-slate-50/80'
                  }`}
                >
                  {/* Anchor Badge if this paragraph matches active flashcard provenance */}
                  {isAnchor && (
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 mb-2 uppercase tracking-wider">
                      <BookmarkCheck className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Active Citation Anchor &bull; Card {activeCardIndex + 1}</span>
                    </div>
                  )}

                  {/* Concept match badge if active concept filter matches this paragraph */}
                  {!isAnchor && isConceptMatch && (
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 mb-2">
                      <Tag className="w-3 h-3 text-indigo-500" />
                      <span>Referenced Concept &bull; {highlightedConcept}</span>
                    </div>
                  )}

                  <div className="flex items-start gap-2.5">
                    <span className="text-slate-400 font-mono text-[11px] select-none pt-0.5 shrink-0">
                      &para;{idx + 1}
                    </span>
                    <p className="flex-1">{displayContent}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ================= RIGHT PANE: SYNTHESIS & STUDY HUB ================= */}
        <div
          className={`space-y-4 ${
            mobileView === 'synthesis' ? 'block' : 'hidden lg:block'
          }`}
        >
          {/* Sticky Tab Navigation Sub-Header */}
          <div className="bg-white rounded-2xl p-2 sm:p-2.5 border border-slate-200/90 shadow-xs flex items-center justify-between gap-1 sm:gap-2">
            <div className="flex items-center gap-1 sm:gap-2 flex-1" role="tablist" aria-label="Synthesis and study hub tabs">
              {/* Tab 1: Flashcards */}
              <button
                type="button"
                role="tab"
                id="tab-flashcards"
                aria-selected={activeTab === 'flashcards'}
                aria-controls="tabpanel-flashcards"
                onClick={() => handleTabChange('flashcards')}
                className={`cursor-pointer flex-1 py-2 px-2.5 sm:px-3.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                  activeTab === 'flashcards'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
                aria-label="Flashcards active recall deck tab"
              >
                <Layers className="w-3.5 h-3.5 pointer-events-none shrink-0" />
                <span className="pointer-events-none select-none">Flashcards</span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => handleBadgeClick('flashcards', e)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      handleTabChange('flashcards');
                    }
                  }}
                  aria-label={`View ${flashcards.length} flashcards`}
                  title={`Click badge to view ${flashcards.length} flashcards`}
                  className={`cursor-pointer select-none text-[10px] font-mono px-1.5 py-0.5 rounded-full transition-all hover:scale-110 active:scale-95 ${
                    activeTab === 'flashcards'
                      ? 'bg-blue-700/80 text-white shadow-xs hover:bg-blue-800'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  {flashcards.length}
                </span>
              </button>

              {/* Tab 2: Executive Summary */}
              <button
                type="button"
                role="tab"
                id="tab-summary"
                aria-selected={activeTab === 'summary'}
                aria-controls="tabpanel-summary"
                onClick={() => handleTabChange('summary')}
                className={`cursor-pointer flex-1 py-2 px-2.5 sm:px-3.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                  activeTab === 'summary'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
                aria-label="Executive summary tab"
              >
                <AlignLeft className="w-3.5 h-3.5 pointer-events-none shrink-0" />
                <span className="pointer-events-none select-none">Summary</span>
              </button>

              {/* Tab 3: Concept Matrix */}
              <button
                type="button"
                role="tab"
                id="tab-concepts"
                aria-selected={activeTab === 'concepts'}
                aria-controls="tabpanel-concepts"
                onClick={() => handleTabChange('concepts')}
                className={`cursor-pointer flex-1 py-2 px-2.5 sm:px-3.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                  activeTab === 'concepts'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
                aria-label="Knowledge concepts matrix tab"
              >
                <Network className="w-3.5 h-3.5 pointer-events-none shrink-0" />
                <span className="pointer-events-none select-none">Concepts</span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => handleBadgeClick('concepts', e)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      handleTabChange('concepts');
                    }
                  }}
                  aria-label={`View ${concepts.length} concepts`}
                  title={`Click badge to view ${concepts.length} concepts`}
                  className={`cursor-pointer select-none text-[10px] font-mono px-1.5 py-0.5 rounded-full transition-all hover:scale-110 active:scale-95 ${
                    activeTab === 'concepts'
                      ? 'bg-blue-700/80 text-white shadow-xs hover:bg-blue-800'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  {concepts.length}
                </span>
              </button>

              {/* Tab 4: Knowledge Graph */}
              <button
                type="button"
                role="tab"
                id="tab-graph"
                aria-selected={activeTab === 'graph'}
                aria-controls="tabpanel-graph"
                onClick={() => handleTabChange('graph')}
                className={`cursor-pointer flex-1 py-2 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                  activeTab === 'graph'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
                aria-label="Knowledge Graph and Oxigraph triplestore tab"
              >
                <Share2 className="w-3.5 h-3.5 pointer-events-none shrink-0" />
                <span className="pointer-events-none select-none">Graph</span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => handleBadgeClick('graph', e)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      handleTabChange('graph');
                    }
                  }}
                  aria-label={`View ${tripletCount} triples in Oxigraph`}
                  title={`Click badge to view ${tripletCount} triples in Oxigraph`}
                  className={`cursor-pointer select-none text-[10px] font-mono px-1.5 py-0.5 rounded-full transition-all hover:scale-110 active:scale-95 ${
                    activeTab === 'graph'
                      ? 'bg-blue-700/80 text-white shadow-xs hover:bg-blue-800'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  {tripletCount}
                </span>
              </button>
            </div>
          </div>

          {/* TAB 1: 3D FLIP FLASHCARD ACTIVE RECALL DECK */}
          {activeTab === 'flashcards' && (
            <div
              id="tabpanel-flashcards"
              role="tabpanel"
              aria-labelledby="tab-flashcards"
              ref={flashcardDeckRef}
              className="animate-in fade-in duration-200"
            >
              <FlashcardDeck
                flashcards={flashcards}
                onTraceSource={onTraceSource}
                activeCardIndex={activeCardIndex}
                onCardIndexChange={setActiveCardIndex}
              />
            </div>
          )}

          {/* TAB 2: STRUCTURED EXECUTIVE SUMMARY */}
          {activeTab === 'summary' && (
            <div
              id="tabpanel-summary"
              role="tabpanel"
              aria-labelledby="tab-summary"
              ref={summaryRef}
              className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/90 shadow-sm space-y-5 animate-in fade-in duration-200"
            >
              {/* Summary Header & Copy Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <AlignLeft className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Executive Summary</h3>
                    <p className="text-xs text-slate-500">
                      Synthesized semantic takeaways with verifiable provenance
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors focus:outline-none"
                  aria-label="Copy executive summary to clipboard"
                >
                  {copiedSummary ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-600" />
                      <span>Copy Markdown</span>
                    </>
                  )}
                </button>
              </div>

              {/* Key Takeaways Highlights */}
              {summaryKeyTakeaways.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Key Takeaways
                  </span>
                  <div className="grid grid-cols-1 gap-2.5">
                    {summaryKeyTakeaways.map((takeaway, tIdx) => (
                      <div
                        key={tIdx}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2.5 text-xs sm:text-sm text-slate-800"
                      >
                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[11px] mt-0.5">
                          {tIdx + 1}
                        </span>
                        <span className="leading-relaxed">{takeaway}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Full Synthesized Text */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Full Synthesis Text
                </span>
                <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 text-sm leading-relaxed text-slate-700 font-sans whitespace-pre-line">
                  {summary}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: INTERACTIVE CONCEPT MATRIX / GRAPH TRIPLES */}
          {activeTab === 'concepts' && (
            <div
              id="tabpanel-concepts"
              role="tabpanel"
              aria-labelledby="tab-concepts"
              ref={conceptMatrixRef}
              className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/90 shadow-sm space-y-5 animate-in fade-in duration-200"
            >
              {/* Concept Matrix Header & Search */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <Network className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Extracted Knowledge Concepts</h3>
                    <p className="text-xs text-slate-500">
                      RDF triples and semantic entities indexed in Oxigraph &bull; Click any card to highlight references
                    </p>
                  </div>
                </div>

                {/* Concept Search Filter */}
                <div className="relative min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={conceptFilter}
                    onChange={(e) => setConceptFilter(e.target.value)}
                    placeholder="Filter concepts..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                  />
                </div>
              </div>

              {/* Concepts Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {filteredConcepts.map((concept, cIdx) => {
                  const label = concept.label || concept.name || concept.id || `Concept ${cIdx + 1}`;
                  const type = concept.type || 'Entity';
                  const description = concept.description || '';
                  const relations = concept.relations || [];
                  const isHighlighted = highlightedConcept === (concept.id || label);

                  // Find matching flashcard for this concept
                  const matchingFlashcardIdx = flashcards.findIndex((fc) => {
                    const prov = typeof fc.provenance === 'object' && fc.provenance !== null ? fc.provenance : {};
                    const nodeId = (prov.node_id || '').toLowerCase();
                    const conceptName = (prov.concept || '').toLowerCase();
                    const cId = (concept.id || '').toLowerCase();
                    const cLabel = (label || '').toLowerCase();
                    return (
                      (cId && nodeId.includes(cId)) ||
                      (cLabel && conceptName.includes(cLabel)) ||
                      (cLabel && nodeId.includes(cLabel))
                    );
                  });

                  return (
                    <div
                      key={concept.id || cIdx}
                      role="button"
                      tabIndex={0}
                      onClick={() => setHighlightedConcept(isHighlighted ? null : (concept.id || label))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setHighlightedConcept(isHighlighted ? null : (concept.id || label));
                        }
                      }}
                      className={`cursor-pointer p-4 rounded-xl border transition-all flex flex-col justify-between space-y-2.5 ${
                        isHighlighted
                          ? 'border-indigo-500 bg-indigo-50/60 shadow-md ring-2 ring-indigo-500/30'
                          : 'border-slate-200/80 bg-gradient-to-b from-white to-slate-50/50 hover:border-indigo-300 hover:shadow-sm'
                      }`}
                      aria-label={`Concept: ${label}. Click to ${isHighlighted ? 'unhighlight' : 'highlight in source reader'}`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200 pointer-events-none">
                            <Tag className="w-3 h-3" />
                            {type}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 truncate max-w-[120px]">
                            {concept.id}
                          </span>
                        </div>

                        <h4 className="text-sm font-bold text-slate-900 leading-snug">
                          {label}
                        </h4>

                        {description && (
                          <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                            {description}
                          </p>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5 text-[11px]">
                        {relations && relations.length > 0 ? (
                          <div className="flex items-center gap-1 text-slate-500 min-w-0">
                            <Share2 className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{relations.join(', ')}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">Triple Node</span>
                        )}

                        {matchingFlashcardIdx !== -1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveCardIndex(matchingFlashcardIdx);
                              handleTabChange('flashcards');
                            }}
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold text-[11px] hover:underline shrink-0"
                            title={`Jump to Flashcard ${matchingFlashcardIdx + 1}`}
                          >
                            <span>Card {matchingFlashcardIdx + 1}</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: KNOWLEDGE GRAPH & OXIGRAPH EXPLORER */}
          {activeTab === 'graph' && (
            <div
              id="tabpanel-graph"
              role="tabpanel"
              aria-labelledby="tab-graph"
              ref={graphExplorerRef}
              className="space-y-4 animate-in fade-in duration-200"
            >
              <KnowledgeGraphExplorer
                graph={result.graph}
                concepts={concepts}
                initialTriplets={result.graph?.triplets}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
