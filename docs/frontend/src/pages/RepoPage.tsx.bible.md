### 1. File Purpose
This file implements the main repository dashboard page (`RepoPage`) for the frontend application. It orchestrates the user interface for viewing a repository's ingestion status, generated documentation, and file tree. The page manages state transitions between three primary modes: ingesting (polling for completion), generating documentation (polling for completion), and ready (displaying the full dashboard with a resizable sidebar, markdown reader, and toolbar actions). It also handles automatic documentation generation when triggered via a URL query parameter.

### 2. Architecture and Design Patterns
This file is a React component following a **container/presentational pattern** (though not strictly separated). It uses **state-driven UI rendering** to switch between full-screen status views and the main dashboard layout. The component integrates with the backend via an API client (`api`) and uses **polling** for asynchronous operations (repository ingestion and documentation generation). It employs **local state management** for UI concerns like sidebar resizing, view selection, and toast notifications. The file fits into the broader frontend architecture as the primary view for repository details, communicating with backend services like `ingestRepository` and `generateBible` via the API client.

### 3. Public Interface
The file exports a single default React component:

```typescript
export default function RepoPage()
```
- **Purpose**: Renders the repository dashboard page, handling all state transitions and user interactions for a single repository.

Internal components (not exported) include:
- `Toolbar`: Renders the top toolbar with repository name, links, and action buttons.
- `Sidebar`: Renders the file tree and overview section.
- `Reader`: Renders the markdown content viewer with edit capabilities.
- `FullScreenStatus`: Renders full-screen loading/error/waiting states.
- `FileRow`: Renders a single file or overview row in the sidebar.

### 4. Internal Logic Walkthrough
The component's logic revolves around state management and conditional rendering based on repository status.

**State Initialization and Polling**:
The component initializes state for repository details, polling errors, and UI elements. It uses `useEffect` to poll the backend for repository details every 3 seconds (`POLL_INTERVAL_MS`). Polling stops when both ingestion and documentation generation reach terminal states (`completed` or `failed`).

```typescript
useEffect(() => {
  if (!repositoryId) return;
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tick = async () => {
    try {
      const next = await api.getRepositoryDetail({ repositoryId });
      if (cancelled) return;
      setDetail(next);
      setPollError(null);

      const ingestTerminal =
        next.status === 'completed' || next.status === 'failed';
      const docsTerminal =
        next.docsStatus === 'completed' || next.docsStatus === 'failed';

      if (ingestTerminal && docsTerminal) return; // stop polling
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    } catch (err: unknown) {
      if (cancelled) return;
      const message = err instanceof Error ? err.message : String(err);
      setPollError(message);
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    }
  };
  tick();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}, [repositoryId]);
```

**Auto-Generate Documentation**:
If the URL contains `?autogenerate=1` and ingestion completes, the component automatically triggers documentation generation and strips the query parameter to prevent re-triggering on reload.

```typescript
useEffect(() => {
  if (!detail || autogenerateConsumed) return;
  if (!autogenerateRequested) return;
  if (detail.status !== 'completed') return;
  if (detail.docsStatus !== 'idle') return;
  setAutogenerateConsumed(true);
  api
    .generateBible({ repositoryId })
    .catch((err) => {
      console.error('generateBible failed', err);
      setToast({
        kind: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'Failed to start documentation generation.',
      });
    })
    .finally(() => {
      // Strip ?autogenerate=1 from the URL.
      navigate(`/repos/${repositoryId}`, { replace: true });
    });
}, [
  detail,
  autogenerateRequested,
  autogenerateConsumed,
  repositoryId,
  navigate,
]);
```

**Conditional Rendering Based on Status**:
The component renders different views based on `detail.status` and `detail.docsStatus`:
- **Ingesting**: Shows a full-screen status with a progress message.
- **Generating/Idle**: Shows a full-screen status with options to generate documentation.
- **Failed**: Shows error messages with retry or home navigation.
- **Ready**: Renders the full dashboard with toolbar, sidebar, and reader.

**Resizable Sidebar**:
The sidebar width is managed via local state and mouse event handlers. The component adjusts the cursor and user selection during resizing.

```typescript
const handleMouseDown = useCallback(() => {
  setIsResizing(true);
}, []);

const handleMouseMove = useCallback(
  (e: MouseEvent) => {
    if (!isResizing) return;
    const newWidth = Math.min(
      Math.max(e.clientX, MIN_SIDEBAR_WIDTH),
      MAX_SIDEBAR_WIDTH,
    );
    setSidebarWidth(newWidth);
  },
  [isResizing],
);

const handleMouseUp = useCallback(() => {
  setIsResizing(false);
}, []);
```

