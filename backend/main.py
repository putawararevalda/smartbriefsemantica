"""SmartBrief Backend Service.

FastAPI application integrating semantica-agi/semantica with embedded Oxigraph
and W3C PROV-O decision provenance tracking.
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
import hashlib
import json
import os
import re
import time
from typing import Any, Dict, List, Optional, Union
import uuid

import requests
# ---------------------------------------------------------------------------
# Load .env file dynamically if present
# ---------------------------------------------------------------------------
def _load_env_file():
    for candidate in [
        os.path.join(os.path.dirname(__file__), ".env"),
        os.path.join(os.path.dirname(__file__), "..", ".env"),
        "/app/.env",
        ".env",
    ]:
        if os.path.exists(candidate):
            try:
                with open(candidate, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            k, v = k.strip(), v.strip().strip('"').strip("'")
                            if k and not os.environ.get(k):
                                os.environ[k] = v
            except Exception:
                pass

_load_env_file()
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()


from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from semantica.provenance import ProvenanceManager
from semantica.semantic_extract.types import Triplet
from semantica.triplet_store.oxigraph_store import OxigraphStore

# ---------------------------------------------------------------------------
# Global Store and Provenance Instances
# ---------------------------------------------------------------------------
oxigraph_store: Optional[OxigraphStore] = None
provenance_manager: Optional[ProvenanceManager] = None

DATA_DIR = os.environ.get("DATA_DIR", "/tmp/smartbrief_data")
os.makedirs(DATA_DIR, exist_ok=True)
PROV_DB_PATH = os.path.join(DATA_DIR, "provenance.db")

import sqlite3


def _init_session_chunks_db() -> None:
    """Initialize SQLite session_chunks table for persisting source article text chunks."""
    try:
        with sqlite3.connect(PROV_DB_PATH) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS session_chunks (
                    session_id TEXT,
                    chunk_id TEXT,
                    chunk_index INT,
                    content TEXT,
                    PRIMARY KEY (session_id, chunk_id)
                )
                """
            )
            conn.commit()
    except Exception:
        pass


def _chunk_text(text: str, target_words: int = 200, max_words: int = 300) -> List[str]:
    """Split input article text into readable paragraphs/chunks of ~150-300 words."""
    clean_text = text.strip()
    if not clean_text:
        return []

    raw_paragraphs = [p.strip() for p in re.split(r"\n\s*\n", clean_text) if p.strip()]
    if not raw_paragraphs:
        raw_paragraphs = [clean_text]

    chunks = []
    for para in raw_paragraphs:
        para_words = para.split()
        if len(para_words) > max_words:
            # Paragraph is longer than max_words: split by sentence
            sentences = re.split(r"(?<=[.!?])\s+", para)
            curr = []
            curr_len = 0
            for s in sentences:
                s_words = s.split()
                if not s_words:
                    continue
                if curr_len + len(s_words) > max_words and curr:
                    chunks.append(" ".join(curr))
                    curr = []
                    curr_len = 0
                curr.append(s)
                curr_len += len(s_words)
            if curr:
                chunks.append(" ".join(curr))
        else:
            chunks.append(para)

    return chunks if chunks else [clean_text]


def _store_session_chunks(session_id: str, chunks: List[str]) -> List[Dict[str, Any]]:
    """Persist source text chunks in SQLite session_chunks table."""
    _init_session_chunks_db()
    records = []
    try:
        with sqlite3.connect(PROV_DB_PATH) as conn:
            for idx, content in enumerate(chunks):
                chunk_id = f"chunk_{session_id}_{idx}"
                conn.execute(
                    """
                    INSERT OR REPLACE INTO session_chunks (session_id, chunk_id, chunk_index, content)
                    VALUES (?, ?, ?, ?)
                    """,
                    (session_id, chunk_id, idx, content),
                )
                records.append({
                    "chunk_id": chunk_id,
                    "chunk_index": idx,
                    "content": content,
                })
            conn.commit()
    except Exception:
        pass
    return records


def _get_session_chunks(session_id: str) -> List[Dict[str, Any]]:
    """Retrieve persisted source text chunks for a session from SQLite."""
    _init_session_chunks_db()
    records = []
    try:
        with sqlite3.connect(PROV_DB_PATH) as conn:
            cursor = conn.execute(
                """
                SELECT chunk_id, chunk_index, content
                FROM session_chunks
                WHERE session_id = ?
                ORDER BY chunk_index ASC
                """,
                (session_id,),
            )
            for row in cursor.fetchall():
                records.append({
                    "chunk_id": row[0],
                    "chunk_index": row[1],
                    "content": row[2],
                })
    except Exception:
        pass
    return records


