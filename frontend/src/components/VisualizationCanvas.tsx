import { MindmapVisualization } from './MindmapVisualization';
import { GraphVisualization } from './GraphVisualization';
import { SequenceVisualization } from './SequenceVisualization';
import { TimelineVisualization } from './TimelineVisualization';
import type { VisualizationData } from '../utils/api';
import type { StructureType } from '../types';

interface VisualizationCanvasProps {
  data: VisualizationData | null;
  structureType: StructureType;
}

export function VisualizationCanvas({ data, structureType }: VisualizationCanvasProps) {
  console.log('VisualizationCanvas rendering:', { structureType, hasData: !!data, nodeCount: data?.nodes?.length });
  
  switch (structureType) {
    case 'mindmap':
      return <MindmapVisualization data={data} />;
    case 'graph':
      return <GraphVisualization data={data} />;
    case 'sequence':
      return <SequenceVisualization data={data} />;
    case 'timeline':
      return <TimelineVisualization data={data} />;
    default:
      return <MindmapVisualization data={data} />;
  }
}