import React, { useEffect, useState, useRef } from 'react';
import { CheckCircle2, Loader2, Circle, XCircle, Clock, ShieldCheck, Database, Cpu, Sparkles } from 'lucide-react';

export interface ProgressStepperProps {
  isLoading: boolean;
  onCancel: () => void;
  wordCount?: number;
}

export interface StepInfo {
  step: number;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STAGES: StepInfo[] = [
  {
    step: 1,
    title: 'Ingesting & Tokenizing Text',
    description: 'Validating semantic boundaries and computing token vectors',
    icon: Cpu,
  },
  {
    step: 2,
    title: 'Extracting Entities & Building Oxigraph Triples',
    description: 'Querying embedded Oxigraph RDF store and asserting entity relationships',
    icon: Database,
  },
  {
    step: 3,
    title: 'Synthesizing Flashcards & Reasoning Chains',
    description: 'Constructing knowledge graph subgraphs, grounding semantic synthesis, and generating study deck items',
    icon: Sparkles,
  },
  {
    step: 4,
    title: 'Generating Cryptographic W3C PROV-O Lineage',
    description: 'Computing SHA256 audit hashes and binding verifiable source citations',
    icon: ShieldCheck,
  },
];

export default function ProgressStepper({
  isLoading,
  onCancel,
  wordCount = 0,
}: ProgressStepperProps) {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [screenReaderAnnouncement, setScreenReaderAnnouncement] = useState<string>('');
  const lastCancelTimeRef = useRef<number>(0);

  // Estimate total duration based on text length
  const estimatedSeconds = Math.max(3, Math.min(12, Math.round(wordCount / 120) + 3));

  // Reset and drive timer when isLoading changes
  useEffect(() => {
    if (!isLoading) {
      setCurrentStep(1);
      setElapsedMs(0);
      return;
    }

    const startTime = Date.now();
    setScreenReaderAnnouncement(`Analysis started. Step 1 of 4: ${STAGES[0].title}.`);

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setElapsedMs(elapsed);

      // Determine active step based on realistic backend latency intervals
      let step = 1;
      if (elapsed >= 3800) {
        step = 4;
      } else if (elapsed >= 2200) {
        step = 3;
      } else if (elapsed >= 900) {
        step = 2;
      } else {
        step = 1;
      }

      setCurrentStep((prevStep) => {
        if (step !== prevStep) {
          const completedTitle = STAGES[prevStep - 1]?.title;
          const newTitle = STAGES[step - 1]?.title;
          setScreenReaderAnnouncement(
            `Completed Step ${prevStep}: ${completedTitle}. Now on Step ${step} of 4: ${newTitle}.`
          );
        }
        return step;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isLoading]);

  if (!isLoading) return null;

  const handleCancelClick = () => {
    const now = Date.now();
    if (now - lastCancelTimeRef.current < 500) {
      // Debounce rapid double-clicks on cancel
      return;
    }
    lastCancelTimeRef.current = now;
    onCancel();
  };

  // Format elapsed time as mm:ss
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const elapsedFormatted = `00:${elapsedSeconds.toString().padStart(2, '0')}s`;

  // Calculate approximate progress percentage for smooth bar
  const progressPercent = Math.min(95, Math.max(10, Math.round((currentStep - 1) * 25 + Math.min(25, (elapsedMs % 1500) / 60))));

  return (
    <section
      aria-label="Analysis progress"
      className="bg-white rounded-2xl p-6 sm:p-7 shadow-sm border border-blue-100 bg-gradient-to-b from-blue-50/30 to-white animate-in fade-in zoom-in-95 duration-200"
    >
      {/* Screen Reader Live Announcement */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {screenReaderAnnouncement}
      </div>

      {/* Header with Title & Timing Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-600"></span>
            </span>
            <h3 className="text-base font-bold text-slate-900">
              Constructing Knowledge Graph, Subgraph Grounding & Provenance Lineage...
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Extracting semantic entities, asserting Oxigraph RDF triples, grounding subgraph synthesis, and sealing W3C PROV-O audit trails.
          </p>
        </div>

        {/* Timing Badges & Cancel Action */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-mono font-medium border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Elapsed: {elapsedFormatted}</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500 font-sans">Est: ~{estimatedSeconds}s</span>
          </div>

          <button
            type="button"
            onClick={handleCancelClick}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer shadow-xs active:scale-95"
            title="Abort in-flight analysis and return to input"
          >
            <XCircle className="w-4 h-4 text-rose-600" />
            <span>Cancel Analysis</span>
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-4 mb-6">
        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
          <div
            className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 h-2 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 4-Stage Stepper Items */}
      <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {STAGES.map((stage) => {
          const isCompleted = currentStep > stage.step;
          const isActive = currentStep === stage.step;
          const isPending = currentStep < stage.step;

          return (
            <li
              key={stage.step}
              className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                isActive
                  ? 'bg-blue-50/80 border-blue-300 shadow-xs ring-2 ring-blue-500/10'
                  : isCompleted
                  ? 'bg-emerald-50/40 border-emerald-200'
                  : 'bg-slate-50/50 border-slate-200 opacity-60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Step {stage.step} of 4
                  </span>
                  <div>
                    {isCompleted && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Done
                      </span>
                    )}
                    {isActive && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded animate-pulse">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                        Active
                      </span>
                    )}
                    {isPending && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                        <Circle className="w-3 h-3 text-slate-300" />
                        Pending
                      </span>
                    )}
                  </div>
                </div>

                <h4
                  className={`text-xs font-bold leading-tight ${
                    isActive
                      ? 'text-blue-900'
                      : isCompleted
                      ? 'text-slate-800'
                      : 'text-slate-500'
                  }`}
                >
                  {stage.title}
                </h4>
              </div>

              <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                {stage.description}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
