# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project Overview

NocoDB-Things Sync CLI - A Deno TypeScript application that synchronizes data
between NocoDB (database) and Things 3 (macOS task manager).

## Commands

- **Run development mode**: `deno task dev`
- **Run CLI**: `deno task start [command] [options]`
- **Run tests**: `deno task test`
- **Format code**: `deno task fmt`
- **Lint code**: `deno task lint`

## Architecture

The application follows a modular architecture with clear separation of
concerns:

- **CLI Layer** (`src/cli/`): Command parsing and user interaction using Deno's
  standard library
- **API Layer** (`src/api/`): Abstractions for NocoDB REST API and Things
  AppleScript/URL scheme integration
- **Sync Engine** (`src/sync/`): Core synchronization logic with bidirectional
  sync, conflict resolution, and data mapping
- **Configuration** (`src/config/`): Persistent configuration management stored
  in `~/.nocodb-things/`
- **State Management** (`src/utils/state.ts`): Tracks sync history and
  statistics

## Key Technical Details

### NocoDB Integration

- Uses REST API with token authentication
- Supports CRUD operations on table records
- Handles pagination for large datasets

### Things App Integration

- Primary: URL scheme (`things:///`) for creating tasks
- Secondary: AppleScript for reading tasks and updates
- No direct API, requires creative workarounds

### Sync Strategy

- Timestamp-based change detection
- Three modes: push (to NocoDB), pull (from NocoDB), sync (bidirectional)
- Conflict resolution with configurable strategies
- Field mapping system for schema flexibility

## Testing Approach

Use Deno's built-in test runner with `@std/assert` for assertions. Test files
follow the `*_test.ts` naming convention.
