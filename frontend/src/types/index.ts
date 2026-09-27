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
  concept_id?: string;
  concept_name?: string;
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

export interface GraphNode {
  id: string;
  label: string;
  type?: string;
  description?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
}

export interface TripletItem {
  subject: string;
  predicate: string;
  object: string;
  confidence?: number;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  triplets?: TripletItem[];
  triplet_count?: number;
  sparql_sample?: Record<string, any>[];
}

export interface SparqlQueryRequest {
  query: string;
}

export interface SparqlQueryResponse {
  success: boolean;
  variables: string[];
  bindings: Record<string, any>[];
  total_results: number;
  query: string;
}

export interface AllTripletsResponse {
  total_triplets: number;
  triplets: TripletItem[];
  store_backend: string;
}

export interface ExportRdfResponse {
  format: string;
  content: string;
  total_triplets: number;
}

export interface ProcessResponse {
  summary: string;
  flashcards: Flashcard[];
  graph_nodes?: GraphConcept[];
  concepts?: GraphConcept[];
  graph?: KnowledgeGraph;
  provenance_summary?: any;
  status?: string;
  error?: string;
  [key: string]: any;
}

export interface ProcessRequest {
  text: string;
}
