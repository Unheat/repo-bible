/**
 * File filtering and language detection for ingestion.
 *
 * The goal is to keep "things a developer would want to read" and skip
 * "things that are noise or not text" — boilerplate dirs, lockfiles,
 * binaries, minified bundles, oversized files.
 */

/** Path segments whose presence anywhere in a path means "skip this file". */
const BOILERPLATE_DIR_SEGMENTS = new Set<string>([
  'node_modules',
  '.git',
  '.github', // workflows can be useful, but mostly noise — skip for MVP
  '.svn',
  '.hg',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.svelte-kit',
  '.astro',
  '.expo',
  '.output',
  'target', // rust, java
  'vendor', // go modules, php
  '__pycache__',
  '.venv',
  'venv',
  '.idea',
  '.vscode',
  '.vs',
  'coverage',
  '.nyc_output',
  '.cache',
  '.parcel-cache',
  '.turbo',
  '.vercel',
  '.pnpm-store',
  'bower_components',
  'jspm_packages',
  'Pods', // CocoaPods
  'DerivedData', // Xcode
]);

/** Filenames that are always skipped (lockfiles, OS metadata). */
const SKIP_FILENAMES = new Set<string>([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'npm-shrinkwrap.json',
  'Cargo.lock',
  'Gemfile.lock',
  'poetry.lock',
  'composer.lock',
  'Pipfile.lock',
  'Podfile.lock',
  'mix.lock',
  '.DS_Store',
  'Thumbs.db',
]);

/** File extensions (without the dot) that are binary or otherwise unhelpful. */
const SKIP_EXTENSIONS = new Set<string>([
  // Images
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'ico',
  'bmp',
  'tif',
  'tiff',
  'svg',
  // Documents
  'pdf',
  'doc',
  'docx',
  'ppt',
  'pptx',
  'xls',
  'xlsx',
  // Archives
  'zip',
  'tar',
  'gz',
  'bz2',
  'xz',
  '7z',
  'rar',
  // Audio / video
  'mp4',
  'mp3',
  'wav',
  'ogg',
  'mov',
  'avi',
  'webm',
  'flac',
  'aac',
  'm4a',
  // Fonts
  'woff',
  'woff2',
  'ttf',
  'otf',
  'eot',
  // Compiled / binary artifacts
  'exe',
  'dll',
  'so',
  'dylib',
  'a',
  'o',
  'obj',
  'class',
  'jar',
  'war',
  'ear',
  'wasm',
  'pyc',
  'pyo',
  'pyd',
  // Data blobs
  'sqlite',
  'sqlite3',
  'db',
  'dat',
  'bin',
]);

/** Extension-to-language mapping for the `files.language` column. */
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  py: 'python',
  pyi: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  swift: 'swift',
  m: 'objective-c',
  mm: 'objective-cpp',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  hh: 'cpp',
  cs: 'csharp',
  fs: 'fsharp',
  fsi: 'fsharp',
  php: 'php',
  scala: 'scala',
  clj: 'clojure',
  cljs: 'clojure',
  cljc: 'clojure',
  ex: 'elixir',
  exs: 'elixir',
  erl: 'erlang',
  hrl: 'erlang',
  elm: 'elm',
  hs: 'haskell',
  lhs: 'haskell',
  ml: 'ocaml',
  mli: 'ocaml',
  dart: 'dart',
  lua: 'lua',
  r: 'r',
  pl: 'perl',
  pm: 'perl',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  fish: 'shell',
  ps1: 'powershell',
  sql: 'sql',
  graphql: 'graphql',
  gql: 'graphql',
  proto: 'protobuf',
  vue: 'vue',
  svelte: 'svelte',
  astro: 'astro',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',
  styl: 'stylus',
  md: 'markdown',
  mdx: 'mdx',
  rst: 'restructuredtext',
  txt: 'text',
  json: 'json',
  jsonc: 'json',
  json5: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  ini: 'ini',
  xml: 'xml',
  csv: 'csv',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
};

/** Files larger than this (in bytes) are skipped during ingestion. */
const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB

/** Decision returned by the filter. */
export interface FilterResult {
  keep: boolean;
  /** When `keep === false`, a short reason for diagnostics. */
  reason?: string;
}

/**
 * Decide whether a single tree blob should be ingested.
 * `size` is in bytes (from the GitHub tree response). `undefined` is treated
 * as "unknown size" and allowed through.
 */
export function shouldIngest(path: string, size: number | undefined): FilterResult {
  if (!path) return { keep: false, reason: 'empty path' };

  // Boilerplate directory check — any segment match.
  const segments = path.split('/');
  for (const seg of segments) {
    if (BOILERPLATE_DIR_SEGMENTS.has(seg)) {
      return { keep: false, reason: `boilerplate dir: ${seg}` };
    }
  }

  const filename = segments[segments.length - 1] ?? '';

  // Lockfile / OS metadata exact-name match.
  if (SKIP_FILENAMES.has(filename)) {
    return { keep: false, reason: `skip filename: ${filename}` };
  }

  // Minified bundles.
  if (/\.min\.(js|css|html|mjs|cjs)$/i.test(filename)) {
    return { keep: false, reason: 'minified bundle' };
  }

  // Map / sourcemap files.
  if (/\.map$/i.test(filename)) {
    return { keep: false, reason: 'sourcemap' };
  }

  // Binary / non-textual extensions.
  const ext = extractExtension(filename);
  if (ext && SKIP_EXTENSIONS.has(ext)) {
    return { keep: false, reason: `binary/non-text ext: .${ext}` };
  }

  // Oversized.
  if (typeof size === 'number' && size > MAX_FILE_SIZE_BYTES) {
    return { keep: false, reason: `too large: ${size} bytes` };
  }

  return { keep: true };
}

/**
 * Detect a language label from a file path. Returns "unknown" when no rule
 * matches. Special-case filenames (Dockerfile, Makefile) handled before
 * extension-based mapping.
 */
export function detectLanguage(path: string): string {
  const filename = path.split('/').pop() ?? '';
  const lower = filename.toLowerCase();

  // Special filenames (no extension).
  if (lower === 'dockerfile' || lower.startsWith('dockerfile.')) return 'dockerfile';
  if (lower === 'makefile' || lower === 'gnumakefile') return 'makefile';
  if (lower === 'rakefile') return 'ruby';
  if (lower === 'gemfile') return 'ruby';
  if (lower === 'podfile') return 'ruby';

  const ext = extractExtension(filename);
  if (ext && EXTENSION_TO_LANGUAGE[ext]) {
    return EXTENSION_TO_LANGUAGE[ext];
  }
  return 'unknown';
}

function extractExtension(filename: string): string | null {
  const idx = filename.lastIndexOf('.');
  if (idx <= 0 || idx === filename.length - 1) return null;
  return filename.slice(idx + 1).toLowerCase();
}
