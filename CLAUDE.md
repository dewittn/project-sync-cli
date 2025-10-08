# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project Overview

prjsync - A Deno TypeScript CLI that synchronizes projects from Things 3 (macOS
task manager) to NocoDB (database platform).

## Commands

- **Run development mode**: `deno task dev`
- **Run CLI**: `deno task start [command] [options]`
- **Sync projects**: `deno task start` or `deno task start sync`
- **List projects**: `deno task start list-projects`
- **Configure mappings**: `deno task start map`
- **Run tests**: `deno task test`
- **Format code**: `deno task fmt`
- **Lint code**: `deno task lint`

## Architecture

The application follows a modular architecture with clear separation of
concerns:

- **CLI Layer** (`src/cli/`): Command parsing and user interaction using Deno's
  standard library
- **API Layer** (`src/api/`): Abstractions for NocoDB REST API and Things
  AppleScript integration
- **Configuration** (`src/config/`): Persistent configuration management stored
  in `~/.prjsync/`
- **State Management** (`src/utils/state.ts`): Tracks sync history and
  statistics

## Key Technical Details

### NocoDB Integration

- Uses REST API with token authentication
- Supports CRUD operations on table records
- Handles pagination for large datasets

### Things App Integration

- AppleScript for reading projects and their properties
- No direct API, requires creative workarounds
- Extracts project title, UUID, notes, and area

### Sync Strategy

- One-way sync: Things projects → NocoDB records
- Projects matched by title
- Automatic UUID tracking
- Field mapping system for flexible schema alignment
- Visual mapping diagram in map command

## Testing Approach

Use Deno's built-in test runner with `@std/assert` for assertions. Test files
follow the `*_test.ts` naming convention.
