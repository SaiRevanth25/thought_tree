import { Network, Workflow, GitBranch, Clock } from 'lucide-react';
import type { StructureType } from '../types';

interface StructureSelectorProps {
  selectedType: StructureType;
  onSelect: (type: StructureType) => void;
  disabled?: boolean;
}

const structures: {
  type: StructureType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}[] = [
  { type: 'mindmap', label: 'Mind Map', icon: Network, color: 'from-blue-500 to-cyan-500' },
  { type: 'graph', label: 'Graph', icon: GitBranch, color: 'from-purple-500 to-pink-500' },
  { type: 'sequence', label: 'Sequence', icon: Workflow, color: 'from-green-500 to-emerald-500' },
  { type: 'timeline', label: 'Timeline', icon: Clock, color: 'from-orange-500 to-red-500' },
];

export function StructureSelector({ selectedType, onSelect, disabled }: StructureSelectorProps) {
  return (
    <div className="flex gap-3 flex-wrap">
      {structures.map(({ type, label, icon: Icon, color }) => (
        <button
          key={type}
          onClick={() => onSelect(type)}
          disabled={disabled}
          className={`
            flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all duration-200
            ${
              selectedType === type
                ? `bg-gradient-to-r ${color} text-white shadow-lg scale-105`
                : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 hover:scale-102'
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          <Icon className="w-5 h-5" />
          {label}
        </button>
      ))}
    </div>
  );
}
