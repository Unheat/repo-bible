
# Codebase Bible 📖

**Codebase Bible** is a full-stack tool that helps developers read, analyze, and automatically generate onboarding documentation for any GitHub repository with a single click. By leveraging a Retrieval-Augmented Generation (RAG) architecture and deep Abstract Syntax Tree (AST) parsing, it transforms complex source code into intuitive, readable Markdown documentation.
[![Watch the demo](https://img.youtube.com/vi/OP5eS9XlrI0/hqdefault.jpg)](https://www.youtube.com/watch?v=OP5eS9XlrI0)
---

## 🚀 Key Features

1. **Automated Ingestion Pipeline:** Automatically clones GitHub repositories, filters out noise (images, build folders, hidden configs), and semantically chunks source code using an AST-aware parser.
2. **Local Vector Database:** Generates Vector Embeddings (1536-dimensional arrays via OpenAI) to represent the semantic meaning of code chunks, stored seamlessly in a local **SQLite** database using **Prisma ORM**.
3. **Hierarchical File Explorer:** Features a recursive, nested tree sidebar inspired by VS Code's Explorer, complete with automatic file extension detection and 30+ custom file icons.
4. **Automated Port Management (Pre-dev):** Integrates a cleanup script to kill "Zombie Processes". Upon startup, it automatically scans and frees up locked ports (`3000`, `5173`, `5174`), completely eliminating the dreaded `EADDRINUSE` error.
5. **Dynamic Rate Limiting:** Automatically detects the type of LLM being used. If a free-tier model (e.g., `:free` variants on OpenRouter) is detected, it triggers a **Throttle & Delay** mechanism (sequential processing with 3-second delays) to prevent `429 Too Many Requests` errors.
6. **Cascade Data Deletion:** Deeply integrated database cleanup. Deleting a repository automatically cascades down to erase all associated files, code chunks, and generated AI documents without leaving orphaned data in SQLite.

---

## 🛠️ Tech Stack

* **Frontend:** React.js, Vite, TypeScript, Wouter (Routing), `@uiw/react-md-editor` (Markdown Rendering & Editing)
* **Backend:** Node.js, Express, TypeScript, Chonky/AST Parsers, Concurrently
* **Database & ORM:** SQLite, Prisma ORM (utilizing `onDelete: Cascade`)
* **AI & RAG Pipeline:** OpenAI Embeddings (`text-embedding-3-small`), OpenRouter API Gateway (`claude-opus-4.6-fast`, `deepseek-v4-flash:free`)

---

## 📦 Setup Instructions

This system is optimized for a smooth local development experience. Follow these steps to get started:

### 1. Install Dependencies

Open your terminal at the project root and run the automated installation script for both the backend and frontend:

```bash
npm run install:all


### 2. Environment Variables

Navigate to the `backend/` directory, create a `.env` file, and configure the following keys:

```bash
# Local SQLite database connection string
DATABASE_URL="file:./prisma/dev.db"

# GitHub Personal Access Token (Used to fetch/clone repositories)
GITHUB_TOKEN="ghp_your_github_token_here"

# OpenAI API Key (Required for Vector Embeddings)
OPENAI_API_KEY="sk-proj-your_openai_key_here"

# OpenRouter API Key (Required for LLM documentation generation)
OPENROUTER_API_KEY="sk-or-v1-your_openrouter_key_here"
```

### 3. Sync Database Schema

Initialize your local SQLite database with the correct table structures by running this command inside the `backend/` directory:

```bash
npx prisma db push
```

### 💻 Usage

Once configured, return to the project root and start the application with a single command:

```bash
npm run dev
```

The predev script will automatically clear any stuck ports, and concurrently will spin up both the Backend (port 3000) and Frontend (port 5173) in the same terminal window.

**Application Workflow:**

1. **Access the UI:** Open your browser and navigate to [http://localhost:5173](http://localhost:5173)
2. **Ingest a Repo:** Paste a public GitHub URL (e.g., `https://github.com/Unheat/tic-tac-toe`) into the input field and click *Generate Bible*.
3. **Automated Processing:** The system will clone, chunk, and trigger the AI agents. The UI will automatically poll and update its status without requiring a page reload.
4. **Read the Docs:** Click on the repository name to enter the Dashboard. Use the VS Code-style sidebar to navigate through files and read the AI-generated deep dives.
5. **Manage Data:** Use the 3-dot (⋮) kebab menu on any repository card to *Regenerate documentation* or *Delete* the repository entirely from your local database.

---

## 🗺️ Future Roadmap

To scale Codebase Bible from a local developer tool into a full-fledged SaaS product, the following features are planned:

1. **Cloud Hosting & Infrastructure**

   * Migrate from local SQLite to a robust cloud database (like PostgreSQL or Supabase) to handle massive codebases
   * Deploy the backend services to cloud platforms (Render/Fly.io) and host the frontend on Vercel

2. **Shareable Documentation**

   * Implement user authentication and role-based access control
   * Introduce *Public Share Links*, allowing repository owners to publish their "Codebase Bibles" online

3. **Dual-Mode Generation System**

   * **Explanation Mode (Current):** Deep technical dives into code mechanics. Explains data flow, algorithmic choices, and internal logic
   * **Documentation / API Mode (Upcoming):** High-level view that documents public interfaces (method names, arguments, return types, usage examples) for library/API consumers


