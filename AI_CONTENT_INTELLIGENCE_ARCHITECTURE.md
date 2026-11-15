# LINKEDIN AUTOPILOT — AI CONTENT INTELLIGENCE & UNIQUENESS ARCHITECTURE
**Company:** GT InnoX LLP  
**Product:** LinkedIn Autopilot SaaS (`https://autopilot.gtinnox.in`)  
**Date:** November 15, 2026  
**Status:** Implemented & Verified in Production Pipeline  

---

## 1. System Overview

The **Content Intelligence & Uniqueness Engine** replaces the legacy single-prompt generator with a multi-stage, domain-grounded generative synthesis architecture. Rather than treating all topics as generic corporate marketing announcements, the engine understands the subject, classifies the domain, extracts real technical mechanics, selects a dynamic narrative arc, adapts to the tenant's writing style, and verifies post quality and uniqueness before returning output.

```
                                  ┌───────────────────────────────┐
                                  │          User Prompt          │
                                  │      (Raw Topic String)       │
                                  └──────────────┬────────────────┘
                                                 │
                                                 ▼
                                  ┌───────────────────────────────┐
                                  │   Stage A: Topic Analysis     │
                                  │   - Main Subject & Subtopic   │
                                  │   - Industry Classification   │
                                  │   - Technical Complexity      │
                                  └──────────────┬────────────────┘
                                                 │
                                                 ▼
                                  ┌───────────────────────────────┐
                                  │   Stage B: Content Classifier │
                                  │   - 24 Specific Categories    │
                                  │   - Hybrid Topic Detection    │
                                  └──────────────┬────────────────┘
                                                 │
                                                 ▼
                                  ┌───────────────────────────────┐
                                  │  Stage C: Knowledge Extraction│
                                  │  - Domain Ontologies (Terms)  │
                                  │  - Core Technical Mechanics   │
                                  │  - Practical Heuristics       │
                                  └──────────────┬────────────────┘
                                                 │
                                                 ▼
                                  ┌───────────────────────────────┐
                                  │  Stage D: Narrative Engine    │
                                  │  - 15 Dynamic Narrative Arcs  │
                                  │  - Non-Monolithic Frameworks  │
                                  └──────────────┬────────────────┘
                                                 │
                                                 ▼
     ┌────────────────────────┐                  │                  ┌────────────────────────┐
     │  Stage E: Tenant Corpus│ ─────────────────┼───────────────── │ Stage F: Style Profile │
     │  - Recent 20 Posts     │                  │                  │ - Rhythm & Cadence     │
     │  - Scoped by Tenant ID │                  │                  │ - Formality & Emojis   │
     └────────────────────────┘                  │                  └────────────────────────┘
                                                 ▼
                                  ┌───────────────────────────────┐
                                  │  Stage G: Prompt Construction │
                                  │  - Anti-Cliché Directives     │
                                  │  - Grounded Terminology       │
                                  │  - Google Gemini 1.5 Flash    │
                                  └──────────────┬────────────────┘
                                                 │
                                                 ▼
                                  ┌───────────────────────────────┐
                                  │  Stage H: Quality Gate        │
                                  │  - 100-Point Composite Index  │
                                  │  - Hook & Conclusion Check    │
                                  │  - Banned Cliché Detector     │
                                  └──────────────┬────────────────┘
                                                 │
                         ┌───────────────────────┴───────────────────────┐
                         ▼                                               ▼
               [Failed / Repetitive]                                [Passed]
                         │                                               │
                         ▼                                               ▼
             [Narrative Arc Pivot &                                [Return Post &
               Bounded Retry (≤2)]                               Quality Telemetry]
```

---

## 2. Architectural Pipeline Stages

### Stage A & B: Topic Understanding & Hybrid Classification
The engine inspects the input string and determines:
- **Main Subject & Subtopic:** Extracted via lexical tokenization and domain keyword matching.
- **Content Category (24 Supported Classes):**
  - `technical_knowledge`, `software_engineering`, `artificial_intelligence`, `data_science`, `cloud_architecture`, `cybersecurity`, `databases`, `business_entrepreneurship`, `startup_updates`, `product_announcements`, `project_showcases`, `professional_achievements`, `certifications`, `learning_journeys`, `educational_explainers`, `industry_opinions`, `case_studies`, `research_findings`, `career_updates`, `leadership`, `lessons_learned`, `event_participation`, `personal_reflections`, `product_releases`.
