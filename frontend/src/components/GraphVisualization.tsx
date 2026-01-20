import { useEffect, useState } from 'react';
import { Maximize2, Minimize2, ZoomIn, Plus, Minus } from 'lucide-react';
import type { VisualizationData } from '../utils/api';

interface GraphVisualizationProps {
  data: VisualizationData | null;
}

interface NodePosition {
  x: number;
  y: number;
}

export function GraphVisualization({ data }: GraphVisualizationProps) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [nodePositions, setNodePositions] = useState<Record<string, NodePosition>>({});

  useEffect(() => {
    if (data?.nodes) {
      calculateNodePositions();
    }
  }, [data]);

  const calculateNodePositions = () => {
    if (!data || !data.nodes || !data.edges) return;

    const positions: Record<string, NodePosition> = {};
    const width = 1400;
    const height = 850;
    const padding = 140;

    // Build adjacency map and in-degree count
    const childrenMap: Record<string, string[]> = {};
    const inDegree: Record<string, number> = {};
    
    data.nodes.forEach(node => {
      inDegree[node.id] = 0;
    });

    data.edges.forEach(edge => {
      if (!childrenMap[edge.source]) {
        childrenMap[edge.source] = [];
      }
      childrenMap[edge.source].push(edge.target);
      inDegree[edge.target]++;
    });

    // Find root node (node with no incoming edges or marked as root)
    let rootNode = data.nodes.find(n => n.data.type === 'root');
    if (!rootNode) {
      const rootCandidates = data.nodes.filter(n => inDegree[n.id] === 0);
      rootNode = rootCandidates[0] || data.nodes[0];
    }

    // Hierarchical layout using BFS
    const levels: Record<number, string[]> = {};
    const queue: Array<{ id: string; level: number }> = [{ id: rootNode.id, level: 0 }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { id, level } = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);

      if (!levels[level]) levels[level] = [];
      levels[level].push(id);

      const children = childrenMap[id] || [];
      children.forEach(childId => {
        queue.push({ id: childId, level: level + 1 });
      });
    }

    // Position nodes by level
    const levelCount = Object.keys(levels).length;
    const verticalSpacing = Math.min(170, (height - 2 * padding) / Math.max(levelCount, 1));

    Object.entries(levels).forEach(([levelStr, nodeIds]) => {
      const level = parseInt(levelStr);
      const y = padding + 50 + level * verticalSpacing;
      const nodesInLevel = nodeIds.length;
      const availableWidth = width - 2 * padding;
      const horizontalSpacing = availableWidth / (nodesInLevel + 1);

      nodeIds.forEach((nodeId, index) => {
        const x = padding + horizontalSpacing * (index + 1);
        positions[nodeId] = { x, y };
      });
    });

    setNodePositions(positions);
  };

  const handleFitView = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev * 1.2, 5));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev / 1.2, 0.1));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName !== 'svg') return;
    setIsPanning(true);
    setStartPos({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - startPos.x,
      y: e.clientY - startPos.y,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY;
    const newScale = delta > 0 ? scale * 1.1 : scale / 1.1;
    setScale(Math.max(0.1, Math.min(5, newScale)));
  };

  if (!data || !data.nodes || !data.edges || data.nodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900 rounded-lg">
        <p className="text-slate-400">No graph data available</p>
      </div>
    );
  }

  const hoveredNodeData = hoveredNode ? data.nodes.find((n) => n.id === hoveredNode) : null;

  return (
    <div className="h-full relative bg-slate-900 rounded-lg overflow-hidden">
      <div className="absolute top-4 left-4 z-10 flex gap-2 flex-wrap">
        <button 
          onClick={handleZoomIn} 
          className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-2 shadow-lg"
        >
          <Plus className="w-4 h-4" />
          Zoom In
        </button>
        <button 
          onClick={handleZoomOut} 
          className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-2 shadow-lg"
        >
          <Minus className="w-4 h-4" />
          Zoom Out
        </button>
        <button 
          onClick={handleFitView} 
          className="px-3 py-2 bg-pink-600 text-white rounded-lg text-sm hover:bg-pink-700 flex items-center gap-2 shadow-lg"
        >
          <ZoomIn className="w-4 h-4" />
          Fit View
        </button>
      </div>

      <svg
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill="#a78bfa" />
          </marker>
          <filter id="graph-shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.4" />
          </filter>
        </defs>

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
          {/* Draw edges */}
          {data.edges.map((edge) => {
            const sourcePos = nodePositions[edge.source];
            const targetPos = nodePositions[edge.target];
            
            if (!sourcePos || !targetPos) return null;

            // Calculate arrow endpoint (stop at node boundary)
            const dx = targetPos.x - sourcePos.x;
            const dy = targetPos.y - sourcePos.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            const unitX = dx / length;
            const unitY = dy / length;
            const radius = 45;
            
            const startX = sourcePos.x + unitX * radius;
            const startY = sourcePos.y + unitY * radius;
            const endX = targetPos.x - unitX * radius;
            const endY = targetPos.y - unitY * radius;

            return (
              <g key={edge.id}>
                <line
                  x1={startX}
                  y1={startY}
                  x2={endX}
                  y2={endY}
                  stroke="#a78bfa"
                  strokeWidth="2.5"
                  opacity="0.45"
                  markerEnd="url(#arrowhead)"
                />
              </g>
            );
          })}

          {/* Draw nodes */}
          {data.nodes.map((node) => {
            const pos = nodePositions[node.id];
            if (!pos) return null;

            const isRoot = node.data.type === 'root';
            const isCategory = node.data.type === 'category';
            const radius = isRoot ? 50 : isCategory ? 42 : 38;
            let bgColor = '#8b5cf6';
            let borderColor = '#a78bfa';
            
            if (isRoot) {
              bgColor = '#8b5cf6';
              borderColor = '#c084fc';
            } else if (isCategory) {
              bgColor = '#0ea5e9';
              borderColor = '#06b6d4';
            } else {
              bgColor = '#10b981';
              borderColor = '#34d399';
            }

            return (
              <g
                key={node.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Node circle */}
                <circle
                  r={radius}
                  fill={bgColor}
                  stroke={hoveredNode === node.id ? '#fff' : borderColor}
                  strokeWidth={hoveredNode === node.id ? '3' : '2'}
                  opacity={hoveredNode === node.id ? "1" : "0.9"}
                  filter="url(#graph-shadow)"
                />
                
                {/* Node label */}
                <text
                  textAnchor="middle"
                  dy="6"
                  fill="white"
                  fontSize={isRoot ? "13" : "12"}
                  fontWeight={isRoot ? "700" : "600"}
                  style={{ pointerEvents: 'none', userSelect: 'none', letterSpacing: '-0.3px' }}
                >
                  {node.data.label.length > 14
                    ? `${node.data.label.substring(0, 14)}...` 
                    : node.data.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {hoveredNodeData && (
        <div className="absolute bottom-4 left-4 bg-slate-800 text-white p-4 rounded-lg shadow-xl max-w-sm border border-slate-700">
          <div className="font-semibold text-sm mb-1">{hoveredNodeData.data.label}</div>
          <div className="text-xs text-slate-400">
            {hoveredNodeData.data.hoverSummary || hoveredNodeData.data.summary || 'No description available'}
          </div>
        </div>
      )}

      <div className="absolute top-4 right-4 bg-slate-800/90 text-white px-3 py-2 rounded-lg text-sm">
        <div className="flex items-center gap-4">
          <div>Nodes: {data.nodes.length}</div>
          <div>Edges: {data.edges.length}</div>
          <div>Zoom: {Math.round(scale * 100)}%</div>
        </div>
      </div>
    </div>
  );
}