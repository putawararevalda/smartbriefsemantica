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
    """Verify valid session + query matching existing concept returns 200, answer, matched concepts, and non-empty triples."""
    import time
    # Seed knowledge graph via process endpoint
    sample_text = (
        "SmartBrief uses Oxigraph as an embedded triplestore for Knowledge Graph reasoning. "
        "W3C PROV-O provides auditable decision provenance."
    )
    proc_resp = client.post("/api/process", json={"text": sample_text, "session_id": "test_session_rag_1"})
    assert proc_resp.status_code == 200

    # Query the RAG endpoint
    rag_payload = {
        "session_id": "test_session_rag_1",
        "query": "How does Oxigraph relate to Knowledge Graph and SPARQL?",
        "top_k_triples": 15,
    }

    t0 = time.perf_counter()
    response = client.post("/api/rag/query", json=rag_payload)
    elapsed = time.perf_counter() - t0

    assert response.status_code == 200
    # Performance benchmark: Total backend endpoint response under 1.5s
    assert elapsed < 1.5, f"Endpoint response took {elapsed:.3f}s, expected < 1.5s"

    data = response.json()

    # Query & Answer
    assert data["query"] == rag_payload["query"]
    assert "answer" in data
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
    assert len(ctx["retrieved_triples"]) >= 1, "Expected non-empty triples list for matched concept"
    for rt in ctx["retrieved_triples"]:
        assert "subject" in rt
        assert "predicate" in rt
        assert "object" in rt
        assert "raw_triple" in rt

    assert ctx["traversal_hops"] == 2
    # Benchmark: in-process Oxigraph SPARQL traversal executes under 10ms
    assert ctx["execution_time_ms"] < 10.0, f"Graph traversal took {ctx['execution_time_ms']}ms, expected < 10ms"

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


def test_rag_query_unmatched_concept(client):
    """Verify query with unknown terms returns 200 with fallback answer and empty triples list (no 500 error)."""
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

    # Provenance record is still created
    prov = data["provenance"]
    assert "entity_id" in prov
    assert len(prov["checksum"]) == 64


# Alias for backwards compatibility
test_rag_query_fallback_unmatched_concepts = test_rag_query_unmatched_concept


def test_rag_query_missing_fields(client):
    """Verify validation errors for missing session_id, missing query, or empty query (status 400/422)."""
    # 1. Missing session_id -> 422 Unprocessable Entity
    resp_no_session = client.post("/api/rag/query", json={"query": "Oxigraph reasoning"})
    assert resp_no_session.status_code == 422

    # 2. Missing query field -> 422 Unprocessable Entity
    resp_no_query = client.post("/api/rag/query", json={"session_id": "s1"})
    assert resp_no_query.status_code == 422

    # 3. Empty string query (min_length=1 constraint) -> 422
    resp_empty_str = client.post("/api/rag/query", json={"session_id": "s1", "query": ""})
    assert resp_empty_str.status_code == 422

    # 4. Whitespace-only query string -> 400 Bad Request
    resp_whitespace = client.post("/api/rag/query", json={"session_id": "s1", "query": "   "})
    assert resp_whitespace.status_code == 400
    assert "Query cannot be empty" in resp_whitespace.json().get("detail", "")

    # 5. Invalid top_k_triples (<= 0) -> 422
    resp_invalid_k = client.post(
        "/api/rag/query",
        json={"session_id": "s1", "query": "Oxigraph", "top_k_triples": 0},
    )
    assert resp_invalid_k.status_code == 422


# Alias for backwards compatibility
test_rag_query_validation = test_rag_query_missing_fields


