import React from 'react';
import { Layers, Sparkles } from 'lucide-react';
import { Flashcard } from '@/types';
import FlashcardItem from './FlashcardItem';

interface FlashcardsGridProps {
  flashcards: Flashcard[];
  onTraceSource: (card: Flashcard) => void;
}

export default function FlashcardsGrid({ flashcards, onTraceSource }: FlashcardsGridProps) {
  if (!flashcards || flashcards.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Interactive Q&A Flashcards</h3>
            <p className="text-xs text-slate-500">
              Generated concept mastery cards with Semantica decision provenance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
            {flashcards.length} Flashcards
          </span>
          <span className="text-xs text-slate-500 hidden sm:inline">
            Each backed by Knowledge Graph nodes
          </span>
        </div>
      </div>

      {/* Responsive Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {flashcards.map((card, idx) => (
          <FlashcardItem
            key={card.id || idx}
            card={card}
            index={idx}
            onTraceSource={onTraceSource}
          />
        ))}
      </div>
    </section>
  );
}
