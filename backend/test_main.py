"""Unit and integration tests for SmartBrief FastAPI Backend."""

import pytest
from fastapi.testclient import TestClient
from main import app

@pytest.fixture
def client():
    """Create test client with active lifespan."""
    with TestClient(app) as test_client:
        yield test_client


def test_health_check(client):
    """Verify health check endpoint returns 200 and expected status."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "SmartBrief Backend"
    assert data["oxigraph_store_active"] is True
    assert data["provenance_manager_active"] is True


def test_process_article_success(client):
    """Verify POST /api/process produces summary, graph, and 3 flashcards with provenance."""
    sample_text = (
        "SmartBrief is an AI-powered article summarizer. Knowledge graphs provide structured, "
        "deterministic memory that enhances LLM reasoning. Oxigraph is an embedded RDF triplestore "
        "enabling fast SPARQL queries. W3C PROV-O provides an auditable provenance trail for decisions."
    )
    response = client.post(
        "/api/process",
        json={"text": sample_text, "title": "Knowledge Graph Summarizer"},
    )
    assert response.status_code == 200
    data = response.json()

    # AC4: Summary
    assert "summary" in data
    assert len(data["summary"]) > 0

    # AC4: Graph concepts
    assert "concepts" in data
    assert len(data["concepts"]) >= 3
    for c in data["concepts"]:
        assert "id" in c
        assert "name" in c
        assert "category" in c
        assert "description" in c

    # AC4: Graph structure
    assert "graph" in data
    assert len(data["graph"]["nodes"]) >= 3
    assert len(data["graph"]["edges"]) >= 1
    assert data["graph"]["triplet_count"] > 0

    # AC2 & AC3: 3 to 5 interactive Q&A flashcards with provenance
    assert "flashcards" in data
    assert 3 <= len(data["flashcards"]) <= 5

    for card in data["flashcards"]:
        assert "id" in card
        assert "question" in card
        assert "answer" in card
        assert "concept_id" in card
        assert "concept_name" in card
        assert "provenance" in card

        prov = card["provenance"]
        assert prov["entity_id"] == card["id"]
        assert prov["source_node"] == card["concept_id"]
        assert "source_document" in prov
        assert "checksum" in prov
        assert len(prov["checksum"]) == 64  # SHA-256
        assert "w3c_prov" in prov
        assert "wasDerivedFrom" in prov["w3c_prov"]
        assert "wasGeneratedBy" in prov["w3c_prov"]
        assert "wasAttributedTo" in prov["w3c_prov"]
        assert "lineage_chain" in prov
        assert isinstance(prov["lineage_chain"], list)


def test_process_article_empty_text(client):
    """Verify POST /api/process rejects empty text with 400."""
    response = client.post("/api/process", json={"text": "   "})
    assert response.status_code == 400
    data = response.json()
    assert "detail" in data


def test_provenance_lookup_endpoint(client):
    """Verify GET /api/provenance/{entity_id} returns lineage."""
    # First create an entity via process
    response = client.post(
        "/api/process",
        json={"text": "Oxigraph embedded triplestore and W3C PROV-O audit trails."},
    )
    assert response.status_code == 200
    card = response.json()["flashcards"][0]
    card_id = card["id"]

    # Query provenance endpoint
    prov_resp = client.get(f"/api/provenance/{card_id}")
    assert prov_resp.status_code == 200
    prov_data = prov_resp.json()
    assert "entity_id" in prov_data
    assert prov_data["entity_id"] == card_id


def test_get_all_triplets_endpoint(client):
    """Verify GET /api/graph/triplets returns all asserted Oxigraph RDF triples."""
    # Process text to populate store
    client.post(
        "/api/process",
        json={"text": "Quantum computing uses superposition in qubits to solve complex calculations."},
    )
    response = client.get("/api/graph/triplets")
    assert response.status_code == 200
    data = response.json()
    assert "total_triplets" in data
    assert "triplets" in data
    assert data["total_triplets"] > 0
    assert len(data["triplets"]) > 0
    for t in data["triplets"]:
        assert "subject" in t
        assert "predicate" in t
        assert "object" in t


def test_sparql_query_endpoint(client):
    """Verify POST /api/graph/sparql executes SPARQL against Oxigraph and returns bindings."""
    # Ensure store has data
    client.post(
        "/api/process",
        json={"text": "Molecular biology and genetics: exons and introns in RNA splicing."},
    )
    sparql_query = "SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 10"
    response = client.post("/api/graph/sparql", json={"query": sparql_query})
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "variables" in data
    assert "bindings" in data
    assert isinstance(data["bindings"], list)
    assert data["total_results"] >= 0


def test_sparql_query_invalid(client):
    """Verify POST /api/graph/sparql rejects invalid query with 400."""
    response = client.post("/api/graph/sparql", json={"query": "THIS IS INVALID SYNTAX"})
    assert response.status_code == 400
    data = response.json()
    assert "detail" in data


def test_export_graph_turtle_endpoint(client):
    """Verify GET /api/graph/export returns valid Turtle RDF string."""
    response = client.get("/api/graph/export")
    assert response.status_code == 200
    data = response.json()
    assert data["format"] == "turtle"
    assert "content" in data
    assert "@prefix" in data["content"]
    assert "total_triplets" in data


def test_rag_query_success(client):
    """Verify POST /api/rag/query executes traversal <10ms and attaches W3C PROV-O."""
    # First seed store via process
    sample_text = (
        "SmartBrief uses Oxigraph as an embedded triplestore for Knowledge Graph reasoning. "
        "W3C PROV-O provides auditable decision provenance."
    )
    proc_resp = client.post("/api/process", json={"text": sample_text})
    assert proc_resp.status_code == 200

    # Query the RAG endpoint
    rag_payload = {
        "session_id": "test_session_rag_1",
        "query": "How does Oxigraph relate to Knowledge Graph and SPARQL?",
        "top_k_triples": 15,
    }
    response = client.post("/api/rag/query", json=rag_payload)
    assert response.status_code == 200
    data = response.json()

    # Query & Answer
    assert data["query"] == rag_payload["query"]
    assert len(data["answer"]) > 0
    assert "Knowledge Graph" in data["answer"] or "Oxigraph" in data["answer"]

    # Graph Context
    ctx = data["graph_context"]
    assert "matched_concepts" in ctx
    assert len(ctx["matched_concepts"]) >= 1
    for mc in ctx["matched_concepts"]:
        assert "id" in mc
        assert "name" in mc
        assert "uri" in mc
        assert mc["uri"].startswith("https://smartbrief.ai/concept/")

    assert "retrieved_triples" in ctx
    assert len(ctx["retrieved_triples"]) >= 1
    for rt in ctx["retrieved_triples"]:
        assert "subject" in rt
        assert "predicate" in rt
        assert "object" in rt
        assert "raw_triple" in rt

    assert ctx["traversal_hops"] == 2
    # Acceptance criteria: traversal overhead < 10ms
    assert ctx["execution_time_ms"] < 10.0

    # W3C PROV-O Provenance
    prov = data["provenance"]
    assert "entity_id" in prov
    assert prov["entity_id"].startswith("rag_query_")
    assert "checksum" in prov
    assert len(prov["checksum"]) == 64  # SHA-256
    assert prov["activity"] == "rag_synthesis"
    assert "w3c_prov" in prov
    assert prov["w3c_prov"]["wasGeneratedBy"] == "urn:smartbrief:activity:rag_synthesis"
    assert "urn:smartbrief:doc:" in prov["w3c_prov"]["wasDerivedFrom"]
    assert prov["w3c_prov"]["wasAttributedTo"] == "urn:smartbrief:agent:semantica_agi"
    assert "lineage_chain" in prov
    assert isinstance(prov["lineage_chain"], list)


def test_rag_query_fallback_unmatched_concepts(client):
    """Verify POST /api/rag/query gracefully handles queries with no matching concepts."""
    rag_payload = {
        "session_id": "test_session_fallback",
        "query": "What is the orbital speed of Jupiter moons?",
        "top_k_triples": 10,
    }
    response = client.post("/api/rag/query", json=rag_payload)
    assert response.status_code == 200
    data = response.json()

    # Graph Context should have empty concepts and triples
    ctx = data["graph_context"]
    assert ctx["matched_concepts"] == []
    assert ctx["retrieved_triples"] == []
    assert ctx["execution_time_ms"] < 10.0

    # Fallback answer should be returned
    assert "No relevant knowledge graph concepts" in data["answer"]

    # Provenance record is still recorded
    prov = data["provenance"]
    assert "entity_id" in prov
    assert len(prov["checksum"]) == 64


def test_rag_query_provenance_retrieval(client):
    """Verify W3C PROV-O audit record is stored and retrievable via GET /api/provenance/{entity_id}."""
    rag_payload = {
        "session_id": "test_session_prov_lookup",
        "query": "Explain Oxigraph and SPARQL queries.",
    }
    response = client.post("/api/rag/query", json=rag_payload)
    assert response.status_code == 200
    entity_id = response.json()["provenance"]["entity_id"]

    # Retrieve from provenance endpoint
    prov_resp = client.get(f"/api/provenance/{entity_id}")
    assert prov_resp.status_code == 200
    prov_data = prov_resp.json()
    assert prov_data["entity_id"] == entity_id
    assert "lineage_chain" in prov_data


def test_rag_query_validation(client):
    """Verify input validation for POST /api/rag/query."""
    # Empty query string
    resp_empty = client.post("/api/rag/query", json={"session_id": "s1", "query": "   "})
    assert resp_empty.status_code == 400

    # Invalid top_k_triples (<= 0)
    resp_invalid_k = client.post(
        "/api/rag/query",
        json={"session_id": "s1", "query": "Oxigraph", "top_k_triples": 0},
    )
    assert resp_invalid_k.status_code == 422


def test_unit_extract_query_concepts_and_subgraph_traversal():
    """Unit test _extract_query_concepts and _traverse_subgraph functions directly."""
    from main import (
        OxigraphStore,
        Triplet,
        _extract_query_concepts,
        _traverse_subgraph,
    )
    import time

    store = OxigraphStore()

    # 1. Empty store should return empty concepts
    assert _extract_query_concepts("Oxigraph", store) == []
    assert _traverse_subgraph([], store) == []

    # 2. Add test triplets into embedded Oxigraph
    c_oxi = "https://smartbrief.ai/concept/oxigraph"
    c_kg = "https://smartbrief.ai/concept/knowledge_graph"
    c_prov = "https://smartbrief.ai/concept/w3c_prov_o"

    store.add_triplet(
        Triplet(
            subject=c_oxi,
            predicate="https://smartbrief.ai/ontology/interactsWith",
            object=c_kg,
        )
    )
    store.add_triplet(
        Triplet(
            subject=c_kg,
            predicate="https://smartbrief.ai/ontology/enables",
            object=c_prov,
        )
    )

    # 3. Test concept extraction
    matched = _extract_query_concepts("Tell me about Oxigraph and SPARQL", store)
    assert len(matched) >= 1
    assert any(m["name"] == "Oxigraph" for m in matched)

    # 4. Test 1-hop and 2-hop traversal
    t0 = time.perf_counter()
    triples_1hop = _traverse_subgraph([c_oxi], store, hops=1, limit=10)
    t1 = time.perf_counter()
    assert (t1 - t0) * 1000 < 10.0  # < 10ms
    assert len(triples_1hop) == 1
    assert triples_1hop[0]["subject"] == c_oxi
    assert triples_1hop[0]["object"] == c_kg

    t2 = time.perf_counter()
    triples_2hop = _traverse_subgraph([c_oxi], store, hops=2, limit=10)
    t3 = time.perf_counter()
    assert (t3 - t2) * 1000 < 10.0  # < 10ms
    assert len(triples_2hop) == 2
    subjects = {t["subject"] for t in triples_2hop}
    assert c_oxi in subjects
    assert c_kg in subjects

