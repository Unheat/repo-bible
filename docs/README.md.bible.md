### 1. File Purpose

This file is the project's root README.md, serving as the primary entry point for developer onboarding and project documentation. It provides a high-level overview of the Codebase Bible tool, its key features, technology stack, setup instructions, usage workflow, and future roadmap. Its role is to orient new contributors and users by explaining the project's purpose, how to set it up locally, and how to interact with the application.

### 2. Architecture and Design Patterns

This file is a documentation artifact and does not implement architectural patterns. However, based on the architecture context and the content of the README, it describes a system that uses a **layered monolithic architecture** with an **event-driven ingestion pipeline**. The README outlines a clear separation between a React frontend and a Node.js/Express backend, with data flowing through services for repository ingestion and documentation generation. It also highlights a **RAG (Retrieval-Augmented Generation)** architecture for AI-powered documentation.

### 3. Public Interface

This file is a Markdown document and does not export any functions, classes, types, or constants. It is a static documentation file.

### 4. Internal Logic Walkthrough

This file contains no executable internal logic; it is a descriptive document. However, it outlines the application's workflow, which can be summarized as follows:

1.  **Access the UI:** The user navigates to `http://localhost:5173`.
2.  **Ingest a Repo:** The user pastes a GitHub URL and clicks "Generate Bible".
3.  **Automated Processing:** The system clones the repository, chunks the code, and triggers AI agents for processing.
4.  **Read the Docs:** The user navigates the generated documentation via a VS Code-style sidebar.
5.  **Manage Data:** The user can regenerate or delete repositories via a kebab menu.

The README also specifies the exact commands for setup and execution:
```bash
npm run install:all
npx prisma db push
npm run dev
```

### 5. Dependencies and Integrations

This file is a Markdown document and has no code-level dependencies. It references external tools and services in its documentation:

*   **Frontend:** React.js, Vite, TypeScript, Wouter, `@uiw/react-md-editor` (mentioned in the "Tech Stack" section).
*   **Backend:** Node.js, Express, TypeScript, Chonky/AST Parsers, Concurrently (mentioned in the "Tech Stack" section).
*   **Database & ORM:** SQLite, Prisma ORM (mentioned in the "Tech Stack" section).
*   **AI & RAG Pipeline:** OpenAI Embeddings, OpenRouter API Gateway (mentioned in the "Tech Stack" section).
*   **GitHub:** Requires a Personal Access Token for repository operations (mentioned in the "Environment Variables" section).

### 6. Edge Cases and Error Handling

The README documents specific error handling and edge case mitigation features:

*   **Port Conflicts:** The system includes an "Automated Port Management" script that kills "Zombie Processes" and frees up locked ports (`3000`, `5173`, `5174`) to prevent `EADDRINUSE` errors.
*   **Rate Limiting:** It implements "Dynamic Rate Limiting" that detects free-tier LLM models and triggers a "Throttle & Delay" mechanism (sequential processing with 3-second delays) to prevent `429 Too Many Requests` errors.
*   **Data Orphans:** It features "Cascade Data Deletion" via Prisma's `onDelete: Cascade` to ensure that deleting a repository also erases all associated files, code chunks, and generated documents.

### 7. Observations

*   **Documentation Duplication:** The "Usage" section contains a duplicated block of text (the `npx prisma db push` command and the subsequent paragraph are repeated).
*   **Non-Standard Markdown:** The file uses a custom emoji-based header (`# Codebase Bible 📖`) and includes an HTML `<div>` for a YouTube video embed, which is non-standard for pure Markdown but acceptable for rendered documentation.
*   **Future Roadmap:** The README clearly outlines a transition from a local developer tool to a SaaS product, indicating planned architectural shifts (e.g., migrating from SQLite to a cloud database).