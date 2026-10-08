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

// GraphRAG Q&A and Subgraph Evidence Types (SMAR-14)
export interface MatchedConcept {
  id: string;
  name: string;
  uri?: string;
  category?: string;
}

export interface RetrievedTriple {
  subject: string;
  predicate: string;
  object: string;
  raw_triple?: string;
  confidence?: number;
}

export interface GraphContext {
  matched_concepts: MatchedConcept[];
  retrieved_triples: RetrievedTriple[];
  traversal_hops: number;
  execution_time_ms: number;
}

export interface W3CProvRAGMetadata {
  wasDerivedFrom: string[] | string;
  wasGeneratedBy: string;
  wasAttributedTo: string;
}

export interface RAGProvenance {
  entity_id: string;
  activity: string;
  agent: string;
  timestamp: string;
  checksum: string;
  w3c_prov: W3CProvRAGMetadata;
  lineage_chain?: any[];
}

export interface RAGQueryRequest {
  session_id: string;
  query: string;
  top_k_triples?: number;
}

export interface RAGQueryResponse {
  query: string;
  answer: string;
  graph_context: GraphContext;
  provenance: RAGProvenance;
  session_id?: string;
  error?: string;
  status?: string;
}

export interface RAGChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  graph_context?: GraphContext;
  provenance?: RAGProvenance;
  isStreaming?: boolean;
}
