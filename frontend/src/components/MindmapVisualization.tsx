import { useEffect, useState } from 'react';
import { Maximize2, Minimize2, ZoomIn, Download } from 'lucide-react';
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
    const centerX = 600;
    const centerY = 400;
    
    // Adaptive spacing based on node count
    const nodeCount = data.nodes.length;
    const baseLevelDistance = 180;
    const adaptiveLevelDistance = baseLevelDistance + (nodeCount * 3);
    const minNodeRadius = 50;
    const nodePadding = 20;

    // Find root node
    const rootNode = data.nodes.find(n => n.data.type === 'root');
    if (!rootNode) return;

    // Position root at center
    positions[rootNode.id] = { x: centerX, y: centerY };

    // Build hierarchy with depth calculation
    const childrenMap: Record<string, string[]> = {};
    const parentMap: Record<string, string> = {};
    const nodeDepths: Record<string, number> = { [rootNode.id]: 0 };
    
    if (data.edges) {
      data.edges.forEach(edge => {
        if (!childrenMap[edge.source]) {
          childrenMap[edge.source] = [];
        }
        childrenMap[edge.source].push(edge.target);
        parentMap[edge.target] = edge.source;
      });
    }

    // Calculate depths using BFS
    const depthQueue: Array<{ id: string; depth: number }> = [{ id: rootNode.id, depth: 0 }];
    const depthVisited = new Set<string>();
    let maxDepth = 0;

    while (depthQueue.length > 0) {
      const { id, depth } = depthQueue.shift()!;
      if (depthVisited.has(id)) continue;
      depthVisited.add(id);
      
      nodeDepths[id] = depth;
      maxDepth = Math.max(maxDepth, depth);

      const children = childrenMap[id] || [];
      children.forEach(childId => {
        if (!depthVisited.has(childId)) {
          depthQueue.push({ id: childId, depth: depth + 1 });
        }
      });
    }

    // Calculate sector angles for each node's children
    const calculateSectorAngles = (parentId: string, startAngle: number, sectorWidth: number): void => {
      const children = childrenMap[parentId] || [];
      if (children.length === 0) return;

      const childCount = children.length;
      const angleStep = sectorWidth / childCount;
      const minAngleStep = (2 * Math.PI) / 32; // Minimum angle to prevent clustering
      const actualAngleStep = Math.max(angleStep, minAngleStep);
      const actualSectorWidth = actualAngleStep * childCount;

      // Center the sector
      const sectorStartAngle = startAngle - actualSectorWidth / 2;

      children.forEach((childId, index) => {
        const childAngle = sectorStartAngle + (index + 0.5) * actualAngleStep;
        const level = nodeDepths[childId] || 1;
        const distance = adaptiveLevelDistance * level;
        
        let x = centerX + Math.cos(childAngle) * distance;
        let y = centerY + Math.sin(childAngle) * distance;

        // Collision detection and adjustment
        const maxCollisionChecks = 10;
        let collisionCheckCount = 0;
        let hasCollision = true;

        while (hasCollision && collisionCheckCount < maxCollisionChecks) {
          hasCollision = false;
          
          // Check collision with existing nodes
          for (const [existingId, existingPos] of Object.entries(positions)) {
            if (existingId === childId) continue;
            
            const dx = x - existingPos.x;
            const dy = y - existingPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const minDistance = (minNodeRadius + nodePadding) * 2;

            if (distance < minDistance) {
              hasCollision = true;
              // Push away from collision
              const angle = Math.atan2(dy, dx);
              const pushDistance = minDistance - distance + 5;
              x += Math.cos(angle) * pushDistance;
              y += Math.sin(angle) * pushDistance;
              break;
            }
          }

          collisionCheckCount++;
        }

        positions[childId] = { x, y };

        // Recursively position children with sector-based distribution
        const childSectorWidth = actualAngleStep * 0.8; // Slightly narrower sector for children
        calculateSectorAngles(childId, childAngle, childSectorWidth);
      });
    };

    // Start positioning from root
    const rootChildren = childrenMap[rootNode.id] || [];
    if (rootChildren.length > 0) {
      const rootSectorWidth = (2 * Math.PI) / Math.max(rootChildren.length, 1);
      calculateSectorAngles(rootNode.id, 0, rootSectorWidth);
    }

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
    <div className="h-full relative bg-slate-900 rounded-lg overflow-hidden">
      <div className="absolute top-4 left-4 z-10 flex gap-2 flex-wrap">
        <button 
          onClick={handleExpandAll} 
          className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-2"
        >
          <Maximize2 className="w-4 h-4" />
          Expand All
        </button>
        <button 
          onClick={handleCollapseAll} 
          className="px-3 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700 flex items-center gap-2"
        >
          <Minimize2 className="w-4 h-4" />
          Collapse All
        </button>
        <button 
          onClick={handleFitView} 
          className="px-3 py-2 bg-pink-600 text-white rounded-lg text-sm hover:bg-pink-700 flex items-center gap-2"
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
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
          {/* Draw edges */}
          {data.edges?.map((edge) => {
            const sourcePos = nodePositions[edge.source];
            const targetPos = nodePositions[edge.target];
            
            if (!sourcePos || !targetPos || !expandedNodes.has(edge.source) || !expandedNodes.has(edge.target)) {
              return null;
            }

            return (
              <line
                key={edge.id}
                x1={sourcePos.x}
                y1={sourcePos.y}
                x2={targetPos.x}
                y2={targetPos.y}
                stroke="#475569"
                strokeWidth="2"
                opacity="0.6"
              />
            );
          })}

          {/* Draw nodes */}
          {data.nodes.map((node) => {
            const pos = nodePositions[node.id];
            if (!pos || !expandedNodes.has(node.id)) return null;

            const isRoot = node.data.type === 'root';
            const radius = isRoot ? 60 : 50;

            return (
              <g
                key={node.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => toggleNode(node.id)}
                style={{ cursor: 'pointer' }}
              >
                {/* Node circle with gradient */}
                <defs>
                  <linearGradient id={`gradient-${node.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" className={getNodeColor(node.data.type)} stopColor="#8b5cf6" />
                    <stop offset="100%" className={getNodeColor(node.data.type)} stopColor="#ec4899" />
                  </linearGradient>
                </defs>
                <circle
                  r={radius}
                  fill={`url(#gradient-${node.id})`}
                  stroke={hoveredNode === node.id ? '#fff' : 'none'}
                  strokeWidth="3"
                  opacity="0.9"
                />
                
                {/* Node label */}
                <text
                  textAnchor="middle"
                  dy="5"
                  fill="white"
                  fontSize={isRoot ? "14" : "12"}
                  fontWeight={isRoot ? "bold" : "normal"}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {node.data.label.length > 15 
                    ? `${node.data.label.substring(0, 15)}...` 
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