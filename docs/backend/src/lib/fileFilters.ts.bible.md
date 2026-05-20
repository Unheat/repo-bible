### 1. File Purpose
This file provides utility functions for filtering files during repository ingestion and detecting their programming language. It solves the problem of noise reduction by skipping non-textual, binary, or boilerplate files (e.g., `node_modules`, lockfiles, images) and mapping file extensions to language labels for downstream processing. This ensures the ingestion pipeline focuses on developer-relevant source code.

### 2. Architecture and Design Patterns
This file is a stateless utility module within the backend's `lib` directory, following a **filter and mapping pattern**. It fits into the broader layered monolithic architecture by serving as a preprocessing step in the ingestion pipeline (e.g., called by `services/ingestRepository.ts`). It uses hardcoded constants for boilerplate directories, skip filenames, and extension mappings, which aligns with the system's event-driven ingestion flow where file selection precedes LLM processing.

### 3. Public Interface
The file exports one interface and two functions:

```typescript
export interface FilterResult {
  keep: boolean;
  /** When `keep === false`, a short reason for diagnostics. */
  reason?: string;
}
```

```typescript
export function shouldIngest(path: string, size: number | undefined): FilterResult
```
- **Parameters**: `path` (string) - the file path; `size` (number | undefined) - file size in bytes (unknown size is allowed).
- **Return Type**: `FilterResult` - an object indicating whether to keep the file and a reason if skipped.
- **Purpose**: Decides whether a file should be ingested based on path patterns, filename, extension, and size.

```typescript
export function detectLanguage(path: string): string
```
- **Parameters**: `path` (string) - the file path.
- **Return Type**: `string` - the detected language label (e.g., "typescript", "unknown").
- **Purpose**: Maps a file path to a language label using special filenames and extension-based rules.

### 4. Internal Logic Walkthrough
The `shouldIngest` function implements a multi-step filter chain. First, it checks for an empty path:
```typescript
if (!path) return { keep: false, reason: 'empty path' };
```
Next, it splits the path into segments and checks for boilerplate directory names (e.g., `node_modules`, `.git`). This prevents ingestion of entire directory trees that are typically noise:
```typescript
const segments = path.split('/');
for (const seg of segments) {
  if (BOILERPLATE_DIR_SEGMENTS.has(seg)) {
    return { keep: false, reason: `boilerplate dir: ${seg}` };
  }
}
```
It then extracts the filename and checks against exact-name skip patterns (e.g., lockfiles like `package-lock.json`):
```typescript
const filename = segments[segments.length - 1] ?? '';
if (SKIP_FILENAMES.has(filename)) {
  return { keep: false, reason: `skip filename: ${filename}` };
}
```
It uses regex to skip minified bundles (e.g., `.min.js`) and sourcemap files (e.g., `.map`):
```typescript
if (/\.min\.(js|css|html|mjs|cjs)$/i.test(filename)) {
  return { keep: false, reason: 'minified bundle' };
}
if (/\.map$/i.test(filename)) {
  return { keep: false, reason: 'sourcemap' };
}
```
It checks the file extension against a set of binary or non-textual extensions (e.g., images, archives):
```typescript
const ext = extractExtension(filename);
if (ext && SKIP_EXTENSIONS.has(ext)) {
  return { keep: false, reason: `binary/non-text ext: .${ext}` };
}
```
Finally, it enforces a size limit (1 MB) if the size is known:
```typescript
if (typeof size === 'number' && size > MAX_FILE_SIZE_BYTES) {
  return { keep: false, reason: `too large: ${size} bytes` };
}
```
If all checks pass, it returns `{ keep: true }`.

The `detectLanguage` function first handles special filenames without extensions (e.g., `Dockerfile`, `Makefile`):
```typescript
const lower = filename.toLowerCase();
if (lower === 'dockerfile' || lower.startsWith('dockerfile.')) return 'dockerfile';
if (lower === 'makefile' || lower === 'gnumakefile') return 'makefile';
// ... other special cases
```
It then extracts the extension and maps it to a language using the `EXTENSION_TO_LANGUAGE` record. If no match, it returns `'unknown'`.

The helper `extractExtension` safely extracts the extension by finding the last dot and ensuring it's not at the start or end of the filename.

### 5. Dependencies and Integrations
- **Internal Imports**: None. This file is self-contained and does not import other modules.
- **External Dependencies**: None. The file uses only TypeScript and standard JavaScript APIs (e.g., `Set`, `String.prototype.split`, `String.prototype.lastIndexOf`).

### 6. Edge Cases and Error Handling
- **Empty Path**: Returns `{ keep: false, reason: 'empty path' }`.
- **Unknown File Size**: If `size` is `undefined`, the size check is skipped, allowing the file through.
- **No Extension**: `extractExtension` returns `null` for filenames without a valid extension (e.g., `Dockerfile`), which is handled by special-case checks in `detectLanguage`.
- **Unrecognized Extensions**: `detectLanguage` returns `'unknown'` if no mapping exists.
- **Minified and Sourcemap Files**: Explicitly skipped via regex patterns, even if they have text-like extensions.

### 7. Observations
- **Code Duplication**: The `EXTENSION_TO_LANGUAGE` record and other constants are defined twice in the source code block (likely a copy-paste error in the provided snippet). The logic remains consistent, but this could be cleaned up.
- **Hardcoded Lists**: The boilerplate directories and skip extensions are hardcoded, which may require maintenance as new project types emerge. Consider making these configurable via environment variables or a config file.
- **Language Detection Limitations**: The mapping is extension-based and may misclassify files with non-standard extensions (e.g., `.mjs` as JavaScript, which is correct, but `.cjs` is also mapped to JavaScript). Special filenames like `Rakefile` are hardcoded to Ruby, which may not always be accurate.
- **Size Limit**: The 1 MB limit is reasonable for text files but could be too restrictive for large configuration files (e.g., JSON schemas). The code allows unknown sizes, which might bypass this check unintentionally.