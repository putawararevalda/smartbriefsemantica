'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  HelpCircle,
  RotateCw,
  Compass,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  RotateCcw,
  Zap,
  BookmarkCheck,
  Layers,
  Award
} from 'lucide-react';
import { Flashcard } from '@/types';

export type RecallGrade = 'again' | 'hard' | 'good' | 'easy';

export interface FlashcardDeckProps {
  flashcards: Flashcard[];
  onTraceSource: (card: Flashcard) => void;
  activeCardIndex?: number;
  onCardIndexChange?: (index: number) => void;
}

interface GradeConfig {
  label: string;
  sublabel: string;
  key: string;
  activeBg: string;
  defaultBg: string;
  borderColor: string;
  textColor: string;
  ringColor: string;
  ariaLabel: string;
}

const GRADE_CONFIG: Record<RecallGrade, GradeConfig> = {
  again: {
    label: 'Again',
    sublabel: '< 1 min',
    key: '1',
    activeBg: 'bg-rose-600 text-white border-rose-600 shadow-sm',
    defaultBg: 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200',
    borderColor: 'border-rose-200',
    textColor: 'text-rose-700',
    ringColor: 'focus:ring-rose-500',
    ariaLabel: 'Grade recall as Again: repeat in under 1 minute (Hotkey 1)',
  },
  hard: {
    label: 'Hard',
    sublabel: '10 min',
    key: '2',
    activeBg: 'bg-amber-600 text-white border-amber-600 shadow-sm',
    defaultBg: 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-800',
    ringColor: 'focus:ring-amber-500',
    ariaLabel: 'Grade recall as Hard: repeat in 10 minutes (Hotkey 2)',
  },
  good: {
    label: 'Good',
    sublabel: '1 day',
    key: '3',
    activeBg: 'bg-blue-600 text-white border-blue-600 shadow-sm',
    defaultBg: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700',
    ringColor: 'focus:ring-blue-500',
    ariaLabel: 'Grade recall as Good: repeat in 1 day (Hotkey 3)',
  },
  easy: {
    label: 'Easy',
    sublabel: '3 days',
    key: '4',
    activeBg: 'bg-emerald-600 text-white border-emerald-600 shadow-sm',
    defaultBg: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200',
    borderColor: 'border-emerald-200',
    textColor: 'text-emerald-800',
    ringColor: 'focus:ring-emerald-500',
    ariaLabel: 'Grade recall as Easy: repeat in 3 days (Hotkey 4)',
  },
};

