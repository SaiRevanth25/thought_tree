import { useState } from 'react';
import { ZoomIn, ArrowRight, Plus, Minus } from 'lucide-react';
import type { VisualizationData } from '../utils/api';

interface SequenceVisualizationProps {
  data: VisualizationData | null;
}

export function SequenceVisualization({ data }: SequenceVisualizationProps) {
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
        <p className="text-slate-400">No sequence data available</p>
      </div>
    );
  }

  // Handle sequence diagram structure (from SEQUENCE_PROMPT)
  if ('participants' in data && Array.isArray((data as any).participants)) {
    const sequenceData = data as any;
    const participants = sequenceData.participants || [];
    const events = sequenceData.events || [];
    
    if (participants.length === 0 || events.length === 0) {
      return (
        <div className="h-full flex items-center justify-center bg-slate-900 rounded-lg">
          <p className="text-slate-400">No sequence diagram data available</p>
        </div>
      );
    }

    const boxWidth = 200;
    const boxHeight = 90;
    const topSpacing = 140;
    const eventSpacing = 90;
    const startX = 100;
    const startY = topSpacing;

    return (
      <div className="h-full relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-lg overflow-hidden">
        <div className="absolute inset-0 opacity-40">
          <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500 rounded-full mix-blend-screen filter blur-3xl opacity-10"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-cyan-500 rounded-full mix-blend-screen filter blur-3xl opacity-10"></div>
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
            <marker
              id="seq-arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 10 3, 0 6" fill="#0ea5e9" />
            </marker>
            <filter id="seq-shadow">
              <feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity="0.3" />
            </filter>
          </defs>

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
            {/* Draw participant boxes at top */}
            {participants.map((participant: any, index: number) => {
              const x = startX + index * (boxWidth + 50);
              const y = startY;
              const isActor = participant.type === 'Actor';

              return (
                <g key={participant.id}>
                  {/* Participant line going down */}
                  <line
                    x1={x + boxWidth / 2}
                    y1={y + boxHeight}
                    x2={x + boxWidth / 2}
                    y2={startY + (events.length * eventSpacing) + 60}
                    stroke="#0ea5e9"
                    strokeWidth="2.5"
                    strokeDasharray="10,5"
                    opacity="0.4"
                  />

                  {/* Participant box */}
                  <rect
                    x={x}
                    y={y}
                    width={boxWidth}
                    height={boxHeight}
                    rx="12"
                    fill={isActor ? '#0369a1' : '#0ea5e9'}
                    stroke={isActor ? '#06b6d4' : '#0ea5e9'}
                    strokeWidth="3"
                    opacity="0.95"
                    filter="url(#seq-shadow)"
                  />

                  {/* Participant label */}
                  <text
                    x={x + boxWidth / 2}
                    y={y + boxHeight / 2 + 8}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="15"
                    fontWeight="700"
                    style={{ pointerEvents: 'none' }}
                  >
                    {participant.label}
                  </text>
                </g>
              );
            })}

            {/* Draw sequence events */}
            {events.map((event: any, index: number) => {
              const sourceParticipant = participants.find((p: any) => p.id === event.source);
              const targetParticipant = participants.find((p: any) => p.id === event.target);
              
              if (!sourceParticipant || !targetParticipant) return null;

              const sourceIndex = participants.indexOf(sourceParticipant);
              const targetIndex = participants.indexOf(targetParticipant);
              
              const x1 = startX + sourceIndex * (boxWidth + 50) + boxWidth / 2;
              const x2 = startX + targetIndex * (boxWidth + 50) + boxWidth / 2;
              const y = startY + boxHeight + (index * eventSpacing) + 30;

              const isHovered = hoveredNode === event.id;

              return (
                <g key={event.id}>
                  {/* Arrow */}
                  <line
                    x1={Math.min(x1, x2)}
                    y1={y}
                    x2={Math.max(x1, x2)}
                    y2={y}
                    stroke={isHovered ? '#06b6d4' : '#0ea5e9'}
                    strokeWidth={isHovered ? 4 : 3.5}
                    markerEnd="url(#seq-arrowhead)"
                    opacity={isHovered ? 0.95 : 0.7}
                    style={{ transition: 'all 0.2s ease' }}
                  />

                  {/* Event label background */}
                  <rect
                    x={(x1 + x2) / 2 - 70}
                    y={y - 28}
                    width="140"
                    height="24"
                    rx="6"
                    fill={isHovered ? '#0369a1' : '#0ea5e9'}
                    opacity={isHovered ? '0.95' : '0.8'}
                  />

                  {/* Event label */}
                  <text
                    x={(x1 + x2) / 2}
                    y={y - 10}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="13"
                    fontWeight="700"
                    onMouseEnter={() => setHoveredNode(event.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    style={{ cursor: 'pointer', pointerEvents: 'none' }}
                  >
                    {event.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Tooltip */}
        {hoveredNode && (
          <div className="absolute bottom-4 right-4 bg-slate-800 border border-green-500 rounded-lg p-3 max-w-xs">
            <p className="text-white font-bold">{hoveredNode}</p>
            <p className="text-slate-300 text-sm mt-1">Sequence event</p>
          </div>
        )}
      </div>
    );
  }

  // Handle graph/mindmap structure (with nodes and edges)
  if (!data.nodes || !data.edges || data.nodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900 rounded-lg">
        <p className="text-slate-400">No sequence data available</p>
      </div>
    );
  }

  // Fallback for nodes/edges structure
  const sequenceNodes = [];
  const nodeMap = new Map(data.nodes.map(n => [n.id, n]));
  
  // Find root/start node
  const targetIds = new Set(data.edges.map(e => e.target));
  const startNode = data.nodes.find(n => !targetIds.has(n.id)) || data.nodes[0];
  
  // Build sequence by following edges
  const visited = new Set<string>();
  let currentId = startNode.id;
  
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const node = nodeMap.get(currentId);
    if (node) {
      sequenceNodes.push(node);
    }
    
    // Find next node
    const nextEdge = data.edges.find(e => e.source === currentId && !visited.has(e.target));
    currentId = nextEdge?.target || '';
  }

  const hoveredNodeData = hoveredNode ? data.nodes.find((n) => n.id === hoveredNode) : null;
  
  // Define dimensions for fallback rendering
  const fallbackBoxWidth = 180;
  const fallbackBoxHeight = 75;
  const fallbackTopSpacing = 120;
  const fallbackEventSpacing = 75;
  const fallbackStartX = 120;
  const fallbackStartY = fallbackTopSpacing;

  return (
    <div className="h-full relative bg-slate-900 rounded-lg overflow-hidden">
      <div className="absolute top-4 left-4 z-10 flex gap-2 flex-wrap">
        <button 
          onClick={handleFitView} 
          className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 flex items-center gap-2"
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
            id="seq-arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill="#10b981" />
          </marker>
        </defs>

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
          {/* Draw sequence boxes and arrows */}
          {sequenceNodes.map((node, index) => {
            const x = fallbackStartX + index * (fallbackBoxWidth + 50);
            const y = fallbackStartY;
            const isHovered = hoveredNode === node.id;

            return (
              <g key={node.id}>
                {/* Arrow to next step */}
                {index < sequenceNodes.length - 1 && (
                  <line
                    x1={x + fallbackBoxWidth}
                    y1={y + fallbackBoxHeight / 2}
                    x2={x + fallbackBoxWidth + 50}
                    y2={y + fallbackBoxHeight / 2}
                    stroke="#10b981"
                    strokeWidth="3"
                    markerEnd="url(#seq-arrowhead)"
                  />
                )}

                {/* Step box */}
                <rect
                  x={x}
                  y={y}
                  width={fallbackBoxWidth}
                  height={fallbackBoxHeight}
                  rx="8"
                  fill={isHovered ? '#059669' : '#10b981'}
                  stroke={isHovered ? '#fff' : '#047857'}
                  strokeWidth="2"
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  style={{ cursor: 'pointer' }}
                />

                {/* Step number */}
                <circle
                  cx={x + 20}
                  cy={y + 20}
                  r="12"
                  fill="#047857"
                />
                <text
                  x={x + 20}
                  y={y + 20}
                  textAnchor="middle"
                  dy="4"
                  fill="white"
                  fontSize="12"
                  fontWeight="bold"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {index + 1}
                </text>

                {/* Step label */}
                <text
                  x={x + fallbackBoxWidth / 2}
                  y={y + fallbackBoxHeight / 2}
                  textAnchor="middle"
                  dy="5"
                  fill="white"
                  fontSize="14"
                  fontWeight="600"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {node.data.label.length > 20
                    ? `${node.data.label.substring(0, 20)}...`
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
          <div>Steps: {sequenceNodes.length}</div>
          <div>Zoom: {Math.round(scale * 100)}%</div>
        </div>
      </div>
    </div>
  );
}