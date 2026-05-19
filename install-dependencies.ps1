# Phase 3 - Dependency Installation Script
# This script installs all required dependencies for the Codebase Bible application

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Codebase Bible - Dependency Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js version
Write-Host "Checking Node.js version..." -ForegroundColor Yellow
$nodeVersion = node --version
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Node.js is not installed!" -ForegroundColor Red
    Write-Host "Please install Node.js 18+ from https://nodejs.org/" -ForegroundColor Red
    exit 1
}
Write-Host "Node.js version: $nodeVersion" -ForegroundColor Green

# Check npm version
$npmVersion = npm --version
Write-Host "npm version: $npmVersion" -ForegroundColor Green
Write-Host ""

# Install backend dependencies
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Installing Backend Dependencies..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Set-Location backend
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Backend dependency installation failed!" -ForegroundColor Red
    Set-Location ..
    exit 1
}
Write-Host "✓ Backend dependencies installed successfully!" -ForegroundColor Green
Set-Location ..
Write-Host ""

# Install frontend dependencies
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Installing Frontend Dependencies..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Set-Location frontend
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Frontend dependency installation failed!" -ForegroundColor Red
    Set-Location ..
    exit 1
}
Write-Host "✓ Frontend dependencies installed successfully!" -ForegroundColor Green
Set-Location ..
Write-Host ""

# Verify installations
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Verifying Installations..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "Running backend typecheck..." -ForegroundColor Yellow
Set-Location backend
npm run typecheck 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Backend typecheck passed!" -ForegroundColor Green
} else {
    Write-Host "⚠ Backend typecheck has errors (expected - we have not set up Prisma yet)" -ForegroundColor Yellow
}
Set-Location ..

Write-Host "Running frontend typecheck..." -ForegroundColor Yellow
Set-Location frontend
npm run typecheck 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Frontend typecheck passed!" -ForegroundColor Green
} else {
    Write-Host "⚠ Frontend typecheck has errors (expected - API client not implemented yet)" -ForegroundColor Yellow
}
Set-Location ..
Write-Host ""

# Success message
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Installation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Create backend/.env file with your API keys" -ForegroundColor White
Write-Host "  2. Initialize Prisma database (Task 2)" -ForegroundColor White
Write-Host "  3. Set up Express server (Task 3)" -ForegroundColor White
Write-Host "  4. Implement API client (Task 4)" -ForegroundColor White
Write-Host ""
Write-Host "To start development after setup:" -ForegroundColor Yellow
Write-Host "  Backend:  cd backend && npm run dev" -ForegroundColor White
Write-Host "  Frontend: cd frontend && npm run dev" -ForegroundColor White
Write-Host ""

# Made with Bob