def test_rag_provenance_audit(client):
    """Verify provenance entity created in ProvenanceManager matches W3C PROV-O schema and can be fetched via GET /api/provenance/{entity_id}."""
    rag_payload = {
        "session_id": "test_session_prov_lookup",
        "query": "Explain Oxigraph and SPARQL queries.",
    }
    response = client.post("/api/rag/query", json=rag_payload)
    assert response.status_code == 200
    prov_payload = response.json()["provenance"]
    entity_id = prov_payload["entity_id"]

    # Verify W3C PROV-O schema compliance in response
    assert "entity_id" in prov_payload
    assert "activity" in prov_payload
    assert "agent" in prov_payload
    assert "timestamp" in prov_payload
    assert "checksum" in prov_payload
    assert "w3c_prov" in prov_payload
    assert "wasDerivedFrom" in prov_payload["w3c_prov"]
    assert "wasGeneratedBy" in prov_payload["w3c_prov"]
    assert "wasAttributedTo" in prov_payload["w3c_prov"]
    assert "lineage_chain" in prov_payload

    # Query provenance endpoint directly
    prov_resp = client.get(f"/api/provenance/{entity_id}")
    assert prov_resp.status_code == 200
    prov_data = prov_resp.json()
    assert prov_data["entity_id"] == entity_id
    assert "lineage_chain" in prov_data
    assert isinstance(prov_data["lineage_chain"], list)


# Alias for backwards compatibility
test_rag_query_provenance_retrieval = test_rag_provenance_audit


def test_rag_performance_benchmarks(client):
    """Verify Oxigraph in-process SPARQL query executes in <10ms and total backend endpoint response is <1.5s."""
    import time
    # Seed data
    client.post(
        "/api/process",
        json={"text": "Oxigraph SPARQL query benchmark and W3C PROV-O provenance verification."},
    )

    rag_payload = {
        "session_id": "bench_session",
        "query": "What is Oxigraph?",
        "top_k_triples": 15,
    }

    # Measure total endpoint response time
    t0 = time.perf_counter()
    resp = client.post("/api/rag/query", json=rag_payload)
    endpoint_latency = time.perf_counter() - t0

    assert resp.status_code == 200
    data = resp.json()

    # Benchmark Criteria 1: Total backend endpoint response under 1.5s
    assert endpoint_latency < 1.5, f"Endpoint latency {endpoint_latency:.4f}s exceeded 1.5s"

    # Benchmark Criteria 2: Oxigraph in-process SPARQL traversal executed under 10ms
    sparql_latency_ms = data["graph_context"]["execution_time_ms"]
    assert sparql_latency_ms < 10.0, f"Oxigraph SPARQL traversal {sparql_latency_ms:.2f}ms exceeded 10ms"


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


def test_source_chunk_and_provenance_persistence(client):
    """Verify source text chunking, SQLite persistence in session_chunks, and chunk_id in provenance metadata."""
    import sqlite3
    from main import PROV_DB_PATH

    session_id = "test_chunk_persistence_sess"
    article_text = (
        "Paragraph 1: Formula 1 aerodynamic engineering focuses on optimizing airflow over aerodynamic wings and bodywork. "
        "Engineers utilize computational fluid dynamics and wind tunnel testing to maximize cornering performance.\n\n"
        "Paragraph 2: Underbody Venturi tunnels produce massive ground effect downforce, sucking the car into the tarmac. "
        "This allows high cornering speeds through high-speed turns while minimizing turbulent wake for following competitors.\n\n"
        "Paragraph 3: W3C PROV-O provenance structures every decision, concept, and relationship asserted in the knowledge graph. "
        "Auditors can verify the complete derivation ancestry of every derived finding."
    )

    proc_resp = client.post("/api/process", json={"text": article_text, "session_id": session_id})
    assert proc_resp.status_code == 200
    data = proc_resp.json()

    # 1. Verify SQLite session_chunks table rows
    with sqlite3.connect(PROV_DB_PATH) as conn:
        cursor = conn.execute(
            "SELECT session_id, chunk_id, chunk_index, content FROM session_chunks WHERE session_id = ? ORDER BY chunk_index ASC",
            (session_id,),
        )
        rows = cursor.fetchall()
        assert len(rows) >= 2, f"Expected at least 2 chunks, got {len(rows)}"
        for idx, row in enumerate(rows):
            assert row[0] == session_id
            assert row[1] == f"chunk_{session_id}_{idx}"
            assert row[2] == idx
            assert len(row[3]) > 10

    # 2. Verify provenance metadata includes chunk_id for concepts
    concepts = data["concepts"]
    assert len(concepts) >= 1
    with sqlite3.connect(PROV_DB_PATH) as conn:
        for c in concepts:
            c_id = c["id"]
            cursor = conn.execute("SELECT metadata FROM provenance WHERE entity_id = ?", (c_id,))
            row = cursor.fetchone()
            assert row is not None, f"Provenance entity {c_id} not found"
            import json
            meta = json.loads(row[0]) if isinstance(row[0], str) else row[0]
            assert "chunk_id" in meta, f"Metadata for {c_id} missing chunk_id"
            assert meta["chunk_id"].startswith(f"chunk_{session_id}_")


