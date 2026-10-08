# SmartBrief Backend API & Semantica Integration

This service provides the AI processing backend for **SmartBrief**, powered by **FastAPI**, **`semantica-agi/semantica`** embedded Oxigraph, and **W3C PROV-O** decision provenance tracking.

---

## 1. Quick Start

### Running with Docker
```bash
docker build -t smartbrief-backend .
docker run -p 8003:8003 smartbrief-backend
```

The service will be accessible at `http://localhost:8003`.
Interactive Swagger API Documentation: `http://localhost:8003/docs`

---

## 2. API JSON Contracts

### Endpoint: `POST /api/process`
Summarizes an article, extracts concepts into embedded Oxigraph, and generates 3 Q&A flashcards with W3C PROV-O audit trails.

#### Request Schema (`application/json`)
```json
{
  "text": "Knowledge graphs structure semantic information, allowing AI agents to perform deterministic reasoning. Oxigraph provides an embedded RDF triplestore for fast querying without network latency.",
  "title": "Optional article title"
}
```

#### Response Schema (`application/json`)
```json
{
  "summary": "SmartBrief Executive Summary: Knowledge graphs structure semantic information...",
  "concepts": [
    {
      "id": "concept:knowledge_graph",
      "name": "Knowledge Graph",
      "category": "Data Architecture",
      "description": "Structured network of entities, concepts, and explicit semantic relationships."
    }
  ],
  "graph": {
    "nodes": [
      {
        "id": "concept:knowledge_graph",
        "label": "Knowledge Graph",
        "type": "Data Architecture",
        "description": "Structured network of entities..."
      }
    ],
    "edges": [
      {
        "source": "concept:knowledge_graph",
        "target": "concept:oxigraph",
        "relation": "interactsWith"
      }
    ],
    "triplet_count": 9,
    "sparql_sample": []
  },
  "flashcards": [
    {
      "id": "flashcard_proc_a1b2c3d4_1",
      "question": "What is the primary architectural role of a Knowledge Graph in Semantica?",
      "answer": "It serves as a deterministic semantic memory layer that models explicit relationships between concepts...",
      "concept_id": "concept:knowledge_graph",
      "concept_name": "Knowledge Graph",
      "provenance": {
        "entity_id": "flashcard_proc_a1b2c3d4_1",
        "source_node": "concept:knowledge_graph",
        "source_document": "article_input",
        "agent": "Semantica PROV-O Engine",
        "activity": "Flashcard Generation & Context Synthesis",
        "timestamp": "2026-09-18T15:48:32.439150+00:00",
        "checksum": "5f9d07d9461ffff052f64e83e39081c3992f2f75a3d3572fc02859c47e3c445c",
        "w3c_prov": {
          "wasDerivedFrom": "urn:smartbrief:concept:concept:knowledge_graph",
          "wasGeneratedBy": "urn:smartbrief:activity:synthesis_proc_a1b2c3d4",
          "wasAttributedTo": "urn:smartbrief:agent:semantica_agi"
        },
        "lineage_chain": [
          {
            "entity_id": "flashcard_proc_a1b2c3d4_1",
            "derived_from_id": "concept:knowledge_graph",
            "source_document": "concept:knowledge_graph",
            "checksum": "...",
            "timestamp": "..."
          }
        ]
      }
    }
  ],
  "provenance_summary": {
    "total_entities_tracked": 6,
    "storage_backend": "Semantica Oxigraph Embedded + Provenance SQLite",
    "provenance_standard": "W3C PROV-O (Provenance Ontology)",
    "session_id": "proc_a1b2c3d4"
  }
}
```

---

### Endpoint: `POST /api/rag/query`
Lightweight in-process Hybrid GraphRAG query over embedded Oxigraph knowledge graph with W3C PROV-O provenance audit trails.

#### Request Schema (`application/json`)
```json
{
  "session_id": "proc_a1b2c3d4",
  "query": "How does Oxigraph relate to Knowledge Graph and SPARQL?",
  "top_k_triples": 15
}
```

