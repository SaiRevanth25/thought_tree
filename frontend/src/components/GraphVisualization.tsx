import { useEffect, useState } from 'react';
import { Maximize2, Minimize2, ZoomIn } from 'lucide-react';
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
    const width = 1200;
    const height = 800;
    const padding = 120;

    // Check if graph is hierarchical (knowledge graph structure)
    const rootNode = data.nodes.find(n => n.data.type === 'root' || n.data.type === 'data');
    const hasHierarchy = rootNode !== undefined;
    
    // Build hierarchy maps
    const childrenMap: Record<string, string[]> = {};
    const parentMap: Record<string, string> = {};
    const nodeDepths: Record<string, number> = {};
    
    data.edges.forEach(edge => {
      if (!childrenMap[edge.source]) {
        childrenMap[edge.source] = [];
      }
      childrenMap[edge.source].push(edge.target);
      parentMap[edge.target] = edge.source;
    });

    // If hierarchical, use tree layout
    if (hasHierarchy && rootNode) {
      // Calculate depths
      const calculateDepths = (nodeId: string, depth: number) => {
        nodeDepths[nodeId] = depth;
        const children = childrenMap[nodeId] || [];
        children.forEach(childId => {
          calculateDepths(childId, depth + 1);
        });
      };
      calculateDepths(rootNode.id, 0);

      // Find max depth
      const maxDepth = Math.max(...Object.values(nodeDepths));
      const levelHeight = maxDepth > 0 ? (height - 2 * padding) / maxDepth : height - 2 * padding;

      // Tree layout: position nodes by level
      const levelNodes: Record<number, string[]> = {};
      Object.entries(nodeDepths).forEach(([nodeId, depth]) => {
        if (!levelNodes[depth]) {
          levelNodes[depth] = [];
        }
        levelNodes[depth].push(nodeId);
      });

      // Position nodes level by level
      Object.entries(levelNodes).forEach(([depthStr, nodeIds]) => {
        const depth = parseInt(depthStr);
        const levelY = padding + depth * levelHeight;
        const levelWidth = width - 2 * padding;
        const nodeSpacing = levelWidth / (nodeIds.length + 1);

        nodeIds.forEach((nodeId, index) => {
          positions[nodeId] = {
            x: padding + (index + 1) * nodeSpacing,
            y: levelY
          };
        });
      });

      // Adjust for better spacing - center children under parents
      const adjustPositions = (nodeId: string) => {
        const children = childrenMap[nodeId] || [];
        if (children.length === 0) return;

        const parentX = positions[nodeId].x;
        const childrenX = children.reduce((sum, childId) => sum + positions[childId].x, 0) / children.length;
        const offset = parentX - childrenX;

        children.forEach(childId => {
          positions[childId].x += offset;
          adjustPositions(childId);
        });
      };

      // Adjust positions to center children under parents
      if (rootNode) {
        adjustPositions(rootNode.id);
      }
    } else {
      // Force-directed layout for non-hierarchical graphs
      const minDistance = 80;
      const repulsionStrength = 2000;
      const attractionStrength = 0.02;
      const maxIterations = 300;
      const convergenceThreshold = 0.01;

      // Initialize positions in a circle
      data.nodes.forEach((node, index) => {
        const angle = (index / data.nodes.length) * 2 * Math.PI;
        const radius = Math.min(width, height) * 0.3;
        positions[node.id] = {
          x: width / 2 + Math.cos(angle) * radius,
          y: height / 2 + Math.sin(angle) * radius
        };
      });

      // Force-directed simulation with convergence detection
      let previousMaxForce = Infinity;
      
      for (let iteration = 0; iteration < maxIterations; iteration++) {
        const forces: Record<string, { x: number; y: number }> = {};
        
        // Initialize forces
        data.nodes.forEach(node => {
          forces[node.id] = { x: 0, y: 0 };
        });

        // Repulsive forces between all nodes
        data.nodes.forEach((node1, i) => {
          data.nodes.forEach((node2, j) => {
            if (i >= j) return;
            
            const pos1 = positions[node1.id];
            const pos2 = positions[node2.id];
            const dx = pos2.x - pos1.x;
            const dy = pos2.y - pos1.y;
            const distance = Math.sqrt(dx * dx + dy * dy) || 0.1;
            
            // Only apply repulsion if nodes are too close
            if (distance < minDistance * 2) {
              const force = repulsionStrength / (distance * distance);
              const unitX = dx / distance;
              const unitY = dy / distance;
              
              forces[node1.id].x -= unitX * force;
              forces[node1.id].y -= unitY * force;
              forces[node2.id].x += unitX * force;
              forces[node2.id].y += unitY * force;
            }
          });
        });

        // Attractive forces along edges
        data.edges.forEach(edge => {
          const pos1 = positions[edge.source];
          const pos2 = positions[edge.target];
          if (!pos1 || !pos2) return;
          
          const dx = pos2.x - pos1.x;
          const dy = pos2.y - pos1.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 0.1;
          const idealDistance = minDistance * 1.5;
          const force = (distance - idealDistance) * attractionStrength;
          const unitX = dx / distance;
          const unitY = dy / distance;
          
          forces[edge.source].x += unitX * force;
          forces[edge.source].y += unitY * force;
          forces[edge.target].x -= unitX * force;
          forces[edge.target].y -= unitY * force;
        });

        // Calculate cooling factor (simulated annealing)
        const coolingFactor = 1 - (iteration / maxIterations) * 0.9;
        const stepSize = 0.1 * coolingFactor;

        // Apply forces and calculate max force for convergence
        let maxForce = 0;
        data.nodes.forEach(node => {
          const forceX = forces[node.id].x;
          const forceY = forces[node.id].y;
          const forceMagnitude = Math.sqrt(forceX * forceX + forceY * forceY);
          maxForce = Math.max(maxForce, forceMagnitude);

          positions[node.id].x += forceX * stepSize;
          positions[node.id].y += forceY * stepSize;
          
          // Keep within bounds
          positions[node.id].x = Math.max(padding, Math.min(width - padding, positions[node.id].x));
          positions[node.id].y = Math.max(padding, Math.min(height - padding, positions[node.id].y));
        });

        // Check for convergence
        if (iteration > 50 && Math.abs(previousMaxForce - maxForce) < convergenceThreshold) {
          break;
        }
        previousMaxForce = maxForce;
      }
    }

    setNodePositions(positions);
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
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill="#64748b" />
          </marker>
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
            const radius = 40;
            
            const endX = targetPos.x - unitX * radius;
            const endY = targetPos.y - unitY * radius;

            return (
              <line
                key={edge.id}
                x1={sourcePos.x}
                y1={sourcePos.y}
                x2={endX}
                y2={endY}
                stroke="#64748b"
                strokeWidth="2"
                opacity="0.6"
                markerEnd="url(#arrowhead)"
              />
            );
          })}

          {/* Draw nodes */}
          {data.nodes.map((node) => {
            const pos = nodePositions[node.id];
            if (!pos) return null;

            const isRoot = node.data.type === 'root';
            const radius = 40;

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
                  fill={isRoot ? '#8b5cf6' : node.data.type === 'category' ? '#3b82f6' : '#10b981'}
                  stroke={hoveredNode === node.id ? '#fff' : '#1e293b'}
                  strokeWidth="3"
                  opacity="0.9"
                />
                
                {/* Node label */}
                <text
                  textAnchor="middle"
                  dy="5"
                  fill="white"
                  fontSize="12"
                  fontWeight={isRoot ? "bold" : "normal"}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {node.data.label.length > 12 
                    ? `${node.data.label.substring(0, 12)}...` 
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