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
    assert len(data["concepts"]) == 3
    for c in data["concepts"]:
        assert "id" in c
        assert "name" in c
        assert "category" in c
        assert "description" in c

    # AC4: Graph structure
    assert "graph" in data
    assert len(data["graph"]["nodes"]) == 3
    assert len(data["graph"]["edges"]) >= 1
    assert data["graph"]["triplet_count"] > 0

    # AC2 & AC3: 3 interactive Q&A flashcards with provenance
    assert "flashcards" in data
    assert len(data["flashcards"]) == 3

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
