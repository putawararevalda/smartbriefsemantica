import React, { useState } from 'react';
import IngestionHub from './IngestionHub';

export interface InputFormProps {
  onSubmit: (text: string) => Promise<void>;
  isLoading: boolean;
  text?: string;
  setText?: (text: string) => void;
  selectedSampleId?: string | null;
  onSelectSampleId?: (sampleId: string) => void;
}

/**
 * InputForm — Adapter component wrapping IngestionHub for backward compatibility.
 * Tracks live wordCount and charCount, supports "Load Sample Article" via curated domain library.
 */
export default function InputForm({
  onSubmit,
  isLoading,
  text: externalText,
  setText: externalSetText,
  selectedSampleId,
  onSelectSampleId,
}: InputFormProps) {
  const [internalText, setInternalText] = useState('');
  const text = externalText !== undefined ? externalText : internalText;
  const setText = externalSetText || setInternalText;

  // Real-time wordCount and charCount tracking
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;

  return (
    <IngestionHub
      text={text}
      setText={setText}
      onSubmit={onSubmit}
      isLoading={isLoading}
      selectedSampleId={selectedSampleId}
      onSelectSampleId={onSelectSampleId}
    />
  );
}

export { IngestionHub };