def test_cross_session_isolation(client):
    """Verify session isolation: triples and concepts from session A do not leak into queries for session B."""
    session_a = "session_iso_formula1"
    session_b = "session_iso_biology"

    # Process Session A (Formula 1)
    text_a = (
        "Formula 1 aerodynamic wings and underbody tunnels produce tremendous downforce. "
        "Aerodynamics allows racing cars to achieve extreme cornering grip."
    )
    resp_a = client.post("/api/process", json={"text": text_a, "session_id": session_a})
    assert resp_a.status_code == 200

    # Process Session B (Plant Biology)
    text_b = (
        "Photosynthesis allows green plants to convert solar light energy into chemical energy. "
        "Chlorophyll molecules absorb photons within plant chloroplasts."
    )
    resp_b = client.post("/api/process", json={"text": text_b, "session_id": session_b})
    assert resp_b.status_code == 200

    # 1. Query Session A for aerodynamics
    rag_a = client.post(
        "/api/rag/query",
        json={"session_id": session_a, "query": "How does aerodynamics work in cornering?"},
    )
    assert rag_a.status_code == 200
    data_a = rag_a.json()
    assert len(data_a["graph_context"]["matched_concepts"]) >= 1
    concept_names_a = [c["name"].lower() for c in data_a["graph_context"]["matched_concepts"]]
    assert not any("photosynthesis" in name or "chlorophyll" in name for name in concept_names_a)

    # 2. Query Session B for aerodynamics (Should NOT leak concepts or triples from Session A)
    rag_b_leak_check = client.post(
        "/api/rag/query",
        json={"session_id": session_b, "query": "How does aerodynamics work in cornering?"},
    )
    assert rag_b_leak_check.status_code == 200
    data_b_leak = rag_b_leak_check.json()
    assert len(data_b_leak["graph_context"]["matched_concepts"]) == 0
    assert len(data_b_leak["graph_context"]["retrieved_triples"]) == 0
    assert "No relevant knowledge graph concepts" in data_b_leak["answer"]

    # 3. Query Session B for photosynthesis (Should only return Session B concepts and triples)
    rag_b = client.post(
        "/api/rag/query",
        json={"session_id": session_b, "query": "What is photosynthesis and chlorophyll?"},
    )
    assert rag_b.status_code == 200
    data_b = rag_b.json()
    assert len(data_b["graph_context"]["matched_concepts"]) >= 1
    for rt in data_b["graph_context"]["retrieved_triples"]:
        assert session_a not in rt["raw_triple"]
        assert "aerodynamics" not in rt["raw_triple"].lower()


