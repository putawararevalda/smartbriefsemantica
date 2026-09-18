# SmartBrief

SmartBrief is an AI-powered article summarizer and knowledge synthesis engine. It allows users to paste long-form text into a web interface to generate an executive summary, extract a knowledge graph of concepts into an embedded Oxigraph triplestore, and produce interactive Q&A flashcards with verifiable decision provenance powered by Semantica.

## Architecture

* **Frontend**: Next.js 14 (TypeScript) + Tailwind CSS running on port `3003`.
* **Backend**: FastAPI (Python) + `semantica` running on port `8003`.
* **Orchestration**: Root `docker-compose.yml` networking frontend and backend services on an internal bridge network.

## Directory Structure

```
.
├── docker-compose.yml       # Root orchestration networking frontend (3003) & backend (8003)
├── README.md
├── frontend/
│   ├── Dockerfile           # Multi-stage production container running on port 3003
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.js       # Standalone build output
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── src/
│       ├── app/
│       │   ├── page.tsx     # Main dashboard with form, summary, graph, & flashcard grid
│       │   ├── layout.tsx
│       │   ├── globals.css
│       │   └── api/process/ # Proxy route handler to FastAPI backend with fallback
│       ├── components/
│       │   ├── Header.tsx
│       │   ├── InputForm.tsx            # Tailwind submission form
│       │   ├── SummaryCard.tsx          # Executive summary
│       │   ├── KnowledgeGraphCard.tsx   # Extracted graph concepts
│       │   ├── FlashcardsGrid.tsx       # Grid of 3 Q&A flashcards
│       │   ├── FlashcardItem.tsx        # Card with revealable answer & "Trace Source"
│       │   └── ProvenanceModal.tsx      # Modal revealing Semantica provenance & Oxigraph node
│       └── types/
│           └── index.ts
└── backend/                 # FastAPI + Semantica backend service (port 8003)
```

## Getting Started

### Using Docker Compose

To build and start both the frontend and backend containers:

```bash
docker compose up --build -d
```

Once running:
- **Frontend**: Navigate to `http://localhost:3003` in your browser.
- **Backend API**: Accessible at `http://localhost:8003` (docs at `http://localhost:8003/docs`).

To stop the containers:

```bash
docker compose down
```

### Running Frontend Locally

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3003`.

## Key Features

1. **Tailwind Article Form**: Clean, responsive interface with character/word counting and a 1-click "Load Sample Article" button for immediate demonstration.
2. **Executive Summary**: Synthesized overview of key article insights.
3. **Knowledge Graph Concepts**: Visual concept tags representing extracted entities and semantic triples captured in Oxigraph.
4. **Interactive Flashcards Grid**: Responsive grid rendering 3 Q&A mastery cards with revealable answers.
5. **Trace Source Provenance**: Clicking the "Trace Source" button reveals full Semantica provenance data, including the linked Oxigraph graph node, source excerpt citation, confidence score, and step-by-step decision audit lineage.
