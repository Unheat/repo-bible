/**
 * Recursive file tree component for hierarchical sidebar navigation.
 * Supports folder expand/collapse, file selection, and VS Code-like styling.
 */

import { useState, useCallback, memo } from 'react';
import type { TreeNode } from '../utils/fileTree';
import { getFileIcon } from '../utils/fileTree';
import type { FileSummary } from '../../../shared/types/api';

interface SidebarTreeProps {
  nodes: TreeNode[];
  selectedFileId: string | null;
  onSelectFile: (file: FileSummary) => void;
  depth?: number;
}

/**
 * Main tree component - renders a list of nodes recursively
 */
export default function SidebarTree({
  nodes,
  selectedFileId,
  onSelectFile,
  depth = 0,
}: SidebarTreeProps) {
  return (
    <div role="tree" aria-label="File tree">
      {nodes.map((node) => (
        <TreeNodeComponent
          key={node.path}
          node={node}
          selectedFileId={selectedFileId}
          onSelectFile={onSelectFile}
          depth={depth}
        />
      ))}
    </div>
  );
}

/**
 * Individual tree node - can be a file or folder
 * Memoized to prevent unnecessary re-renders when other nodes change
 */
const TreeNodeComponent = memo(function TreeNodeComponent({
  node,
  selectedFileId,
  onSelectFile,
  depth,
}: {
  node: TreeNode;
  selectedFileId: string | null;
  onSelectFile: (file: FileSummary) => void;
  depth: number;
}) {
  const [isExpanded, setIsExpanded] = useState(depth < 2); // Auto-expand first 2 levels

  const handleToggle = useCallback(() => {
    if (node.type === 'folder') {
      setIsExpanded((prev) => !prev);
    }
  }, [node.type]);

  const handleFileClick = useCallback(() => {
    if (node.type === 'file' && node.file?.hasDoc) {
      onSelectFile(node.file);
    }
  }, [node, onSelectFile]);

  const isFile = node.type === 'file';
  const isFolder = node.type === 'folder';
  const isActive = isFile && node.file?.id === selectedFileId;
  const isDisabled = isFile && !node.file?.hasDoc;
  const icon = getFileIcon(node);
  
  // Calculate indentation based on depth
  const indentPx = depth * 16;

  return (
    <div role="treeitem" aria-expanded={isFolder ? isExpanded : undefined}>
      {/* Node row (folder or file) */}
      <button
        onClick={isFolder ? handleToggle : handleFileClick}
        disabled={isDisabled}
        className="tree-node-button"
        style={{
          all: 'unset',
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          padding: '4px 12px 4px 8px',
          paddingLeft: `${8 + indentPx}px`,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          background: isActive ? 'var(--bg-active)' : 'transparent',
          borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
          color: isDisabled
            ? 'var(--text-muted)'
            : isActive
              ? 'var(--text)'
              : 'var(--text-secondary)',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          opacity: isDisabled ? 0.5 : 1,
          transition: 'background 80ms, color 80ms',
          userSelect: 'none',
          position: 'relative',
        }}
        onMouseEnter={(e) => {
          if (!isDisabled && !isActive) {
            e.currentTarget.style.background = 'var(--bg-hover)';
            e.currentTarget.style.color = 'var(--text)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = isDisabled
              ? 'var(--text-muted)'
              : 'var(--text-secondary)';
          }
        }}
        title={node.path}
      >
        {/* Folder chevron */}
        {isFolder && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 16,
              height: 16,
              marginRight: 4,
              fontSize: 10,
              color: 'var(--text-muted)',
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 120ms ease-out',
            }}
            aria-hidden="true"
          >
            ▶
          </span>
        )}

        {/* Icon */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            marginRight: 6,
            fontSize: 14,
            marginLeft: isFile ? 20 : 0, // Align files with folder content
          }}
          aria-hidden="true"
        >
          {icon}
        </span>

        {/* Name */}
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {node.name}
        </span>

        {/* Language badge for files */}
        {isFile && node.file?.language && (
          <span
            style={{
              fontSize: 9,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginLeft: 8,
              opacity: 0.7,
            }}
          >
            {node.file.language}
          </span>
        )}
      </button>

      {/* Recursively render children if folder is expanded */}
      {isFolder && isExpanded && node.children && node.children.length > 0 && (
        <SidebarTree
          nodes={node.children}
          selectedFileId={selectedFileId}
          onSelectFile={onSelectFile}
          depth={depth + 1}
        />
      )}
    </div>
  );
});

// Made with Bob
