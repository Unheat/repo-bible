#!/bin/bash

# Codebase Bible - Phase 1 Setup Script
# This script creates the directory structure and configuration files for the migration

set -e  # Exit on error

echo "🚀 Starting Codebase Bible Phase 1 Setup..."
echo ""

# Step 1: Create Directory Structure
echo "📁 Creating directory structure..."
mkdir -p frontend/src/api
mkdir -p frontend/src/pages
mkdir -p frontend/src/components
mkdir -p frontend/src/types
mkdir -p frontend/public

mkdir -p backend/src/config
mkdir -p backend/src/routes
mkdir -p backend/src/controllers
mkdir -p backend/src/services
mkdir -p backend/src/lib
mkdir -p backend/src/db/migrations
mkdir -p backend/src/types
mkdir -p backend/prisma

mkdir -p shared/types
mkdir -p docs

echo "✅ Directory structure created"
echo ""

# Step 2: Create Root package.json
echo "📦 Creating root package.json..."
cat > package.json << 'EOF'
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
EOF
echo "✅ Root package.json created"
echo ""

# Step 3: Create Frontend package.json
echo "📦 Creating frontend/package.json..."
cat > frontend/package.json << 'EOF'
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
EOF
echo "✅ Frontend package.json created"
echo ""

# Step 4: Create Backend package.json
echo "📦 Creating backend/package.json..."
cat > backend/package.json << 'EOF'
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
EOF
echo "✅ Backend package.json created"
echo ""

# Step 5: Create Environment Files
echo "🔐 Creating environment files..."
cat > backend/.env.example << 'EOF'
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
EOF

cp backend/.env.example backend/.env
echo "✅ Environment files created"
echo ""

# Step 6: Create TypeScript Configurations
echo "⚙️  Creating TypeScript configurations..."

# Frontend tsconfig.json
cat > frontend/tsconfig.json << 'EOF'
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
EOF

# Frontend tsconfig.app.json
cat > frontend/tsconfig.app.json << 'EOF'
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
EOF

# Frontend tsconfig.node.json
cat > frontend/tsconfig.node.json << 'EOF'
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
EOF

# Backend tsconfig.json
cat > backend/tsconfig.json << 'EOF'
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
EOF

echo "✅ TypeScript configurations created"
echo ""

# Step 7: Create Vite Configuration
echo "⚡ Creating Vite configuration..."
cat > frontend/vite.config.ts << 'EOF'
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
EOF
echo "✅ Vite configuration created"
echo ""

# Step 8: Create Prisma Schema
echo "🗄️  Creating Prisma schema..."
cat > backend/prisma/schema.prisma << 'EOF'
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
EOF
echo "✅ Prisma schema created"
echo ""

# Step 9: Install Dependencies
echo "📥 Installing dependencies..."
echo "   This may take a few minutes..."
echo ""

npm install
echo "✅ Root dependencies installed"
echo ""

cd frontend && npm install && cd ..
echo "✅ Frontend dependencies installed"
echo ""

cd backend && npm install && cd ..
echo "✅ Backend dependencies installed"
echo ""

# Step 10: Generate Prisma Client
echo "🔧 Generating Prisma client..."
cd backend && npm run db:generate && cd ..
echo "✅ Prisma client generated"
echo ""

echo "✨ Phase 1 Setup Complete!"
echo ""
echo "📋 Summary:"
echo "   ✅ Directory structure created"
echo "   ✅ Package.json files configured"
echo "   ✅ TypeScript configurations set up"
echo "   ✅ Vite configuration created"
echo "   ✅ Prisma schema defined"
echo "   ✅ All dependencies installed"
echo "   ✅ Prisma client generated"
echo ""
echo "🎯 Next Steps:"
echo "   1. Review backend/.env and add your API keys"
echo "   2. Run file migration (next phase)"
echo "   3. Create Express server and REST API"
echo ""
echo "💡 Useful Commands:"
echo "   npm run dev              - Start both frontend and backend"
echo "   npm run dev:frontend     - Start frontend only"
echo "   npm run dev:backend      - Start backend only"
echo "   cd backend && npm run db:studio - Open Prisma Studio"
echo ""

# Made with Bob
