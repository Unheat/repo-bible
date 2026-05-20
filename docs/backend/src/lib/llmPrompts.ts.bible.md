### 1. File Purpose
This file serves as the prompt engineering and LLM orchestration layer for the documentation generation pipeline. It defines two distinct prompt templates and their corresponding wrapper functions that invoke OpenAI-compatible APIs (configured for OpenRouter) to generate two types of documentation: a high-level architecture summary for an entire repository ("Mapper" agent) and a detailed technical writeup for a single source file ("Deep-Dive" agent). It abstracts the LLM interaction, model configuration, and response sanitization for the documentation services.

### 2. Architecture and Design Patterns
This file implements a **Service Layer** pattern, acting as a dedicated service for LLM interactions within the broader backend architecture. It uses a **Factory-like** pattern for client initialization (lazy-loaded singleton `OpenAI` client) and **Strategy** patterns via distinct prompt templates for different documentation tasks. It fits into the event-driven ingestion pipeline described in the architecture context, where `generateArchitectureSummary` is called during repository analysis and `generateFileDeepDive` is used for per-file documentation generation, both feeding into the final "bible" output.

### 3. Public Interface

```typescript
export const MODEL_ID: string
```
Purpose: The model identifier for LLM calls, defaulting to `deepseek/deepseek-v4-flash:free` but overridable via `LLM_MODEL_ID` environment variable.

```typescript
export async function sleep(ms: number): Promise<void>
```
Purpose: A helper function to pause execution, used as a guard against pathological model behavior. It is not used in the provided code but is exported.

```typescript
export async function generateArchitectureSummary(
  repoName: string,
  fileTree: string,
): Promise<string>
```
Purpose: Generates a repository-level architecture summary and Mermaid flowchart. It sends the repository name and file tree to the LLM with the `MAPPER_PREAMBLE` system prompt and returns the sanitized markdown response.

```typescript
export async function generateFileDeepDive(
  filePath: string,
  language: string,
  sourceCode: string,
  architectureContext: string,
): Promise<string>
```
Purpose: Generates a senior-engineer-grade technical writeup for a single file. It sends the file path, language, source code, and prior architecture context to the LLM with the `FILE_ANALYSIS_PREAMBLE` system prompt and returns the sanitized markdown response.

### 4. Internal Logic Walkthrough

**Client Initialization and Caching:**
The `getClient` function implements lazy initialization of the OpenAI client. It checks for a cached instance first, then validates required API keys (`OPENROUTER_API_KEY` or `OPENAI_API_KEY`), and configures the client with OpenRouter's base URL and custom headers for referer and title.

```typescript
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
```

**Architecture Summary Generation:**
The `generateArchitectureSummary` function constructs a user message embedding the repository name and file tree within XML-like tags. It calls the OpenAI chat completions API with the `MAPPER_PREAMBLE` system prompt, a low temperature (0.1) for deterministic output, and a high token limit. The response is then passed to `sanitizeMermaidInMarkdown` to ensure Mermaid diagram syntax compliance.

```typescript
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
```

**File Deep-Dive Generation:**
The `generateFileDeepDive` function similarly constructs a user message with the architecture context, file path, language, and source code. It uses the `FILE_ANALYSIS_PREAMBLE` system prompt, sets temperature to 0 for maximum determinism, and also sanitizes the output. This ensures the per-file documentation is grounded in the broader system context without hallucination.

```typescript
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
```

### 5. Dependencies and Integrations

**External Dependencies:**
- `openai`: The official OpenAI SDK, used to instantiate the client and create chat completions. It is configured to use OpenRouter's base URL.
- `./mermaidSanitizer.js`: An internal utility (implementation not in scope) that provides `sanitizeMermaidInMarkdown` to post-process LLM responses and ensure Mermaid diagram syntax is correct.

**Internal Dependencies:**
- No other internal imports are present in this file. The functions are self-contained and rely only on environment variables and the external SDK.

### 6. Edge Cases and Error Handling

**API Key Validation:**
The `getClient` function throws an error if neither `OPENROUTER_API_KEY` nor `OPENAI_API_KEY` is set, preventing client initialization without credentials.

```typescript
if (!apiKey) {
  throw new Error(
    'OPENROUTER_API_KEY or OPENAI_API_KEY is not configured. Set it in environment variables.',
  );
}
```

**Response Fallbacks:**
Both LLM wrapper functions use a fallback to an empty string if the response content is missing, preventing runtime errors when accessing `response.choices[0]?.message?.content`.

```typescript
const rawContent = response.choices[0]?.message?.content || '';
```

**Sanitization Guard:**
The code post-processes all LLM outputs with `sanitizeMermaidInMarkdown`, which acts as a guard against malformed Mermaid syntax that could break documentation rendering.

### 7. Observations

**Model Configuration Discrepancy:**
The comment states the model is pinned to "Claude 4.6 Sonnet via OpenRouter," but the default `MODEL_ID` is set to `'deepseek/deepseek-v4-flash:free'`. This inconsistency should be verified for production use.

**Unused Sleep Function:**
The `sleep` function is exported but not used within this file. It may be intended for future use or external callers but currently represents dead code.

**Hardcoded Prompts:**
The prompts (`MAPPER_PREAMBLE` and `FILE_ANALYSIS_PREAMBLE`) are hardcoded as string literals. This makes them inflexible for prompt tuning without code changes; consider externalizing them to configuration files or a prompt management system.