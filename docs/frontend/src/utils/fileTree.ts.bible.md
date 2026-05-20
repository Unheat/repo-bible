### 1. File Purpose
This file provides utility functions for constructing and managing hierarchical file tree structures from flat file path data. It is used by the frontend to convert a list of repository files into a nested tree suitable for sidebar navigation, enabling users to browse repository contents in a familiar folder/file hierarchy. The file also includes helper functions for determining file icons based on extensions.

### 2. Architecture and Design Patterns
This file is a pure utility module within the frontend layer of the architecture. It follows a **data transformation pattern**, specifically converting flat data (an array of `FileSummary` objects) into a hierarchical tree structure. It does not use traditional design patterns like factory or repository but employs a recursive tree-building algorithm. It fits into the broader architecture by supporting the frontend's UI components (e.g., `SidebarTree.tsx`) that display repository file structures, as indicated in the architecture context's data flow.

### 3. Public Interface
The file exports one interface and three functions.

**Interface: `TreeNode`**
```typescript
export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: TreeNode[];
  file?: FileSummary; // Original file data for leaf nodes
}
```
- **Purpose**: Represents a node in the file tree, with properties for name, path, type, optional children (for folders), and optional file data (for leaf nodes).

**Function: `buildFileTree`**
```typescript
export function buildFileTree(files: FileSummary[]): TreeNode[]
```
- **Parameters**: `files` - An array of `FileSummary` objects from the shared API types.
- **Return Type**: `TreeNode[]` - An array of root-level tree nodes representing the hierarchical file structure.
- **Purpose**: Converts a flat array of files into a nested tree structure, sorting folders before files and alphabetically within each level.

**Function: `getFileExtension`**
```typescript
export function getFileExtension(filename: string): string
```
- **Parameters**: `filename` - A string representing a file name.
- **Return Type**: `string` - The file extension (e.g., "ts", "md") in lowercase, or an empty string if no extension is found.
- **Purpose**: Extracts the file extension for icon determination.

**Function: `getFileIcon`**
```typescript
export function getFileIcon(node: TreeNode): string
```
- **Parameters**: `node` - A `TreeNode` object.
- **Return Type**: `string` - An emoji icon representing the file type or folder.
- **Purpose**: Returns an emoji icon based on the node's type or file extension, using a predefined mapping.

### 4. Internal Logic Walkthrough
The core logic is in `buildFileTree`, which constructs a tree by splitting file paths and creating nodes recursively.

1. **Initialization and Sorting**: The function starts with an empty root array and sorts the input files by their file path for consistent ordering:
   ```typescript
   const root: TreeNode[] = [];
   const sortedFiles = [...files].sort((a, b) => 
     a.filePath.localeCompare(b.filePath)
   );
   ```

2. **Tree Construction Loop**: For each file, it splits the path into parts and navigates the tree:
   ```typescript
   for (const file of sortedFiles) {
     const parts = file.filePath.split('/').filter(Boolean);
     let currentLevel = root;
     for (let i = 0; i < parts.length; i++) {
       const part = parts[i];
       const isLastPart = i === parts.length - 1;
       const pathSoFar = parts.slice(0, i + 1).join('/');
       let existingNode = currentLevel.find(node => node.name === part);
       if (!existingNode) {
         const newNode: TreeNode = {
           name: part,
           path: pathSoFar,
           type: isLastPart ? 'file' : 'folder',
           ...(isLastPart ? { file } : { children: [] }),
         };
         currentLevel.push(newNode);
         existingNode = newNode;
       }
       if (!isLastPart && existingNode.children) {
         currentLevel = existingNode.children;
       }
     }
   }
   ```
   - **Why**: This algorithm efficiently builds the tree by reusing existing nodes for folders, avoiding duplication. It distinguishes between files and folders based on whether the path part is the last one, attaching the original `FileSummary` to leaf nodes.

3. **Sorting the Tree**: After construction, a recursive `sortTree` function sorts each level: folders first, then files, both alphabetically:
   ```typescript
   const sortTree = (nodes: TreeNode[]): TreeNode[] => {
     return nodes.sort((a, b) => {
       if (a.type !== b.type) {
         return a.type === 'folder' ? -1 : 1;
       }
       return a.name.localeCompare(b.name);
     }).map(node => {
       if (node.children) {
         return { ...node, children: sortTree(node.children) };
       }
       return node;
     });
   };
   return sortTree(root);
   ```
   - **Why**: This ensures a user-friendly display where folders appear before files, and items are ordered predictably.

The helper functions `getFileExtension` and `getFileIcon` are straightforward: `getFileExtension` uses `lastIndexOf` to find the dot, and `getFileIcon` uses a static mapping of extensions to emojis, with a fallback to a generic file icon.

### 5. Dependencies and Integrations
- **Internal Imports**:
  - `import type { FileSummary } from '../../../shared/types/api';`: Provides the `FileSummary` type from the shared API types, used as input to `buildFileTree` and stored in `TreeNode.file`. The implementation of `FileSummary` is not in scope.
- **External Dependencies**: None. This file uses only TypeScript standard library features (e.g., `Array.sort`, `String.split`, `String.lastIndexOf`).

### 6. Edge Cases and Error Handling
- **Empty Input**: If `files` is empty, `buildFileTree` returns an empty array, which is handled gracefully.
- **Duplicate Paths**: The algorithm finds existing nodes by name, so duplicate file paths would not create duplicate nodes, but the input should ideally have unique paths.
- **Paths with Leading/Trailing Slashes**: The `filter(Boolean)` in `split('/')` removes empty parts, handling paths like `/src/app.ts` or `src/app.ts/`.
- **No File Extension**: `getFileExtension` returns an empty string if no dot is found, and `getFileIcon` falls back to `'📄'` for unknown extensions.
- **Folder vs. File Determination**: The logic assumes the last path part is always a file; if a path ends with a slash (e.g., `src/`), it would be treated as a file, but this is unlikely given the input from `FileSummary`.
- **Icon Mapping**: The `iconMap` covers common extensions but may not include all possible types; the fallback ensures no error occurs.

### 7. Observations
- **Code Smell**: The `getFileIcon` function uses a large static mapping, which could become unwieldy if more extensions are added; consider externalizing to a configuration file.
- **Non-Obvious Behavior**: The tree construction assumes file paths are normalized (no `..` or `.` segments); if paths contain these, the tree may not reflect the intended structure.
- **TODO**: The comment "Made with Bob" appears to be a casual note and may not be intentional for production code.
- **Architectural Concern**: This utility is frontend-specific and does not handle backend data fetching or error states; it assumes clean input from the API client.