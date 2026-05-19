# Codebase Bible - Phase 1 Setup Script (PowerShell)
# This script creates the directory structure and configuration files for the migration

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting Codebase Bible Phase 1 Setup..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Create Directory Structure
Write-Host "📁 Creating directory structure..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "frontend/src/api" | Out-Null
New-Item -ItemType Directory -Force -Path "frontend/src/pages" | Out-Null
New-Item -ItemType Directory -Force -Path "frontend/src/components" | Out-Null
New-Item -ItemType Directory -Force -Path "frontend/src/types" | Out-Null
New-Item -ItemType Directory -Force -Path "frontend/public" | Out-Null

New-Item -ItemType Directory -Force -Path "backend/src/config" | Out-Null
New-Item -ItemType Directory -Force -Path "backend/src/routes" | Out-Null
New-Item -ItemType Directory -Force -Path "backend/src/controllers" | Out-Null
New-Item -ItemType Directory -Force -Path "backend/src/services" | Out-Null
New-Item -ItemType Directory -Force -Path "backend/src/lib" | Out-Null
New-Item -ItemType Directory -Force -Path "backend/src/db/migrations" | Out-Null
New-Item -ItemType Directory -Force -Path "backend/src/types" | Out-Null
New-Item -ItemType Directory -Force -Path "backend/prisma" | Out-Null

New-Item -ItemType Directory -Force -Path "shared/types" | Out-Null
New-Item -ItemType Directory -Force -Path "docs" | Out-Null

Write-Host "✅ Directory structure created" -ForegroundColor Green
Write-Host ""

# Step 2: Create Root package.json
Write-Host "📦 Creating root package.json..." -ForegroundColor Yellow
@"
{
  "name": "repo-bible",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
    "dev:frontend": "cd frontend && npm run dev",
    "dev:backend": "cd backend && npm run dev",
    "build": "npm run build:frontend && npm run build:backend",
    "build:frontend": "cd frontend && npm run build",
    "build:backend": "cd backend && npm run build",
    "install:all": "npm install && cd frontend && npm install && cd ../backend && npm install",
    "format": "prettier --write .",
    "typecheck": "npm run typecheck:frontend && npm run typecheck:backend",
    "typecheck:frontend": "cd frontend && npm run typecheck",
    "typecheck:backend": "cd backend && npm run typecheck"
  },
  "devDependencies": {
    "concurrently": "^8.2.2",
    "prettier": "^3.5.0"
  }
}
"@ | Out-File -FilePath "package.json" -Encoding UTF8
Write-Host "✅ Root package.json created" -ForegroundColor Green
Write-Host ""

# Step 3: Create Frontend package.json
Write-Host "📦 Creating frontend/package.json..." -ForegroundColor Yellow
@"
{
  "name": "codebase-bible-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "highlight.js": "^11.10.0",
    "mermaid": "^11.4.1",
    "react": "^19.2.5",
    "react-dom": "^19.2.5",
    "react-markdown": "^9.0.1",
    "rehype-highlight": "^7.0.1",
    "remark-gfm": "^4.0.0",
    "wouter": "^3.3.5",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.2.13",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.1",
    "typescript": "^6.0.2",
    "vite": "^8.0.8"
  }
}
"@ | Out-File -FilePath "frontend/package.json" -Encoding UTF8
Write-Host "✅ Frontend package.json created" -ForegroundColor Green
Write-Host ""

# Step 4: Create Backend package.json
Write-Host "📦 Creating backend/package.json..." -ForegroundColor Yellow
@"
{
  "name": "codebase-bible-backend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "typecheck": "tsc --noEmit",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio"
  },
  "dependencies": {
    "@prisma/client": "^6.1.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.21.2",
    "openai": "^6.35.0",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/node": "^20.12.7",
    "prisma": "^6.1.0",
    "tsx": "^4.19.2",
    "typescript": "^6.0.2"
  }
}
"@ | Out-File -FilePath "backend/package.json" -Encoding UTF8
Write-Host "✅ Backend package.json created" -ForegroundColor Green
Write-Host ""

# Step 5: Create Environment Files
Write-Host "🔐 Creating environment files..." -ForegroundColor Yellow
@"
# Server Configuration
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL="file:./dev.db"

# API Keys
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
GITHUB_TOKEN=your_github_token_here

# CORS (for development)
FRONTEND_URL=http://localhost:5173
"@ | Out-File -FilePath "backend/.env.example" -Encoding UTF8

Copy-Item "backend/.env.example" -Destination "backend/.env"
Write-Host "✅ Environment files created" -ForegroundColor Green
Write-Host ""

# Step 6: Create TypeScript Configurations
Write-Host "⚙️  Creating TypeScript configurations..." -ForegroundColor Yellow

# Frontend tsconfig.json
@"
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
"@ | Out-File -FilePath "frontend/tsconfig.json" -Encoding UTF8

# Frontend tsconfig.app.json
@"
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["src"]
}
"@ | Out-File -FilePath "frontend/tsconfig.app.json" -Encoding UTF8

