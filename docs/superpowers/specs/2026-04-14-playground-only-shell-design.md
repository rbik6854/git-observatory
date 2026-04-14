# Playground-Only Shell Design

## Summary

This design narrows the desktop app to its core playground experience: create a disposable Git playground, let the user run Git commands in their own system terminal, and show the resulting Git state on a large visual canvas.

The first implementation slice removes product surfaces that do not serve that loop directly. The app should stop presenting itself as a broad lesson system, repo browser, workflow movie, command runner, or file editor. It should behave like a focused visual companion for Git experimentation.

## Product Goal

The user can create a playground repository, run Git commands outside the app, and immediately see the repository state change on the canvas.

## Scope Decisions

- Keep `New Playground` as the only entry point.
- Remove `Open Repo` for now.
- Remove the embedded terminal entirely.
- Keep system terminal handoff as a convenience action after playground creation.
- Keep the Git graph canvas as the primary surface.
- Keep repository watching and manual refresh.
- Remove lesson, story, movie, command-guide, terminal-history, and in-app file-editor surfaces from the first shell.
- Keep selection details only if they are compact and do not compete with the canvas.

## User Flow

### Empty State

The app opens to a minimal launcher with:

- product title: `Git Observatory`
- primary action: `New Playground`

No repo picker, lesson picker, story picker, mode tabs, explanatory cards, or secondary onboarding content should appear.

### Playground State

After the user creates a playground:

- the app creates a disposable sandbox repository
- the app starts watching that repository
- the app renders the Git graph canvas
- the canvas uses as much of the window as possible
- the top bar stays thin and functional

The top bar should include:

- playground path
- `Open System Terminal`
- `Refresh`
- `Reset Playground` if cleanup and recreation is already reliable

The user runs Git commands in the external terminal. File watcher events and manual refresh update the canvas.

## UI Requirements

- The graph canvas is the main product.
- The canvas must not look like an embedded preview inside a decorative card.
- UI chrome should be limited to the controls needed to create, locate, refresh, and reset the playground.
- No right rail should be visible by default.
- No terminal panel should exist in the renderer.
- No redundant teaching copy should appear in the default path.
- Error messages should be short and actionable.
- The layout should stay useful on narrower desktop windows by preserving canvas priority.

## Technical Design

### Renderer

The renderer should be simplified around these states:

- no playground yet
- playground loading
- playground ready
- refresh error

The renderer should keep only the state needed for:

- current sandbox descriptor
- current repo path
- current snapshot
- current graph projection
- selected graph item, if selection remains
- busy or error status

Remove renderer state and UI for:

- mode switching
- lesson content
- story playback
- embedded terminal sessions
- command history
- in-app workspace editing
- detailed side panels that are not essential to the canvas loop

### Main Process

Keep IPC handlers for:

- creating sandbox repositories
- inspecting repositories
- inspecting objects if compact selection details still use it
- opening the system terminal
- starting and stopping repository watchers
- removing sandbox repositories

Remove IPC handlers and runtime code for embedded terminal sessions:

- create terminal
- write terminal
- resize terminal
- close terminal
- read terminal buffer
- terminal event channel
- node-pty terminal manager

The app may keep Git command execution only if existing automated story or command surfaces still need it during migration. The target playground-only shell should not expose command execution in the UI.

### Shared Packages

The first implementation should avoid broad domain or lesson refactors. Lesson packages can remain in the repo even if unused by the shell. Package cleanup can follow after the playground-only UI is stable.

## Testing Strategy

Update tests around the new core loop:

- launcher renders only `New Playground`
- creating a playground shows the canvas
- embedded terminal UI is absent
- repo watching or manual refresh updates the graph after an external Git change
- system terminal handoff remains available after playground creation

Remove or replace e2e tests that assert embedded terminal behavior.

Unit tests should remain focused on existing graph projection, Git inspection, and sandbox behavior. The implementation should avoid changing those contracts unless the UI simplification exposes a real bug.

## Acceptance Criteria

- A fresh app launch shows only the minimal playground launcher.
- `New Playground` creates a repository and renders a large canvas.
- There is no `Open Repo` action.
- There is no embedded terminal or command input.
- The user can open their system terminal at the playground path.
- Running Git commands externally can be reflected by refresh or watch updates.
- The canvas receives the majority of available window space.
- Existing package tests pass.
- The desktop shell builds.

## Out Of Scope

- Guided lessons
- Story or movie mode
- Opening arbitrary existing repositories
- In-app terminal emulation
- In-app file editing
- GitHub collaboration teaching
- Large-repo teaching surfaces
- Full product cleanup outside the playground shell

## Risks

### Existing Dirty Worktree

Several source files already have uncommitted changes. The implementation must preserve those changes unless the user explicitly asks to replace them.

### Renderer Size

The current renderer file is large and mixes several product modes. The first pass may be a targeted simplification rather than a perfect decomposition. If the file remains too large after behavior removal, a follow-up refactor can split the playground shell, graph surface, and selection details.

### Test Drift

Existing e2e tests may encode the old embedded terminal behavior. Those tests should be updated to assert the new product contract instead of deleted without replacement.

## Next Step

After approval of this spec, write an implementation plan that removes the unused UI surfaces first, updates tests around the playground-only loop, then removes embedded terminal main-process code once the renderer no longer depends on it.
