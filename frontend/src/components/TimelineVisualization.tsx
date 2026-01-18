import { useState } from 'react';
import { ZoomIn, Clock } from 'lucide-react';
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

    // Calculate dynamic spacing and sizing based on content
    const calculateContentHeight = (event: any) => {
      const nameHeight = 20;
      const summaryHeight = event.summary ? 40 : 0;
      const descriptionHeight = event.description ? 30 : 0;
      const padding = 40;
      return Math.max(100, nameHeight + summaryHeight + descriptionHeight + padding);
    };

    const eventHeights = timelineNodes.map((event: any) => calculateContentHeight(event));
    const maxEventHeight = Math.max(...eventHeights, 100);
    const baseSpacing = 50;
    const adaptiveSpacing = baseSpacing + (timelineNodes.length > 10 ? 10 : 0);
    
    const itemHeight = maxEventHeight;
    const spacing = adaptiveSpacing;
    const startX = 200;
    const startY = 80;
    const lineX = startX + 30;
    const boxWidth = 320;
    const boxOffset = 60;

    // Calculate cumulative Y positions to avoid overlaps
    const eventPositions = timelineNodes.map((event: any, index: number) => {
      const eventHeight = eventHeights[index];
      const previousY = index === 0 ? startY : eventPositions[index - 1].y + eventPositions[index - 1].height + spacing;
      return {
        y: previousY,
        height: eventHeight,
        isLeft: index % 2 === 0
      };
    });

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
              x1={lineX}
              y1={startY}
              x2={lineX}
              y2={eventPositions.length > 0 
                ? eventPositions[eventPositions.length - 1].y + eventPositions[eventPositions.length - 1].height + 20
                : startY + 100}
              stroke="#f97316"
              strokeWidth="4"
              opacity="0.6"
            />

            {/* Draw timeline events */}
            {timelineNodes.map((event: any, index: number) => {
              const position = eventPositions[index];
              const y = position.y;
              const eventHeight = position.height;
              const isHovered = hoveredNode === event.name;
              const isLeft = position.isLeft;

              return (
                <g key={`${event.name}-${index}`}>
                  {/* Timeline dot */}
                  <circle
                    cx={lineX}
                    cy={y + eventHeight / 2}
                    r="12"
                    fill={isHovered ? '#f97316' : '#ea580c'}
                    stroke="#fff"
                    strokeWidth="3"
                  />

                  {/* Connection line to event box */}
                  <line
                    x1={lineX}
                    y1={y + eventHeight / 2}
                    x2={isLeft ? lineX - boxOffset : lineX + boxOffset}
                    y2={y + eventHeight / 2}
                    stroke="#f97316"
                    strokeWidth="2"
                    opacity="0.6"
                  />

                  {/* Event box */}
                  <rect
                    x={isLeft ? lineX - boxWidth - boxOffset : lineX + boxOffset}
                    y={y}
                    width={boxWidth}
                    height={eventHeight}
                    rx="8"
                    fill={isHovered ? '#ea580c' : '#f97316'}
                    stroke={isHovered ? '#fff' : '#c2410c'}
                    strokeWidth="2"
                    opacity="0.9"
                    onMouseEnter={() => setHoveredNode(event.name)}
                    onMouseLeave={() => setHoveredNode(null)}
                    style={{ cursor: 'pointer' }}
                  />

                  {/* Year/era badge */}
                  <circle
                    cx={isLeft ? lineX - boxWidth - boxOffset + 25 : lineX + boxOffset + 25}
                    cy={y + 25}
                    r="16"
                    fill="#c2410c"
                  />
                  <text
                    x={isLeft ? lineX - boxWidth - boxOffset + 25 : lineX + boxOffset + 25}
                    y={y + 32}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="11"
                    fontWeight="bold"
                    style={{ pointerEvents: 'none' }}
                  >
                    {event.year || event.era || (index + 1)}
                  </text>

                  {/* Event title */}
                  <text
                    x={isLeft ? lineX - boxWidth / 2 - boxOffset : lineX + boxWidth / 2 + boxOffset}
                    y={y + 55}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="15"
                    fontWeight="bold"
                    style={{ pointerEvents: 'none' }}
                  >
                    {event.name.length > 35
                      ? `${event.name.substring(0, 35)}...`
                      : event.name}
                  </text>

                  {/* Event summary */}
                  {event.summary && (
                    <foreignObject
                      x={isLeft ? lineX - boxWidth - boxOffset + 15 : lineX + boxOffset + 15}
                      y={y + 70}
                      width={boxWidth - 30}
                      height={eventHeight - 80}
                    >
                      <div className="text-xs text-gray-100 leading-relaxed">
                        <p className="font-semibold mb-1">{event.summary}</p>
                        {event.description && (
                          <p className="text-gray-300 text-xs">{event.description}</p>
                        )}
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
  const fallbackItemHeight = 120;
  const fallbackSpacing = 40;
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
            stroke="#f97316"
            strokeWidth="4"
            opacity="0.6"
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