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
from typing import Any, Dict, List, Optional
import uuid
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

        # 2. Capitalized Multi-word Phrases (Entities / Concepts)
        phrase_pattern = re.compile(
            r'\b(?:[A-Z][a-zA-Z0-9]*(?:[\'\’][a-zA-Z]+)?(?:\s+(?:de|du|of|the|and|for|in|on)\s+|\s+)){1,3}[A-Z][a-zA-Z0-9]*(?:[\'\’][a-zA-Z]+)?\b'
        )
        for s in sentences:
            if len(found_concepts) >= 3:
                break
            for match in phrase_pattern.finditer(s):
                words = _clean_words(match.group().strip().split())
                if len(words) >= 2:
                    clean_phrase = ' '.join(words)
                    if not _is_overlap(clean_phrase) and len(clean_phrase) >= 4:
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
    fallback_pool = [c for c in candidate_dict if c["name"].lower() not in {fc["name"].lower() for fc in found_concepts}]
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
                    "answer": c["description"],
                }
            )

    return result[:3]


def _extract_with_openai(text: str, model: str = "gpt-4o-mini") -> Optional[Dict[str, Any]]:
    """Extract summary, structured knowledge graph concepts, triplets, and flashcards using OpenAI."""
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        return None
    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        sys_prompt = (
            "You are an expert knowledge engineer and pedagogical learning assistant. "
            "Analyze the given text to extract a structured knowledge graph and active recall flashcards. "
            "You MUST return ONLY a JSON object with this exact structure:\n"
            "{\n"
            '  "summary": "Concise executive summary of the document (2-3 sentences).",\n'
            '  "concepts": [\n'
            '    {\n'
            '      "name": "Concept Name",\n'
            '      "category": "Category or Entity Type (e.g. Quantum Architecture, Economics, Biology)",\n'
            '      "description": "Clear, informative explanation of this concept based on the text."\n'
            '    }\n'
            '  ],\n'
            '  "triplets": [\n'
            '    {\n'
            '      "subject": "Concept 1",\n'
            '      "predicate": "relation (e.g. utilizes, implements, demonstrates, regulates, causes)",\n'
            '      "object": "Concept 2"\n'
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
            "Constraints:\n"
            "- Exactly 3 concepts in 'concepts'.\n"
            "- At least 2 semantic triplets in 'triplets' connecting these concepts.\n"
            "- Exactly 3 flashcards in 'flashcards', each targeting one of the extracted concepts.\n"
            "- Ground everything directly in the provided text."
        )

        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": f"Document text:\n\n{text}"}
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
            max_tokens=1500,
        )
        content = resp.choices[0].message.content
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

    session_id = f"proc_{uuid.uuid4().hex[:8]}"
    doc_id = f"urn:smartbrief:doc:{session_id}"

    # 1. Attempt OpenAI extraction first, falling back to local extraction
    llm_data = _extract_with_openai(text)
    is_llm = llm_data is not None and len(llm_data.get("concepts", [])) >= 3

    if is_llm:
        summary = llm_data.get("summary") or _extract_summary(text)
        raw_concepts = llm_data.get("concepts")[:3]
        raw_triplets = llm_data.get("triplets", [])
        raw_flashcards = llm_data.get("flashcards", [])[:3]
        agent_name = "OpenAI GPT-4o-mini + Semantica PROV-O"
    else:
        summary = _extract_summary(text)
        raw_concepts = _extract_key_concepts(text)
        raw_triplets = []
        raw_flashcards = _generate_flashcards_data(raw_concepts, text)
        agent_name = "Semantica PROV-O Engine"

    # 2. Populate Semantica's embedded Oxigraph store
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
                "agent": agent_name,
            },
        )

    # 3. Create interconnecting semantic edges between extracted concepts
    # If LLM extracted triplets, store in Oxigraph and populate graph_edges
    if raw_triplets:
        for t in raw_triplets:
            subj_name = t.get("subject", "").strip()
            pred_name = t.get("predicate", "relatedTo").strip()
            obj_name = t.get("object", "").strip()
            if subj_name and obj_name:
                subj_slug = _slugify(subj_name)
                obj_slug = _slugify(obj_name)
                pred_slug = _slugify(pred_name)
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

    # Compile session triplets asserted into Oxigraph
    session_triplets: List[TripletItem] = []
    session_triplets.append(
        TripletItem(
            subject=root_triplet.subject,
            predicate=root_triplet.predicate,
            object=root_triplet.object,
            confidence=1.0,
        )
    )
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
        session_triplets.append(
            TripletItem(
                subject=concept_uri,
                predicate="https://smartbrief.ai/ontology/extractedFrom",
                object=doc_id,
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

    raw_triplets = oxigraph_store.get_triplets()
    triplet_items = [
        TripletItem(
            subject=t.subject,
            predicate=t.predicate,
            object=t.object,
            confidence=getattr(t, "confidence", 1.0) or 1.0,
        )
        for t in raw_triplets
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

    raw_triplets = oxigraph_store.get_triplets()
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


