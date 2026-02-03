# Subbie-HQ
Subcontractors Contracts Management App
You are acting as a senior frontend engineer and UX refactor specialist.

This repository contains an early-stage web app called Subbie HQ, designed for construction subcontractors. The UI exists but is inconsistent, partially incomplete, and needs to be normalised and improved without changing product intent.

CRITICAL CONSTRAINTS (DO NOT VIOLATE)

Do not turn this into a project management tool

Do not add task boards, kanban, or scheduling systems

Do not redesign flows — refine and normalise what exists

Do not delete pages unless they are clearly broken duplicates

Keep projects/jobs as the core context for all features

PRODUCT CONTEXT (VERY IMPORTANT)

Subbie HQ works like this:

User lands on a Launchpad / All Projects dashboard

User selects a Project / Job

Inside a project, a left-side navigation appears with:

Overview

Contract

Scope

Programme

Payment Claims / Invoices

Evidence

Settings

All screens except Launchpad are project-scoped.

YOUR TASK
1. Audit the existing codebase

Identify:

Inconsistent layouts

Duplicate or conflicting components

Missing or half-rendered pages

Inconsistent headings, spacing, and typography

Do not assume missing files are intentional — flag them.

2. Normalise the UI structure

Refactor so that:

There is a single, consistent layout system

Project-scoped pages share:

A persistent project header (project name, context)

The same left navigation

Page headers follow a consistent pattern:

Page title

Optional description

Primary action (if applicable)

3. Improve clarity (not complexity)

Make the primary action on each page obvious

Reduce visual noise where information is secondary

Use subtle labels/badges for:

Confirmed vs assumed vs unclear data

Parsed vs manually reviewed content

No heavy alerts or flashy UI.

4. Complete missing pages

If navigation links exist but pages are missing or broken:

Create placeholder pages

Use mock data

Ensure every route renders cleanly

5. Keep everything frontend-only for now

No backend wiring yet

Use mocked data or temporary state

Focus on structure, consistency, and UX correctness

OUTPUT EXPECTATIONS

Refactored components

Cleaner layouts

Consistent page structure

No new features

No backend logic

Minimal but professional styling

The final UI should feel like:

“This app has my back and helps me stay paid — without getting in my way.”

Proceed carefully, refactoring incrementally and preserving existing intent wherever possible.