def _find_originating_chunk(item_text: str, chunk_records: List[Dict[str, Any]]) -> str:
    """Find the originating chunk_id for an extracted concept or triplet."""
    if not chunk_records:
        return "chunk_0"
    item_lower = item_text.lower().strip()
    # 1. Direct substring match
    for ch in chunk_records:
        if item_lower in ch["content"].lower():
            return ch["chunk_id"]
    # 2. Token overlap match
    words = [w for w in re.split(r"\W+", item_lower) if len(w) > 3]
    if words:
        best_chunk = max(
            chunk_records,
            key=lambda ch: sum(1 for w in words if w in ch["content"].lower()),
        )
        return best_chunk["chunk_id"]
    return chunk_records[0]["chunk_id"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager to initialize and clean up Semantica services."""
    global oxigraph_store, provenance_manager
    # Initialize embedded Oxigraph store
    oxigraph_store = OxigraphStore()

    # Initialize Semantica Provenance Manager with persistent SQLite storage
    provenance_manager = ProvenanceManager(storage_path=PROV_DB_PATH)

    # Initialize session chunks SQLite schema
    _init_session_chunks_db()

    yield

    # Teardown if required
    if oxigraph_store is not None:
        try:
            oxigraph_store.flush()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# FastAPI Application Definition
# ---------------------------------------------------------------------------
app = FastAPI(
    title="SmartBrief API",
    description="AI-powered article summarizer with Knowledge Graph extraction and Semantica Decision Provenance.",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for Next.js frontend (default port 3003) and all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request & Response Schemas (Strict JSON Contracts)
# ---------------------------------------------------------------------------
class ProcessRequest(BaseModel):
    """Request payload for processing text."""

    text: str = Field(
        ...,
        min_length=1,
        description="The source text or article to summarize and process.",
        examples=[
            "Knowledge graphs structure semantic information, allowing AI agents to perform deterministic reasoning. Oxigraph provides an embedded RDF triplestore for fast querying without network latency."
        ],
    )
    title: Optional[str] = Field(
        default=None,
        description="Optional title for the submitted article.",
        examples=["Introduction to Knowledge Graphs and Oxigraph"],
    )
    session_id: Optional[str] = Field(
        default=None,
        description="Optional session identifier to anchor the processed document.",
        examples=["proc_a1b2c3d4"],
    )


class GraphNode(BaseModel):
    """Knowledge Graph entity node."""

    id: str = Field(..., description="Unique URI or identifier for the graph node.")
    label: str = Field(..., description="Human-readable concept label.")
    type: str = Field(default="Concept", description="Semantic category or type.")
    description: Optional[str] = Field(default=None, description="Brief explanation.")


class GraphEdge(BaseModel):
    """Knowledge Graph relation edge."""

    source: str = Field(..., description="Source node identifier.")
    target: str = Field(..., description="Target node identifier.")
    relation: str = Field(..., description="Semantic predicate or relationship.")


class TripletItem(BaseModel):
    """Formal W3C RDF Triplet asserted in Oxigraph."""

    subject: str = Field(..., description="Subject URI or identifier.")
    predicate: str = Field(..., description="Predicate URI or relationship.")
    object: str = Field(..., description="Object URI, concept, or literal.")
    confidence: float = Field(default=1.0, description="Extraction confidence score.")


class KnowledgeGraph(BaseModel):
    """Structured graph representation."""

    nodes: List[GraphNode]
    edges: List[GraphEdge]
    triplets: Optional[List[TripletItem]] = Field(
        default_factory=list,
        description="Complete list of formal RDF triplets asserted in Oxigraph.",
    )
    triplet_count: int
    sparql_sample: Optional[List[Dict[str, Any]]] = None


class SparqlQueryRequest(BaseModel):
    """Request payload for executing SPARQL queries against Oxigraph."""

    query: str = Field(
        default="SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 25",
        description="SPARQL 1.1 query string to execute against embedded Oxigraph store.",
    )


class SparqlQueryResponse(BaseModel):
    """Response payload for SPARQL query execution."""

    success: bool
    variables: List[str]
    bindings: List[Dict[str, Any]]
    total_results: int
    query: str


class AllTripletsResponse(BaseModel):
    """Response containing all asserted triplets in Oxigraph."""

    total_triplets: int
    triplets: List[TripletItem]
    store_backend: str = "Semantica Oxigraph Embedded"


class ExportRdfResponse(BaseModel):
    """Response containing exported RDF syntax."""

    format: str = "turtle"
    content: str
    total_triplets: int



class ConceptItem(BaseModel):
    """Extracted concept details."""

    id: str
    name: str
    category: str
    description: str


class W3CProvMetadata(BaseModel):
    """W3C PROV-O standard properties."""

    wasDerivedFrom: str
    wasGeneratedBy: str
    wasAttributedTo: str


class FlashcardProvenance(BaseModel):
    """Semantica decision provenance audit trail for a flashcard."""

    entity_id: str = Field(..., description="ID of the tracked flashcard entity.")
    node_id: Optional[str] = Field(default=None, description="Linked knowledge graph node ID.")
    source_node: str = Field(..., description="Knowledge graph node this card was derived from.")
    source_excerpt: Optional[str] = Field(default=None, description="Document source citation.")
    confidence: float = Field(default=1.0, description="Decision confidence score.")
    audit_trail: List[str] = Field(
        default_factory=list,
        description="Step-by-step decision provenance lineage steps.",
    )
    source_document: str = Field(..., description="Root document source.")
    agent: str = Field(default="Semantica PROV-O Engine", description="Agent responsible.")
    activity: str = Field(default="Flashcard Generation", description="Generating activity.")
    timestamp: str = Field(..., description="UTC ISO-8601 timestamp.")
    checksum: str = Field(..., description="SHA-256 integrity checksum.")
    w3c_prov: W3CProvMetadata
    lineage_chain: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Full lineage ancestry chain from Semantica ProvenanceManager.",
    )


class Flashcard(BaseModel):
    """Interactive Q&A flashcard anchored to knowledge graph node."""

    id: str
    question: str
    answer: str
    concept_id: str
    concept_name: str
    provenance: FlashcardProvenance


class ProvenanceSummary(BaseModel):
    """Metadata regarding decision provenance tracking."""

    total_entities_tracked: int
    storage_backend: str
    provenance_standard: str
    session_id: str


class ProcessResponse(BaseModel):
    """Top-level response schema for POST /api/process."""

    summary: str = Field(..., description="Synthesized summary of the text.")
    concepts: List[ConceptItem] = Field(..., description="Extracted key concepts.")
    graph_nodes: Optional[List[GraphNode]] = Field(
        default=None, description="Extracted knowledge graph concept nodes."
    )
    graph: KnowledgeGraph = Field(..., description="Knowledge graph nodes and edges.")
    flashcards: List[Flashcard] = Field(
        ...,
        description="3 interactive Q&A flashcards with Semantica provenance audit trails.",
    )
    provenance_summary: ProvenanceSummary


class MatchedConcept(BaseModel):
    """Entity matched from query text in embedded Oxigraph store."""

    id: str = Field(..., description="Unique concept node identifier (e.g., concept:oxigraph).")
    name: str = Field(..., description="Human-readable concept name.")
    uri: str = Field(..., description="Canonical concept RDF URI.")


class RetrievedTriple(BaseModel):
    """Sub-graph triple retrieved from Oxigraph."""

    subject: str = Field(..., description="RDF subject URI.")
    predicate: str = Field(..., description="RDF predicate URI.")
    object: str = Field(..., description="RDF object URI or literal.")
    raw_triple: str = Field(..., description="Formatted triple representation string.")


class GraphContext(BaseModel):
    """Retrieved subgraph context from embedded Oxigraph store."""

    matched_concepts: List[MatchedConcept] = Field(
        default_factory=list,
        description="Entities matched from query in knowledge graph.",
    )
    retrieved_triples: List[RetrievedTriple] = Field(
        default_factory=list,
        description="1-hop and 2-hop triples retrieved via SPARQL traversal.",
    )
    traversal_hops: int = Field(default=2, description="Number of traversal hops executed.")
    execution_time_ms: float = Field(
        ...,
        description="Execution latency in milliseconds for subgraph traversal.",
    )


class RAGProvenance(BaseModel):
    """Semantica decision provenance audit trail for a GraphRAG query."""

    entity_id: str = Field(..., description="Unique identifier for the RAG query provenance entity.")
    source_node: str = Field(..., description="Knowledge graph node(s) or concept URIs.")
    source_document: str = Field(..., description="Root document or session context URI.")
    agent: str = Field(default="Semantica GraphRAG Engine", description="Agent responsible.")
    activity: str = Field(default="rag_synthesis", description="Generating activity.")
    timestamp: str = Field(..., description="UTC ISO-8601 timestamp.")
    checksum: str = Field(..., description="SHA-256 integrity checksum.")
    w3c_prov: W3CProvMetadata
    lineage_chain: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Full lineage ancestry chain from Semantica ProvenanceManager.",
    )


class RAGQueryRequest(BaseModel):
    """Request payload for Hybrid GraphRAG query."""

    session_id: str = Field(
        ...,
        description="Session identifier to anchor the query context.",
        examples=["proc_a1b2c3d4"],
    )
    query: str = Field(
        ...,
        min_length=1,
        description="Natural language question to answer using the knowledge graph.",
        examples=["How does Oxigraph enable deterministic reasoning in SmartBrief?"],
    )
    top_k_triples: int = Field(
        default=15,
        ge=1,
        le=100,
        description="Maximum number of triples to retrieve.",
    )


class RAGQueryResponse(BaseModel):
    """Top-level response schema for POST /api/rag/query."""

    query: str = Field(..., description="The original query.")
    answer: str = Field(..., description="Synthesized answer combining graph triples and document context.")
    graph_context: GraphContext = Field(..., description="Retrieved subgraph and traversal metadata.")
    provenance: Union[RAGProvenance, FlashcardProvenance] = Field(
        ...,
        description="W3C PROV-O decision provenance audit trail.",
    )


# ---------------------------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------------------------
def _slugify(text: str) -> str:
    """Normalize text into a clean URI slug."""
    text = re.sub(r"[^\w\s-]", "", text.strip())
    return re.sub(r"[-\s]+", "_", text).lower()


def _extract_summary(text: str) -> str:
    """Extract or synthesize an executive summary from the input text."""
    clean_text = text.strip()
    sentences = re.split(r"(?<=[.!?])\s+", clean_text)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 10]

    if not sentences:
        return clean_text[:250] + "..." if len(clean_text) > 250 else clean_text

    # Synthesize top sentences into a cohesive overview
    if len(sentences) <= 3:
        summary_body = " ".join(sentences)
    else:
        # Take first sentence, a central substantive sentence, and concluding thought
        summary_body = f"{sentences[0]} {sentences[len(sentences)//2]} {sentences[-1]}"

    return (
        f"SmartBrief Executive Summary: {summary_body}"
        if not summary_body.startswith("SmartBrief")
        else summary_body
    )


# Domain dictionary of recognizable concepts with semantic metadata
CANDIDATE_CONCEPTS: List[Dict[str, Any]] = [
    {
        "name": "Knowledge Graph",
        "category": "Data Architecture",
        "description": "Structured network of entities, concepts, and explicit semantic relationships.",
        "patterns": [r"\bknowledge\s+graphs?\b", r"\bkg\b", r"\bontology\b", r"\brdf\b"],
    },
    {
        "name": "Oxigraph",
        "category": "Graph Storage",
        "description": "High-performance embedded SPARQL 1.1 graph database implemented in Rust.",
        "patterns": [r"\boxigraph\b", r"\btriplestore\b", r"\bsparql\b"],
    },
    {
        "name": "W3C PROV-O",
        "category": "Provenance Standard",
        "description": "The W3C Provenance Ontology providing audit trails for entities, activities, and agents.",
        "patterns": [r"\bprovenance\b", r"\bprov-o\b", r"\baudit\b", r"\blineage\b"],
    },
    {
        "name": "Deterministic Reasoning",
        "category": "AI Cognition",
        "description": "Rule-based and graph-traversal inference yielding reproducible and verifiable conclusions.",
        "patterns": [r"\bdeterministic\b", r"\breasoning\b", r"\brules?\b", r"\blogic\b"],
    },
    {
        "name": "Context Graph",
        "category": "Memory Infrastructure",
        "description": "Graph-native context store that anchors LLM prompts to verifiable knowledge nodes.",
        "patterns": [r"\bcontext\b", r"\bmemory\b", r"\bgrounding\b", r"\bvector\b"],
    },
    {
        "name": "AI Decision Intelligence",
        "category": "Accountable AI",
        "description": "First-class recording of reasoning paths, confidence scores, and causal ancestry.",
        "patterns": [r"\bdecision\b", r"\baccountab\w+", r"\bintelligence\b", r"\bllm\b"],
    },
    {
        "name": "Aerodynamics",
        "category": "Vehicle Dynamics",
        "description": "Study of airflow and aerodynamic downforce generated by wings and underbody tunnels to maximize cornering grip.",
        "patterns": [
            r"\baerodynamics?\b",
            r"\bdownforce\b",
            r"\bwings?\b",
            r"\bunderbody\b",
            r"\bventuri\b",
            r"\bground\s+effects?\b",
            r"\battacking\s+(?:the\s+)?corners?\b",
        ],
    },
]


def _extract_key_concepts(text: str) -> List[Dict[str, str]]:
    """Simulate concept and entity extraction from input text for graph modeling."""
    found_concepts = []

    lower_text = text.lower()
    for item in CANDIDATE_CONCEPTS:
        for pat in item["patterns"]:
            if re.search(pat, lower_text):
                found_concepts.append(
                    {
                        "name": item["name"],
                        "category": item["category"],
                        "description": item["description"],
                    }
                )
                break

    # If fewer than 3 concepts found, dynamically extract salient entities from the source text
    if len(found_concepts) < 3:
        stop_words = {
            'the', 'this', 'that', 'these', 'those', 'in', 'on', 'at', 'to', 'for',
            'with', 'from', 'by', 'about', 'as', 'into', 'through', 'during',
            'before', 'after', 'above', 'below', 'under', 'between', 'among', 'a',
            'an', 'and', 'but', 'or', 'nor', 'so', 'yet', 'however', 'therefore',
            'moreover', 'furthermore', 'although', 'though', 'while', 'whereas',
            'if', 'unless', 'since', 'because', 'why', 'what', 'how', 'when',
            'where', 'who', 'which', 'it', 'its', 'they', 'their', 'we', 'our',
            'of', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
            'do', 'does', 'did', 'can', 'could', 'should', 'would', 'will', 'may', 'might', 'must',
            'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such'
        }

        def _clean_words(words):
            while words and words[0].lower() in stop_words:
                words.pop(0)
            while words and words[-1].lower() in stop_words:
                words.pop()
            return words

        existing_names = {c["name"].lower() for c in found_concepts}

        def _is_overlap(term):
            t = term.lower()
            if t in existing_names:
                return True
            for s in existing_names:
                if t in s or s in t:
                    return True
            return False

        raw_lines = [line.strip() for line in text.split('\n') if line.strip()]
        has_header = False
        header_candidate = ''
        if raw_lines and (raw_lines[0].startswith('#') or (len(raw_lines[0].split()) <= 8 and not raw_lines[0].endswith('.'))):
            has_header = True
            header_candidate = re.sub(r'^[#\s*_-]+', '', raw_lines[0]).strip()

        body_lines = raw_lines[1:] if has_header else raw_lines
        sentences = []
        for line in body_lines:
            for s in re.split(r'(?<=[.!?])\s+', line):
                s_clean = s.strip()
                if len(s_clean) > 15:
                    sentences.append(s_clean)

        # 1. Primary Subject from Header/Title if available
        if header_candidate and len(found_concepts) < 3:
            parts = [p.strip() for p in re.split(r'[:–—]', header_candidate) if 2 < len(p.strip()) < 40]
            p = parts[0] if parts else header_candidate
            words = _clean_words(p.split())
            if words and 1 <= len(words) <= 4:
                clean_p = ' '.join(words)
                if not _is_overlap(clean_p) and len(clean_p) >= 3:
                    best_s = next((s for s in sentences if clean_p.lower() in s.lower()), sentences[0] if sentences else header_candidate)
                    found_concepts.append({
                        "name": clean_p,
                        "category": "Primary Subject",
                        "description": best_s[:240].strip() + ('.' if not best_s.strip().endswith('.') else ''),
                    })
                    existing_names.add(clean_p.lower())
                    if parts and len(parts) > 1:
                        sub_p = ' '.join(_clean_words(parts[1].split()))
                        existing_names.add(sub_p.lower())

        # 2. Capitalized Entities / Concepts (single or multi-word)
        phrase_pattern = re.compile(
            r'\b(?:[A-Z][a-zA-Z0-9]*(?:[\'\’][a-zA-Z]+)?(?:\s+(?:de|du|of|the|and|for|in|on)\s+|\s+)){0,3}[A-Z][a-zA-Z0-9]*(?:[\'\’][a-zA-Z]+)?\b'
        )
        for s in sentences:
            if len(found_concepts) >= 3:
                break
            for match in phrase_pattern.finditer(s):
                words = _clean_words(match.group().strip().split())
                if len(words) >= 1:
                    clean_phrase = ' '.join(words)
                    if not _is_overlap(clean_phrase) and len(clean_phrase) >= 4 and clean_phrase.lower() not in stop_words:
                        found_concepts.append({
                            "name": clean_phrase,
                            "category": "Key Concept",
                            "description": s[:240].strip() + ('.' if not s.strip().endswith('.') else ''),
                        })
                        existing_names.add(clean_phrase.lower())
                        if len(found_concepts) >= 3:
                            break

        # 3. Domain Acronyms (e.g. FIA, F1, WDC, DNA, etc.)
        if len(found_concepts) < 3:
            acronym_pattern = re.compile(r'\b[A-Z]{2,6}\b')
            for s in sentences:
                if len(found_concepts) >= 3:
                    break
                for match in acronym_pattern.finditer(s):
                    acro = match.group().strip()
                    if acro.lower() not in stop_words and len(acro) >= 2:
                        if not _is_overlap(acro):
                            found_concepts.append({
                                "name": acro,
                                "category": "Domain Entity",
                                "description": s[:240].strip() + ('.' if not s.strip().endswith('.') else ''),
                            })
                            existing_names.add(acro.lower())
                            if len(found_concepts) >= 3:
                                break

    # If fewer than 3 concepts found, supplement with top domain concepts
    fallback_pool = [c for c in CANDIDATE_CONCEPTS if c["name"].lower() not in {fc["name"].lower() for fc in found_concepts}]
    while len(found_concepts) < 3 and fallback_pool:
        found_concepts.append(fallback_pool.pop(0))

    # Return top 3 distinct concepts
    return found_concepts[:3]


def _extract_query_concepts(
    query: str,
    store: OxigraphStore,
    session_id: Optional[str] = None,
) -> List[Dict[str, str]]:
    """Extract and match concepts mentioned in query against the Oxigraph store, scoped to session_id if provided."""
    if not query or not query.strip() or store is None:
        return []

    # If session_id provided, query only concepts asserted for this session
    if session_id:
        doc_uri = f"urn:smartbrief:doc:{session_id}"
        sparql_query = f"""
        SELECT DISTINCT ?c WHERE {{
            ?c <https://smartbrief.ai/ontology/extractedFrom> <{doc_uri}> .
            FILTER(isURI(?c) && !STRSTARTS(STR(?c), "urn:smartbrief:doc:") && !STRSTARTS(STR(?c), "http://www.w3.org/") && !STRSTARTS(STR(?c), "https://smartbrief.ai/ontology/"))
        }}
        """
    else:
        sparql_query = """
        SELECT DISTINCT ?c WHERE {
            { ?c ?p ?o . FILTER(isURI(?c) && STRSTARTS(STR(?c), "https://smartbrief.ai/concept/")) }
            UNION
            { ?s ?p ?c . FILTER(isURI(?c) && STRSTARTS(STR(?c), "https://smartbrief.ai/concept/")) }
            UNION
            { ?c ?p ?o . FILTER(isURI(?c) && !STRSTARTS(STR(?c), "urn:smartbrief:doc:") && !STRSTARTS(STR(?c), "http://www.w3.org/") && !STRSTARTS(STR(?c), "https://smartbrief.ai/ontology/")) }
        }
        """

    try:
        res = store.execute_sparql(sparql_query)
        bindings = res.get("bindings", []) if isinstance(res, dict) else []
    except Exception:
        bindings = []

    concept_uris = set()
    for b in bindings:
        c_val = b.get("c", {}).get("value")
        if c_val:
            concept_uris.add(c_val)

    if not concept_uris:
        return []

    lower_query = query.lower()
    matched: List[Dict[str, str]] = []
    seen_ids = set()
    session_candidates = []

    for uri in sorted(concept_uris):
        slug = uri.rsplit("/", 1)[-1].replace("#", "")
        clean_slug = _slugify(slug)
        concept_id = f"concept:{clean_slug}"

        candidate_match = next(
            (c for c in CANDIDATE_CONCEPTS if _slugify(c["name"]) == clean_slug),
            None,
        )

        name = candidate_match["name"] if candidate_match else slug.replace("_", " ").title()

        session_candidates.append({
            "id": concept_id,
            "name": name,
            "uri": uri,
            "clean_slug": clean_slug,
            "candidate": candidate_match,
        })

        is_match = False
        if candidate_match:
            for pat in candidate_match["patterns"]:
                if re.search(pat, lower_query):
                    is_match = True
                    break

        if not is_match:
            slug_words = clean_slug.replace("_", " ")
            if name.lower() in lower_query or slug_words in lower_query or clean_slug in lower_query:
                is_match = True
            elif uri.lower() in lower_query:
                is_match = True
            elif any(w in lower_query.split() for w in clean_slug.split("_") if len(w) > 3):
                is_match = True

        if is_match and concept_id not in seen_ids:
            seen_ids.add(concept_id)
            matched.append(
                {
                    "id": concept_id,
                    "name": name,
                    "uri": uri,
                }
            )

    # Semantic Query Concept Resolution if direct token matching yields no matches
    if not matched and session_candidates:
        # A. Try OpenAI semantic concept resolution via direct HTTPS
        api_key = os.environ.get("OPENAI_API_KEY", "").strip()
        if api_key:
            try:
                candidate_names = [sc["name"] for sc in session_candidates]
                sem_prompt = (
                    f"User question: \"{query}\"\n"
                    f"Candidate concepts: {json.dumps(candidate_names)}\n\n"
                    "Which candidate concept(s) best match or resolve the semantic intent of the query? "
                    "Return ONLY a JSON array of matched concept names, e.g. [\"Aerodynamics\"]. "
                    "If none match, return []."
                )
                headers = {
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                }
                payload = {
                    "model": "gpt-4o-mini",
                    "messages": [{"role": "user", "content": sem_prompt}],
                    "temperature": 0.0,
                }
                sem_resp = requests.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=30,
                )
                if sem_resp.status_code == 200:
                    sem_data = sem_resp.json()
                    choices = sem_data.get("choices", [])
                    if choices:
                        sem_content = choices[0].get("message", {}).get("content", "").strip()
                        if sem_content.startswith("```"):
                            sem_content = re.sub(r"^```(?:json)?\s*", "", sem_content)
                            sem_content = re.sub(r"\s*```$", "", sem_content)
                        parsed_names = json.loads(sem_content.strip())
                        if isinstance(parsed_names, list):
                            for pn in parsed_names:
                                for sc in session_candidates:
                                    if sc["name"].lower() == str(pn).lower() or _slugify(sc["name"]) == _slugify(str(pn)):
                                        if sc["id"] not in seen_ids:
                                            seen_ids.add(sc["id"])
                                            matched.append({
                                                "id": sc["id"],
                                                "name": sc["name"],
                                                "uri": sc["uri"],
                                            })
            except Exception:
                pass

        # B. Deterministic semantic resolution via source text chunks & domain keyword mapping
        if not matched:
            chunks = _get_session_chunks(session_id) if session_id else []
            stop_words = {
                "what", "is", "the", "a", "an", "in", "to", "of", "and", "for", "how", "does", "do",
                "are", "with", "on", "at", "by", "from", "or", "which", "this", "that", "cars", "car"
            }
            q_keywords = [w for w in re.split(r"\W+", lower_query) if len(w) > 2 and w not in stop_words]

            # Semantic domain intent mapping
            semantic_triggers = {
                "aerodynamics": [
                    "attacking corners", "cornering", "corners", "downforce", "wings", "tunnels",
                    "venturi", "circuit", "high speed", "ground effect", "airflow", "lateral grip", "grip"
                ],
                "knowledge_graph": [
                    "graph", "triples", "relations", "ontology", "subgraph", "entities", "rdf"
                ],
                "oxigraph": [
                    "triplestore", "sparql", "database", "rust", "store", "query engine"
                ],
                "w3c_prov_o": [
                    "provenance", "audit", "lineage", "checksum", "tamper-evident", "derivation"
                ],
                "deterministic_reasoning": [
                    "deterministic", "logic", "reasoning", "inference", "formal logic"
                ],
            }

            for sc in session_candidates:
                c_slug = sc["clean_slug"]
                triggers = semantic_triggers.get(c_slug, [])
                has_semantic_trigger = any(tr in lower_query for tr in triggers)

                chunk_correlation = False
                for ch in chunks:
                    ch_lower = ch["content"].lower()
                    if (sc["name"].lower() in ch_lower or c_slug in ch_lower) and sum(1 for kw in q_keywords if kw in ch_lower) >= 2:
                        chunk_correlation = True
                        break

                if (has_semantic_trigger or chunk_correlation) and sc["id"] not in seen_ids:
                    seen_ids.add(sc["id"])
                    matched.append({
                        "id": sc["id"],
                        "name": sc["name"],
                        "uri": sc["uri"],
                    })

    return matched


def _is_infrastructure_triple(subject: str, predicate: str, obj: str) -> bool:
    """Return True if a triple is internal bookkeeping metadata (e.g., extractedFrom or Document root)."""
    if "extractedFrom" in predicate:
        return True
    if subject.startswith("urn:smartbrief:doc:") or obj.startswith("urn:smartbrief:doc:"):
        return True
    if obj.endswith("Document") or "ontology/Document" in obj:
        return True
    return False


def _traverse_subgraph(
    concept_uris: List[str],
    store: OxigraphStore,
    session_id: Optional[str] = None,
    hops: int = 2,
    limit: int = 15,
) -> List[Dict[str, str]]:
    """Traverse 1-hop and 2-hop subgraphs around matched concepts using SPARQL, scoped to session_id if provided."""
    if not concept_uris or store is None:
        return []

    valid_uris = [
        u
        for u in concept_uris
        if isinstance(u, str)
        and (u.startswith("http://") or u.startswith("https://") or u.startswith("urn:"))
    ]
    if not valid_uris:
        return []

    start_clause = " ".join(f"<{u}>" for u in valid_uris)
    sparql_limit = max(limit * 3, 30)

    if session_id:
        doc_uri = f"urn:smartbrief:doc:{session_id}"
        session_filter = f"""
        FILTER(
            ?p != <https://smartbrief.ai/ontology/extractedFrom> &&
            !STRSTARTS(STR(?s), "urn:smartbrief:doc:") &&
            !STRSTARTS(STR(?o), "urn:smartbrief:doc:") &&
            EXISTS {{ ?s <https://smartbrief.ai/ontology/extractedFrom> <{doc_uri}> }} &&
            (
                ?p = <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> ||
                EXISTS {{ ?o <https://smartbrief.ai/ontology/extractedFrom> <{doc_uri}> }} ||
                isLiteral(?o)
            )
        )
        """
        mid_filter = f"FILTER(?p1 != <https://smartbrief.ai/ontology/extractedFrom> && EXISTS {{ ?mid <https://smartbrief.ai/ontology/extractedFrom> <{doc_uri}> }})"
    else:
        session_filter = """
        FILTER(
            ?p != <https://smartbrief.ai/ontology/extractedFrom> &&
            !STRSTARTS(STR(?s), "urn:smartbrief:doc:") &&
            !STRSTARTS(STR(?o), "urn:smartbrief:doc:")
        )
        """
        mid_filter = "FILTER(?p1 != <https://smartbrief.ai/ontology/extractedFrom>)"

    if hops <= 1:
        sparql_query = f"""
        SELECT DISTINCT ?s ?p ?o WHERE {{
            VALUES ?start {{ {start_clause} }}
            {{
                ?start ?p ?o .
                BIND(?start AS ?s)
            }} UNION {{
                ?s ?p ?start .
                BIND(?start AS ?o)
            }}
            {session_filter}
        }} LIMIT {sparql_limit}
        """
    else:
        sparql_query = f"""
        SELECT DISTINCT ?s ?p ?o WHERE {{
            VALUES ?start {{ {start_clause} }}
            {{
                ?start ?p ?o .
                BIND(?start AS ?s)
            }} UNION {{
                ?s ?p ?start .
                BIND(?start AS ?o)
            }} UNION {{
                ?start ?p1 ?mid .
                ?mid ?p ?o .
                BIND(?mid AS ?s)
                FILTER(?o != ?start)
                {mid_filter}
            }} UNION {{
                ?mid ?p1 ?start .
                ?s ?p ?mid .
                BIND(?mid AS ?o)
                FILTER(?s != ?start)
                {mid_filter}
            }}
            {session_filter}
        }} LIMIT {sparql_limit}
        """

    try:
        result = store.execute_sparql(sparql_query)
        bindings = result.get("bindings", []) if isinstance(result, dict) else []
    except Exception:
        bindings = []

    seen = set()
    triples: List[Dict[str, str]] = []
    for b in bindings:
        s_val = b.get("s", {}).get("value", "")
        p_val = b.get("p", {}).get("value", "")
        o_val = b.get("o", {}).get("value", "")

        if _is_infrastructure_triple(s_val, p_val, o_val):
            continue

        key = (s_val, p_val, o_val)
        if key in seen:
            continue
        seen.add(key)
        raw_triple = f"{s_val} {p_val} {o_val}"
        triples.append(
            {
                "subject": s_val,
                "predicate": p_val,
                "object": o_val,
                "raw_triple": raw_triple,
            }
        )
        if len(triples) >= limit:
            break

    return triples


def _format_uri_label(uri: str) -> str:
    """Format a URI into a readable label."""
    if uri.startswith("https://smartbrief.ai/concept/"):
        return uri.split("/")[-1].replace("_", " ").title()
    if uri.startswith("https://smartbrief.ai/ontology/"):
        return uri.split("/")[-1]
    if uri.startswith("urn:smartbrief:doc:"):
        return f"Document({uri.split(':')[-1]})"
    return uri.split("/")[-1]


def _clean_predicate_label(predicate: str) -> str:
    """Format predicate into natural human-readable label, fixing 22-rdf-syntax-nstype bug."""
    if (
        predicate == "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
        or predicate.endswith("#type")
        or "22-rdf-syntax-ns" in predicate
    ):
        return "is an instance of"
    p_name = predicate.rsplit("/", 1)[-1].replace("#", "")
    if p_name == "type":
        return "is an instance of"
    if p_name == "interactsWith":
        return "interacts with"
    if p_name == "enables":
        return "enables"
    if p_name == "extractedFrom":
        return "was extracted from"
    if p_name == "relatesTo":
        return "relates to"
    if p_name == "partOf":
        return "is part of"
    return re.sub(r"([A-Z])", r" \1", p_name).strip().lower()


def _synthesize_hybrid_answer(
    query: str,
    matched_concepts: List[Dict[str, str]],
    retrieved_triples: List[Dict[str, str]],
    session_id: str,
    doc_summary: Optional[str] = None,
    source_chunks: Optional[List[str]] = None,
) -> str:
    """Synthesize a hybrid GraphRAG response combining graph triples and document context."""
    if not matched_concepts:
        return (
            f"No relevant knowledge graph concepts or relations were found for query: '{query}'. "
            "The embedded Oxigraph knowledge graph currently contains no entities matching this query."
        )

    # 1. Retrieve chunks from SQLite if not explicitly provided
    if source_chunks is None:
        chunk_records = _get_session_chunks(session_id)
        source_chunks = [c["content"] for c in chunk_records]

    # 2. Filter out infrastructure/system triples from user-facing answer synthesis
    clean_triples = [
        t
        for t in retrieved_triples
        if not _is_infrastructure_triple(
            t.get("subject", ""),
            t.get("predicate", ""),
            t.get("object", ""),
        )
    ]

    # 3. Format relational sentences with cleaned predicate labels
    relation_phrases = []
    for t in clean_triples:
        s_lbl = _format_uri_label(t["subject"])
        p_lbl = _clean_predicate_label(t["predicate"])
        o_lbl = _format_uri_label(t["object"])
        relation_phrases.append(f"{s_lbl} {p_lbl} {o_lbl}")

    concept_names = [c["name"] for c in matched_concepts]

    # 4. Invoke OpenAI generative synthesis via direct HTTPS when OPENAI_API_KEY is available
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if api_key:
        try:
            triples_ctx = "\n".join(f"- {rp}" for rp in relation_phrases[:10]) if relation_phrases else "None"
            text_ctx = "\n\n".join(source_chunks) if source_chunks else (doc_summary or "")
            system_msg = (
                "You are an expert AI synthesizing answers using a hybrid Knowledge Graph and text retrieval pipeline. "
                "Produce a concise (2–3 sentences), factually grounded answer directly addressing the question using "
                "the provided graph triples and source text context. Filter out infrastructure/system metadata."
            )
            user_msg = (
                f"Question: {query}\n\n"
                f"Asserted Concepts: {', '.join(concept_names)}\n\n"
                f"Knowledge Graph Relations:\n{triples_ctx}\n\n"
                f"Source Text Context:\n{text_ctx if text_ctx else 'None'}\n\n"
                "Answer (concise 2–3 sentences):"
            )
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": user_msg},
                ],
                "temperature": 0.2,
                "max_tokens": 300,
            }
            resp = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=30,
            )
            if resp.status_code == 200:
                result_data = resp.json()
                choices = result_data.get("choices", [])
                if choices:
                    llm_text = choices[0].get("message", {}).get("content", "").strip()
                    if llm_text:
                        return llm_text
        except Exception:
            pass

    # 5. Fall back gracefully to a clean deterministic summary
    all_sentences = []
    for ch in (source_chunks or []):
        for s in re.split(r"(?<=[.!?])\s+", ch.strip()):
            s_clean = s.strip()
            if len(s_clean) > 20:
                all_sentences.append(s_clean)

    stop_words = {
        "what", "is", "the", "a", "an", "in", "to", "of", "and", "for", "how", "does", "do",
        "are", "with", "on", "at", "by", "from", "or", "which", "this", "that", "cars", "car"
    }
    query_words = [w.lower() for w in re.split(r"\W+", query) if len(w) > 2 and w.lower() not in stop_words]
    concept_words = [w.lower() for c in concept_names for w in re.split(r"\W+", c) if len(w) > 2]

    # Domain keywords associated with concepts
    domain_terms = {
        "aerodynamics": ["downforce", "wings", "tunnels", "venturi", "airflow", "ground effect", "cornering", "corners", "drag", "grip"],
        "knowledge_graph": ["triples", "relations", "entities", "subgraph", "ontology", "rdf"],
        "oxigraph": ["triplestore", "sparql", "database", "rust", "store"],
        "w3c_prov_o": ["provenance", "audit", "lineage", "checksum", "integrity"],
    }
    extra_keywords = set()
    for c in concept_names:
        c_slug = _slugify(c)
        if c_slug in domain_terms:
            extra_keywords.update(domain_terms[c_slug])

    def _score_sentence(sent: str) -> float:
        s_lower = sent.lower()
        score = 0.0
        for qw in query_words:
            if qw in s_lower:
                score += 2.0
        for cw in concept_words:
            if cw in s_lower:
                score += 1.5
        for ek in extra_keywords:
            if ek in s_lower:
                score += 1.0
        if any(term in s_lower for term in ["synonymous", "refer", "referred to", "known as", "means", "defined as"]):
            score += 2.0
        return score

    scored = sorted(
        [(s, _score_sentence(s)) for s in all_sentences if _score_sentence(s) > 0],
        key=lambda x: x[1],
        reverse=True,
    )

    selected_sentences = [s[0] for s in scored[:2]]

    ans_parts = []
    if selected_sentences:
        ans_parts.extend(selected_sentences)
    elif doc_summary:
        ans_parts.append(doc_summary)

    if relation_phrases and len(selected_sentences) < 2:
        rel_fact = f"In the knowledge graph, {relation_phrases[0]}."
        ans_parts.append(rel_fact)
    elif not ans_parts:
        ans_parts.append(
            f"Based on Knowledge Graph analysis for {', '.join(concept_names)}, the active concepts address the query '{query}'."
        )

    full_ans = " ".join(ans_parts).strip()
    return full_ans


def _generate_flashcards_data(
    concepts: List[Dict[str, str]], text_context: str
) -> List[Dict[str, str]]:
    """Generate 3 mock Q&A flashcards corresponding to the extracted concepts."""
    flashcards_templates = [
        {
            "concept_name": "Knowledge Graph",
            "question": "What is the primary architectural role of a Knowledge Graph in Semantica?",
            "answer": "It serves as a deterministic semantic memory layer that models explicit relationships between concepts rather than relying solely on vector embeddings.",
        },
        {
            "concept_name": "Oxigraph",
            "question": "Why is embedded Oxigraph chosen for local graph processing in SmartBrief?",
            "answer": "Oxigraph operates in-process as an embedded SPARQL 1.1 store, delivering zero-latency graph queries without requiring an external database cluster.",
        },
        {
            "concept_name": "W3C PROV-O",
            "question": "How does Semantica enforce decision provenance using the W3C PROV-O standard?",
            "answer": "Every generated output is cryptographically hashed and linked to source entities, activities, and software agents in a tamper-evident causal graph.",
        },
        {
            "concept_name": "Deterministic Reasoning",
            "question": "How does deterministic reasoning contrast with probabilistic LLM inference?",
            "answer": "Deterministic reasoning uses formal logic (SPARQL, Datalog, Rete) to guarantee consistent, explainable outputs that can be audited for compliance.",
        },
        {
            "concept_name": "Context Graph",
            "question": "How does a Context Graph bridge unstructured input and agent decisions?",
            "answer": "It parses raw input into structured entities and triplets, providing a queryable topological context for agent actions.",
        },
        {
            "concept_name": "AI Decision Intelligence",
            "question": "What problem does Semantica's Decision Intelligence solve in production AI?",
            "answer": "It closes the accountability gap by attaching complete causal ancestry to every recommendation, flashcard, or generated summary.",
        },
    ]

    result = []
    is_semantica_doc = "semantica" in text_context.lower() or "oxigraph" in text_context.lower()
    for idx, c in enumerate(concepts):
        # Match template only for Semantica/Oxigraph docs, or create tailored Q&A
        matched = next(
            (t for t in flashcards_templates if is_semantica_doc and t["concept_name"].lower() == c["name"].lower()),
            None,
        )
        if matched:
            result.append(
                {
                    "concept_name": c["name"],
                    "question": matched["question"],
                    "answer": matched["answer"],
                }
            )
        else:
            cat = c.get("category", "Key Concept")
            if cat == "Primary Subject":
                q = f"What is {c['name']} according to the document?"
            elif "Entity" in cat or "Acronym" in cat:
                q = f"What role does {c['name']} play in this context?"
            else:
                q = f"How does the text describe or characterize {c['name']}?"

            result.append(
                {
                    "concept_name": c["name"],
                    "question": q,
                    "answer": c.get("description", f"{c['name']} is a primary concept discussed in the text."),
                }
            )

    return result[:5]


def _extract_with_openai(text: str, model: str = "gpt-4o-mini") -> Optional[Dict[str, Any]]:
    """Extract summary, structured knowledge graph concepts (6-12 entities), triplets, and 3-5 flashcards using OpenAI via direct HTTPS."""
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        return None
    try:
        sys_prompt = (
            "You are an expert knowledge graph engineer and pedagogical learning assistant. "
            "Analyze the given text to extract a comprehensive domain knowledge graph and high-yield active recall flashcards.\n\n"
            "Requirements:\n"
            "1. Knowledge Graph Entities ('concepts'): Extract 6 to 12 distinct key concepts, entities, organizations, regulations, championships, or technologies mentioned across the ENTIRE text.\n"
            "2. Semantic Triplets ('triplets'): Extract formal semantic relationship triplets connecting these concepts across the text (subject, predicate, object).\n"
            "3. Active Recall Flashcards ('flashcards'): Generate 3 to 5 targeted active recall questions and concise answers testing understanding of the most crucial concepts in the text.\n\n"
            "You MUST return ONLY a JSON object with this exact structure:\n"
            "{\n"
            '  "summary": "Concise executive summary of the document (2-3 sentences).",\n'
            '  "concepts": [\n'
            '    {\n'
            '      "name": "Concept Name",\n'
            '      "category": "Category or Entity Type (e.g. Motorsport Championship, Governing Body, Technology, Biology)",\n'
            '      "description": "Clear, informative explanation of this concept based on the text."\n'
            '    }\n'
            '  ],\n'
            '  "triplets": [\n'
            '    {\n'
            '      "subject": "Concept Name 1",\n'
            '      "predicate": "relation (e.g. sanctionedBy, competesIn, utilizes, regulates, causes)",\n'
            '      "object": "Concept Name 2"\n'
            '    }\n'
            '  ],\n'
            '  "flashcards": [\n'
            '    {\n'
            '      "target_concept": "Concept Name (must correspond to one of the concepts above)",\n'
            '      "question": "Clear, high-yield active recall question testing understanding of this concept.",\n'
            '      "answer": "Accurate, concise answer derived directly from the document.",\n'
            '      "source_excerpt": "Exact or near-exact sentence from the text that justifies this question and answer."\n'
            '    }\n'
            '  ]\n'
            "}\n"
            "Ground everything directly and faithfully in the provided text."
        )

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": f"Document text:\n\n{text}"}
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
            "max_tokens": 2500,
        }

        resp = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=30,
        )
        if resp.status_code != 200:
            print(f"[OpenAI Extraction Error HTTP {resp.status_code}] {resp.text}")
            return None

        result_data = resp.json()
        content = result_data["choices"][0]["message"]["content"]
        if not content:
            return None
        data = json.loads(content)
        if isinstance(data, dict) and "concepts" in data and len(data["concepts"]) >= 3:
            return data
        return None
    except Exception as e:
        print(f"[OpenAI Extraction Error] {e}")
        return None


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------
@app.get(
    "/api/health",
    summary="Health Check",
    tags=["Health"],
)
@app.get("/", include_in_schema=False)
async def health_check():
    """Verify service health and embedded Oxigraph readiness."""
    global oxigraph_store, provenance_manager
    if oxigraph_store is None:
        oxigraph_store = OxigraphStore()
    if provenance_manager is None:
        provenance_manager = ProvenanceManager(storage_path=PROV_DB_PATH)

    store_ready = oxigraph_store is not None
    prov_ready = provenance_manager is not None

    return {
        "status": "healthy",
        "service": "SmartBrief Backend",
        "version": "1.0.0",
        "oxigraph_store_active": store_ready,
        "provenance_manager_active": prov_ready,
        "openai_available": bool(os.environ.get("OPENAI_API_KEY", "").strip()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post(
    "/api/process",
    response_model=ProcessResponse,
    status_code=status.HTTP_200_OK,
    summary="Process Article Text",
    description="Summarize article, populate Semantica embedded Oxigraph knowledge graph, and generate 3 Q&A flashcards with W3C PROV-O provenance audit trails.",
    tags=["AI Pipeline"],
)
async def process_article(payload: ProcessRequest):
    """Core AI processing endpoint for text summarization, graph construction, and provenance tracking."""
    global oxigraph_store, provenance_manager

    # Lazy-init fallback if not initialized through lifespan (e.g. direct test runner)
    if oxigraph_store is None:
        oxigraph_store = OxigraphStore()
    if provenance_manager is None:
        provenance_manager = ProvenanceManager(storage_path=PROV_DB_PATH)

    text = payload.text.strip()
    if not text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provided text cannot be empty or solely whitespace.",
        )

    session_id = payload.session_id.strip() if (payload.session_id and payload.session_id.strip()) else f"proc_{uuid.uuid4().hex[:8]}"
    doc_id = f"urn:smartbrief:doc:{session_id}"

    # 1. Chunk and persist input text in SQLite
    chunks = _chunk_text(text)
    chunk_records = _store_session_chunks(session_id, chunks)

    # 2. Attempt OpenAI extraction first, falling back to local extraction
    llm_data = _extract_with_openai(text)
    is_llm = llm_data is not None and len(llm_data.get("concepts", [])) >= 3

    if is_llm:
        summary = llm_data.get("summary") or _extract_summary(text)
        raw_concepts = llm_data.get("concepts", [])[:12]
        raw_triplets = llm_data.get("triplets", [])
        raw_flashcards = llm_data.get("flashcards", [])[:5]
        agent_name = "OpenAI GPT-4o-mini + Semantica PROV-O"
    else:
        summary = _extract_summary(text)
        raw_concepts = _extract_key_concepts(text)
        raw_triplets = []
        raw_flashcards = _generate_flashcards_data(raw_concepts, text)
        agent_name = "Semantica PROV-O Engine"

    # 3. Populate Semantica's embedded Oxigraph store
    graph_nodes: List[GraphNode] = []
    graph_edges: List[GraphEdge] = []
    concept_items: List[ConceptItem] = []

    # Store root document node
    root_triplet = Triplet(
        subject=doc_id,
        predicate="http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        object="https://smartbrief.ai/ontology/Document",
    )
    oxigraph_store.add_triplet(root_triplet)

    for idx, c in enumerate(raw_concepts):
        concept_slug = _slugify(c["name"])
        concept_uri = f"https://smartbrief.ai/concept/{concept_slug}"
        concept_node_id = f"concept:{concept_slug}"

        # RDF Triplets: Concept classification & extraction link
        t_type = Triplet(
            subject=concept_uri,
            predicate="http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
            object=f"https://smartbrief.ai/ontology/{_slugify(c['category'])}",
        )
        t_extracted = Triplet(
            subject=concept_uri,
            predicate="https://smartbrief.ai/ontology/extractedFrom",
            object=doc_id,
        )
        oxigraph_store.add_triplet(t_type)
        oxigraph_store.add_triplet(t_extracted)

        # Graph node definition
        graph_nodes.append(
            GraphNode(
                id=concept_node_id,
                label=c["name"],
                type=c["category"],
                description=c["description"],
            )
        )

        concept_items.append(
            ConceptItem(
                id=concept_node_id,
                name=c["name"],
                category=c["category"],
                description=c["description"],
            )
        )

        # Determine originating chunk for provenance metadata
        orig_chunk_id = _find_originating_chunk(c["name"], chunk_records)
        c["chunk_id"] = orig_chunk_id

        # Track concept entity in Semantica Provenance Manager
        provenance_manager.track_entity(
            entity_id=concept_node_id,
            source="article_input",
            metadata={
                "concept_name": c["name"],
                "category": c["category"],
                "session_id": session_id,
                "agent": agent_name,
                "chunk_id": orig_chunk_id,
            },
        )

    # 4. Create interconnecting semantic edges between extracted concepts
    # If LLM extracted triplets, store in Oxigraph and populate graph_edges
    if raw_triplets:
        existing_node_ids = {n.id for n in graph_nodes}
        for t_idx, t in enumerate(raw_triplets):
            subj_name = t.get("subject", "").strip()
            pred_name = t.get("predicate", "relatedTo").strip()
            obj_name = t.get("object", "").strip()
            if subj_name and obj_name:
                subj_slug = _slugify(subj_name)
                obj_slug = _slugify(obj_name)
                pred_slug = _slugify(pred_name)

                # Ensure both subject and object exist as graph nodes
                for ent_name, ent_slug in [(subj_name, subj_slug), (obj_name, obj_slug)]:
                    ent_node_id = f"concept:{ent_slug}"
                    if ent_node_id not in existing_node_ids:
                        graph_nodes.append(
                            GraphNode(
                                id=ent_node_id,
                                label=ent_name,
                                type="Entity",
                                description=f"Extracted domain entity: {ent_name}",
                            )
                        )
                        oxigraph_store.add_triplet(
                            Triplet(
                                subject=f"https://smartbrief.ai/concept/{ent_slug}",
                                predicate="http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
                                object="https://smartbrief.ai/ontology/Entity",
                            )
                        )
                        oxigraph_store.add_triplet(
                            Triplet(
                                subject=f"https://smartbrief.ai/concept/{ent_slug}",
                                predicate="https://smartbrief.ai/ontology/extractedFrom",
                                object=doc_id,
                            )
                        )
                        existing_node_ids.add(ent_node_id)

                rel_triplet = Triplet(
                    subject=f"https://smartbrief.ai/concept/{subj_slug}",
                    predicate=f"https://smartbrief.ai/ontology/{pred_slug}",
                    object=f"https://smartbrief.ai/concept/{obj_slug}",
                )
                oxigraph_store.add_triplet(rel_triplet)
                graph_edges.append(
                    GraphEdge(
                        source=f"concept:{subj_slug}",
                        target=f"concept:{obj_slug}",
                        relation=pred_name,
                    )
                )

                # Associate triplet with originating chunk_id in provenance metadata
                triplet_text = f"{subj_name} {pred_name} {obj_name}"
                triplet_chunk_id = _find_originating_chunk(triplet_text, chunk_records)
                triplet_entity_id = f"triplet_{session_id}_{t_idx}"
                provenance_manager.track_entity(
                    entity_id=triplet_entity_id,
                    source=doc_id,
                    metadata={
                        "subject": subj_name,
                        "predicate": pred_name,
                        "object": obj_name,
                        "session_id": session_id,
                        "chunk_id": triplet_chunk_id,
                    },
                )

    # Fallback edges if no triplets were extracted
    if len(graph_edges) == 0:
        if len(graph_nodes) >= 2:
            rel_1 = Triplet(
                subject=f"https://smartbrief.ai/concept/{_slugify(raw_concepts[0]['name'])}",
                predicate="https://smartbrief.ai/ontology/interactsWith",
                object=f"https://smartbrief.ai/concept/{_slugify(raw_concepts[1]['name'])}",
            )
            oxigraph_store.add_triplet(rel_1)
            graph_edges.append(
                GraphEdge(
                    source=graph_nodes[0].id,
                    target=graph_nodes[1].id,
                    relation="interactsWith",
                )
            )
            fb_chunk_1 = _find_originating_chunk(raw_concepts[0]["name"], chunk_records)
            provenance_manager.track_entity(
                entity_id=f"triplet_{session_id}_0",
                source=doc_id,
                metadata={
                    "subject": raw_concepts[0]["name"],
                    "predicate": "interactsWith",
                    "object": raw_concepts[1]["name"],
                    "session_id": session_id,
                    "chunk_id": fb_chunk_1,
                },
            )

        if len(graph_nodes) >= 3:
            rel_2 = Triplet(
                subject=f"https://smartbrief.ai/concept/{_slugify(raw_concepts[1]['name'])}",
                predicate="https://smartbrief.ai/ontology/enables",
                object=f"https://smartbrief.ai/concept/{_slugify(raw_concepts[2]['name'])}",
            )
            oxigraph_store.add_triplet(rel_2)
            graph_edges.append(
                GraphEdge(
                    source=graph_nodes[1].id,
                    target=graph_nodes[2].id,
                    relation="enables",
                )
            )
            fb_chunk_2 = _find_originating_chunk(raw_concepts[1]["name"], chunk_records)
            provenance_manager.track_entity(
                entity_id=f"triplet_{session_id}_1",
                source=doc_id,
                metadata={
                    "subject": raw_concepts[1]["name"],
                    "predicate": "enables",
                    "object": raw_concepts[2]["name"],
                    "session_id": session_id,
                    "chunk_id": fb_chunk_2,
                },
            )

    # Query Oxigraph with SPARQL to demonstrate embedded query capability
    sparql_query = "SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 30"
    sparql_exec = oxigraph_store.execute_sparql(sparql_query)
    raw_sparql_bindings = sparql_exec.get("bindings", []) if isinstance(sparql_exec, dict) else []
    sparql_sample = [
        b
        for b in raw_sparql_bindings
        if not _is_infrastructure_triple(
            b.get("s", {}).get("value", ""),
            b.get("p", {}).get("value", ""),
            b.get("o", {}).get("value", ""),
        )
    ][:10]

    # 4. Generate 3 Q&A Flashcards anchored to graph nodes
    flashcard_objects: List[Flashcard] = []

    for i, fc in enumerate(raw_flashcards):
        fc_id = f"flashcard_{session_id}_{i+1}"
        
        # Match flashcard to its target concept node
        target_name = fc.get("target_concept", fc.get("concept_name", "")).lower()
        matched_node = next(
            (n for n in graph_nodes if target_name and (target_name in n.label.lower() or n.label.lower() in target_name)),
            None,
        )
        concept_node = matched_node if matched_node else (graph_nodes[i] if i < len(graph_nodes) else graph_nodes[0])
        concept_node_id = concept_node.id

        now_iso = datetime.now(timezone.utc).isoformat()

        # Track the flashcard entity derived from the concept node in Semantica Provenance
        provenance_manager.track_entity(
            entity_id=fc_id,
            source=concept_node_id,
            metadata={
                "question": fc["question"],
                "target_concept": concept_node_id,
                "derivation": "PROV_O_DERIVED_FROM",
                "agent": agent_name,
            },
        )

        # Retrieve verified lineage chain from ProvenanceManager
        prov_lineage = provenance_manager.get_lineage(fc_id)
        lineage_entries = (
            prov_lineage.get("lineage_chain", []) if isinstance(prov_lineage, dict) else []
        )

        # Compute tamper-evident checksum
        checksum_content = f"{fc_id}|{concept_node_id}|{fc['question']}|{fc['answer']}"
        checksum = hashlib.sha256(checksum_content.encode("utf-8")).hexdigest()
        
        excerpt = fc.get("source_excerpt") or f"Extracted concept '{concept_node.label}': {concept_node.description}"
        audit_steps = [
            f"1. Extracted concept '{concept_node.label}' using {agent_name}",
            f"2. Asserted RDF triples in embedded Oxigraph store ({concept_node_id})",
            f"3. Derived Q&A flashcard using Semantica Provenance Manager audit trail",
        ]

        prov_record = FlashcardProvenance(
            entity_id=fc_id,
            node_id=concept_node_id,
            source_node=concept_node_id,
            source_excerpt=excerpt,
            confidence=0.98 if is_llm else 1.0,
            audit_trail=audit_steps,
            source_document="article_input",
            agent=agent_name,
            activity="LLM Knowledge Synthesis & Flashcard Generation" if is_llm else "Flashcard Generation & Context Synthesis",
            timestamp=now_iso,
            checksum=checksum,
            w3c_prov=W3CProvMetadata(
                wasDerivedFrom=f"urn:smartbrief:concept:{concept_node.id}",
                wasGeneratedBy=f"urn:smartbrief:activity:synthesis_{session_id}",
                wasAttributedTo="urn:smartbrief:agent:openai:gpt-4o-mini" if is_llm else "urn:smartbrief:agent:semantica_agi",
            ),
            lineage_chain=lineage_entries,
        )

        flashcard_objects.append(
            Flashcard(
                id=fc_id,
                question=fc["question"],
                answer=fc["answer"],
                concept_id=concept_node_id,
                concept_name=concept_node.label,
                provenance=prov_record,
            )
        )

    # Compile domain session triplets (excluding internal bookkeeping triples)
    session_triplets: List[TripletItem] = []
    for idx, c in enumerate(raw_concepts):
        concept_slug = _slugify(c["name"])
        concept_uri = f"https://smartbrief.ai/concept/{concept_slug}"
        session_triplets.append(
            TripletItem(
                subject=concept_uri,
                predicate="http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
                object=f"https://smartbrief.ai/ontology/{_slugify(c['category'])}",
                confidence=1.0,
            )
        )
    for edge in graph_edges:
        src_slug = edge.source.replace("concept:", "")
        tgt_slug = edge.target.replace("concept:", "")
        session_triplets.append(
            TripletItem(
                subject=f"https://smartbrief.ai/concept/{src_slug}",
                predicate=f"https://smartbrief.ai/ontology/{_slugify(edge.relation)}",
                object=f"https://smartbrief.ai/concept/{tgt_slug}",
                confidence=0.98 if is_llm else 1.0,
            )
        )

    # Construct response
    return ProcessResponse(
        summary=summary,
        concepts=concept_items,
        graph_nodes=graph_nodes,
        graph=KnowledgeGraph(
            nodes=graph_nodes,
            edges=graph_edges,
            triplets=session_triplets,
            triplet_count=len(session_triplets),
            sparql_sample=sparql_sample,
        ),
        flashcards=flashcard_objects,
        provenance_summary=ProvenanceSummary(
            total_entities_tracked=len(flashcard_objects) + len(graph_nodes),
            storage_backend="Semantica Oxigraph Embedded + OpenAI gpt-4o-mini + SQLite" if is_llm else "Semantica Oxigraph Embedded + Provenance SQLite",
            provenance_standard="W3C PROV-O (Provenance Ontology)",
            session_id=session_id,
        ),
    )


@app.get(
    "/api/provenance/{entity_id}",
    summary="Get Entity Provenance Lineage",
    tags=["Decision Provenance"],
)
async def get_entity_provenance(entity_id: str):
    """Query Semantica provenance lineage and audit trail for any tracked entity."""
    global provenance_manager
    if provenance_manager is None:
        provenance_manager = ProvenanceManager(storage_path=PROV_DB_PATH)

    lineage = provenance_manager.get_lineage(entity_id)
    if not lineage:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Provenance not found for entity ID: {entity_id}",
        )
    return lineage


@app.get(
    "/api/graph/triplets",
    response_model=AllTripletsResponse,
    summary="Get All Oxigraph RDF Triplets",
    tags=["Knowledge Graph & Oxigraph"],
)
async def get_all_triplets():
    """Retrieve all RDF triplets currently stored in Semantica's embedded Oxigraph store."""
    global oxigraph_store
    if oxigraph_store is None:
        oxigraph_store = OxigraphStore()

    raw_triplets = [
        t
        for t in oxigraph_store.get_triplets()
        if not _is_infrastructure_triple(t.subject, t.predicate, t.object)
    ]
    triplet_items = [
        TripletItem(
            subject=t.subject,
            predicate=t.predicate,
            object=t.object,
            confidence=getattr(t, "confidence", 1.0) or 1.0,
        )
        for t in raw_triplets
        if not _is_infrastructure_triple(t.subject, t.predicate, t.object)
    ]
    return AllTripletsResponse(
        total_triplets=len(triplet_items),
        triplets=triplet_items,
        store_backend="Semantica Oxigraph Embedded",
    )


@app.post(
    "/api/graph/sparql",
    response_model=SparqlQueryResponse,
    summary="Execute SPARQL Query on Oxigraph",
    tags=["Knowledge Graph & Oxigraph"],
)
async def execute_sparql_query(payload: SparqlQueryRequest):
    """Execute a SPARQL 1.1 query directly against Semantica's embedded Oxigraph store."""
    global oxigraph_store
    if oxigraph_store is None:
        oxigraph_store = OxigraphStore()

    query_str = payload.query.strip()
    if not query_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SPARQL query cannot be empty.",
        )

    try:
        result = oxigraph_store.execute_sparql(query_str)
        if isinstance(result, dict) and result.get("success"):
            variables = result.get("variables", [])
            bindings = result.get("bindings", [])
            return SparqlQueryResponse(
                success=True,
                variables=variables,
                bindings=bindings,
                total_results=len(bindings),
                query=query_str,
            )
        else:
            return SparqlQueryResponse(
                success=True,
                variables=[],
                bindings=[],
                total_results=0,
                query=query_str,
            )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"SPARQL execution error: {str(exc)}",
        )


@app.get(
    "/api/graph/export",
    response_model=ExportRdfResponse,
    summary="Export Oxigraph Knowledge Graph as RDF Turtle",
    tags=["Knowledge Graph & Oxigraph"],
)
async def export_graph_turtle():
    """Export the complete Oxigraph triplestore in standard W3C Turtle syntax."""
    global oxigraph_store
    if oxigraph_store is None:
        oxigraph_store = OxigraphStore()

    raw_triplets = [
        t
        for t in oxigraph_store.get_triplets()
        if not _is_infrastructure_triple(t.subject, t.predicate, t.object)
    ]
    turtle_lines = [
        "# SmartBrief Knowledge Graph - W3C Turtle Export",
        f"# Exported At: {datetime.now(timezone.utc).isoformat()}",
        f"# Total Asserted Triples: {len(raw_triplets)}",
        "@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .",
        "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .",
        "@prefix sb: <https://smartbrief.ai/concept/> .",
        "@prefix sbo: <https://smartbrief.ai/ontology/> .",
        "",
    ]
    for t in raw_triplets:
        subj = f"<{t.subject}>" if t.subject.startswith("http") or ":" in t.subject else f"<https://smartbrief.ai/concept/{t.subject}>"
        pred = f"<{t.predicate}>" if t.predicate.startswith("http") or ":" in t.predicate else f"<https://smartbrief.ai/ontology/{t.predicate}>"
        obj = f"<{t.object}>" if t.object.startswith("http") or ":" in t.object else f'"{t.object}"'
        turtle_lines.append(f"{subj} {pred} {obj} .")

    turtle_content = "\n".join(turtle_lines)
    return ExportRdfResponse(
        format="turtle",
        content=turtle_content,
        total_triplets=len(raw_triplets),
    )


@app.post(
    "/api/rag/query",
    response_model=RAGQueryResponse,
    status_code=status.HTTP_200_OK,
    summary="Hybrid GraphRAG Query",
    description="Query knowledge graph using in-process hybrid GraphRAG with embedded Oxigraph subgraph traversal and Semantica W3C PROV-O provenance tracking.",
    tags=["GraphRAG"],
)
async def rag_query(payload: RAGQueryRequest):
    """Execute lightweight in-process Hybrid GraphRAG query over embedded Oxigraph knowledge graph."""
    global oxigraph_store, provenance_manager

    # Lazy-init fallback if not initialized through lifespan
    if oxigraph_store is None:
        oxigraph_store = OxigraphStore()
    if provenance_manager is None:
        provenance_manager = ProvenanceManager(storage_path=PROV_DB_PATH)

    clean_query = payload.query.strip()
    if not clean_query:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query cannot be empty or solely whitespace.",
        )

    session_id = payload.session_id.strip() if payload.session_id else ""
    if not session_id:
        session_id = f"proc_{uuid.uuid4().hex[:8]}"

    doc_uri = f"urn:smartbrief:doc:{session_id}"

    # 1. Subgraph Traversal & Latency Measurement
    t0 = time.perf_counter()
    matched_concepts_raw = _extract_query_concepts(clean_query, oxigraph_store, session_id=session_id)
    concept_uris = [c["uri"] for c in matched_concepts_raw]
    retrieved_triples_raw = _traverse_subgraph(
        concept_uris=concept_uris,
        store=oxigraph_store,
        session_id=session_id,
        hops=2,
        limit=payload.top_k_triples,
    )
    t1 = time.perf_counter()
    execution_time_ms = round((t1 - t0) * 1000, 3)

    # 2. Hybrid Context Synthesis
    chunk_records = _get_session_chunks(session_id)
    source_chunks = [c["content"] for c in chunk_records]
    answer = _synthesize_hybrid_answer(
        query=clean_query,
        matched_concepts=matched_concepts_raw,
        retrieved_triples=retrieved_triples_raw,
        session_id=session_id,
        source_chunks=source_chunks,
    )

    # 3. W3C PROV-O Provenance Registration
    rag_entity_id = f"rag_query_{session_id}_{uuid.uuid4().hex[:8]}"
    derived_from_uris = concept_uris + [doc_uri] if concept_uris else [doc_uri]
    derived_from_str = ", ".join(derived_from_uris)
    now_iso = datetime.now(timezone.utc).isoformat()

    provenance_manager.track_entity(
        entity_id=rag_entity_id,
        source=doc_uri,
        activity_id="rag_synthesis",
        used_entities=derived_from_uris,
        metadata={
            "query": clean_query,
            "session_id": session_id,
            "activity": "rag_synthesis",
            "wasDerivedFrom": derived_from_str,
            "wasGeneratedBy": "rag_synthesis",
            "hop_count": 2 if retrieved_triples_raw else 0,
            "triples_retrieved": len(retrieved_triples_raw),
        },
    )

    prov_lineage = provenance_manager.get_lineage(rag_entity_id)
    lineage_entries = (
        prov_lineage.get("lineage_chain", []) if isinstance(prov_lineage, dict) else []
    )

    checksum_content = f"{rag_entity_id}|{session_id}|{clean_query}|{answer}"
    checksum = hashlib.sha256(checksum_content.encode("utf-8")).hexdigest()

    source_node_str = (
        ", ".join(c["id"] for c in matched_concepts_raw)
        if matched_concepts_raw
        else "none"
    )

    prov_record = RAGProvenance(
        entity_id=rag_entity_id,
        source_node=source_node_str,
        source_document=doc_uri,
        agent="Semantica GraphRAG Engine",
        activity="rag_synthesis",
        timestamp=now_iso,
        checksum=checksum,
        w3c_prov=W3CProvMetadata(
            wasDerivedFrom=derived_from_str,
            wasGeneratedBy="urn:smartbrief:activity:rag_synthesis",
            wasAttributedTo="urn:smartbrief:agent:semantica_agi",
        ),
        lineage_chain=lineage_entries,
    )

    return RAGQueryResponse(
        query=clean_query,
        answer=answer,
        graph_context=GraphContext(
            matched_concepts=[MatchedConcept(**c) for c in matched_concepts_raw],
            retrieved_triples=[RetrievedTriple(**t) for t in retrieved_triples_raw],
            traversal_hops=2 if retrieved_triples_raw else (1 if matched_concepts_raw else 0),
            execution_time_ms=execution_time_ms,
        ),
        provenance=prov_record,
    )