def test_f1_aerodynamics_query_and_chunk_grounding(client):
    """Verify acceptance criteria query on F1 cornering speed returns fluent answer referencing downforce, wings, and tunnels."""
    session_f1 = "session_f1_acceptance"
    f1_article = (
        "Formula 1 racing cars achieve high speed when attacking the corners of the circuit primarily due to aerodynamic downforce. "
        "This downforce is generated by intricate front and rear wings combined with sculpted underbody Venturi tunnels. "
        "The ground effect pulls the vehicle down onto the asphalt, providing immense lateral grip without creating unsustainable aerodynamic drag."
    )
    proc_resp = client.post("/api/process", json={"text": f1_article, "session_id": session_f1})
    assert proc_resp.status_code == 200

    query = "what attribute to f1 cars high speed in attacking the corners of the circuit?"
    rag_resp = client.post(
        "/api/rag/query",
        json={"session_id": session_f1, "query": query, "top_k_triples": 15},
    )
    assert rag_resp.status_code == 200
    data = rag_resp.json()

    # 1. Fluent natural language answer referencing aerodynamic downforce, wings, and tunnels
    answer = data["answer"].lower()
    assert "downforce" in answer or "aerodynamic" in answer
    assert "wings" in answer
    assert "tunnels" in answer

    # 2. Graph Context & Evidence Drawer compliance
    ctx = data["graph_context"]
    assert len(ctx["matched_concepts"]) >= 1
    assert any("aerodynamics" in c["name"].lower() or "circuit" in c["name"].lower() for c in ctx["matched_concepts"])
    assert len(ctx["retrieved_triples"]) >= 1
    assert ctx["traversal_hops"] >= 1
    assert ctx["execution_time_ms"] < 10.0

    # 3. W3C PROV-O audit trail
    prov = data["provenance"]
    assert prov["entity_id"].startswith(f"rag_query_{session_f1}_")
    assert len(prov["checksum"]) == 64
    assert prov["activity"] == "rag_synthesis"
    assert f"urn:smartbrief:doc:{session_f1}" in prov["w3c_prov"]["wasDerivedFrom"]


def test_llm_hybrid_answer_synthesis(client, monkeypatch):
    """Verify LLM hybrid answer synthesis with direct HTTPS requests.post mock."""
    from unittest.mock import MagicMock

    session_llm = "session_llm_synthesis"
    proc_text = (
        "Oxigraph provides an in-process RDF triplestore for Knowledge Graph reasoning. "
        "W3C PROV-O guarantees tamper-evident provenance tracking."
    )
    proc_resp = client.post("/api/process", json={"text": proc_text, "session_id": session_llm})
    assert proc_resp.status_code == 200

    expected_content = (
        "Oxigraph operates as an embedded in-process graph engine that executes SPARQL queries directly within memory. "
        "It integrates with the Knowledge Graph to enable deterministic reasoning with minimal latency."
    )

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [
            {
                "message": {
                    "content": expected_content,
                }
            }
        ]
    }
    mock_post = MagicMock(return_value=mock_resp)

    monkeypatch.setattr("requests.post", mock_post)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-mock-llm-key")

    rag_payload = {
        "session_id": session_llm,
        "query": "How does Oxigraph provide fast Knowledge Graph querying?",
        "top_k_triples": 10,
    }
    resp = client.post("/api/rag/query", json=rag_payload)
    assert resp.status_code == 200
    data = resp.json()

    assert mock_post.called
    call_args, call_kwargs = mock_post.call_args
    assert call_args[0] == "https://api.openai.com/v1/chat/completions"
    assert call_kwargs["headers"]["Authorization"] == "Bearer sk-mock-llm-key"
    assert call_kwargs["headers"]["Content-Type"] == "application/json"

    payload = call_kwargs["json"]
    assert payload["model"] == "gpt-4o-mini"
    assert payload["temperature"] == 0.2
    assert payload["max_tokens"] == 300

    # Verify synthesized answer matches mock LLM completion
    assert data["answer"] == expected_content

    # Verify system prompts did not include infrastructure triples like extractedFrom or Document
    messages = payload["messages"]
    user_prompt = next(m["content"] for m in messages if m["role"] == "user")
    assert "extractedFrom" not in user_prompt
    assert "https://smartbrief.ai/ontology/Document" not in user_prompt