- **Hybrid Topic Detection:** Recognizes multi-domain topics (e.g. building an AI ERP system combines `software_engineering` and `artificial_intelligence`).
- **Technical Complexity:** Categorized into `none`, `low`, `moderate`, or `deep` to control the depth of terminology.

### Stage C: Subject-Specific Knowledge Extraction
Pre-compiled domain ontologies supply ground-truth engineering mechanics:
- **PostgreSQL & Databases:** MVCC snapshot isolation, Write-Ahead Logging (WAL), B-Tree vs. GIN index selectivity, dead tuple bloat, and `EXPLAIN (ANALYZE, BUFFERS)` diagnostics.
- **Kubernetes & Cloud:** Declarative etcd reconciliation, pod lifecycle phases, readiness/liveness probes, OOMKilled mitigation, and zero-downtime rolling updates.
- **Cybersecurity & Auth:** Row-Level Security (RLS) policies, IDOR prevention, AES-256-GCM authenticated encryption, and OAuth 2.0 PKCE.
- **Certifications:** Syllabus domains, hands-on terminal sandbox labs, failure recovery testing, and avoiding multiple-choice quiz memorization.
- **Startups & SaaS:** Unit economics, CAC-to-LTV, talking to paying users, and customer retention over premature feature breadth.

### Stage D: Dynamic Narrative Selection Engine
The engine eliminates the monolithic 3-bullet template by selecting from 15 distinct narrative structures:
1. `problem_investigation_solution`: Friction → Diagnostic trace → Root cause → Resolution mechanism → Practical takeaway.
2. `architecture_tradeoffs`: Decision context → Alternatives evaluated → Explicit trade-offs → Implementation lessons.
3. `misconception_reality`: Common industry myth → Technical breakdown → Empirical reality → Practitioner heuristic.
4. `deep_dive_mechanics`: Core abstraction → Under-the-hood execution → Failure modes → Operational advice.
5. `concept_why_how`: Definition → Operational need → Step-by-step mechanics → Retentive mental model.
6. `context_milestone_reflection`: Milestone context → Hands-on lab effort → Core competencies → Forward-looking reflection.
7. `market_problem_execution`: Market friction → Tactical decision → Operational execution → Measured outcome.
8. `experience_observation_insight`: Real-world moment → Honest observation → Perspective shift → Enduring insight.

### Stage E & F: Writing Style Intelligence & Tenant Isolation
- Analyzes recent posts (`public.posts` and `public.ai_generations`) strictly filtered by `workspace_id`.
- Deduces:
  - Sentence length (short / medium / long).
  - Paragraph formatting (prose-focused / bullet-focused / hybrid).
  - Formality (casual / conversational / balanced / formal).
  - Pronoun voice (first-person singular "I" vs team "We" vs objective neutral).
  - Emoji density (none / sparse / moderate).
  - Hashtag usage (none / minimal 1-2 / standard 3-4).
- Injects these preferences into prompt constraints so different users maintain their authentic personal voice.

### Stage G & H: Quality Gate, Anti-Cliché Enforcements & Bounded Retries
- **Banned Clichés:** Systematically rejects canned phrases:
  `"Excited to share"`, `"Thrilled to announce"`, `"In today's fast-paced world"`, `"The journey has been incredible"`, `"This is just the beginning"`, `"Another milestone achieved"`, `"Let's dive into"`, `"Game changer"`, `"Paradigm shift"`, `"At the end of the day"`.
- **Anti-Fabrication:** Rejects hallucinated percentages or metrics not provided in the original prompt.
- **100-Point Composite Index:**
  - Topic Relevance (20%)
  - Subject-Specific Detail (20%)
  - Originality vs Tenant History (20%)
  - Writing Naturalness (15%)
  - Factual Grounding (15%)
  - Audience Value (10%)
- **Bounded Retries:** If score < 70 or clichés/hook repetition are detected, triggers up to 2 retries with an altered narrative arc and explicit negative directives.
- **Grounded Offline Fallback:** When Gemini is unreachable or offline, generates rich, domain-grounded posts based on the ontology mechanics rather than static boilerplate.

---

## 3. Database Schema Compatibility

- Forward-only migration provided: `supabase/migrations/20261115000011_ai_content_intelligence.sql`.
- Adds `quality_score`, `topic_category`, and `generation_metadata` to `public.ai_generations`.
- Adds `writing_preferences` to `public.brand_settings`.
- Safe backward compatibility: All runtime code uses fallback queries so operations execute seamlessly both before and after applying the migration.
