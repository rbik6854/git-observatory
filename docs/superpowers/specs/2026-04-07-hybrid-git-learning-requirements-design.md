# Hybrid Git Learning Requirements Design

## Summary

This document freezes the product requirements for a desktop-first Git learning system that teaches Git and GitHub from first principles through visualization, guided workflows, and sandboxed experimentation. The product is not a cheat sheet, not only a graph visualizer, and not only a playground. It is a blended learning system where internals understanding is the primary goal and workflows exist to show those internals in action.

## Product Goal

Build a desktop-first learning product that helps beginner through advanced developers understand how Git works internally, how real workflows behave in professional repositories, and how GitHub collaboration maps back to Git internals.

The primary success outcome for version 1 is:

- A learner can understand Git internals deeply enough to reason about real workflows instead of memorizing commands.

## Product Positioning

The product must be treated as:

- an internals-first education system
- a blended curriculum plus playground experience
- a realistic workflow simulator
- a GitHub-through-Git teaching tool

The product must not be treated as:

- a static Git tutorial
- a command reference or cheatsheet
- a generic Git GUI client
- a toy-only teaching demo detached from real repository behavior

## User Personas

### 1. New Developer

A beginner entering software development who has little or no Git understanding and needs correct mental models from zero.

### 2. Command User Without Mental Model

A developer who has used Git commands before but does not understand blobs, index mechanics, refs, remotes, rebases, or recovery.

### 3. Workflow-Struggling Intermediate Developer

A developer who can perform basic tasks but struggles with conflicts, rebases, divergence, history rewriting, recovery, and collaboration patterns.

### 4. Advanced Learner

A developer who wants deeper inspection of Git internals, large-repo behavior, storage mechanics, and the relationship between GitHub workflows and Git state changes.

## Product Principles

### 1. Internals First

The primary emphasis is teaching internals. Every important workflow must explain:

- what changed in the working tree
- what changed in the index
- what changed in the object database
- what changed in refs, HEAD, remote-tracking refs, or upstream state
- why those changes happened

The product must explicitly teach:

- hashing and content addressing
- blob creation and reuse
- tree construction
- commit construction
- refs and symbolic refs
- index/staging mechanics
- merge and rebase internals
- conflict states
- reflog and recovery
- packfiles and storage optimization
- remote synchronization and divergence

### 2. Blended Learning

Guided learning and free exploration are both first-class product surfaces.

Requirements:

- Users must be able to jump directly into practice or playground mode without following the curriculum.
- Every major concept should exist in both guided and exploratory forms.
- Guided content should provide structure for learners who want direction.
- Practice mode should support direct experimentation for learners who prefer discovery.
- Users should be able to move between lesson, story, and practice contexts without losing orientation.

### 3. Real-World Fidelity

Guided workflows must mimic realistic professional repository behavior, including large-repo pressures where relevant. The UI may simplify presentation, but it must not teach false mental models.

Requirements:

- Show moving branch tips and changing upstream state.
- Include realistic branch and remote flows.
- Represent conflict and recovery states faithfully.
- Expose performance-aware limits for larger repositories.
- Label any teaching simplification clearly when it hides complexity.

### 4. GitHub Through Git

GitHub concepts must be taught by mapping them back to Git internals, not as an unrelated layer.

Requirements:

- Explain PRs in terms of branches, commits, diffs, and merge outcomes.
- Explain branch protection as workflow constraints over Git operations.
- Explain merge strategies in terms of resulting history shape.
- Explain local state, remote state, and hosted collaboration distinctly.

### 5. Desktop-First, Future-Portable

Version 1 targets desktop first because local Git execution, sandboxes, terminal access, and filesystem-backed experimentation are core teaching tools.

Requirements:

- Desktop-only capabilities may be used when they materially improve the learning model.
- Shared lesson data, domain models, and visualization logic should remain portable to a future web surface.
- Requirements must distinguish desktop-only capabilities from product concepts that should stay cross-platform.

## Product Modes

### Guided Curriculum Mode

The structured path for learners who want progression from beginner to advanced concepts.

### Practice / Playground Mode

A sandboxed environment for direct experimentation that is available immediately from the product entry point.

### Workflow / Story Mode

A guided spectator or step-driven experience that demonstrates realistic end-to-end workflows and their internal consequences.

### Advanced Inspection Mode

A deeper inspection surface for learners who want to inspect objects, refs, storage state, remote state, or workflow consequences at a more technical level.

These are different entry points into the same product, not separate products.

## Core User Journeys

### Journey 1: Learn Git From Zero

The learner should be able to start from an empty folder and understand:

- what `git init` creates
- how files become blobs
- what the index stores
- how trees and commits are formed
- how refs and HEAD move

### Journey 2: Jump Straight Into Practice

The learner should be able to open a disposable repository or an existing local repository and experiment without going through lessons first.

### Journey 3: Observe Realistic End-to-End Workflow

The learner should be able to watch or step through a realistic branch-to-release flow involving branching, remote sync, rebase, conflict resolution, rewritten history, and publish steps.

### Journey 4: Understand Recovery

The learner should be able to make mistakes and then understand how Git preserves recoverability through reflog and history state.

### Journey 5: Understand GitHub Through Internals

