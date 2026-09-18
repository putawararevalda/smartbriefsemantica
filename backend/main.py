"""SmartBrief Backend Service.

FastAPI application integrating semantica-agi/semantica with embedded Oxigraph
and W3C PROV-O decision provenance tracking.
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
import hashlib
import os
import re
from typing import Any, Dict, List, Optional
import uuid

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


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager to initialize and clean up Semantica services."""
    global oxigraph_store, provenance_manager
    # Initialize embedded Oxigraph store
    oxigraph_store = OxigraphStore()

    # Initialize Semantica Provenance Manager with persistent SQLite storage
    provenance_manager = ProvenanceManager(storage_path=PROV_DB_PATH)

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


class KnowledgeGraph(BaseModel):
    """Structured graph representation."""

    nodes: List[GraphNode]
    edges: List[GraphEdge]
    triplet_count: int
    sparql_sample: Optional[List[Dict[str, Any]]] = None


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
    source_node: str = Field(..., description="Knowledge graph node this card was derived from.")
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
    graph: KnowledgeGraph = Field(..., description="Knowledge graph nodes and edges.")
    flashcards: List[Flashcard] = Field(
        ...,
        description="3 interactive Q&A flashcards with Semantica provenance audit trails.",
    )
    provenance_summary: ProvenanceSummary


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


def _extract_key_concepts(text: str) -> List[Dict[str, str]]:
    """Simulate concept and entity extraction from input text for graph modeling."""
    found_concepts = []

    # Domain dictionary of recognizable concepts with semantic metadata
    candidate_dict = [
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
    ]

    lower_text = text.lower()
    for item in candidate_dict:
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

    # If fewer than 3 concepts found, supplement with top domain concepts
    fallback_pool = [c for c in candidate_dict if c not in found_concepts]
    while len(found_concepts) < 3 and fallback_pool:
        found_concepts.append(fallback_pool.pop(0))

    # Return top 3 distinct concepts
    return found_concepts[:3]


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
    for idx, c in enumerate(concepts):
        # Match template or create tailored Q&A
        matched = next(
            (t for t in flashcards_templates if t["concept_name"].lower() == c["name"].lower()),
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
            result.append(
                {
                    "concept_name": c["name"],
                    "question": f"What significance does '{c['name']}' hold in the context of this document?",
                    "answer": f"{c['name']} ({c['category']}) represents {c['description']} and was extracted as a foundational concept in the source text.",
                }
            )

    return result[:3]


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

    session_id = f"proc_{uuid.uuid4().hex[:8]}"
    doc_id = f"urn:smartbrief:doc:{session_id}"

    # 1. Synthesize Executive Summary
    summary = _extract_summary(text)

    # 2. Extract Key Concepts
    raw_concepts = _extract_key_concepts(text)

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

        # Track concept entity in Semantica Provenance Manager
        provenance_manager.track_entity(
            entity_id=concept_node_id,
            source="article_input",
            metadata={
                "concept_name": c["name"],
                "category": c["category"],
                "session_id": session_id,
            },
        )

    # Create interconnecting semantic edges between extracted concepts
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

    # Query Oxigraph with SPARQL to demonstrate embedded query capability
    sparql_query = "SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 10"
    sparql_exec = oxigraph_store.execute_sparql(sparql_query)
    sparql_sample = sparql_exec.get("bindings", []) if isinstance(sparql_exec, dict) else []

    # 4. Generate 3 Q&A Flashcards anchored to graph nodes
    flashcards_raw = _generate_flashcards_data(raw_concepts, text)
    flashcard_objects: List[Flashcard] = []

    for i, fc in enumerate(flashcards_raw):
        fc_id = f"flashcard_{session_id}_{i+1}"
        concept_node = graph_nodes[i] if i < len(graph_nodes) else graph_nodes[0]
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

        prov_record = FlashcardProvenance(
            entity_id=fc_id,
            source_node=concept_node_id,
            source_document="article_input",
            agent="Semantica PROV-O Engine",
            activity="Flashcard Generation & Context Synthesis",
            timestamp=now_iso,
            checksum=checksum,
            w3c_prov=W3CProvMetadata(
                wasDerivedFrom=f"urn:smartbrief:concept:{concept_node.id}",
                wasGeneratedBy=f"urn:smartbrief:activity:synthesis_{session_id}",
                wasAttributedTo="urn:smartbrief:agent:semantica_agi",
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

    # Construct response
    return ProcessResponse(
        summary=summary,
        concepts=concept_items,
        graph=KnowledgeGraph(
            nodes=graph_nodes,
            edges=graph_edges,
            triplet_count=len(graph_nodes) * 2 + len(graph_edges) + 1,
            sparql_sample=sparql_sample,
        ),
        flashcards=flashcard_objects,
        provenance_summary=ProvenanceSummary(
            total_entities_tracked=len(flashcard_objects) + len(graph_nodes),
            storage_backend="Semantica Oxigraph Embedded + Provenance SQLite",
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
