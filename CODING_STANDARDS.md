# Coding Standards

## 1. Architecture

### 1.1 One state owner

Each concern has one controller/store owner. UI components receive reactive data
and callbacks; they do not reach into another controller's internals.

### 1.2 One-way dependencies

Application composition may import packages and UI. Framework-neutral packages
must not import Solid, React, or application code. UI must not import the
application composition root.

### 1.3 One renderer path

A parity implementation replaces its temporary predecessor in the same slice.
Do not retain Druk and Hunk diff engines as permanent parallel paths.

## 2. Runtime

### 2.1 Bun only

Do not add Node runtime compatibility, Node transports, `ws`, npm task runners,
or Node setup in CI. Browser-compatible APIs are allowed when Bun supplies them.

### 2.2 OpenTUI remains native

Use OpenTUI's native renderer and Solid reconciler. Never mount React inside the
Solid tree.

## 3. Review contract

### 3.1 Broker stays application-opaque

Session broker packages carry typed envelopes but do not interpret review state.
Review-domain semantics belong in `review-protocol` and host adapters.

### 3.2 Exact targets

Navigation and comments use stable document, hunk, side, and line identities.
Never infer targets from visible text or row positions.

### 3.3 Local security

Preserve body limits, wire validation, stale-session expiry, loopback defaults,
and DNS-rebinding protections from Hunk's daemon.

## 4. Diff quality

### 4.1 Framework-neutral plans

Pierre parsing, Shiki/TextMate highlighting, word-diff planning, geometry, and
annotation anchoring produce plain typed models. Solid only renders those models.

### 4.2 Terminal correctness

Measure terminal cells, not JavaScript string length. Cover CJK, combining marks,
emoji, wrapping, narrow layouts, and real PTY behavior.

## 5. Delivery

### 5.1 Closed slices

Every slice includes implementation, all in-scope consumers, docs, tests, and
visible evidence. No speculative compatibility paths.

### 5.2 Provenance

Retain the three copyright lines in `LICENSE`. Record material Hunk/Druk-derived
code in `NOTICE` and focused source comments where origin would otherwise be lost.

### 5.3 Verification

Focused tests guide iteration; `mise run verify` is the repository gate. Never
bypass hooks or publish from a local terminal.