# Frontend tsconfig.node.json
@"
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["vite.config.ts"]
}
"@ | Out-File -FilePath "frontend/tsconfig.node.json" -Encoding UTF8

# Backend tsconfig.json
@"
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2023"],
    "moduleResolution": "bundler",
    "rootDir": "./src",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "allowSyntheticDefaultImports": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
"@ | Out-File -FilePath "backend/tsconfig.json" -Encoding UTF8

Write-Host "✅ TypeScript configurations created" -ForegroundColor Green
Write-Host ""

# Step 7: Create Vite Configuration
Write-Host "⚡ Creating Vite configuration..." -ForegroundColor Yellow
@"
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
"@ | Out-File -FilePath "frontend/vite.config.ts" -Encoding UTF8
Write-Host "✅ Vite configuration created" -ForegroundColor Green
Write-Host ""

# Step 8: Create Prisma Schema
Write-Host "🗄️  Creating Prisma schema..." -ForegroundColor Yellow
@"
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Repository {
  id            String   @id @default(cuid())
  githubUrl     String   @unique
  repoName      String
  status        String   // 'pending' | 'processing' | 'completed' | 'failed'
  docsStatus    String?  // 'idle' | 'generating' | 'completed' | 'failed'
  lastScannedAt Int?     // Unix timestamp in milliseconds
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  files         File[]
  generatedDocs GeneratedDoc[]

  @@map("repositories")
}

model File {
  id           String   @id @default(cuid())
  repositoryId String
  filePath     String
  language     String
  rawContent   String?  // Full file content
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  repository Repository   @relation(fields: [repositoryId], references: [id], onDelete: Cascade)
  chunks     CodeChunk[]
  docs       GeneratedDoc[]

  @@unique([repositoryId, filePath])
  @@map("files")
}

model CodeChunk {
  id         String   @id @default(cuid())
  fileId     String
  chunkIndex Int
  chunkText  String
  embedding  String   // JSON-serialized float array
  createdAt  DateTime @default(now())

  file File @relation(fields: [fileId], references: [id], onDelete: Cascade)

  @@unique([fileId, chunkIndex])
  @@map("code_chunks")
}

model GeneratedDoc {
  id              String   @id @default(cuid())
  repositoryId    String
  fileId          String?  // null for overview docs
  docType         String   // 'overview' | 'file'
  markdownContent String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  repository Repository @relation(fields: [repositoryId], references: [id], onDelete: Cascade)
  file       File?      @relation(fields: [fileId], references: [id], onDelete: Cascade)

  @@unique([repositoryId, fileId])
  @@map("generated_docs")
}
"@ | Out-File -FilePath "backend/prisma/schema.prisma" -Encoding UTF8
Write-Host "✅ Prisma schema created" -ForegroundColor Green
Write-Host ""

# Step 9: Install Dependencies
Write-Host "📥 Installing dependencies..." -ForegroundColor Yellow
Write-Host "   This may take a few minutes..." -ForegroundColor Gray
Write-Host ""

npm install
Write-Host "✅ Root dependencies installed" -ForegroundColor Green
Write-Host ""

Set-Location frontend
npm install
Set-Location ..
Write-Host "✅ Frontend dependencies installed" -ForegroundColor Green
Write-Host ""

Set-Location backend
npm install
Set-Location ..
Write-Host "✅ Backend dependencies installed" -ForegroundColor Green
Write-Host ""

# Step 10: Generate Prisma Client
Write-Host "🔧 Generating Prisma client..." -ForegroundColor Yellow
Set-Location backend
npm run db:generate
Set-Location ..
Write-Host "✅ Prisma client generated" -ForegroundColor Green
Write-Host ""

Write-Host "✨ Phase 1 Setup Complete!" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Summary:" -ForegroundColor White
Write-Host "   ✅ Directory structure created" -ForegroundColor Green
Write-Host "   ✅ Package.json files configured" -ForegroundColor Green
Write-Host "   ✅ TypeScript configurations set up" -ForegroundColor Green
Write-Host "   ✅ Vite configuration created" -ForegroundColor Green
Write-Host "   ✅ Prisma schema defined" -ForegroundColor Green
Write-Host "   ✅ All dependencies installed" -ForegroundColor Green
Write-Host "   ✅ Prisma client generated" -ForegroundColor Green
Write-Host ""
Write-Host "🎯 Next Steps:" -ForegroundColor Yellow
Write-Host "   1. Review backend/.env and add your API keys"
Write-Host "   2. Run file migration (next phase)"
Write-Host "   3. Create Express server and REST API"
Write-Host ""
Write-Host "💡 Useful Commands:" -ForegroundColor Cyan
Write-Host "   npm run dev              - Start both frontend and backend"
Write-Host "   npm run dev:frontend     - Start frontend only"
Write-Host "   npm run dev:backend      - Start backend only"
Write-Host "   cd backend && npm run db:studio - Open Prisma Studio"
Write-Host ""

# Made with Bob
