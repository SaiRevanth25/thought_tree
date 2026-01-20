import { useEffect, useState } from 'react';
import { Maximize2, Minimize2, ZoomIn, Download, Plus, Minus } from 'lucide-react';
import type { VisualizationData } from '../utils/api';

interface MindmapVisualizationProps {
  data: VisualizationData | null;
}

interface NodePosition {
  x: number;
  y: number;
}

export function MindmapVisualization({ data }: MindmapVisualizationProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [nodePositions, setNodePositions] = useState<Record<string, NodePosition>>({});

  useEffect(() => {
    if (data?.nodes) {
      console.log('MindmapVisualization: data received', { nodeCount: data.nodes.length, edgeCount: data.edges?.length || 0 });
      const rootNode = data.nodes.find(n => n.data.type === 'root');
      if (rootNode) {
        setExpandedNodes(new Set(data.nodes.map(n => n.id)));
      }
      calculateNodePositions();
    } else {
      console.log('MindmapVisualization: no data');
    }
  }, [data]);

  const calculateNodePositions = () => {
    if (!data || !data.nodes) return;

    const positions: Record<string, NodePosition> = {};
    const centerX = 700;
    const centerY = 400;

    // Find root node
    const rootNode = data.nodes.find(n => n.data.type === 'root');
    if (!rootNode) return;

    // Position root at center
    positions[rootNode.id] = { x: centerX, y: centerY };

    // Build hierarchy
    const childrenMap: Record<string, string[]> = {};
    const nodeLevel: Record<string, number> = {};
    
    if (data.edges) {
      data.edges.forEach(edge => {
        if (!childrenMap[edge.source]) {
          childrenMap[edge.source] = [];
        }
        childrenMap[edge.source].push(edge.target);
      });
    }

    // Calculate level for each node using BFS
    nodeLevel[rootNode.id] = 0;
    const queue = [rootNode.id];
    let queueIndex = 0;

    while (queueIndex < queue.length) {
      const nodeId = queue[queueIndex++];
      const children = childrenMap[nodeId] || [];
      
      children.forEach(childId => {
        if (nodeLevel[childId] === undefined) {
          nodeLevel[childId] = nodeLevel[nodeId] + 1;
          queue.push(childId);
        }
      });
    }

    // Group nodes by level
    const levelNodes: Record<number, string[]> = {};
    queue.forEach(nodeId => {
      const level = nodeLevel[nodeId];
      if (!levelNodes[level]) levelNodes[level] = [];
      levelNodes[level].push(nodeId);
    });

    // Increased distance multiplier for each level - much more spacing
    const baseDistance = 280;
    const levelDistances: Record<number, number> = {};
    Object.keys(levelNodes).forEach(levelStr => {
      const level = parseInt(levelStr);
      levelDistances[level] = baseDistance + level * 280;
    });

    // Position nodes - each level gets distributed around a circle
    Object.entries(levelNodes).forEach(([levelStr, nodeIds]) => {
      const level = parseInt(levelStr);
      const distance = levelDistances[level];

      if (level === 0) {
        // Root already positioned
        return;
      }

      // Group nodes by parent for better organization
      const nodesByParent: Record<string, string[]> = {};
      nodeIds.forEach(nodeId => {
        const parentId = Object.keys(childrenMap).find(parent =>
          childrenMap[parent].includes(nodeId)
        );
        if (parentId) {
          if (!nodesByParent[parentId]) nodesByParent[parentId] = [];
          nodesByParent[parentId].push(nodeId);
        }
      });

      // Position each node based on parent's angle
      Object.entries(nodesByParent).forEach(([parentId, children]) => {
        const parentPos = positions[parentId];
        if (!parentPos) return;

        // Calculate angle from root to parent
        const dx = parentPos.x - centerX;
        const dy = parentPos.y - centerY;
        const parentAngle = Math.atan2(dy, dx);

        // Increased angle spread for siblings - much wider distribution
        const angleSpread = Math.PI / 2; // ±90 degrees from parent direction
        const angleStep = angleSpread / Math.max(children.length - 1, 1);

        children.forEach((childId, index) => {
          // Position along parent's ray with larger offset
          const childAngle = parentAngle + (index - children.length / 2) * angleStep * 0.8;
          
          const childX = centerX + Math.cos(childAngle) * distance;
          const childY = centerY + Math.sin(childAngle) * distance;
          
          positions[childId] = { x: childX, y: childY };
        });
      });
    });

    setNodePositions(positions);
  };

  const handleExpandAll = () => {
    if (!data) return;
    setExpandedNodes(new Set(data.nodes.map((n) => n.id)));
  };

  const handleCollapseAll = () => {
    const rootNode = data?.nodes.find((n) => n.data.type === 'root');
    setExpandedNodes(rootNode ? new Set([rootNode.id]) : new Set());
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

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900 rounded-lg">
        <p className="text-slate-400">No visualization data available</p>
      </div>
    );
  }

  const hoveredNodeData = hoveredNode ? data.nodes.find((n) => n.id === hoveredNode) : null;

  // Get node color based on type
  const getNodeColor = (type: string) => {
    switch (type) {
      case 'root':
        return 'from-purple-500 to-pink-500';
      case 'category':
        return 'from-blue-500 to-cyan-500';
      case 'leaf':
        return 'from-green-500 to-emerald-500';
      default:
        return 'from-gray-500 to-slate-500';
    }
  };

  return (
    <div className="h-full relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-lg overflow-hidden">
      <div className="absolute inset-0 opacity-40">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-screen filter blur-3xl opacity-10"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500 rounded-full mix-blend-screen filter blur-3xl opacity-10"></div>
      </div>
      
      <div className="absolute top-4 left-4 z-10 flex gap-2 flex-wrap">
        <button 
          onClick={handleExpandAll} 
          className="px-3 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg text-sm hover:from-purple-700 hover:to-pink-700 flex items-center gap-2 shadow-lg"
        >
          <Maximize2 className="w-4 h-4" />
          Expand All
        </button>
        <button 
          onClick={handleCollapseAll} 
          className="px-3 py-2 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg text-sm hover:from-orange-700 hover:to-red-700 flex items-center gap-2 shadow-lg"
        >
          <Minimize2 className="w-4 h-4" />
          Collapse All
        </button>
        <button 
          onClick={handleZoomIn} 
          className="px-3 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg text-sm hover:from-blue-700 hover:to-cyan-700 flex items-center gap-2 shadow-lg"
        >
          <Plus className="w-4 h-4" />
          Zoom In
        </button>
        <button 
          onClick={handleZoomOut} 
          className="px-3 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg text-sm hover:from-blue-700 hover:to-cyan-700 flex items-center gap-2 shadow-lg"
        >
          <Minus className="w-4 h-4" />
          Zoom Out
        </button>
        <button 
          onClick={handleFitView} 
          className="px-3 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg text-sm hover:from-blue-700 hover:to-cyan-700 flex items-center gap-2 shadow-lg"
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
          <filter id="mindmap-shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.4" />
          </filter>
        </defs>

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
          {/* Draw edges with curved paths */}
          {data.edges?.map((edge) => {
            const sourcePos = nodePositions[edge.source];
            const targetPos = nodePositions[edge.target];
            
            if (!sourcePos || !targetPos || !expandedNodes.has(edge.source) || !expandedNodes.has(edge.target)) {
              return null;
            }

            // Create quadratic bezier curve for smooth edges
            const midX = (sourcePos.x + targetPos.x) / 2;
            const midY = (sourcePos.y + targetPos.y) / 2;
            
            // Curve control point - pull towards center to create flowing branches
            const centerX = 700;
            const centerY = 400;
            const dx = targetPos.x - sourcePos.x;
            const dy = targetPos.y - sourcePos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Control point distance based on edge length
            const controlDistance = distance * 0.3;
            const angle = Math.atan2(dy, dx);
            const perpAngle = angle + Math.PI / 2;
            
            const controlX = midX + Math.cos(perpAngle) * controlDistance * 0.3;
            const controlY = midY + Math.sin(perpAngle) * controlDistance * 0.3;

            return (
              <path
                key={edge.id}
                d={`M ${sourcePos.x} ${sourcePos.y} Q ${controlX} ${controlY} ${targetPos.x} ${targetPos.y}`}
                stroke="#a78bfa"
                strokeWidth="2.5"
                opacity="0.35"
                fill="none"
              />
            );
          })}

          {/* Draw nodes */}
          {data.nodes.map((node) => {
            const pos = nodePositions[node.id];
            if (!pos || !expandedNodes.has(node.id)) return null;

            const isRoot = node.data.type === 'root';
            const radius = isRoot ? 85 : 65;
            const bgColor = isRoot ? '#8b5cf6' : '#a78bfa';
            const borderColor = isRoot ? '#c084fc' : '#e9d5ff';

            return (
              <g
                key={node.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => toggleNode(node.id)}
                style={{ cursor: 'pointer' }}
              >
                {/* Node circle */}
                <circle
                  r={radius}
                  fill={bgColor}
                  stroke={hoveredNode === node.id ? '#fff' : borderColor}
                  strokeWidth={hoveredNode === node.id ? "4" : "2.5"}
                  opacity={hoveredNode === node.id ? "1" : "0.92"}
                  filter="url(#mindmap-shadow)"
                  style={{ transition: 'all 0.2s ease' }}
                />
                
                {/* Node label */}
                <text
                  textAnchor="middle"
                  dy="6"
                  fill="white"
                  fontSize={isRoot ? "15" : "13"}
                  fontWeight={isRoot ? "bold" : "600"}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {node.data.label.length > 16 
                    ? `${node.data.label.substring(0, 16)}...` 
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

      {/* Info panel */}
      <div className="absolute top-4 right-4 bg-slate-800/90 text-white px-3 py-2 rounded-lg text-sm">
        <div className="flex items-center gap-4">
          <div>Nodes: {data.nodes.length}</div>
          <div>Edges: {data.edges?.length || 0}</div>
          <div>Zoom: {Math.round(scale * 100)}%</div>
        </div>
      </div>
    </div>
  );
}