**Toast Notifications**:
Toasts are used for feedback on actions like PR creation or errors. They auto-dismiss after 8 seconds or can be closed manually with the Escape key.

```typescript
useEffect(() => {
  if (!toast) return;
  const t = setTimeout(() => setToast(null), 8000);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setToast(null);
  };
  window.addEventListener('keydown', onKey);
  return () => {
    clearTimeout(t);
    window.removeEventListener('keydown', onKey);
  };
}, [toast]);
```

**Document Editing in Reader**:
The `Reader` component allows editing markdown content. It uses local state for draft content and saves changes via the API. The view resets scroll and fades when switching documents.

```typescript
const handleSave = async () => {
  if (!docId) return;
  setIsSaving(true);
  try {
    await api.updateDocumentation(detail.id, docId, draftContent);
    // Update the detail object with the new content
    const updatedDetail = { ...detail };
    if (view.kind === 'overview' && updatedDetail.overview) {
      updatedDetail.overview = {
        ...updatedDetail.overview,
        markdownContent: draftContent,
      };
    } else if (view.kind === 'file') {
      const doc = updatedDetail.fileDocsByFileId[view.fileId];
      if (doc) {
        updatedDetail.fileDocsByFileId[view.fileId] = {
          ...doc,
          markdownContent: draftContent,
        };
      }
    }
    onDocumentUpdated(updatedDetail);
    setIsEditing(false);
    setDraftContent('');
  } catch (err) {
    console.error('Failed to save documentation:', err);
    alert(err instanceof Error ? err.message : 'Failed to save documentation');
  } finally {
    setIsSaving(false);
  }
};
```

### 5. Dependencies and Integrations
**Imports**:
- `react` and hooks (`useEffect`, `useMemo`, `useRef`, `useState`, `useCallback`): Core React library for component logic.
- `wouter` (`useLocation`, `useRoute`, `Link`): Routing library for navigation and route matching.
- `../api/client`: Internal API client for backend communication. Provides methods like `getRepositoryDetail`, `generateBible`, `openDocumentationPR`, and `updateDocumentation`.
- `../../../shared/types/api`: Shared TypeScript types for API contracts (`RepositoryDetail`, `FileSummary`).
- `../components/MarkdownView`: Internal component for rendering markdown content.
- `../components/SidebarTree`: Internal component for rendering the hierarchical file tree.
- `../utils/fileTree`: Internal utility for building file tree structures from flat file lists.
- `@uiw/react-md-editor`: Third-party markdown editor component for editing documentation.

**Dependencies Relationship**:
- The file depends on the API client to interact with backend services (e.g., fetching repository details, generating documentation).
- It uses shared types to ensure type safety for API responses.
- It relies on internal components (`MarkdownView`, `SidebarTree`) for UI rendering and utilities (`buildFileTree`) for data transformation.

### 6. Edge Cases and Error Handling
- **Polling Errors**: If the API call fails during polling, the error is caught and displayed in a full-screen status view. Polling continues despite errors.
- **Auto-Generate Failure**: If automatic documentation generation fails, a toast error is shown, and the URL query parameter is still stripped to prevent re-triggering.
- **Missing Repository ID**: If no repository ID is matched from the route, the component returns `null`.
- **Sidebar Resizing**: The sidebar width is clamped between `MIN_SIDEBAR_WIDTH` (200px) and `MAX_SIDEBAR_WIDTH` (600px) to prevent extreme sizes.
- **Toast Auto-Dismiss**: Toasts automatically dismiss after 8 seconds but can be closed early with the Escape key.
- **Document Editing**: If saving documentation fails, an alert is shown with the error message. The edit mode remains active until canceled or saved successfully.
- **Empty Documentation**: If no documentation is available for a selected file or overview, a placeholder message is displayed.

### 7. Observations
- **Code Duplication**: The logic for triggering documentation generation (e.g., `api.generateBible`) is duplicated in multiple places (auto-generate, toolbar regenerate, failure retry). This could be consolidated into a shared hook or function.
- **State Management Complexity**: The component manages multiple states (detail, view, sidebar width, toasts) locally, which could become difficult to maintain as the UI grows. Consider using a state management library like Zustand or React Context for shared state.
- **Hardcoded Polling Interval**: The polling interval is fixed at 3 seconds, which may not be optimal for all scenarios. It could be made configurable or adaptive based on the operation.
- **Accessibility**: The resizable sidebar handle lacks ARIA attributes for screen readers. The toast notifications could benefit from more robust accessibility support (e.g., role="alert").
- **Type Safety**: The component uses shared types from `../../../shared/types/api`, but some local state types (e.g., `View`) are defined inline. Ensuring consistency in type definitions could improve maintainability.