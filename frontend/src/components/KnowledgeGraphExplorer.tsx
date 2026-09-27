'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Network,
  Database,
  Terminal,
  Download,
  Copy,
  Check,
  Search,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Filter,
  Share2,
  Info,
  Play,
  ArrowRight,
  Sparkles,
  Layers,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { KnowledgeGraph, GraphNode, GraphEdge, TripletItem, GraphConcept } from '@/types';

export interface KnowledgeGraphExplorerProps {
  graph?: KnowledgeGraph;
  concepts?: GraphConcept[];
  initialTriplets?: TripletItem[];
}

type ExplorerSubTab = 'visual' | 'triplets' | 'sparql' | 'export';

const PRESET_SPARQL_QUERIES = [
  {
    name: 'All Asserted Triples',
    desc: 'Retrieve all subject-predicate-object triples currently in Oxigraph',
    query: 'SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 50',
  },
  {
    name: 'Extracted Concepts & Types',
    desc: 'List concepts and their rdf:type classifications',
    query: 'SELECT ?concept ?type WHERE { ?concept <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> ?type } LIMIT 25',
  },
  {
    name: 'Semantic Relationships',
    desc: 'Find all inter-concept relationship edges',
    query: 'SELECT ?source ?relation ?target WHERE { ?source ?relation ?target . FILTER(!strstarts(str(?relation), "http://www.w3.org/1999/02/22-rdf-syntax-ns#")) } LIMIT 25',
  },
  {
    name: 'Triples Count',
    desc: 'Count total number of RDF triples asserted in store',
    query: 'SELECT (COUNT(*) AS ?totalTriples) WHERE { ?s ?p ?o }',
  },
];

