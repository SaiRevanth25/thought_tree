import { useState } from 'react';
import { ZoomIn, Clock, Plus, Minus } from 'lucide-react';
import type { VisualizationData } from '../utils/api';

interface TimelineVisualizationProps {
  data: VisualizationData | null;
}

export function TimelineVisualization({ data }: TimelineVisualizationProps) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

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
    if ((e.target as HTMLElement).tagName === 'svg') {
      setIsPanning(true);
      setStartPos({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
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

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900 rounded-lg">
        <p className="text-slate-400">No timeline data available</p>
      </div>
    );
  }

  // Handle timeline-specific structure (from TIMELINE_PROMPT)
  if ('events' in data && Array.isArray((data as any).events)) {
    const timelineData = data as any;
    const timelineNodes = timelineData.events || [];
    
    if (!Array.isArray(timelineNodes) || timelineNodes.length === 0) {
      return (
        <div className="h-full flex items-center justify-center bg-slate-900 rounded-lg">
          <p className="text-slate-400">No timeline events available</p>
        </div>
      );
    }

    const hoveredNodeData = hoveredNode ? timelineNodes.find((n: any) => n.name === hoveredNode) : null;

    const itemHeight = 160;
    const spacing = 80;
    const startX = 180;
    const startY = 80;
    const lineX = startX + 30;

    return (
      <div className="h-full relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-lg overflow-hidden">
        <div className="absolute inset-0 opacity-40">
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500 rounded-full mix-blend-screen filter blur-3xl opacity-10"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500 rounded-full mix-blend-screen filter blur-3xl opacity-10"></div>
        </div>
        
        <div className="absolute top-4 left-4 z-10 flex gap-2 flex-wrap">
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
            className="px-3 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg text-sm hover:from-purple-700 hover:to-pink-700 flex items-center gap-2 shadow-lg"
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
            {/* Draw vertical timeline line */}
            <line
              x1={lineX}
              y1={startY}
              x2={lineX}
              y2={startY + timelineNodes.length * (itemHeight + spacing)}
              stroke="#a78bfa"
              strokeWidth="6"
              opacity="0.7"
              strokeLinecap="round"
            />

            {/* Draw timeline events */}
            {timelineNodes.map((event: any, index: number) => {
              const y = startY + index * (itemHeight + spacing);
              const isHovered = hoveredNode === event.name;
              const isLeft = index % 2 === 0;

              return (
                <g key={`${event.name}-${index}`}>
                  {/* Timeline dot */}
                  <circle
                    cx={lineX}
                    cy={y + itemHeight / 2}
                    r="18"
                    fill={isHovered ? '#c084fc' : '#a78bfa'}
                    stroke="#ffffff"
                    strokeWidth="4"
                    opacity="1"
                    style={{ transition: 'all 0.2s ease' }}
                  />

                  {/* Connection line to event box */}
                  <line
                    x1={lineX}
                    y1={y + itemHeight / 2}
                    x2={isLeft ? lineX - 50 : lineX + 50}
                    y2={y + itemHeight / 2}
                    stroke="#c084fc"
                    strokeWidth="2.5"
                    opacity="0.5"
                  />

                  {/* Event box */}
                  <rect
                    x={isLeft ? lineX - 380 : lineX + 60}
                    y={y}
                    width="320"
                    height={itemHeight}
                    rx="16"
                    fill={isHovered ? '#7c3aed' : '#6d28d9'}
                    stroke={isHovered ? '#e9d5ff' : '#a78bfa'}
                    strokeWidth="3"
                    opacity="0.92"
                    onMouseEnter={() => setHoveredNode(event.name)}
                    onMouseLeave={() => setHoveredNode(null)}
                    style={{ cursor: 'pointer', transition: 'all 0.2s ease', filter: isHovered ? 'drop-shadow(0 8px 16px rgba(139, 92, 246, 0.3))' : 'none' }}
                  />

                  {/* Year badge */}
                  <circle
                    cx={isLeft ? lineX - 360 : lineX + 80}
                    cy={y + 30}
                    r="18"
                    fill="#dc2626"
                    opacity="0.95"
                  />
                  <text
                    x={isLeft ? lineX - 360 : lineX + 80}
                    y={y + 37}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="13"
                    fontWeight="bold"
                  >
                    {event.year}
                  </text>

                  {/* Event title */}
                  <text
                    x={isLeft ? lineX - 220 : lineX + 220}
                    y={y + 45}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="15"
                    fontWeight="bold"
                    style={{ pointerEvents: 'none' }}
                  >
                    {event.name}
                  </text>

                  {/* Event summary (shown on hover) */}
                  {isHovered && event.summary && (
                    <foreignObject
                      x={isLeft ? lineX - 340 : lineX + 60}
                      y={y + 10}
                      width="280"
                      height={itemHeight - 20}
                    >
                      <div className="p-2 text-xs text-gray-100 overflow-hidden">
                        <p className="font-bold">{event.summary}</p>
                      </div>
                    </foreignObject>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Tooltip */}
        {hoveredNodeData && (
          <div className="absolute bottom-4 right-4 bg-slate-800 border border-orange-500 rounded-lg p-3 max-w-xs">
            <p className="text-white font-bold">{hoveredNodeData.name} ({hoveredNodeData.year})</p>
            <p className="text-slate-300 text-sm mt-1">{hoveredNodeData.summary}</p>
            {hoveredNodeData.description && (
              <p className="text-slate-400 text-xs mt-2">{hoveredNodeData.description}</p>
            )}
          </div>
        )}
      </div>
    );
  }

  // Handle graph/mindmap structure (with nodes and edges)
  if (!data.nodes || !data.edges || data.nodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900 rounded-lg">
        <p className="text-slate-400">No timeline data available</p>
      </div>
    );
  }

  // Fallback for nodes/edges structure
  const timelineNodes = [];
  const nodeMap = new Map(data.nodes.map(n => [n.id, n]));
  
  // Find start node (node with no incoming edges)
  const targetIds = new Set(data.edges.map(e => e.target));
  const startNode = data.nodes.find(n => !targetIds.has(n.id)) || data.nodes[0];
  
  // Build timeline by following edges
  const visited = new Set<string>();
  let currentId = startNode.id;
  
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const node = nodeMap.get(currentId);
    if (node) {
      timelineNodes.push(node);
    }
    
    // Find next node
    const nextEdge = data.edges.find(e => e.source === currentId && !visited.has(e.target));
    currentId = nextEdge?.target || '';
  }

  const hoveredNodeData = hoveredNode ? data.nodes.find((n) => n.id === hoveredNode) : null;
  
  // Define dimensions for fallback rendering
  const fallbackItemHeight = 140;
  const fallbackSpacing = 60;
  const fallbackStartX = 150;
  const fallbackStartY = 100;
  const fallbackLineX = fallbackStartX + 20;

  return (
    <div className="h-full relative bg-slate-900 rounded-lg overflow-hidden">
      <div className="absolute top-4 left-4 z-10 flex gap-2 flex-wrap">
        <button 
          onClick={handleFitView} 
          className="px-3 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700 flex items-center gap-2"
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
          {/* Draw vertical timeline line */}
          <line
            x1={fallbackLineX}
            y1={fallbackStartY}
            x2={fallbackLineX}
            y2={fallbackStartY + timelineNodes.length * (fallbackItemHeight + fallbackSpacing)}
            stroke="#a78bfa"
            strokeWidth="5"
            opacity="0.65"
          />

          {/* Draw timeline events */}
          {timelineNodes.map((node, index) => {
            const y = fallbackStartY + index * (fallbackItemHeight + fallbackSpacing);
            const isHovered = hoveredNode === node.id;
            const isLeft = index % 2 === 0;

            return (
              <g key={node.id}>
                {/* Timeline dot */}
                <circle
                  cx={fallbackLineX}
                  cy={y + fallbackItemHeight / 2}
                  r="12"
                  fill={isHovered ? '#f97316' : '#ea580c'}
                  stroke="#fff"
                  strokeWidth="3"
                />

                {/* Connection line to event box */}
                <line
                  x1={fallbackLineX}
                  y1={y + fallbackItemHeight / 2}
                  x2={isLeft ? fallbackLineX - 50 : fallbackLineX + 50}
                  y2={y + fallbackItemHeight / 2}
                  stroke="#f97316"
                  strokeWidth="2"
                  opacity="0.6"
                />

                {/* Event box */}
                <rect
                  x={isLeft ? fallbackLineX - 350 : fallbackLineX + 50}
                  y={y}
                  width="300"
                  height={fallbackItemHeight}
                  rx="8"
                  fill={isHovered ? '#ea580c' : '#f97316'}
                  stroke={isHovered ? '#fff' : '#c2410c'}
                  strokeWidth="2"
                  opacity="0.9"
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  style={{ cursor: 'pointer' }}
                />

                {/* Event number badge */}
                <circle
                  cx={isLeft ? fallbackLineX - 330 : fallbackLineX + 70}
                  cy={y + 25}
                  r="15"
                  fill="#c2410c"
                />
                <text
                  x={isLeft ? fallbackLineX - 330 : fallbackLineX + 70}
                  y={y + 25}
                  textAnchor="middle"
                  dy="5"
                  fill="white"
                  fontSize="12"
                  fontWeight="bold"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {index + 1}
                </text>

                {/* Event title */}
                <text
                  x={isLeft ? fallbackLineX - 185 : fallbackLineX + 200}
                  y={y + 35}
                  textAnchor="middle"
                  fill="white"
                  fontSize="14"
                  fontWeight="bold"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {node.data.label.length > 30
                    ? `${node.data.label.substring(0, 30)}...`
                    : node.data.label}
                </text>

                {/* Event description */}
                {node.data.summary && (
                  <text
                    x={isLeft ? fallbackLineX - 185 : fallbackLineX + 200}
                    y={y + 60}
                    textAnchor="middle"
                    fill="white"
                    fontSize="11"
                    opacity="0.9"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {node.data.summary.length > 40
                      ? `${node.data.summary.substring(0, 40)}...`
                      : node.data.summary}
                  </text>
                )}

                {/* Clock icon */}
                <g transform={`translate(${isLeft ? fallbackLineX - 320 : fallbackLineX + 80}, ${y + 70})`}>
                  <circle r="8" fill="#c2410c" />
                  <text
                    textAnchor="middle"
                    dy="3"
                    fill="white"
                    fontSize="10"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    ⏱
                  </text>
                </g>
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
          <div>Events: {timelineNodes.length}</div>
          <div>Zoom: {Math.round(scale * 100)}%</div>
        </div>
      </div>
    </div>
  );
}