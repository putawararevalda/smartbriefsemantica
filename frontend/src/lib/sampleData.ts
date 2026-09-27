import { ProcessResponse } from '@/types';

export interface CuratedSample {
  id: string;
  domain: string;
  title: string;
  badge: string;
  description: string;
  content: string;
  mockResponse: ProcessResponse;
}

export const CURATED_SAMPLES: CuratedSample[] = [
  {
    id: 'neuro-symbolic-ai',
    domain: 'Neuro-Symbolic AI',
    title: 'Neuro-Symbolic AI & Oxigraph Triples',
    badge: 'AI & Semantics',
    description: 'Explore hybrid architectures combining deep learning with deterministic Oxigraph RDF triplestores and W3C PROV-O provenance.',
    content: `The evolution of artificial intelligence is entering a new paradigm powered by semantic knowledge graphs and neuro-symbolic reasoning. While large language models excel at natural language understanding and text generation, they often suffer from hallucinations and lack transparent decision lineages.

To bridge this critical gap, hybrid architectures combine deep learning representations with deterministic triplestores such as Oxigraph. By extracting entities and semantic relationships into an RDF knowledge graph, intelligent agents can verify facts, trace claims back to primary sources, and generate explainable Q&A flashcards.

Crucially, modern AI governance requires complete provenance tracking. Through dedicated provenance managers like Semantica, every inference step, concept extraction, and synthesized insight is permanently anchored with an audit trail linking directly to specific knowledge graph nodes and original text excerpts.`,
    mockResponse: {
      summary: 'SmartBrief Synthesis (Neuro-Symbolic AI): Hybrid architectures bridge neural networks and deterministic triplestores (Oxigraph) to eliminate hallucination risks. Every extracted fact and generated flashcard is permanently bound to an immutable W3C PROV-O audit trail.',
      graph_nodes: [
        {
          id: 'urn:semantica:concept:neuro_symbolic',
          label: 'Neuro-Symbolic Architecture',
          type: 'CoreConcept',
          description: 'Hybrid paradigm uniting connectionist LLMs with symbolic knowledge graphs.',
          relations: ['integrates:urn:semantica:concept:oxigraph', 'enforces:urn:semantica:concept:provenance']
        },
        {
          id: 'urn:semantica:concept:oxigraph',
          label: 'Oxigraph RDF Triplestore',
          type: 'StorageEngine',
          description: 'High-performance embedded SPARQL and RDF graph database ensuring deterministic ground truth.',
          relations: ['serves:urn:semantica:concept:neuro_symbolic']
        },
        {
          id: 'urn:semantica:concept:provenance',
          label: 'W3C PROV-O Decision Lineage',
          type: 'AuditEntity',
          description: 'Cryptographic lineage tracking derivation paths from source paragraphs to synthesized cards.',
          relations: ['verifies:urn:semantica:concept:neuro_symbolic']
        }
      ],
      graph: {
        nodes: [
          { id: 'urn:semantica:concept:neuro_symbolic', label: 'Neuro-Symbolic Architecture', type: 'CoreConcept', description: 'Hybrid paradigm uniting connectionist LLMs with symbolic knowledge graphs.' },
          { id: 'urn:semantica:concept:oxigraph', label: 'Oxigraph RDF Triplestore', type: 'StorageEngine', description: 'High-performance embedded SPARQL and RDF graph database ensuring deterministic ground truth.' },
          { id: 'urn:semantica:concept:provenance', label: 'W3C PROV-O Decision Lineage', type: 'AuditEntity', description: 'Cryptographic lineage tracking derivation paths from source paragraphs to synthesized cards.' }
        ],
        edges: [
          { source: 'urn:semantica:concept:neuro_symbolic', target: 'urn:semantica:concept:oxigraph', relation: 'integrates' },
          { source: 'urn:semantica:concept:neuro_symbolic', target: 'urn:semantica:concept:provenance', relation: 'enforces' },
          { source: 'urn:semantica:concept:oxigraph', target: 'urn:semantica:concept:neuro_symbolic', relation: 'serves' },
          { source: 'urn:semantica:concept:provenance', target: 'urn:semantica:concept:neuro_symbolic', relation: 'verifies' }
        ],
        triplets: [
          { subject: 'https://smartbrief.ai/concept/neuro-symbolic-architecture', predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', object: 'https://smartbrief.ai/ontology/core-concept', confidence: 1.0 },
          { subject: 'https://smartbrief.ai/concept/neuro-symbolic-architecture', predicate: 'https://smartbrief.ai/ontology/integrates', object: 'https://smartbrief.ai/concept/oxigraph-rdf-triplestore', confidence: 0.98 },
          { subject: 'https://smartbrief.ai/concept/neuro-symbolic-architecture', predicate: 'https://smartbrief.ai/ontology/enforces', object: 'https://smartbrief.ai/concept/w3c-prov-o-decision-lineage', confidence: 0.98 },
          { subject: 'https://smartbrief.ai/concept/oxigraph-rdf-triplestore', predicate: 'https://smartbrief.ai/ontology/serves', object: 'https://smartbrief.ai/concept/neuro-symbolic-architecture', confidence: 0.96 }
        ],
        triplet_count: 4
      },
      flashcards: [
        {
          id: 1,
          question: 'What fundamental limitation of large language models does neuro-symbolic AI resolve?',
          answer: 'It resolves hallucinations and the absence of transparent decision lineages by anchoring generative outputs to deterministic RDF knowledge graph assertions.',
          category: 'Architecture',
          provenance: {
            node_id: 'urn:semantica:concept:neuro_symbolic',
            graph_node: 'Neuro-Symbolic Architecture',
            concept: 'CoreConcept',
            source_excerpt: 'While large language models excel at natural language understanding and text generation, they often suffer from hallucinations and lack transparent decision lineages.',
            confidence: 0.98,
            audit_trail: [
              '1. Parsed text through tokenizer and entity recognition pipeline',
              '2. Bound extracted triple to embedded Oxigraph store (urn:semantica:concept:neuro_symbolic)',
              '3. Semantica Provenance Manager verified semantic consistency'
            ],
            derivation_rule: 'Oxigraph.Triples.InferenceRule#NeuroSymbolicBridge',
            timestamp: '2026-09-20T12:00:00Z'
          }
        },
        {
          id: 2,
          question: 'What is the role of Oxigraph within the Semantica knowledge pipeline?',
          answer: 'Oxigraph serves as an embedded, deterministic RDF triplestore that indexes extracted entities, relationships, and facts for verifiable querying and fact-checking.',
          category: 'Storage & Querying',
          provenance: {
            node_id: 'urn:semantica:concept:oxigraph',
            graph_node: 'Oxigraph RDF Triplestore',
            concept: 'StorageEngine',
            source_excerpt: 'hybrid architectures combine deep learning representations with deterministic triplestores such as Oxigraph.',
            confidence: 0.96,
            audit_trail: [
              '1. Ingested raw document stream and identified entity boundaries',
              '2. Asserted subject-predicate-object triples into Oxigraph',
              '3. Validated graph connectivity across semantic nodes'
            ],
            derivation_rule: 'Semantica.Triples#OxigraphAssert',
            timestamp: '2026-09-20T12:00:00Z'
          }
        },
        {
          id: 3,
          question: 'How is complete provenance guaranteed for generated Q&A flashcards?',
          answer: 'Through Semantica and W3C PROV-O compliance, where every inference step is recorded with cryptographic audit hashes and linked directly to exact source paragraph excerpts.',
          category: 'Governance & Provenance',
          provenance: {
            node_id: 'urn:semantica:concept:provenance',
            graph_node: 'W3C PROV-O Decision Lineage',
            concept: 'AuditEntity',
            source_excerpt: 'Through dedicated provenance managers like Semantica, every inference step, concept extraction, and synthesized insight is permanently anchored with an audit trail linking directly to specific knowledge graph nodes and original text excerpts.',
            confidence: 0.99,
            audit_trail: [
              '1. Created W3C PROV-O activity record for flashcard synthesis',
              '2. Attached cryptographic SHA256 entity derivation signature',
              '3. Anchored audit record into immutable lineage ledger'
            ],
            derivation_rule: 'Semantica.Audit.ProvenanceManager#PROVOSeal',
            timestamp: '2026-09-20T12:00:00Z'
          }
        }
      ],
      provenance_summary: 'Verified with Semantica Oxigraph & W3C PROV-O Lineage Manager (Offline Mock).'
    }
  },
  {
    id: 'quantum-computing',
    domain: 'Quantum Computing',
    title: 'Fault-Tolerant Quantum Computing & Decoherence',
    badge: 'Quantum Physics',
    description: 'An overview of superconducting qubits, quantum superposition, entanglement, and surface-code error correction against decoherence.',
    content: `Quantum computing harnesses the fundamental principles of quantum mechanics, specifically superposition and entanglement, to solve complex computational problems intractable for classical computers. In quantum systems, information is encoded in qubits rather than classical binary bits. Superposition allows qubits to exist in probabilistic combinations of states, while entanglement creates instantaneous quantum correlations between geographically separated particles.

Recent breakthroughs in superconducting transmon circuits and trapped-ion systems have demonstrated quantum supremacy in targeted sampling benchmarks. However, achieving fault-tolerant quantum computation requires robust quantum error correction, such as surface codes with topological protection, to overcome environmental decoherence and gate noise in noisy intermediate-scale quantum devices.`,
    mockResponse: {
      summary: 'SmartBrief Synthesis (Quantum Computing): Quantum systems leverage superposition and entanglement in qubits to transcend classical algorithmic limits. Commercial scalability hinges on topological surface codes and fault-tolerant error correction to eliminate environmental decoherence.',
      graph_nodes: [
        {
          id: 'urn:semantica:concept:quantum_superposition',
          label: 'Superposition & Entanglement',
          type: 'QuantumPrinciple',
          description: 'Mechanisms enabling exponential state spaces and non-local correlations across qubits.',
          relations: ['enables:urn:semantica:concept:quantum_supremacy']
        },
        {
          id: 'urn:semantica:concept:surface_codes',
          label: 'Topological Surface Codes',
          type: 'ErrorCorrection',
          description: '2D lattice error-correction schemes preserving logical qubits against environmental noise.',
          relations: ['protects:urn:semantica:concept:superconducting_qubits']
        },
        {
          id: 'urn:semantica:concept:superconducting_qubits',
          label: 'Superconducting Transmon Qubits',
          type: 'HardwareArchitecture',
          description: 'Josephson junction-based cryogenic circuits demonstrating high-fidelity quantum gates.',
          relations: ['implements:urn:semantica:concept:quantum_superposition']
        }
      ],
      graph: {
        nodes: [
          { id: 'urn:semantica:concept:quantum_superposition', label: 'Superposition & Entanglement', type: 'QuantumPrinciple', description: 'Mechanisms enabling exponential state spaces and non-local correlations across qubits.' },
          { id: 'urn:semantica:concept:surface_codes', label: 'Topological Surface Codes', type: 'ErrorCorrection', description: '2D lattice error-correction schemes preserving logical qubits against environmental noise.' },
          { id: 'urn:semantica:concept:superconducting_qubits', label: 'Superconducting Transmon Qubits', type: 'HardwareArchitecture', description: 'Josephson junction-based cryogenic circuits demonstrating high-fidelity quantum gates.' }
        ],
        edges: [
          { source: 'urn:semantica:concept:quantum_superposition', target: 'urn:semantica:concept:superconducting_qubits', relation: 'implemented_by' },
          { source: 'urn:semantica:concept:surface_codes', target: 'urn:semantica:concept:superconducting_qubits', relation: 'protects' }
        ],
        triplets: [
          { subject: 'https://smartbrief.ai/concept/superposition-and-entanglement', predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', object: 'https://smartbrief.ai/ontology/quantum-principle', confidence: 1.0 },
          { subject: 'https://smartbrief.ai/concept/topological-surface-codes', predicate: 'https://smartbrief.ai/ontology/protects', object: 'https://smartbrief.ai/concept/superconducting-transmon-qubits', confidence: 0.97 },
          { subject: 'https://smartbrief.ai/concept/superconducting-transmon-qubits', predicate: 'https://smartbrief.ai/ontology/implements', object: 'https://smartbrief.ai/concept/superposition-and-entanglement', confidence: 0.95 }
        ],
        triplet_count: 3
      },
      flashcards: [
        {
          id: 1,
          question: 'How do superposition and entanglement differ from classical binary computation?',
          answer: 'While classical bits are strictly 0 or 1, superposition enables qubits to exist in probabilistic linear combinations, and entanglement establishes correlated quantum states across physical qubits.',
          category: 'Quantum Mechanics',
          provenance: {
            node_id: 'urn:semantica:concept:quantum_superposition',
            graph_node: 'Superposition & Entanglement',
            concept: 'QuantumPrinciple',
            source_excerpt: 'Superposition allows qubits to exist in probabilistic combinations of states, while entanglement creates instantaneous quantum correlations between geographically separated particles.',
            confidence: 0.97,
            audit_trail: [
              '1. Tokenized quantum mechanics domain terminology',
              '2. Mapped physical principles to Oxigraph ontology nodes',
              '3. Validated assertion against quantum computing taxonomy'
            ],
            derivation_rule: 'Quantum.Physics#SuperpositionPrinciple',
            timestamp: '2026-09-20T12:00:00Z'
          }
        },
        {
          id: 2,
          question: 'What is the primary obstacle to achieving fault-tolerant quantum computing in NISQ devices?',
          answer: 'Environmental decoherence and quantum gate noise, which corrupt stored quantum information and necessitate surface code error correction.',
          category: 'Hardware Engineering',
          provenance: {
            node_id: 'urn:semantica:concept:surface_codes',
            graph_node: 'Topological Surface Codes',
            concept: 'ErrorCorrection',
            source_excerpt: 'However, achieving fault-tolerant quantum computation requires robust quantum error correction, such as surface codes with topological protection, to overcome environmental decoherence and gate noise in noisy intermediate-scale quantum devices.',
            confidence: 0.95,
            audit_trail: [
              '1. Extracted noise and decoherence relation triples',
              '2. Identified surface code mitigation mechanism',
              '3. Generated audit trail hash for error correction card'
            ],
            derivation_rule: 'Semantica.Extractor#ErrorCorrectionLink',
            timestamp: '2026-09-20T12:00:00Z'
          }
        },
        {
          id: 3,
          question: 'Why are superconducting transmon circuits widely used in modern quantum benchmarks?',
          answer: 'They offer controllable cryogenic microchip integration and have demonstrated practical quantum supremacy in targeted sampling benchmarks.',
          category: 'Hardware Platforms',
          provenance: {
            node_id: 'urn:semantica:concept:superconducting_qubits',
            graph_node: 'Superconducting Transmon Qubits',
            concept: 'HardwareArchitecture',
            source_excerpt: 'Recent breakthroughs in superconducting transmon circuits and trapped-ion systems have demonstrated quantum supremacy in targeted sampling benchmarks.',
            confidence: 0.93,
            audit_trail: [
              '1. Linked superconducting transmon circuits to quantum supremacy benchmarks',
              '2. Serialized graph triple into local Oxigraph knowledge store',
              '3. Confirmed provenance derivation timestamp'
            ],
            derivation_rule: 'Semantica.Graph#HardwareBenchmarkRelation',
            timestamp: '2026-09-20T12:00:00Z'
          }
        }
      ],
      provenance_summary: 'Verified with Semantica Oxigraph & W3C PROV-O Lineage Manager (Offline Mock).'
    }
  },
  {
    id: 'environmental-economics',
    domain: 'Environmental Economics',
    title: 'Circular Economics & Carbon Pricing Frameworks',
    badge: 'Macroeconomics & Ecology',
    description: 'An analysis of market externalities, border carbon adjustments, cap-and-trade allowances, and circular regenerative supply chains.',
    content: `Environmental economics examines the intricate interplay between global economic activity, market incentives, and planetary ecological boundaries. Traditional neoclassical models often treat environmental degradation as an externalized market failure, failing to account for the finite carrying capacity of natural ecosystems and biodiversity depletion.

Modern carbon pricing mechanisms, including cap-and-trade allowances and border carbon adjustments, aim to internalize greenhouse gas emissions costs across industrial supply chains. Furthermore, circular economy frameworks transition modern production models away from linear extract-produce-dispose cycles toward closed-loop material recovery, renewable energy deployment, and natural capital accounting to achieve sustainable macroeconomic resilience.`,
    mockResponse: {
      summary: 'SmartBrief Synthesis (Environmental Economics): Addressing global climate challenges requires internalizing ecological externalities through cap-and-trade mechanisms and carbon border adjustments, alongside transitioning linear industrial supply chains into regenerative circular systems.',
      graph_nodes: [
        {
          id: 'urn:semantica:concept:carbon_pricing',
          label: 'Carbon Pricing & Market Internalization',
          type: 'PolicyMechanism',
          description: 'Economic instruments placing monetary costs on carbon emissions to realign industrial incentives.',
          relations: ['remedies:urn:semantica:concept:market_externalities']
        },
        {
          id: 'urn:semantica:concept:circular_economy',
          label: 'Circular Economy Framework',
          type: 'MacroeconomicModel',
          description: 'Closed-loop industrial paradigm minimizing raw extraction through material reuse and regenerative flows.',
          relations: ['complements:urn:semantica:concept:carbon_pricing']
        },
        {
          id: 'urn:semantica:concept:market_externalities',
          label: 'Environmental Market Externalities',
          type: 'EconomicFailure',
          description: 'Disparity between private production costs and societal ecological damage.',
          relations: ['causes:urn:semantica:concept:biodiversity_loss']
        }
      ],
      graph: {
        nodes: [
          { id: 'urn:semantica:concept:carbon_pricing', label: 'Carbon Pricing & Market Internalization', type: 'PolicyMechanism', description: 'Economic instruments placing monetary costs on carbon emissions to realign industrial incentives.' },
          { id: 'urn:semantica:concept:circular_economy', label: 'Circular Economy Framework', type: 'MacroeconomicModel', description: 'Closed-loop industrial paradigm minimizing raw extraction through material reuse and regenerative flows.' },
          { id: 'urn:semantica:concept:market_externalities', label: 'Environmental Market Externalities', type: 'EconomicFailure', description: 'Disparity between private production costs and societal ecological damage.' }
        ],
        edges: [
          { source: 'urn:semantica:concept:carbon_pricing', target: 'urn:semantica:concept:market_externalities', relation: 'remedies' },
          { source: 'urn:semantica:concept:circular_economy', target: 'urn:semantica:concept:carbon_pricing', relation: 'complements' }
        ],
        triplets: [
          { subject: 'https://smartbrief.ai/concept/carbon-pricing-and-market-internalization', predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', object: 'https://smartbrief.ai/ontology/policy-mechanism', confidence: 1.0 },
          { subject: 'https://smartbrief.ai/concept/carbon-pricing-and-market-internalization', predicate: 'https://smartbrief.ai/ontology/remedies', object: 'https://smartbrief.ai/concept/environmental-market-externalities', confidence: 0.98 },
          { subject: 'https://smartbrief.ai/concept/circular-economy-framework', predicate: 'https://smartbrief.ai/ontology/complements', object: 'https://smartbrief.ai/concept/carbon-pricing-and-market-internalization', confidence: 0.96 }
        ],
        triplet_count: 3
      },
      flashcards: [
        {
          id: 1,
          question: 'How do neoclassical economic models typically mischaracterize environmental degradation?',
          answer: 'They often treat degradation as an externalized market failure rather than accounting for planetary ecological boundaries and finite natural carrying capacities.',
          category: 'Economic Theory',
          provenance: {
            node_id: 'urn:semantica:concept:market_externalities',
            graph_node: 'Environmental Market Externalities',
            concept: 'EconomicFailure',
            source_excerpt: 'Traditional neoclassical models often treat environmental degradation as an externalized market failure, failing to account for the finite carrying capacity of natural ecosystems and biodiversity depletion.',
            confidence: 0.96,
            audit_trail: [
              '1. Parsed neoclassical theory passage and identified market failure premise',
              '2. Constructed Oxigraph assertion for externalized cost concepts',
              '3. Verified semantic alignment with environmental economics ontology'
            ],
            derivation_rule: 'Econ.Ontology#MarketFailureMapping',
            timestamp: '2026-09-20T12:00:00Z'
          }
        },
        {
          id: 2,
          question: 'What is the primary function of carbon pricing mechanisms like cap-and-trade and border adjustments?',
          answer: 'To internalize the ecological cost of greenhouse gas emissions directly into supply chains and cross-border trade economics.',
          category: 'Policy & Markets',
          provenance: {
            node_id: 'urn:semantica:concept:carbon_pricing',
            graph_node: 'Carbon Pricing & Market Internalization',
            concept: 'PolicyMechanism',
            source_excerpt: 'Modern carbon pricing mechanisms, including cap-and-trade allowances and border carbon adjustments, aim to internalize greenhouse gas emissions costs across industrial supply chains.',
            confidence: 0.98,
            audit_trail: [
              '1. Isolated policy instruments: cap-and-trade, border adjustments',
              '2. Bound concept to industrial supply chain decarbonization node',
              '3. Applied PROV-O cryptographic seal'
            ],
            derivation_rule: 'Semantica.Audit#CarbonPricingRule',
            timestamp: '2026-09-20T12:00:00Z'
          }
        },
        {
          id: 3,
          question: 'How does a circular economy diverge from traditional industrial manufacturing?',
          answer: 'It replaces linear "extract-produce-dispose" workflows with closed-loop material recovery, renewable energy integration, and natural capital accounting.',
          category: 'Industrial Ecology',
          provenance: {
            node_id: 'urn:semantica:concept:circular_economy',
            graph_node: 'Circular Economy Framework',
            concept: 'MacroeconomicModel',
            source_excerpt: 'circular economy frameworks transition modern production models away from linear extract-produce-dispose cycles toward closed-loop material recovery, renewable energy deployment, and natural capital accounting',
            confidence: 0.94,
            audit_trail: [
              '1. Identified circular versus linear economy contrast',
              '2. Indexed closed-loop recovery nodes into Oxigraph triplestore',
              '3. Generated audit lineage verification'
            ],
            derivation_rule: 'Semantica.Triples#CircularFlowDerivation',
            timestamp: '2026-09-20T12:00:00Z'
          }
        }
      ],
      provenance_summary: 'Verified with Semantica Oxigraph & W3C PROV-O Lineage Manager (Offline Mock).'
    }
  }
];

export function getOfflineSampleResponse(domainOrId?: string): ProcessResponse {
  if (domainOrId) {
    const match = CURATED_SAMPLES.find(
      s => s.id === domainOrId || s.domain.toLowerCase() === domainOrId.toLowerCase()
    );
    if (match) {
      return match.mockResponse;
    }
  }
  return CURATED_SAMPLES[0].mockResponse;
}
