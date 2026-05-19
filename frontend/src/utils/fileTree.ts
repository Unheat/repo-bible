/**
 * Utility functions for building and managing hierarchical file tree structures.
 * Converts flat file paths into nested folder/file trees for sidebar navigation.
 */

import type { FileSummary } from '../../../shared/types/api';

export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: TreeNode[];
  file?: FileSummary; // Original file data for leaf nodes
}

/**
 * Converts a flat array of files into a hierarchical tree structure.
 * 
 * Example:
 *   Input: ['src/app.ts', 'src/utils/helper.ts', 'README.md']
 *   Output: Tree with 'src' folder containing 'app.ts' and 'utils' subfolder
 */
export function buildFileTree(files: FileSummary[]): TreeNode[] {
  const root: TreeNode[] = [];
  
  // Sort files by path for consistent ordering
  const sortedFiles = [...files].sort((a, b) => 
    a.filePath.localeCompare(b.filePath)
  );

  for (const file of sortedFiles) {
    const parts = file.filePath.split('/').filter(Boolean);
    let currentLevel = root;

    // Navigate/create the folder structure
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLastPart = i === parts.length - 1;
      
      // Build the full path up to this point
      const pathSoFar = parts.slice(0, i + 1).join('/');

      // Check if this node already exists at current level
      let existingNode = currentLevel.find(node => node.name === part);

      if (!existingNode) {
        // Create new node
        const newNode: TreeNode = {
          name: part,
          path: pathSoFar,
          type: isLastPart ? 'file' : 'folder',
          ...(isLastPart ? { file } : { children: [] }),
        };
        currentLevel.push(newNode);
        existingNode = newNode;
      }

      // If not the last part, descend into children
      if (!isLastPart && existingNode.children) {
        currentLevel = existingNode.children;
      }
    }
  }

  // Sort each level: folders first, then files, both alphabetically
  const sortTree = (nodes: TreeNode[]): TreeNode[] => {
    return nodes.sort((a, b) => {
      // Folders before files
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      // Alphabetical within same type
      return a.name.localeCompare(b.name);
    }).map(node => {
      if (node.children) {
        return { ...node, children: sortTree(node.children) };
      }
      return node;
    });
  };

  return sortTree(root);
}

/**
 * Get file extension for icon determination
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.slice(lastDot + 1).toLowerCase() : '';
}

/**
 * Get icon for file based on extension or folder
 */
export function getFileIcon(node: TreeNode): string {
  if (node.type === 'folder') {
    return '📁';
  }

  const ext = getFileExtension(node.name);
  const iconMap: Record<string, string> = {
    // Programming languages
    ts: '🔷',
    tsx: '⚛️',
    js: '🟨',
    jsx: '⚛️',
    py: '🐍',
    java: '☕',
    go: '🔵',
    rs: '🦀',
    cpp: '⚙️',
    c: '⚙️',
    cs: '🔷',
    php: '🐘',
    rb: '💎',
    swift: '🦅',
    kt: '🟣',
    
    // Web
    html: '🌐',
    css: '🎨',
    scss: '🎨',
    sass: '🎨',
    vue: '💚',
    
    // Data/Config
    json: '📋',
    yaml: '📋',
    yml: '📋',
    xml: '📋',
    toml: '📋',
    ini: '⚙️',
    env: '🔐',
    
    // Documentation
    md: '📝',
    txt: '📄',
    pdf: '📕',
    
    // Other
    sql: '🗄️',
    sh: '🐚',
    bat: '⚡',
    ps1: '⚡',
    dockerfile: '🐳',
    gitignore: '🚫',
  };

  return iconMap[ext] || '📄';
}

// Made with Bob
