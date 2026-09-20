import React from 'react';
import { WifiOff, AlertTriangle, Clock, XCircle, RefreshCw, Sparkles, X } from 'lucide-react';

export type ErrorCategory = 'network_offline' | 'invalid_input' | 'timeout' | 'cancelled' | 'generic';

export interface AppError {
  category: ErrorCategory;
  message?: string;
  raw?: string;
}

export interface ErrorAlertProps {
  error: AppError | string | null;
  onRetry?: () => void;
  onLoadOfflineSample?: () => void;
  onDismiss?: () => void;
}

export default function ErrorAlert({
  error,
  onRetry,
  onLoadOfflineSample,
  onDismiss,
}: ErrorAlertProps) {
  if (!error) return null;

  // Normalize string error to structured AppError
  const structuredError: AppError = typeof error === 'string'
    ? classifyErrorString(error)
    : error;

  const { category, message, raw } = structuredError;

  return (
    <aside
      role="alert"
      aria-live="assertive"
      className="rounded-2xl bg-white border border-rose-200 shadow-sm p-5 transition-all animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3.5">
          {/* Categorized Icon */}
          <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 shrink-0 mt-0.5">
            {category === 'network_offline' && <WifiOff className="w-5 h-5 text-rose-600" />}
            {category === 'invalid_input' && <AlertTriangle className="w-5 h-5 text-amber-600" />}
            {category === 'timeout' && <Clock className="w-5 h-5 text-rose-600" />}
            {category === 'cancelled' && <XCircle className="w-5 h-5 text-slate-600" />}
            {category === 'generic' && <AlertTriangle className="w-5 h-5 text-rose-600" />}
          </div>

          <div className="space-y-1">
            {/* Header / Title */}
            <h3 className="text-sm font-bold text-slate-900">
              {category === 'network_offline' && 'Unable to reach Semantica API service'}
              {category === 'invalid_input' && 'Invalid or Insufficient Input'}
              {category === 'timeout' && 'Processing Timed Out'}
              {category === 'cancelled' && 'Analysis Cancelled by User'}
              {category === 'generic' && 'Semantic Synthesis Failed'}
            </h3>

            {/* Description */}
            <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
              {message || getDefaultMessage(category)}
            </p>

            {/* Raw error snippet if available for debugging */}
            {raw && (
              <details className="pt-1 text-[11px] text-slate-400">
                <summary className="cursor-pointer hover:text-slate-600 transition-colors">
                  View technical details
                </summary>
                <pre className="mt-1 p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-mono overflow-x-auto text-[10px]">
                  {raw}
                </pre>
              </details>
            )}
          </div>
        </div>

        {/* Dismiss Button */}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss error"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Action Recovery Buttons */}
      <div className="flex flex-wrap items-center gap-2.5 pt-4 mt-3 border-t border-slate-100 sm:ml-12">
        {onRetry && (category === 'network_offline' || category === 'timeout' || category === 'generic' || category === 'cancelled') && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 transition-all shadow-xs cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        )}

        {onLoadOfflineSample && (category === 'network_offline' || category === 'timeout' || category === 'generic') && (
          <button
            type="button"
            onClick={onLoadOfflineSample}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 border border-indigo-200/80 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Load Offline Sample</span>
          </button>
        )}

        {category === 'invalid_input' && onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all"
          >
            Edit Article Text
          </button>
        )}
      </div>
    </aside>
  );
}

function classifyErrorString(str: string): AppError {
  const lower = str.toLowerCase();

  if (lower.includes('abort') || lower.includes('cancelled') || lower.includes('canceled')) {
    return {
      category: 'cancelled',
      message: 'Analysis was cancelled. Your entered article draft has been safely preserved.',
      raw: str,
    };
  }

  if (
    lower.includes('unable to reach') ||
    lower.includes('failed to fetch') ||
    lower.includes('network') ||
    lower.includes('econnrefused') ||
    lower.includes('offline') ||
    lower.includes('502') ||
    lower.includes('503') ||
    lower.includes('504')
  ) {
    return {
      category: 'network_offline',
      message: 'The Semantica API service could not be reached. Verify that the backend container is running or load a pre-computed offline sample.',
      raw: str,
    };
  }

  if (
    lower.includes('valid text') ||
    lower.includes('too short') ||
    lower.includes('malformed') ||
    lower.includes('empty') ||
    lower.includes('400')
  ) {
    return {
      category: 'invalid_input',
      message: 'Please provide valid text containing complete sentences. Articles with at least 50 words yield the most accurate semantic knowledge extraction.',
      raw: str,
    };
  }

  if (lower.includes('timeout') || lower.includes('timed out')) {
    return {
      category: 'timeout',
      message: 'The analysis took longer than expected to complete. You can retry the request or shorten your text.',
      raw: str,
    };
  }

  return {
    category: 'generic',
    message: str || 'An unexpected error occurred while processing the text.',
    raw: str,
  };
}

function getDefaultMessage(category: ErrorCategory): string {
  switch (category) {
    case 'network_offline':
      return 'The Semantica backend knowledge graph service is currently unreachable or starting up. You can retry the connection or explore with a pre-computed offline sample.';
    case 'invalid_input':
      return 'Please provide valid text containing complete sentences. Articles with at least 50 words yield the most accurate semantic knowledge extraction.';
    case 'timeout':
      return 'The request took longer than expected to complete. You can retry the connection or shorten your input.';
    case 'cancelled':
      return 'Analysis was stopped. Your text has been preserved in the input hub.';
    default:
      return 'An unexpected issue occurred while synthesizing the document. Please try again.';
  }
}
