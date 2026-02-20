import React, { useState, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { ChevronDown, Building2, Globe, MapPin } from 'lucide-react';

export type TenantLevel = 'CONTINENTAL' | 'REC' | 'MEMBER_STATE';

export interface TenantNode {
  id: string;
  name: string;
  code: string;
  level: TenantLevel;
  children?: TenantNode[];
}

export interface TenantSelectorProps {
  tenants: TenantNode[];
  selectedId?: string;
  onSelect: (tenantId: string, tenant: TenantNode) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const LEVEL_ICON: Record<TenantLevel, React.ReactNode> = {
  CONTINENTAL: <Globe className="h-4 w-4 text-aris-primary-600" />,
  REC: <Building2 className="h-4 w-4 text-aris-secondary-600" />,
  MEMBER_STATE: <MapPin className="h-4 w-4 text-aris-accent-600" />,
};

const LEVEL_LABEL: Record<TenantLevel, string> = {
  CONTINENTAL: 'Continental',
  REC: 'REC',
  MEMBER_STATE: 'Member State',
};

function findTenantById(nodes: TenantNode[], id: string): TenantNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findTenantById(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

export const TenantSelector: React.FC<TenantSelectorProps> = ({
  tenants,
  selectedId,
  onSelect,
  placeholder = 'Select tenant...',
  className,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const selectedTenant = selectedId ? findTenantById(tenants, selectedId) : undefined;

  const toggleExpand = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelect = useCallback(
    (tenant: TenantNode) => {
      onSelect(tenant.id, tenant);
      setIsOpen(false);
    },
    [onSelect],
  );

  const renderNode = (node: TenantNode, depth: number = 0): React.ReactNode => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const isSelected = node.id === selectedId;

    return (
      <div key={node.id}>
        <div
          data-testid={`tenant-option-${node.id}`}
          role="option"
          aria-selected={isSelected}
          className={cn(
            'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50',
            isSelected && 'bg-aris-primary-50 text-aris-primary-600 font-medium',
          )}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
          onClick={() => handleSelect(node)}
        >
          {hasChildren && (
            <button
              data-testid={`expand-${node.id}`}
              onClick={(e) => toggleExpand(node.id, e)}
              className="rounded p-0.5 hover:bg-gray-200"
              aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${node.name}`}
            >
              <ChevronDown
                className={cn('h-3 w-3 transition-transform', isExpanded && 'rotate-180')}
              />
            </button>
          )}
          {!hasChildren && <span className="w-4" />}
          {LEVEL_ICON[node.level]}
          <span>{node.name}</span>
          <span className="ml-auto text-xs text-gray-400">{node.code}</span>
        </div>
        {hasChildren && isExpanded && node.children!.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div data-testid="tenant-selector" className={cn('relative', className)}>
      <button
        data-testid="tenant-trigger"
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm',
          'hover:border-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <span className="flex items-center gap-2">
          {selectedTenant ? (
            <>
              {LEVEL_ICON[selectedTenant.level]}
              <span>{selectedTenant.name}</span>
              <span className="text-xs text-gray-400">({LEVEL_LABEL[selectedTenant.level]})</span>
            </>
          ) : (
            <span className="text-gray-400">{placeholder}</span>
          )}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div
          data-testid="tenant-dropdown"
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {tenants.map((tenant) => renderNode(tenant))}
        </div>
      )}
    </div>
  );
};
