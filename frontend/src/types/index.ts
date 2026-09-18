export interface ProvenanceData {
  node_id?: string;
  graph_node?: string;
  concept?: string;
  source_excerpt?: string;
  source_text?: string;
  confidence?: number;
  audit_trail?: string | string[];
  derivation_rule?: string;
  timestamp?: string;
  [key: string]: any;
}

export interface Flashcard {
  id?: string | number;
  question: string;
  answer: string;
  provenance: ProvenanceData | string | Record<string, any>;
  category?: string;
}

export interface GraphConcept {
  id: string;
  label?: string;
  name?: string;
  type?: string;
  description?: string;
  relations?: string[];
  [key: string]: any;
}

export interface ProcessResponse {
  summary: string;
  flashcards: Flashcard[];
  graph_nodes?: GraphConcept[];
  concepts?: GraphConcept[];
  provenance_summary?: string;
  status?: string;
  error?: string;
  [key: string]: any;
}

export interface ProcessRequest {
  text: string;
}