def test_f1_teams_constructors_synthesis_direct_https(client, monkeypatch):
    """Verify query 'what is the 1 or 2 word that can be used to refer to Formula One teams?' returns 'constructors'."""
    from unittest.mock import MagicMock

    session_id = "session_f1_constructors_test"
    f1_article = (
        "The Formula One World Championship consists of a series of races, known as Grands Prix, "
        "held worldwide on purpose-built circuits and public roads. The results of each race are "
        "evaluated using a points system to determine two annual World Championships: one for drivers, "
        "and one for the constructors—now synonymous with teams. While most teams are based in the United Kingdom, "
        "they compete globally under FIA sporting regulations."
    )
    proc_resp = client.post("/api/process", json={"text": f1_article, "session_id": session_id})
    assert proc_resp.status_code == 200

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [
            {
                "message": {
                    "content": "In Formula One, teams are commonly and officially referred to as constructors.",
                }
            }
        ]
    }
    mock_post = MagicMock(return_value=mock_resp)
    monkeypatch.setattr("requests.post", mock_post)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-mock-f1-key")

    query = "what is the 1 or 2 word that can be used to refer to Formula One teams?"
    rag_resp = client.post(
        "/api/rag/query",
        json={"session_id": session_id, "query": query, "top_k_triples": 10},
    )
    assert rag_resp.status_code == 200
    data = rag_resp.json()
    answer = data["answer"].lower()
    assert "constructor" in answer or "constructors" in answer
    assert mock_post.called


def test_f1_teams_constructors_synthesis_heuristic_fallback(client, monkeypatch):
    """Verify fallback sentence scoring also successfully prioritizes the definition sentence identifying constructors."""
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    session_id = "session_f1_constructors_fallback"
    f1_article = (
        "The Formula One World Championship consists of a series of races, known as Grands Prix, "
        "held worldwide on purpose-built circuits and public roads. The results of each race are "
        "evaluated using a points system to determine two annual World Championships: one for drivers, "
        "and one for the constructors—now synonymous with teams. While most teams are based in the United Kingdom, "
        "they compete globally under FIA sporting regulations."
    )
    proc_resp = client.post("/api/process", json={"text": f1_article, "session_id": session_id})
    assert proc_resp.status_code == 200

    query = "what is the 1 or 2 word that can be used to refer to Formula One teams?"
    rag_resp = client.post(
        "/api/rag/query",
        json={"session_id": session_id, "query": query, "top_k_triples": 10},
    )
    assert rag_resp.status_code == 200
    data = rag_resp.json()
    answer = data["answer"].lower()
    assert "constructor" in answer or "constructors" in answer


def test_extract_query_concepts_semantic_resolution_direct_https(client, monkeypatch):
    """Verify _extract_query_concepts semantic resolution uses direct HTTPS requests.post without SDK."""
    import json
    from unittest.mock import MagicMock
    import main

    session_id = "session_semantic_concept_res"
    text = (
        "Aerodynamics engineering dictates vehicle stability through cornering. "
        "Downforce allows the racecar to maintain grip."
    )
    proc_resp = client.post("/api/process", json={"text": text, "session_id": session_id})
    assert proc_resp.status_code == 200

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [
            {
                "message": {
                    "content": json.dumps(["Aerodynamics"]),
                }
            }
        ]
    }
    mock_post = MagicMock(return_value=mock_resp)
    monkeypatch.setattr("requests.post", mock_post)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-mock-sem-key")

    matched = main._extract_query_concepts(
        query="attacking the corners with maximum lateral speed",
        store=main.oxigraph_store,
        session_id=session_id,
    )
    assert any("aerodynamics" in c["name"].lower() for c in matched)


def test_predicate_label_formatting():
    """Verify predicate label formatting fixes the 22-rdf-syntax-nstype bug and formats clean labels."""
    from main import _clean_predicate_label

    assert _clean_predicate_label("http://www.w3.org/1999/02/22-rdf-syntax-ns#type") == "is an instance of"
    assert _clean_predicate_label("https://smartbrief.ai/ontology/22-rdf-syntax-nstype") == "is an instance of"
    assert _clean_predicate_label("type") == "is an instance of"
    assert _clean_predicate_label("https://smartbrief.ai/ontology/interactsWith") == "interacts with"
    assert _clean_predicate_label("https://smartbrief.ai/ontology/enables") == "enables"
    assert _clean_predicate_label("https://smartbrief.ai/ontology/relatesTo") == "relates to"
    assert _clean_predicate_label("https://smartbrief.ai/ontology/partOf") == "is part of"


