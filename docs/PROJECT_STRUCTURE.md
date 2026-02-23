# Project Structure

## Root Directory Organization

```
fourcast/
├── app/                    # Next.js app directory (pages, API routes, components)
├── components/             # Shared React components
├── constants/              # Application constants
├── contracts/              # Solidity smart contracts
├── docs/                   # Documentation
├── hooks/                  # React hooks
├── markets/                # Market-related utilities
├── move/                   # Move language smart contracts (Aptos/Movement)
├── onchain/                # On-chain interaction utilities
├── public/                 # Static assets
├── scripts/                # Build and utility scripts
├── sdk/                    # @fourcast/signal-sdk package
├── services/               # Backend services (AI, DB, APIs)
├── tests/                  # Test files
├── types/                  # TypeScript type definitions
├── utils/                  # Utility functions
└── bin/                    # Binary executables (gitignored)
```

## Key Directories

### `/app` - Next.js Application
- `app/api/` - API routes (agent, markets, predictions, etc.)
- `app/components/` - Page-specific components
- `app/[page]/` - Application pages (vision, markets, signals)

### `/components` - Shared Components
Reusable UI components used across multiple pages:
- Weather visualizations
- 3D scenes
- Dashboard components
- Form controls

### `/services` - Backend Services
Core business logic and external integrations:
- `aiService.server.js` - AI/LLM integration (Venice AI)
- `db.js` - Database operations (SQLite/Turso)
- `polymarketService.js` - Polymarket API integration
- `kalshiService.js` - Kalshi API integration
- `weatherService.js` - Weather data fetching
- `arbitrageService.js` - Cross-platform arbitrage detection
- `redisService.js` - Redis caching

### `/sdk` - Signal SDK Package
Standalone npm package for building custom signal analyzers:
- Published as `@fourcast/signal-sdk`
- Includes TypeScript definitions
- Has its own `node_modules` (not tracked in git)

### `/contracts` - Smart Contracts
- `PredictionReceipt.sol` - EVM-compatible prediction logging
- `PredictionReceiptERC20.sol` - ERC20 token integration

### `/move` - Move Smart Contracts
Aptos/Movement blockchain contracts for signal registry

### `/docs` - Documentation
- API references
- Architecture guides
- Setup instructions
- Integration guides

## Configuration Files

### Environment Variables
- `.env` - Local environment variables (gitignored)
- `.env.local` - Local overrides (gitignored)
- `.env.local.example` - Template for required env vars

### Build Configuration
- `next.config.js` - Next.js configuration
- `tailwind.config.js` - Tailwind CSS configuration
- `tsconfig.json` - TypeScript configuration
- `vitest.config.js` - Test configuration
- `postcss.config.cjs` - PostCSS configuration

### Package Management
- `package.json` - Main dependencies
- `package-lock.json` - Locked dependency versions
- `pnpm-lock.yaml` - PNPM lock file (if using PNPM)

## Ignored Directories

These directories are generated and should not be committed:

### Build Artifacts
- `.next/` - Next.js build output
- `dist/` - Compiled distribution files
- `build/` - Production build

### Dependencies
- `node_modules/` - npm packages
- `sdk/node_modules/` - SDK dependencies

### Database Files
- `fourcast.db` - SQLite database
- `*.db-shm`, `*.db-wal` - SQLite temporary files

### IDE & Tools
- `.qoder/`, `.qodo/`, `.trae/` - AI coding assistants
- `.zencoder/`, `.zenflow/` - Code generation tools
- `.vscode/`, `.idea/` - IDE configurations
- `.cursor/`, `.windsurf/` - AI IDE configs

### Blockchain CLI
- `.aptos/` - Aptos CLI configuration
- `.aptos-testnet/` - Testnet configuration
- `.movement/` - Movement CLI configuration
- `movement-key.txt*` - Private keys

### OS Files
- `.DS_Store` - macOS metadata
- `Thumbs.db` - Windows metadata

## Best Practices

### Adding New Files
1. Place files in the appropriate directory based on their purpose
2. Use consistent naming conventions (kebab-case for files, PascalCase for components)
3. Update this document if adding new top-level directories

### Environment Variables
1. Never commit `.env` or `.env.local` files
2. Always update `.env.local.example` when adding new required variables
3. Document environment variables in `docs/SETUP_GUIDE.md`

### Dependencies
1. Use `npm install` for main project dependencies
2. SDK has separate dependencies - run `npm install` in `sdk/` directory
3. Keep `package.json` organized with clear sections

### Database
1. Database files are auto-generated and should never be committed
2. Schema changes should be documented in `services/db.js`
3. Use migrations for production database changes

### Smart Contracts
1. Solidity contracts go in `/contracts`
2. Move contracts go in `/move`
3. Keep deployment scripts in `/scripts`

## Cleanup

To remove tracked files that should be ignored:

```bash
./scripts/cleanup-repo.sh
```

This will:
- Remove `sdk/node_modules` from git tracking
- Remove database files from git tracking
- Remove IDE config directories
- Remove OS metadata files
- Keep all files locally, only remove from git

## Related Documentation

- [Setup Guide](./SETUP_GUIDE.md) - Initial project setup
- [API Reference](./API_REFERENCE.md) - API endpoint documentation
- [Architecture Guide](./ARCHITECTURE_GUIDE.md) - System architecture
- [Agent Improvements](./AGENT_IMPROVEMENTS.md) - Agent system enhancements