export default function KnowledgeGraphExplorer({
  graph,
  concepts = [],
  initialTriplets = [],
}: KnowledgeGraphExplorerProps) {
  const [activeSubTab, setActiveSubTab] = useState<ExplorerSubTab>('visual');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [visualSearch, setVisualSearch] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Triplets store state
  const [triplets, setTriplets] = useState<TripletItem[]>(() => {
    if (graph?.triplets && graph.triplets.length > 0) return graph.triplets;
    if (initialTriplets && initialTriplets.length > 0) return initialTriplets;
    return [];
  });
  const [tripletsSearch, setTripletsSearch] = useState<string>('');
  const [isRefreshingTriplets, setIsRefreshingTriplets] = useState<boolean>(false);

  // SPARQL Runner state
  const [sparqlQuery, setSparqlQuery] = useState<string>(
    'SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 50'
  );
  const [sparqlResults, setSparqlResults] = useState<{
    variables: string[];
    bindings: Record<string, any>[];
  } | null>(null);
  const [isExecutingSparql, setIsExecutingSparql] = useState<boolean>(false);
  const [sparqlError, setSparqlError] = useState<string | null>(null);
  const [sparqlViewMode, setSparqlViewMode] = useState<'table' | 'json'>('table');

  // Export Turtle state
  const [turtleContent, setTurtleContent] = useState<string>('');
  const [isLoadingTurtle, setIsLoadingTurtle] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Normalize nodes and edges
  const nodes: GraphNode[] = useMemo(() => {
    if (graph?.nodes && graph.nodes.length > 0) return graph.nodes;
    if (concepts && concepts.length > 0) {
      return concepts.map((c) => ({
        id: c.id,
        label: c.label || c.name || c.id,
        type: c.type || 'Concept',
        description: c.description || '',
      }));
    }
    return [];
  }, [graph?.nodes, concepts]);

  const edges: GraphEdge[] = useMemo(() => {
    if (graph?.edges && graph.edges.length > 0) return graph.edges;
    // Derive from concepts relations if not in graph
    const derived: GraphEdge[] = [];
    concepts.forEach((c) => {
      if (Array.isArray(c.relations)) {
        c.relations.forEach((relStr) => {
          const parts = relStr.split(':');
          const relName = parts[0] || 'relates_to';
          const targetId = parts.slice(1).join(':') || relStr;
          derived.push({
            source: c.id,
            target: targetId,
            relation: relName,
          });
        });
      }
    });
    return derived;
  }, [graph?.edges, concepts]);

  // Sync triplets on prop update
  useEffect(() => {
    if (graph?.triplets && graph.triplets.length > 0) {
      setTriplets(graph.triplets);
    } else if (initialTriplets && initialTriplets.length > 0) {
      setTriplets(initialTriplets);
    }
  }, [graph?.triplets, initialTriplets]);

  // Node types for filter
  const nodeTypes = useMemo(() => {
    const types = new Set<string>();
    nodes.forEach((n) => {
      if (n.type) types.add(n.type);
    });
    return Array.from(types);
  }, [nodes]);

  // Color mapping helper for node categories
  const getNodeColor = (type?: string) => {
    const t = (type || '').toLowerCase();
    if (t.includes('core') || t.includes('concept'))
      return { bg: 'bg-indigo-600', text: 'text-indigo-600', ring: 'ring-indigo-300', fill: '#4f46e5' };
    if (t.includes('storage') || t.includes('engine') || t.includes('database'))
      return { bg: 'bg-emerald-600', text: 'text-emerald-600', ring: 'ring-emerald-300', fill: '#059669' };
    if (t.includes('audit') || t.includes('provenance') || t.includes('lineage'))
      return { bg: 'bg-amber-600', text: 'text-amber-600', ring: 'ring-amber-300', fill: '#d97706' };
    if (t.includes('quantum') || t.includes('physics') || t.includes('hardware'))
      return { bg: 'bg-cyan-600', text: 'text-cyan-600', ring: 'ring-cyan-300', fill: '#0891b2' };
    if (t.includes('policy') || t.includes('economic') || t.includes('market'))
      return { bg: 'bg-purple-600', text: 'text-purple-600', ring: 'ring-purple-300', fill: '#9333ea' };
    return { bg: 'bg-blue-600', text: 'text-blue-600', ring: 'ring-blue-300', fill: '#2563eb' };
  };

  // Visual layout coordinates for nodes
  const nodePositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number; index: number }> = {};
    const count = nodes.length;
    if (count === 0) return positions;

    const centerX = 360;
    const centerY = 240;
    const radius = count <= 3 ? 120 : count <= 6 ? 160 : 190;

    nodes.forEach((node, i) => {
      // distribute evenly along circle
      const angle = (2 * Math.PI * i) / count - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      positions[node.id] = { x, y, index: i };
    });

    return positions;
  }, [nodes]);

  // Selected node details
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [selectedNodeId, nodes]);

  // Connected edges for selected node
  const selectedNodeEdges = useMemo(() => {
    if (!selectedNodeId) return { incoming: [], outgoing: [] };
    const outgoing = edges.filter((e) => e.source === selectedNodeId);
    const incoming = edges.filter((e) => e.target === selectedNodeId);
    return { incoming, outgoing };
  }, [selectedNodeId, edges]);

  // Filtered nodes for visual canvas
  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      const matchSearch =
        !visualSearch.trim() ||
        n.label.toLowerCase().includes(visualSearch.toLowerCase()) ||
        n.id.toLowerCase().includes(visualSearch.toLowerCase()) ||
        (n.description && n.description.toLowerCase().includes(visualSearch.toLowerCase()));
      const matchType = typeFilter === 'all' || n.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [nodes, visualSearch, typeFilter]);

  // Filtered triplets for triplestore table
  const filteredTriplets = useMemo(() => {
    if (!tripletsSearch.trim()) return triplets;
    const q = tripletsSearch.toLowerCase();
    return triplets.filter(
      (t) =>
        t.subject.toLowerCase().includes(q) ||
        t.predicate.toLowerCase().includes(q) ||
        t.object.toLowerCase().includes(q)
    );
  }, [triplets, tripletsSearch]);

  // Fetch / Refresh triplets from Oxigraph backend
  const fetchAllTriplets = async () => {
    setIsRefreshingTriplets(true);
    try {
      const res = await fetch('/api/graph/triplets');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.triplets)) {
          setTriplets(data.triplets);
        }
      }
    } catch (err) {
      console.error('Error refreshing Oxigraph triplets:', err);
    } finally {
      setIsRefreshingTriplets(false);
    }
  };

  // Execute SPARQL Query
  const handleExecuteSparql = async (queryToRun?: string) => {
    const q = (queryToRun || sparqlQuery).trim();
    if (!q) return;

    setIsExecutingSparql(true);
    setSparqlError(null);
    try {
      const res = await fetch('/api/graph/sparql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSparqlError(err.error || `SPARQL Error HTTP ${res.status}`);
        setSparqlResults(null);
        return;
      }

      const data = await res.json();
      setSparqlResults({
        variables: data.variables || [],
        bindings: data.bindings || [],
      });
    } catch (err: any) {
      setSparqlError(err.message || 'Failed to execute query against Oxigraph');
      setSparqlResults(null);
    } finally {
      setIsExecutingSparql(false);
    }
  };

  // Fetch Turtle export
  const fetchTurtleExport = async () => {
    setIsLoadingTurtle(true);
    try {
      const res = await fetch('/api/graph/export');
      if (res.ok) {
        const data = await res.json();
        setTurtleContent(data.content || '');
      } else {
        // Fallback serialize client-side
        serializeLocalTurtle();
      }
    } catch (err) {
      serializeLocalTurtle();
    } finally {
      setIsLoadingTurtle(false);
    }
  };

  const serializeLocalTurtle = () => {
    const lines = [
      '# SmartBrief Knowledge Graph - W3C Turtle Export',
      `# Exported At: ${new Date().toISOString()}`,
      `# Total Asserted Triples: ${triplets.length}`,
      '@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .',
      '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .',
      '@prefix sb: <https://smartbrief.ai/concept/> .',
      '@prefix sbo: <https://smartbrief.ai/ontology/> .',
      '',
    ];
    triplets.forEach((t) => {
      const s = t.subject.startsWith('http') || t.subject.includes(':') ? `<${t.subject}>` : `<https://smartbrief.ai/concept/${t.subject}>`;
      const p = t.predicate.startsWith('http') || t.predicate.includes(':') ? `<${t.predicate}>` : `<https://smartbrief.ai/ontology/${t.predicate}>`;
      const o = t.object.startsWith('http') || t.object.includes(':') ? `<${t.object}>` : `"${t.object}"`;
      lines.push(`${s} ${p} ${o} .`);
    });
    setTurtleContent(lines.join('\n'));
  };

  useEffect(() => {
    if (activeSubTab === 'export' && !turtleContent) {
      fetchTurtleExport();
    }
    if (activeSubTab === 'triplets' && triplets.length === 0) {
      fetchAllTriplets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubTab]);

  const handleCopyTurtle = async () => {
    if (!turtleContent) return;
    try {
      await navigator.clipboard.writeText(turtleContent);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy Turtle:', e);
    }
  };

  const handleDownloadTurtle = () => {
    if (!turtleContent) return;
    const blob = new Blob([turtleContent], { type: 'text/turtle;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `smartbrief_oxigraph_${new Date().toISOString().slice(0, 10)}.ttl`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const simplifyUri = (uri: string) => {
    if (!uri) return '';
    if (uri.startsWith('https://smartbrief.ai/concept/')) return `sb:${uri.replace('https://smartbrief.ai/concept/', '')}`;
    if (uri.startsWith('https://smartbrief.ai/ontology/')) return `sbo:${uri.replace('https://smartbrief.ai/ontology/', '')}`;
    if (uri === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') return 'rdf:type';
    if (uri.startsWith('urn:semantica:concept:')) return `concept:${uri.replace('urn:semantica:concept:', '')}`;
    return uri;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
      {/* Top Banner & Stats */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-indigo-900/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shadow-inner">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold tracking-tight text-white">Oxigraph Knowledge Graph Explorer</h3>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-2 py-0.5 rounded-full">
                <ShieldCheck className="w-3 h-3 text-indigo-400" />
                Oxigraph SPARQL 1.1 Engine
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Interactive visualization of asserted RDF entities, directed relationships, and live SPARQL triplestore.
            </p>
          </div>
        </div>

        {/* Global Graph Metrics Badges */}
        <div className="flex items-center gap-2 text-xs">
          <div className="bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-1.5">
            <span className="text-slate-400">Nodes:</span>
            <span className="font-bold text-white">{nodes.length}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-1.5">
            <span className="text-slate-400">Edges:</span>
            <span className="font-bold text-white">{edges.length}</span>
          </div>
          <div className="bg-indigo-500/30 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-indigo-400/30 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-indigo-300" />
            <span className="text-indigo-200">Triples:</span>
            <span className="font-bold text-indigo-100">{triplets.length}</span>
          </div>
        </div>
      </div>

      {/* Explorer Sub-Tabs Navigation */}
      <div className="bg-slate-100/80 px-4 py-2 border-b border-slate-200 flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveSubTab('visual')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeSubTab === 'visual'
                ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>Visual Graph Canvas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('triplets')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeSubTab === 'triplets'
                ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Oxigraph Triplestore</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700">
              {triplets.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('sparql')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeSubTab === 'sparql'
                ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Live SPARQL Runner</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('export')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeSubTab === 'export'
                ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>W3C Turtle Export</span>
          </button>
        </div>

        {activeSubTab === 'triplets' && (
          <button
            type="button"
            onClick={fetchAllTriplets}
            disabled={isRefreshingTriplets}
            className="text-xs font-medium text-slate-600 hover:text-indigo-600 flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 shadow-xs disabled:opacity-50"
            title="Refresh from Oxigraph backend"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshingTriplets ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        )}
      </div>

      {/* Sub-Tab 1: Visual Graph Canvas */}
      {activeSubTab === 'visual' && (
        <div className="p-4 sm:p-5 flex flex-col space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <div className="relative flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter nodes..."
                  value={visualSearch}
                  onChange={(e) => setVisualSearch(e.target.value)}
                  className="w-full text-xs pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {nodeTypes.length > 1 && (
                <div className="flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="text-xs rounded-lg border border-slate-200 bg-white py-1.5 px-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="all">All Types ({nodes.length})</option>
                    {nodeTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 text-slate-600">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(0.7, +(z - 0.15).toFixed(2)))}
                className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 shadow-xs"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono px-1.5">{Math.round(zoomLevel * 100)}%</span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(1.6, +(z + 0.15).toFixed(2)))}
                className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 shadow-xs"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(1)}
                className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 shadow-xs ml-1"
                title="Reset Zoom"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* SVG Visual Graph Container */}
          <div className="relative w-full h-[480px] bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center select-none">
            {nodes.length === 0 ? (
              <div className="text-center text-slate-400 p-6 space-y-2">
                <Network className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-sm">No knowledge graph nodes available.</p>
                <p className="text-xs text-slate-500">Submit an article in the ingestion hub to extract entities.</p>
              </div>
            ) : (
              <svg
                viewBox="0 0 720 480"
                className="w-full h-full transition-transform duration-200 ease-out"
                style={{ transform: `scale(${zoomLevel})` }}
              >
                <defs>
                  {/* Arrow marker for directed edges */}
                  <marker
                    id="arrowhead"
                    markerWidth="8"
                    markerHeight="6"
                    refX="22"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="#818cf8" />
                  </marker>
                  <marker
                    id="arrowhead-highlight"
                    markerWidth="8"
                    markerHeight="6"
                    refX="22"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="#38bdf8" />
                  </marker>
                </defs>

                {/* Grid Background Pattern */}
                <g stroke="#1e293b" strokeWidth="0.8" opacity="0.6">
                  {Array.from({ length: 15 }).map((_, i) => (
                    <line key={`h-${i}`} x1="0" y1={i * 35} x2="720" y2={i * 35} />
                  ))}
                  {Array.from({ length: 22 }).map((_, i) => (
                    <line key={`v-${i}`} x1={i * 35} y1="0" x2={i * 35} y2="480" />
                  ))}
                </g>

                {/* Edges */}
                <g>
                  {edges.map((edge, idx) => {
                    const srcPos = nodePositions[edge.source];
                    const tgtPos = nodePositions[edge.target];
                    if (!srcPos || !tgtPos) return null;

                    const isConnectedToSelected =
                      selectedNodeId &&
                      (edge.source === selectedNodeId || edge.target === selectedNodeId);
                    const isDimmed = selectedNodeId && !isConnectedToSelected;

                    const midX = (srcPos.x + tgtPos.x) / 2;
                    const midY = (srcPos.y + tgtPos.y) / 2;

                    return (
                      <g key={`edge-${idx}`} opacity={isDimmed ? 0.15 : 1} className="transition-opacity duration-300">
                        <line
                          x1={srcPos.x}
                          y1={srcPos.y}
                          x2={tgtPos.x}
                          y2={tgtPos.y}
                          stroke={isConnectedToSelected ? '#38bdf8' : '#6366f1'}
                          strokeWidth={isConnectedToSelected ? 2.5 : 1.5}
                          strokeDasharray={isConnectedToSelected ? 'none' : '4,3'}
                          markerEnd={isConnectedToSelected ? 'url(#arrowhead-highlight)' : 'url(#arrowhead)'}
                        />
                        {/* Edge Label Badge */}
                        <g transform={`translate(${midX}, ${midY})`}>
                          <rect
                            x="-32"
                            y="-9"
                            width="64"
                            height="18"
                            rx="5"
                            fill="#0f172a"
                            stroke={isConnectedToSelected ? '#38bdf8' : '#334155'}
                            strokeWidth="1"
                          />
                          <text
                            textAnchor="middle"
                            y="3"
                            fontSize="9"
                            fontFamily="monospace"
                            fill={isConnectedToSelected ? '#7dd3fc' : '#94a3b8'}
                          >
                            {edge.relation.length > 10 ? `${edge.relation.slice(0, 9)}…` : edge.relation}
                          </text>
                        </g>
                      </g>
                    );
                  })}
                </g>

                {/* Nodes */}
                <g>
                  {nodes.map((node) => {
                    const pos = nodePositions[node.id];
                    if (!pos) return null;

                    const isSelected = selectedNodeId === node.id;
                    const isDimmed = selectedNodeId && !isSelected && !edges.some(
                      (e) => (e.source === selectedNodeId && e.target === node.id) ||
                             (e.target === selectedNodeId && e.source === node.id)
                    );
                    const color = getNodeColor(node.type);

                    return (
                      <g
                        key={`node-${node.id}`}
                        transform={`translate(${pos.x}, ${pos.y})`}
                        onClick={() => setSelectedNodeId(isSelected ? null : node.id)}
                        className="cursor-pointer transition-all duration-300"
                        opacity={isDimmed ? 0.2 : 1}
                      >
                        {/* Selected halo */}
                        {isSelected && (
                          <circle
                            r="34"
                            fill="none"
                            stroke="#38bdf8"
                            strokeWidth="2.5"
                            strokeDasharray="4,2"
                            className="animate-spin"
                            style={{ animationDuration: '8s' }}
                          />
                        )}

                        {/* Node Body Circle */}
                        <circle
                          r="26"
                          fill={color.fill}
                          stroke={isSelected ? '#ffffff' : '#1e293b'}
                          strokeWidth={isSelected ? 3 : 2}
                          className="hover:scale-110 transition-transform duration-200"
                        />

                        {/* Node Label Initial */}
                        <text
                          textAnchor="middle"
                          y="4"
                          fill="#ffffff"
                          fontSize="11"
                          fontWeight="bold"
                          fontFamily="sans-serif"
                          className="pointer-events-none select-none"
                        >
                          {(node.label || 'N').slice(0, 3).toUpperCase()}
                        </text>

                        {/* Node Bottom Label */}
                        <g transform="translate(0, 38)">
                          <rect
                            x="-55"
                            y="-9"
                            width="110"
                            height="18"
                            rx="6"
                            fill="#0f172a"
                            stroke={isSelected ? '#38bdf8' : '#1e293b'}
                            strokeWidth="1"
                            opacity="0.9"
                          />
                          <text
                            textAnchor="middle"
                            y="3"
                            fill={isSelected ? '#38bdf8' : '#e2e8f0'}
                            fontSize="10"
                            fontWeight={isSelected ? 'bold' : 'normal'}
                            fontFamily="sans-serif"
                            className="pointer-events-none select-none"
                          >
                            {(node.label || node.id).length > 15
                              ? `${(node.label || node.id).slice(0, 14)}…`
                              : node.label || node.id}
                          </text>
                        </g>
                      </g>
                    );
                  })}
                </g>
              </svg>
            )}

            {/* Instruction tooltip in canvas */}
            <div className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur-xs text-[11px] text-slate-300 px-3 py-1.5 rounded-lg border border-slate-800 pointer-events-none flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Click any node to inspect semantic connections & triples</span>
            </div>
          </div>

          {/* Node Inspector Details Card (Rendered when node is clicked) */}
          {selectedNode && (
            <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-3 animate-in fade-in duration-200">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-300">
                      {selectedNode.type || 'Concept'}
                    </span>
                    <span className="text-xs font-mono text-slate-500 truncate max-w-xs">
                      {selectedNode.id}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">{selectedNode.label}</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedNodeId(null)}
                  className="text-slate-400 hover:text-slate-700 text-xs px-2 py-1 rounded-md bg-white border border-slate-200"
                >
                  Close
                </button>
              </div>

              {selectedNode.description && (
                <p className="text-xs text-slate-700 leading-relaxed bg-white p-2.5 rounded-lg border border-indigo-100">
                  {selectedNode.description}
                </p>
              )}

              {/* Edge Connections */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                  <span className="font-semibold text-slate-700 flex items-center gap-1 text-[11px]">
                    <Share2 className="w-3 h-3 text-indigo-500" />
                    Outgoing Relations ({selectedNodeEdges.outgoing.length}):
                  </span>
                  {selectedNodeEdges.outgoing.length === 0 ? (
                    <span className="text-slate-400 text-[11px]">None</span>
                  ) : (
                    <ul className="space-y-1">
                      {selectedNodeEdges.outgoing.map((e, i) => (
                        <li key={i} className="text-[11px] text-slate-600 flex items-center gap-1 font-mono">
                          <span className="text-indigo-600 font-semibold">{e.relation}</span>
                          <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                          <span className="truncate">{e.target}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                  <span className="font-semibold text-slate-700 flex items-center gap-1 text-[11px]">
                    <Share2 className="w-3 h-3 text-indigo-500" />
                    Incoming Relations ({selectedNodeEdges.incoming.length}):
                  </span>
                  {selectedNodeEdges.incoming.length === 0 ? (
                    <span className="text-slate-400 text-[11px]">None</span>
                  ) : (
                    <ul className="space-y-1">
                      {selectedNodeEdges.incoming.map((e, i) => (
                        <li key={i} className="text-[11px] text-slate-600 flex items-center gap-1 font-mono">
                          <span className="truncate">{e.source}</span>
                          <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                          <span className="text-indigo-600 font-semibold">{e.relation}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab 2: Oxigraph Triplestore Table */}
      {activeSubTab === 'triplets' && (
        <div className="p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search subject, predicate, or object..."
                value={tripletsSearch}
                onChange={(e) => setTripletsSearch(e.target.value)}
                className="w-full text-xs pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <span className="text-xs text-slate-500 font-mono">
              Showing {filteredTriplets.length} of {triplets.length} triples
            </span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold uppercase tracking-wider text-[10px] sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Subject (URI)</th>
                    <th className="py-2.5 px-3">Predicate</th>
                    <th className="py-2.5 px-3">Object / Literal</th>
                    <th className="py-2.5 px-3 text-right">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {filteredTriplets.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 font-sans text-xs">
                        No triples found matching &quot;{tripletsSearch}&quot;.
                      </td>
                    </tr>
                  ) : (
                    filteredTriplets.map((t, idx) => (
                      <tr key={idx} className="hover:bg-indigo-50/40 transition-colors">
                        <td className="py-2 px-3 text-slate-400 text-[11px] select-none">{idx + 1}</td>
                        <td className="py-2 px-3 text-indigo-700 font-semibold truncate max-w-[200px]" title={t.subject}>
                          {simplifyUri(t.subject)}
                        </td>
                        <td className="py-2 px-3 text-amber-700 truncate max-w-[180px]" title={t.predicate}>
                          {simplifyUri(t.predicate)}
                        </td>
                        <td className="py-2 px-3 text-slate-800 truncate max-w-[220px]" title={t.object}>
                          {simplifyUri(t.object)}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-500 font-sans text-[11px]">
                          {typeof t.confidence === 'number' ? `${Math.round(t.confidence * 100)}%` : '100%'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 3: Live SPARQL Runner */}
      {activeSubTab === 'sparql' && (
        <div className="p-4 sm:p-5 space-y-4">
          {/* Quick Query Templates */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              Pre-built SPARQL 1.1 Templates:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_SPARQL_QUERIES.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setSparqlQuery(preset.query);
                    handleExecuteSparql(preset.query);
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 border border-slate-200 text-slate-700 transition-all text-left"
                  title={preset.desc}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* SPARQL Query Editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="sparql-editor" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-slate-500" />
                SPARQL 1.1 Query Editor:
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExecuteSparql()}
                  disabled={isExecutingSparql}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-50"
                >
                  <Play className={`w-3.5 h-3.5 ${isExecutingSparql ? 'animate-spin' : ''}`} />
                  <span>{isExecutingSparql ? 'Executing...' : 'Run Query'}</span>
                </button>
              </div>
            </div>

            <textarea
              id="sparql-editor"
              value={sparqlQuery}
              onChange={(e) => setSparqlQuery(e.target.value)}
              rows={4}
              className="w-full font-mono text-xs p-3 rounded-xl border border-slate-300 bg-slate-900 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent leading-relaxed"
              placeholder="Enter SPARQL 1.1 query..."
            />
          </div>

          {/* SPARQL Error Notification */}
          {sparqlError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-mono">
              <span className="font-bold">Error:</span> {sparqlError}
            </div>
          )}

          {/* Query Results */}
          {sparqlResults && (
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  Query Results ({sparqlResults.bindings.length} bindings returned)
                </span>
                <div className="flex items-center gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setSparqlViewMode('table')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                      sparqlViewMode === 'table' ? 'bg-indigo-100 text-indigo-800 font-bold' : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    Table View
                  </button>
                  <button
                    type="button"
                    onClick={() => setSparqlViewMode('json')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                      sparqlViewMode === 'json' ? 'bg-indigo-100 text-indigo-800 font-bold' : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    Raw JSON
                  </button>
                </div>
              </div>

              {sparqlViewMode === 'table' ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto max-h-[350px]">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-100 text-slate-700 font-semibold text-[11px] sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">#</th>
                          {sparqlResults.variables.map((v) => (
                            <th key={v} className="py-2 px-3">
                              ?{v}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sparqlResults.bindings.length === 0 ? (
                          <tr>
                            <td
                              colSpan={sparqlResults.variables.length + 1}
                              className="py-6 text-center text-slate-400 font-sans"
                            >
                              Query executed successfully with 0 matching bindings.
                            </td>
                          </tr>
                        ) : (
                          sparqlResults.bindings.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-slate-50">
                              <td className="py-1.5 px-3 text-slate-400 text-[10px]">{rIdx + 1}</td>
                              {sparqlResults.variables.map((v) => {
                                const val = row[v]?.value ?? row[v] ?? '';
                                return (
                                  <td key={v} className="py-1.5 px-3 text-slate-800 truncate max-w-xs" title={String(val)}>
                                    {simplifyUri(String(val))}
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <pre className="p-3 rounded-xl bg-slate-900 text-slate-200 text-xs font-mono overflow-auto max-h-[350px]">
                  {JSON.stringify(sparqlResults, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab 4: W3C Turtle Export */}
      {activeSubTab === 'export' && (
        <div className="p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-semibold text-slate-800">W3C Turtle Serialization (.ttl)</h4>
              <p className="text-[11px] text-slate-500">
                Standard RDF syntax ready for import into GraphDB, Protégé, or Apache Jena.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyTurtle}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 shadow-xs transition-all"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopied ? 'Copied!' : 'Copy Turtle'}</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadTurtle}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .ttl</span>
              </button>
            </div>
          </div>

          <div className="relative">
            {isLoadingTurtle ? (
              <div className="h-64 flex items-center justify-center text-slate-400 text-xs gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                <span>Generating W3C Turtle format...</span>
              </div>
            ) : (
              <pre className="w-full h-80 overflow-auto p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed border border-slate-800 shadow-inner">
                {turtleContent || '# No RDF triples generated yet.'}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
