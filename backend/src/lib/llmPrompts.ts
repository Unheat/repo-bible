/**
 * Prompt builders + LLM call wrappers for the documentation pipeline.
 *
 * Two prompts live here:
 *   - `generateArchitectureSummary` — the "Mapper" agent. Produces a
 *     repo-level architecture summary plus a Mermaid flowchart.
 *   - `generateFileDeepDive` — the "Deep-Dive" agent. Produces a senior-
 *     engineer-grade technical writeup for a single file, anchored to
 *     the file's actual chunk text.
 *
 * Uses OpenAI SDK configured with OpenRouter for Claude 4.6 Sonnet.
 */

import OpenAI from 'openai';

/**
 * Model identifier for both Mapper and Deep-Dive. Pinned to Claude 4.6
 * Sonnet via OpenRouter — proven latency profile (full bible for a 12-file
 * repo in ~80s) and adaptive thinking on the Mapper that earns its cost on
 * architectural synthesis.
 */
const MODEL_ID = 'anthropic/claude-opus-4.6-fast'; // OpenRouter format

let cachedClient: OpenAI | null = null;

/**
 * Lazily build the OpenAI client configured for OpenRouter.
 */
function getClient(): OpenAI {
  if (cachedClient) return cachedClient;

  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY or OPENAI_API_KEY is not configured. Set it in environment variables.',
    );
  }

  const baseURL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

  cachedClient = new OpenAI({
    apiKey,
    baseURL,
    defaultHeaders: {
      'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
      'X-Title': 'Codebase Bible',
    },
  });
  return cachedClient;
}

/**
 * Sleep helper, only used as a guard against pathological model
 * misbehavior; the SDK already retries 429s with backoff internally.
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Mapper (architecture overview) ─────────────────────────────────────

const MAPPER_PREAMBLE = `You are a Staff Software Architect producing a Technical Architecture Document for a senior engineering audience.

You have been given the file tree of a codebase. Produce a structured markdown document with two parts.

## Part 1: Architecture Summary

Cover these sections:
1. **Project Purpose & Domain** — What this codebase does and the domain it operates in.
2. **High-Level Architecture Pattern** — Monolith, microservices, MVC, event-driven, layered, etc. Cite specific directories as evidence.
3. **Module Breakdown** — Each major directory or module: its responsibility and relationships to others.
4. **Data Flow** — How data moves through the system based on structural evidence (entry points, handlers, services, repositories, middleware, etc.).
5. **Key Technical Dependencies** — Infer from filenames only (package.json, go.mod, requirements.txt, etc. if present in the tree). Do not invent dependencies not evidenced by the tree.
6. **Cross-Cutting Concerns** — Auth, logging, config, error handling patterns evident from structure.

## Part 2: Mermaid Flowchart

Produce a Mermaid flowchart of the primary data flow or request lifecycle. Use \`graph TD\` or \`graph LR\` syntax. Embed in a fenced code block tagged \`mermaid\`.

## Strict Rules

- Every claim must be grounded in a specific path from the provided file tree. If inferring, use "likely" or "appears to be."
- Do not reference file paths not present in the tree.
- If the tree is insufficient to determine something, state that explicitly rather than guessing.
- No emojis. No em dashes. No meta-commentary or "Here is the document:" preludes. Respond only with the markdown document.`;

/**
 * Generate the repo-level architecture summary.
 *
 * @param repoName  Display name like `"owner/name"`. Helps the model frame the doc.
 * @param fileTree  Plain-text listing of file paths and detected languages.
 *                  Format-agnostic — the model handles whatever shape we send.
 */
export async function generateArchitectureSummary(
  repoName: string,
  fileTree: string,
): Promise<string> {
  const client = getClient();
  
  const message = `<repository_name>${repoName}</repository_name>

<file_tree>
${fileTree}
</file_tree>`;

  const response = await client.chat.completions.create({
    model: MODEL_ID,
    messages: [
      {
        role: 'system',
        content: MAPPER_PREAMBLE,
      },
      {
        role: 'user',
        content: message,
      },
    ],
    temperature: 0.1,
    max_tokens: 16000,
  });

  return response.choices[0]?.message?.content || '';
}

// ─── Deep-Dive (per-file technical writeup) ─────────────────────────────

const FILE_ANALYSIS_PREAMBLE = `You are a Staff Software Engineer writing internal technical documentation for a senior engineering audience.

You have been given source code for a single file, plus high-level architecture context for the codebase it belongs to.

## Required Output Structure

### 1. File Purpose
One paragraph. What is this file's role in the system? What problem does it solve?

### 2. Architecture and Design Patterns
What patterns are used (factory, repository, middleware, pub/sub, strategy, decorator, etc.)? How does this file fit into the broader architecture described in the context?

### 3. Public Interface
Document all exported functions, classes, types, or constants. For each: signature, parameter types, return type, and purpose. Use fenced code blocks for signatures.

### 4. Internal Logic Walkthrough
Walk through the non-trivial internal logic step by step. Explain the "why" behind algorithmic or structural choices where evident from the code. Include exact code snippets copied verbatim from the source — do not paraphrase code into prose.

### 5. Dependencies and Integrations
List all imports or requires. For each external dependency, describe what it provides to this file. For internal imports, describe the dependency relationship. If you cannot see the imported module's implementation, say "implementation not in scope" — do not invent its behavior.

### 6. Edge Cases and Error Handling
Document error paths, guards, fallbacks, and notable edge case handling present in the code.

### 7. Observations (optional)
Note any code smells, TODOs, non-obvious behavior, or architectural concerns visible in the code. Omit this section entirely if there is nothing worth flagging.

## Strict Rules

- CLOSE-WORLD CONSTRAINT: You may only reference code that appears verbatim in the provided source_code block. You are prohibited from describing behavior you cannot see in the text.
- EXACT QUOTES: When referencing specific logic, paste the exact code from the source into a fenced code block. Do not describe code in prose when you could show it.
- NO HALLUCINATED BEHAVIOR: Do not claim the code does something unless you can point to the specific lines that implement it.
- EXTERNAL DEPENDENCIES: You may state what a third-party library generally does ("express is a Node.js HTTP framework"), but do not invent specific behavior of that library as used in this file unless the usage is explicit in the source.
- TRUNCATION: If the source_code block ends with a "[... truncated ...]" marker, only describe code present before that marker. Do not speculate about the omitted portion.
- No emojis. No em dashes. No "Here is the analysis:" preludes. Respond only with the markdown writeup.`;

/**
 * Generate the per-file technical writeup. The architecture summary from
 * the Mapper phase is passed in as context so the Deep-Dive can ground
 * each file in the broader system without reinventing it.
 */
export async function generateFileDeepDive(
  filePath: string,
  language: string,
  sourceCode: string,
  architectureContext: string,
): Promise<string> {
  const client = getClient();
  
  const message = `<architecture_context>
${architectureContext}
</architecture_context>

<file_path>${filePath}</file_path>
<language>${language}</language>

<source_code>
${sourceCode}
</source_code>`;

  const response = await client.chat.completions.create({
    model: MODEL_ID,
    messages: [
      {
        role: 'system',
        content: FILE_ANALYSIS_PREAMBLE,
      },
      {
        role: 'user',
        content: message,
      },
    ],
    temperature: 0,
    max_tokens: 16000,
  });

  return response.choices[0]?.message?.content || '';
}