export default function FlashcardDeck({
  flashcards,
  onTraceSource,
  activeCardIndex,
  onCardIndexChange,
}: FlashcardDeckProps) {
  const [internalIndex, setInternalIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [ratings, setRatings] = useState<Record<number, RecallGrade>>({});
  const [announcement, setAnnouncement] = useState<string>('');

  const cardRef = useRef<HTMLDivElement>(null);
  const advanceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const totalCards = flashcards.length;
  const currentIndex = activeCardIndex !== undefined ? activeCardIndex : internalIndex;
  const currentCard = flashcards[currentIndex] || flashcards[0];

  // Sync state if external activeCardIndex changes
  const handleIndexChange = useCallback((newIndex: number) => {
    const bounded = Math.max(0, Math.min(totalCards - 1, newIndex));
    setIsFlipped(false);
    if (activeCardIndex === undefined) {
      setInternalIndex(bounded);
    }
    onCardIndexChange?.(bounded);
  }, [totalCards, activeCardIndex, onCardIndexChange]);

  // Session stats
  const reviewedCount = Object.keys(ratings).length;
  const masteredCount = Object.values(ratings).filter(r => r === 'good' || r === 'easy').length;
  const remainingCount = Math.max(0, totalCards - reviewedCount);
  const progressPercent = totalCards > 0 ? Math.round((reviewedCount / totalCards) * 100) : 0;
  const masteryRate = reviewedCount > 0 ? Math.round((masteredCount / reviewedCount) * 100) : 0;

  // Linked node ID & confidence from provenance
  const provObj =
    typeof currentCard?.provenance === 'object' && currentCard?.provenance !== null
      ? currentCard.provenance
      : {};
  const linkedNode = provObj.graph_node || provObj.node_id || provObj.concept || 'urn:concept:default';
  const confidence = provObj.confidence !== undefined ? Math.round(provObj.confidence * 100) : 95;

  const flipCard = useCallback(() => {
    setIsFlipped(prev => {
      const nextFlipped = !prev;
      setAnnouncement(
        nextFlipped
          ? `Card ${currentIndex + 1} flipped. Answer revealed: ${currentCard?.answer}`
          : `Card ${currentIndex + 1} question face: ${currentCard?.question}`
      );
      return nextFlipped;
    });
  }, [currentIndex, currentCard]);

  const goToNextCard = useCallback(() => {
    if (currentIndex < totalCards - 1) {
      handleIndexChange(currentIndex + 1);
      setAnnouncement(`Moved to Card ${currentIndex + 2} of ${totalCards}. Question: ${flashcards[currentIndex + 1]?.question}`);
    }
  }, [currentIndex, totalCards, handleIndexChange, flashcards]);

  const goToPrevCard = useCallback(() => {
    if (currentIndex > 0) {
      handleIndexChange(currentIndex - 1);
      setAnnouncement(`Moved to Card ${currentIndex} of ${totalCards}. Question: ${flashcards[currentIndex - 1]?.question}`);
    }
  }, [currentIndex, totalCards, handleIndexChange, flashcards]);

  const handleGrade = useCallback((grade: RecallGrade) => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
    }

    setRatings(prev => ({ ...prev, [currentIndex]: grade }));
    setAnnouncement(`Graded Card ${currentIndex + 1} as ${GRADE_CONFIG[grade].label}.`);

    // Auto-advance to next card after brief delay if not on last card
    if (currentIndex < totalCards - 1) {
      advanceTimerRef.current = setTimeout(() => {
        handleIndexChange(currentIndex + 1);
      }, 500);
    }
  }, [currentIndex, totalCards, handleIndexChange]);

  const handleResetSession = () => {
    setRatings({});
    setIsFlipped(false);
    handleIndexChange(0);
    setAnnouncement('Study session reset. Starting from Card 1.');
  };

  // Keyboard Navigation & Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcut if user is in an input or textarea
      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target?.isContentEditable) {
        return;
      }

      // Space or Enter: Flip card
      if (e.key === ' ' || e.key === 'Enter') {
        if (target?.tagName?.toLowerCase() === 'button') {
          return; // Let standard button clicks work normally
        }
        e.preventDefault();
        flipCard();
        return;
      }

      // ArrowRight or J: Next card
      if (e.key === 'ArrowRight' || e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        goToNextCard();
        return;
      }

      // ArrowLeft or K: Prev card
      if (e.key === 'ArrowLeft' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        goToPrevCard();
        return;
      }

      // 1, 2, 3, 4: SuperMemo scale
      if (e.key === '1') {
        e.preventDefault();
        if (!isFlipped) setIsFlipped(true);
        handleGrade('again');
        return;
      }
      if (e.key === '2') {
        e.preventDefault();
        if (!isFlipped) setIsFlipped(true);
        handleGrade('hard');
        return;
      }
      if (e.key === '3') {
        e.preventDefault();
        if (!isFlipped) setIsFlipped(true);
        handleGrade('good');
        return;
      }
      if (e.key === '4') {
        e.preventDefault();
        if (!isFlipped) setIsFlipped(true);
        handleGrade('easy');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, [currentIndex, isFlipped, flipCard, goToNextCard, goToPrevCard, handleGrade]);

  if (!flashcards || flashcards.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
        No flashcards available in this synthesis.
      </div>
    );
  }

  const currentGrade = ratings[currentIndex];

  return (
    <div className="flex flex-col space-y-4">
      {/* Screen Reader Live Region */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      {/* Session Progress Header */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
            <span className="font-bold text-slate-800 uppercase tracking-wider">
              Active Recall Session
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-slate-600">
              <span className="font-semibold text-slate-900">{reviewedCount}</span>
              <span>/ {totalCards} reviewed</span>
            </div>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-1 text-emerald-700 font-medium">
              <Award className="w-3.5 h-3.5 text-emerald-600" />
              <span>{masteredCount} Mastered</span>
            </div>
            {reviewedCount > 0 && (
              <button
                type="button"
                onClick={handleResetSession}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 transition-colors ml-1 focus:outline-none"
                aria-label="Reset deck session"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Deck completion percentage"
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-500">
            <span>Progress: {progressPercent}%</span>
            <span>Queue: {remainingCount} remaining</span>
          </div>
        </div>
      </div>

      {/* 3D Flip Card Container */}
      <div
        className="perspective-1000 w-full relative h-[480px] sm:h-[500px] min-h-[480px] sm:min-h-[500px]"
        ref={cardRef}
        tabIndex={0}
        role="region"
        aria-label={`Flashcard ${currentIndex + 1} of ${totalCards}. Press Space to flip.`}
        style={{
          minHeight: '480px',
        }}
      >
        <div
          className={`w-full h-full min-h-[480px] sm:min-h-[500px] relative transition-transform duration-500 transform-style-3d ${
            isFlipped ? 'rotate-y-180' : ''
          }`}
          style={{
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            transformStyle: 'preserve-3d',
            transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
            minHeight: '480px',
          }}
        >
          {/* ================= FRONT FACE (Question) ================= */}
          <div
            className="w-full h-full min-h-[480px] sm:min-h-[500px] absolute inset-0 backface-hidden rounded-2xl bg-white border border-slate-200/90 shadow-sm p-6 sm:p-7 flex flex-col justify-between overflow-y-auto"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              minHeight: '480px',
            }}
          >
            {/* Front Header */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                    <HelpCircle className="w-3.5 h-3.5" />
                    Card {currentIndex + 1} of {totalCards}
                  </span>
                  {currentCard.category && (
                    <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                      {currentCard.category}
                    </span>
                  )}
                </div>

                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  W3C PROV-O
                </span>
              </div>

              {/* Question Text */}
              <div className="mt-4 mb-6">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-2">
                  Question
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
                  {currentCard.question}
                </h3>
              </div>
            </div>

            {/* Click to Flip Affordance */}
            <div className="my-4">
              <button
                type="button"
                onClick={flipCard}
                className="w-full py-3.5 px-4 rounded-xl border border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-100/70 text-blue-700 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                aria-label="Reveal answer by flipping card"
              >
                <RotateCw className="w-4 h-4 text-blue-600 transition-transform group-hover:rotate-180" />
                <span>Click Card or Press Spacebar to Reveal Answer</span>
              </button>
            </div>

            {/* Front Footer */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="text-slate-500 font-mono text-[11px] truncate max-w-[240px]">
                <span className="font-sans font-medium text-slate-600">Node:</span> {String(linkedNode)}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onTraceSource(currentCard)}
                  data-testid="deck-trace-source-front"
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/90 shadow-2xs transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  aria-label="Trace provenance source in left document"
                >
                  <Compass className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Trace Source</span>
                </button>
              </div>
            </div>
          </div>

          {/* ================= BACK FACE (Answer + Grading) ================= */}
          <div
            className="w-full h-full min-h-[480px] sm:min-h-[500px] absolute inset-0 backface-hidden rounded-2xl bg-white border border-slate-200/90 shadow-sm p-6 sm:p-7 flex flex-col justify-between overflow-y-auto rotate-y-180"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              minHeight: '480px',
            }}
          >
            {/* Back Header */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Answer & Retention
                  </span>
                  <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                    Card {currentIndex + 1} / {totalCards}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={flipCard}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors focus:outline-none"
                  aria-label="Flip back to question"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Question Face</span>
                </button>
              </div>

              {/* Answer Content Container */}
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-slate-900 mb-4 max-h-[160px] overflow-y-auto">
                <span className="font-bold text-[11px] uppercase tracking-wider text-emerald-800 block mb-1">
                  Synthesized Answer
                </span>
                <p className="text-sm sm:text-base leading-relaxed font-medium">
                  {currentCard.answer}
                </p>
              </div>
            </div>

            {/* SuperMemo Active Recall Self-Assessment Toolbar */}
            <div className="space-y-2.5 my-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-600" />
                  Rate Your Recall (SuperMemo Scale)
                </span>
                {currentGrade && (
                  <span className="text-[11px] font-semibold text-slate-600">
                    Current: <strong className="text-slate-900 capitalize">{currentGrade}</strong>
                  </span>
                )}
              </div>

              {/* 4 SuperMemo Rating Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(Object.keys(GRADE_CONFIG) as RecallGrade[]).map(gradeKey => {
                  const cfg = GRADE_CONFIG[gradeKey];
                  const isSelected = currentGrade === gradeKey;
                  return (
                    <button
                      key={gradeKey}
                      type="button"
                      onClick={() => handleGrade(gradeKey)}
                      aria-label={cfg.ariaLabel}
                      className={`py-2 px-2.5 rounded-xl border text-center transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                        cfg.ringColor
                      } ${isSelected ? cfg.activeBg : cfg.defaultBg}`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-[11px] opacity-75 font-mono">({cfg.key})</span>
                        <span className="text-xs font-bold">{cfg.label}</span>
                      </div>
                      <span className="text-[10px] block opacity-80 mt-0.5">{cfg.sublabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Back Footer */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="text-slate-500 font-mono text-[11px] truncate max-w-[200px]">
                <span className="font-sans font-medium text-slate-600">Confidence:</span> {confidence}%
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onTraceSource(currentCard)}
                  data-testid="deck-trace-source-back"
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/90 shadow-2xs transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  aria-label="Trace provenance source in left document"
                >
                  <Compass className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Trace Source</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Deck Navigation & Keyboard Shortcuts Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Previous / Next Controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
          <button
            type="button"
            onClick={goToPrevCard}
            disabled={currentIndex === 0}
            className={`inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
              currentIndex === 0
                ? 'opacity-50 cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-2xs'
            }`}
            aria-label="Previous flashcard (Hotkey ArrowLeft or K)"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <span className="text-xs font-bold text-slate-700 px-3">
            Card {currentIndex + 1} of {totalCards}
          </span>

          <button
            type="button"
            onClick={goToNextCard}
            disabled={currentIndex === totalCards - 1}
            className={`inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
              currentIndex === totalCards - 1
                ? 'opacity-50 cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-2xs'
            }`}
            aria-label="Next flashcard (Hotkey ArrowRight or J)"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Keyboard Legend */}
        <div className="text-[11px] text-slate-500 flex flex-wrap items-center justify-center sm:justify-end gap-x-2.5 gap-y-1">
          <span className="font-semibold text-slate-600">Keys:</span>
          <span><kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-[10px]">Space</kbd> Flip</span>
          <span><kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-[10px]">← / K</kbd> Prev</span>
          <span><kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-[10px]">→ / J</kbd> Next</span>
          <span><kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-[10px]">1-4</kbd> Self-Rate</span>
        </div>
      </div>
    </div>
  );
}