#### Response Schema (`application/json`)
```json
{
  "query": "How does Oxigraph relate to Knowledge Graph and SPARQL?",
  "answer": "Based on the Knowledge Graph context, the query relates to Oxigraph, Knowledge Graph...",
  "graph_context": {
    "matched_concepts": [
      {
        "id": "concept:oxigraph",
        "name": "Oxigraph",
        "uri": "https://smartbrief.ai/concept/oxigraph"
      },
      {
        "id": "concept:knowledge_graph",
        "name": "Knowledge Graph",
        "uri": "https://smartbrief.ai/concept/knowledge_graph"
      }
    ],
    "retrieved_triples": [
      {
        "subject": "https://smartbrief.ai/concept/oxigraph",
        "predicate": "https://smartbrief.ai/ontology/interactsWith",
        "object": "https://smartbrief.ai/concept/knowledge_graph",
        "raw_triple": "https://smartbrief.ai/concept/oxigraph https://smartbrief.ai/ontology/interactsWith https://smartbrief.ai/concept/knowledge_graph"
      }
    ],
    "traversal_hops": 2,
    "execution_time_ms": 0.35
  },
  "provenance": {
    "entity_id": "rag_query_proc_a1b2c3d4_8f9c1b2a",
    "source_node": "concept:oxigraph, concept:knowledge_graph",
    "source_document": "urn:smartbrief:doc:proc_a1b2c3d4",
    "agent": "Semantica GraphRAG Engine",
    "activity": "rag_synthesis",
    "timestamp": "2026-10-08T10:30:00+00:00",
    "checksum": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "w3c_prov": {
      "wasDerivedFrom": "https://smartbrief.ai/concept/oxigraph, https://smartbrief.ai/concept/knowledge_graph, urn:smartbrief:doc:proc_a1b2c3d4",
      "wasGeneratedBy": "urn:smartbrief:activity:rag_synthesis",
      "wasAttributedTo": "urn:smartbrief:agent:semantica_agi"
    },
    "lineage_chain": []
  }
}
```

---

### Endpoint: `GET /api/health`
Health check endpoint reporting service, embedded Oxigraph, and ProvenanceManager status.

```json
{
  "status": "healthy",
  "service": "SmartBrief Backend",
  "version": "1.0.0",
  "oxigraph_store_active": true,
  "provenance_manager_active": true,
  "timestamp": "2026-09-18T15:48:32.439150+00:00"
}
```

---

### Endpoint: `GET /api/provenance/{entity_id}`
Look up raw Semantica provenance lineage for any tracked entity ID.

---

## 3. Frontend Integration Notes
- For the flashcard grid, iterate over `response.flashcards`.
- For the "Trace Source" button on each flashcard, display `card.provenance`:
  - **Source Graph Node**: `card.provenance.source_node` (`card.concept_name`)
  - **W3C Derivation**: `card.provenance.w3c_prov.wasDerivedFrom`
  - **Generating Activity**: `card.provenance.activity`
  - **Agent / Engine**: `card.provenance.agent`
  - **Audit Checksum**: `card.provenance.checksum`
  - **Full Lineage Chain**: `card.provenance.lineage_chain`
- For the GraphRAG Q&A interface:
  - Submit requests to `POST /api/rag/query` with `session_id`, `query`, and optional `top_k_triples`.
  - Display `response.answer` in markdown.
  - Render graph traversal subgraphs from `response.graph_context.matched_concepts` and `response.graph_context.retrieved_triples`.
  - Show graph traversal performance badge (`response.graph_context.execution_time_ms` ms).
  - Provide an audit/provenance modal displaying `response.provenance`:
    - **Checksum**: `response.provenance.checksum`
    - **Generating Activity**: `response.provenance.activity`
    - **Derivation**: `response.provenance.w3c_prov.wasDerivedFrom`
    - **Agent**: `response.provenance.agent`

