import { useState } from 'react';
import { ZoomIn, ArrowRight } from 'lucide-react';
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
    const activations = sequenceData.activations || [];
    const fragments = sequenceData.fragments || [];
    
    if (participants.length === 0 || events.length === 0) {
      return (
        <div className="h-full flex items-center justify-center bg-slate-900 rounded-lg">
          <p className="text-slate-400">No sequence diagram data available</p>
        </div>
      );
    }

    // Calculate dynamic spacing based on participant labels
    const calculateLabelWidth = (label: string) => label.length * 7;
    const maxLabelWidth = Math.max(...participants.map((p: any) => calculateLabelWidth(p.label)));
    const boxWidth = Math.max(160, maxLabelWidth + 40);
    const boxHeight = 60;
    const topSpacing = 100;
    const eventSpacing = 70;
    const participantSpacing = Math.max(180, boxWidth + 40);
    const startX = 80;
    const startY = topSpacing;
    const lifelineEndY = startY + boxHeight + (events.length * eventSpacing) + 100;

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
            <marker
              id="seq-arrowhead-open"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <path d="M 0 0 L 10 3 L 0 6" fill="none" stroke="#10b981" strokeWidth="2" />
            </marker>
          </defs>

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
            {/* Draw participant boxes at top */}
            {participants.map((participant: any, index: number) => {
              const x = startX + index * participantSpacing;
              const y = startY;
              const isActor = participant.type === 'Actor';
              const participantX = x + boxWidth / 2;

              return (
                <g key={participant.id}>
                  {/* Participant lifeline going down */}
                  <line
                    x1={participantX}
                    y1={y + boxHeight}
                    x2={participantX}
                    y2={lifelineEndY}
                    stroke="#10b981"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    opacity="0.6"
                  />

                  {/* Participant box */}
                  <rect
                    x={x}
                    y={y}
                    width={boxWidth}
                    height={boxHeight}
                    rx="4"
                    fill={isActor ? '#06b6d4' : '#10b981'}
                    stroke="#fff"
                    strokeWidth="2"
                  />

                  {/* Participant label */}
                  <text
                    x={x + boxWidth / 2}
                    y={y + boxHeight / 2 + 5}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="12"
                    fontWeight="bold"
                    style={{ pointerEvents: 'none' }}
                  >
                    {participant.label}
                  </text>
                </g>
              );
            })}

            {/* Draw fragments (alt, loop, opt boxes) */}
            {fragments.map((fragment: any) => {
              const startEvent = events.find((e: any) => e.step === fragment.startStep);
              const endEvent = events.find((e: any) => e.step === fragment.endStep);
              
              if (!startEvent || !endEvent) return null;

              const fragmentStartY = startY + boxHeight + ((startEvent.step - 1) * eventSpacing) + 30;
              const fragmentEndY = startY + boxHeight + ((endEvent.step - 1) * eventSpacing) + 30;
              const fragmentHeight = fragmentEndY - fragmentStartY;
              
              // Find leftmost and rightmost participants involved
              const involvedParticipants = new Set<string>();
              events.forEach((e: any) => {
                if (e.step >= fragment.startStep && e.step <= fragment.endStep) {
                  involvedParticipants.add(e.source);
                  involvedParticipants.add(e.target);
                }
              });
              
              const participantIndices = Array.from(involvedParticipants).map((pid: string) => 
                participants.findIndex((p: any) => p.id === pid)
              ).filter(idx => idx >= 0);
              
              if (participantIndices.length === 0) return null;
              
              const leftmostX = startX + Math.min(...participantIndices) * participantSpacing;
              const rightmostX = startX + Math.max(...participantIndices) * participantSpacing + boxWidth;
              const fragmentWidth = rightmostX - leftmostX;

              const fragmentColors: Record<string, string> = {
                alt: '#f59e0b',
                loop: '#8b5cf6',
                opt: '#06b6d4'
              };
              const fragmentColor = fragmentColors[fragment.type] || '#64748b';

              return (
                <g key={`fragment-${fragment.startStep}-${fragment.endStep}`}>
                  {/* Fragment box */}
                  <rect
                    x={leftmostX}
                    y={fragmentStartY - 20}
                    width={fragmentWidth}
                    height={fragmentHeight + 40}
                    fill="none"
                    stroke={fragmentColor}
                    strokeWidth="2"
                    opacity="0.3"
                  />
                  {/* Fragment label */}
                  <text
                    x={leftmostX + 10}
                    y={fragmentStartY - 5}
                    fill={fragmentColor}
                    fontSize="11"
                    fontWeight="bold"
                    style={{ pointerEvents: 'none' }}
                  >
                    {fragment.type.toUpperCase()}: {fragment.label || fragment.condition}
                  </text>
                </g>
              );
            })}

            {/* Draw activation bars */}
            {activations.map((activation: any) => {
              const participant = participants.find((p: any) => p.id === activation.participant);
              if (!participant) return null;

              const participantIndex = participants.indexOf(participant);
              const participantX = startX + participantIndex * participantSpacing + boxWidth / 2;
              
              const startEvent = events.find((e: any) => e.step === activation.startStep);
              const endEvent = events.find((e: any) => e.step === activation.endStep);
              
              if (!startEvent || !endEvent) return null;

              const activationStartY = startY + boxHeight + ((startEvent.step - 1) * eventSpacing) + 30;
              const activationEndY = startY + boxHeight + ((endEvent.step - 1) * eventSpacing) + 30;
              const activationWidth = 8;

              return (
                <rect
                  key={`activation-${activation.participant}-${activation.startStep}`}
                  x={participantX - activationWidth / 2}
                  y={activationStartY}
                  width={activationWidth}
                  height={activationEndY - activationStartY}
                  fill="#10b981"
                  opacity="0.6"
                />
              );
            })}

            {/* Draw sequence events */}
            {events.map((event: any, index: number) => {
              const sourceParticipant = participants.find((p: any) => p.id === event.source);
              const targetParticipant = participants.find((p: any) => p.id === event.target);
              
              if (!sourceParticipant || !targetParticipant) return null;

              const sourceIndex = participants.indexOf(sourceParticipant);
              const targetIndex = participants.indexOf(targetParticipant);
              
              const x1 = startX + sourceIndex * participantSpacing + boxWidth / 2;
              const x2 = startX + targetIndex * participantSpacing + boxWidth / 2;
              const y = startY + boxHeight + ((event.step - 1) * eventSpacing) + 30;

              const isHovered = hoveredNode === event.id;
              const isReturn = event.lineType === 'dotted' || event.arrowType === 'open_arrow';
              const isSelfMessage = sourceIndex === targetIndex;

              return (
                <g key={event.id || `event-${event.step}`}>
                  {isSelfMessage ? (
                    // Self message (loop back)
                    <g>
                      <path
                        d={`M ${x1} ${y} Q ${x1 + 30} ${y - 20} ${x1} ${y - 20} Q ${x1 - 30} ${y - 20} ${x1} ${y}`}
                        fill="none"
                        stroke={isHovered ? '#fbbf24' : '#10b981'}
                        strokeWidth={isHovered ? 3 : 2}
                        strokeDasharray={isReturn ? "5,5" : "none"}
                        markerEnd={isReturn ? "url(#seq-arrowhead-open)" : "url(#seq-arrowhead)"}
                      />
                      <text
                        x={x1 + 35}
                        y={y - 25}
                        fill={isHovered ? '#fbbf24' : '#10b981'}
                        fontSize="12"
                        fontWeight="bold"
                        onMouseEnter={() => setHoveredNode(event.id || `event-${event.step}`)}
                        onMouseLeave={() => setHoveredNode(null)}
                        style={{ cursor: 'pointer' }}
                      >
                        {event.label}
                      </text>
                    </g>
                  ) : (
                    // Regular message
                    <g>
                      <line
                        x1={x1}
                        y1={y}
                        x2={x2}
                        y2={y}
                        stroke={isHovered ? '#fbbf24' : '#10b981'}
                        strokeWidth={isHovered ? 3 : 2}
                        strokeDasharray={isReturn ? "5,5" : "none"}
                        markerEnd={isReturn ? "url(#seq-arrowhead-open)" : "url(#seq-arrowhead)"}
                      />
                      <text
                        x={(x1 + x2) / 2}
                        y={y - 8}
                        textAnchor="middle"
                        fill={isHovered ? '#fbbf24' : '#10b981'}
                        fontSize="12"
                        fontWeight="bold"
                        onMouseEnter={() => setHoveredNode(event.id || `event-${event.step}`)}
                        onMouseLeave={() => setHoveredNode(null)}
                        style={{ cursor: 'pointer' }}
                      >
                        {event.label}
                      </text>
                    </g>
                  )}
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
  const fallbackBoxWidth = 160;
  const fallbackBoxHeight = 60;
  const fallbackTopSpacing = 100;
  const fallbackEventSpacing = 60;
  const fallbackStartX = 80;
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
                  width={boxWidth}
                  height={boxHeight}
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