The learner should be able to understand what GitHub collaboration concepts mean in terms of Git state and history changes.

## Learning Model Requirements

Every important concept must include:

- a plain-language explanation
- an internal explanation
- a live or inspectable visualization
- a hands-on or observable workflow

Every important workflow must include:

- what command or action happened
- what changed internally
- what changed locally vs remotely
- what the learner should notice next

The product must use progressive disclosure:

- beginner-friendly explanation first
- deeper internals available on demand

## Frozen Must-Have Feature Set For Version 1

### A. Core Learning Experience

- Guided curriculum from beginner to advanced
- Immediate access to practice/playground mode
- Story/workflow mode for realistic repo scenarios
- Seamless switching between lesson, story, and practice
- Clear explanation of internal state transitions after each important action

### B. Internals Visualization

- Working tree visualization
- Index/staging visualization
- Object model visualization for blobs, trees, commits, and tags
- Ref and HEAD visualization
- Remote and upstream visualization
- Packfile and storage inspection surface
- Explicit explanation of hashing and object identity
- Explicit explanation of index mechanics and staged vs unstaged state

### C. Real Workflow Education

- Branch creation and branch switching
- Commit creation
- Merge workflows
- Rebase workflows
- Conflict resolution
- Push, fetch, and pull
- Upstream divergence explanation
- Rewritten history and force-push explanation
- Recovery workflows using reflog-oriented mental models
- Large-repo-aware selective inspection and truncated views

### D. GitHub Through Git

- GitHub collaboration concepts explained through Git internals
- Pull request mental model
- Branch protection mental model
- Merge strategy outcomes
- Hosted remote vs local repository distinction

### E. Desktop-First Capabilities

- Disposable learning sandboxes
- Open local repositories
- Embedded terminal
- System terminal handoff
- In-app workspace file editing for cause-and-effect learning
- Repo watching and refresh behavior that stays understandable

### F. UX Clarity Requirements

The UI must always make it easy to answer:

- where am I
- what just changed
- what part of Git changed
- what is local vs remote
- what should I do next

### G. Quality Requirements

- Strong documentation for product requirements and workflows
- Regression coverage for critical domain logic
- Regression coverage for critical UI and workflow behavior
- Reliability in core learning flows
- Performance-aware behavior for larger repositories

## Should-Have Soon After Version 1

- Side-by-side comparison of similar commands or workflows
- Replay and time-travel controls
- Diagnostic explainer for confusing states
- Multiple realistic repo templates
- Learning checkpoints or assessments
- Deeper GitHub workflow scenarios

## Out Of Scope For Initial Version 1

- Full GitHub integration as a mandatory dependency
- Multi-user real-time collaboration
- IDE replacement behavior
- Complete coverage of all plumbing commands
- Web parity at launch

## Current Repo Feature Map

### Already Present In The Repo

- desktop shell
- local repository opening
- disposable practice sandbox
- story mode
- lesson content seed
- live Git-state inspection
- terminal integration
- in-app workspace editing
- remote divergence awareness
- some performance-aware truncation

### Present But Underdefined Or Incomplete

- full beginner-to-advanced progression
- formal learning model
- realistic large-repo teaching scenarios
- deeper internals teaching around hashing and index maintenance
- GitHub teaching layer
- explicit UX boundaries between product modes
- quality and testing depth expected for version 1

### Missing As Formal Product Contracts

- frozen requirements spec
- competency model
- feature requirements matrix
- acceptance criteria per mode
- documentation tying product behavior to intended learning outcomes

## Acceptance Criteria Categories

The eventual implementation plan and feature work must be testable against these categories:

- learning correctness
- workflow fidelity
- UX clarity
- reliability and safety
- performance on non-trivial repositories
- documentation completeness
- regression coverage on critical behavior

## Risks And Constraints

### 1. Product Drift Risk

Without a frozen requirements contract, the codebase can drift into an unfocused mix of desktop tooling, visual experiments, and incomplete learning flows.

### 2. Oversized Implementation Hotspots

Large files in the renderer and analysis packages indicate that the current implementation has outgrown its decomposition. This is a delivery and maintainability risk, not only a code-style concern.

### 3. Fidelity Risk

If the guided flows oversimplify Git or GitHub too aggressively, learners will develop incorrect mental models that break in professional repositories.

### 4. Performance Risk

If large-repo realities are treated as an afterthought, the product will fail both as a teaching tool and as an inspection tool for realistic use cases.

## Frozen Decisions

The following decisions are now treated as frozen unless explicitly changed later:

- The product is hybrid, not lesson-only and not playground-only.
- The main emphasis is teaching Git internals from first principles.
- Users can jump directly into practice mode.
- Guided workflows must mimic real-world large-repo behavior.
- GitHub concepts are integrated throughout and always mapped back to Git internals.
- Version 1 is desktop-first.
- Teaching clarity, UX quality, reliability, and large-repo performance are all mandatory.

## Next Step

The next step after approval of this document is to produce a detailed implementation plan that:

- maps the frozen requirements to current repo gaps
- decomposes work into bounded tracks
- defines documentation deliverables
- defines quality gates and validation commands
- identifies which current code paths need refactoring before new feature work can scale safely
