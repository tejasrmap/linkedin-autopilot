// ==============================================================
// LINKEDIN AUTOPILOT — CONTENT INTELLIGENCE & NARRATIVE ENGINE
// SUBTOPIC-GRANULAR ONTOLOGIES, TRUTHFUL SYNTHESIS & ZERO FABRICATION
// BY GT INNOX LLP
// ==============================================================

export type ContentCategory =
  | 'technical_knowledge'
  | 'software_engineering'
  | 'artificial_intelligence'
  | 'data_science'
  | 'cloud_architecture'
  | 'cybersecurity'
  | 'databases'
  | 'business_entrepreneurship'
  | 'startup_updates'
  | 'product_announcements'
  | 'project_showcases'
  | 'professional_achievements'
  | 'certifications'
  | 'learning_journeys'
  | 'educational_explainers'
  | 'industry_opinions'
  | 'case_studies'
  | 'research_findings'
  | 'career_updates'
  | 'leadership'
  | 'lessons_learned'
  | 'event_participation'
  | 'personal_reflections'
  | 'company_announcements'
  | 'product_releases';

export type GenerationMode =
  | 'informative'
  | 'technical'
  | 'analytical'
  | 'opinion'
  | 'storytelling'
  | 'educational'
  | 'announcement'
  | 'reflective'
  | 'promotional';

export type NarrativeArc =
  | 'problem_investigation_solution'
  | 'architecture_tradeoffs'
  | 'misconception_reality'
  | 'deep_dive_mechanics'
  | 'concept_why_how'
  | 'question_explanation_application'
  | 'mistake_correction_lesson'
  | 'market_problem_execution'
  | 'observation_challenge_response'
  | 'customer_need_value'
  | 'context_milestone_reflection'
  | 'starting_point_growth'
  | 'experience_observation_insight'
  | 'opinion_reasoning_counterpoint'
  | 'product_problem_capabilities';

export interface TopicAnalysis {
  mainSubject: string;
  subtopic: string;
  industry: string;
  intendedAudience: string;
  objective: string;
  category: ContentCategory;
  secondaryCategories: ContentCategory[];
  isHybrid: boolean;
  technicalComplexity: 'none' | 'low' | 'moderate' | 'deep';
  domainTerms: string[];
  coreMechanics: string[];
  practicalTakeaways: string[];
  recommendedMode: GenerationMode;
  recommendedNarrative: NarrativeArc;
  isComparison: boolean;
  isPersonalPrompt: boolean;
  isTroubleshooting: boolean;
  isOntologyMatched: boolean;
}

export interface DomainOntology {
  id: string;
  keywords: string[];
  category: ContentCategory;
  complexity: 'none' | 'low' | 'moderate' | 'deep';
  defaultAudience: string;
  suggestedTerms: string[];
  coreMechanisms: string[];
  practicalTakeaways: string[];
  primaryNarrative: NarrativeArc;
  suggestedMode: GenerationMode;
}

// Granular subtopic-specific ontologies to prevent irrelevant terminology bleeding
const SUBTOPIC_ONTOLOGIES: DomainOntology[] = [
  // 1. Cloud Storage
  {
    id: 'cloud_storage',
    keywords: ['s3', 'blob storage', 'object storage', 'storage replication', 'bucket', 'cross-region'],
    category: 'cloud_architecture',
    complexity: 'moderate',
    defaultAudience: 'Cloud Architects, DevOps Engineers, Infrastructure Leads',
    suggestedTerms: ['Cross-Region Replication (CRR)', 'S3 Lifecycle Policies', 'Read-After-Write Consistency', 'Storage Classes (Standard vs Glacier)', 'Bucket Versioning'],
    coreMechanisms: [
      'Asynchronous cross-region byte-level object replication',
      'Lifecycle transition policies moving stale objects to cold archive tiers',
      'Deterministic prefix distribution for high-throughput I/O partitioning',
    ],
    practicalTakeaways: [
      'Configure lifecycle rules to transition unaccessed objects to cost-effective archive tiers',
      'Monitor replication latency metrics (CRR SLA) to catch cross-region backlog accumulation',
      'Enforce bucket encryption and versioning before enabling replication rules',
    ],
    primaryNarrative: 'architecture_tradeoffs',
    suggestedMode: 'technical',
  },

  // 2. Serverless Compute
  {
    id: 'cloud_serverless',
    keywords: ['lambda', 'serverless', 'cold start', 'provisioned concurrency', 'cloud function'],
    category: 'cloud_architecture',
    complexity: 'moderate',
    defaultAudience: 'Cloud Engineers, Backend Developers, Solutions Architects',
    suggestedTerms: ['Cold Starts & Initialization', 'Provisioned Concurrency', 'Execution Context Re-use', 'Stateless Handlers', 'Event Source Mapping'],
    coreMechanisms: [
      'Micro-VM sandbox initialization vs warm invocation execution latency',
      'Stateless request execution offloading persistence to managed databases',
      'Concurrency limits isolating workloads from account-level starvation',
    ],
    practicalTakeaways: [
      'Minimize deployment artifact sizes to accelerate container spin-up during cold starts',
      'Re-use database client pools across warm invocations outside the handler scope',
      'Allocate provisioned concurrency strategically on latency-critical endpoints',
    ],
    primaryNarrative: 'architecture_tradeoffs',
    suggestedMode: 'technical',
  },

  // 3. Kubernetes & Container Orchestration
  {
    id: 'cloud_kubernetes',
    keywords: ['kubernetes', 'k8s', 'pod', 'daemonset', 'ingress', 'helm', 'kubelet', 'crashloopbackoff', 'container'],
    category: 'cloud_architecture',
    complexity: 'deep',
    defaultAudience: 'Platform Engineers, DevOps Leads, Site Reliability Engineers',
    suggestedTerms: ['Control Plane', 'Reconciliation Loop', 'Kubelet', 'Ingress Controller', 'CrashLoopBackOff', 'Resource Limits', 'ConfigMap'],
    coreMechanisms: [
      'Declarative state reconciliation against etcd cluster state via controllers',
      'Pod lifecycle transitions managed through liveness, readiness, and startup probes',
      'Resource limit enforcement preventing memory starvation and uncontained CPU throttling',
    ],
    practicalTakeaways: [
      'Define explicit CPU/memory requests and limits to prevent sudden OOMKilled evictions',
      'Ensure readiness probes accurately check downstream dependency readiness before serving traffic',
      'Configure pod disruption budgets to maintain capacity during rolling cluster updates',
    ],
    primaryNarrative: 'problem_investigation_solution',
    suggestedMode: 'technical',
  },

  // 4. Database Indexing
  {
    id: 'database_indexing',
    keywords: ['index', 'indexing', 'btree', 'gin', 'brin', 'write amplification', 'index scan'],
    category: 'databases',
    complexity: 'deep',
    defaultAudience: 'Database Administrators, Backend Engineers, Software Architects',
    suggestedTerms: ['Index Selectivity', 'B-Tree vs GIN', 'Write Amplification', 'Buffer Pool Hit Ratio', 'EXPLAIN (ANALYZE, BUFFERS)'],
    coreMechanisms: [
      'Cost-based query planner evaluation comparing index page reads against sequential scans',
      'Balanced B-Tree traversal trading off logarithmic lookups against index page splits',
      'Write amplification incurring secondary index maintenance on every INSERT and UPDATE',
    ],
    practicalTakeaways: [
      'Check filter selectivity: low-cardinality queries frequently perform faster with sequential sweeps',
      'Always build indexes in production with CONCURRENTLY to prevent locking concurrent writes',
      'Periodically audit unused indexes that incur write overhead without providing query benefits',
    ],
    primaryNarrative: 'problem_investigation_solution',
    suggestedMode: 'technical',
  },

  // 5. Database Concurrency & Storage
  {
    id: 'database_mvcc',
    keywords: ['mvcc', 'dead tuple', 'vacuum', 'autovacuum', 'wal', 'write-ahead', 'postgres', 'postgresql'],
    category: 'databases',
    complexity: 'deep',
    defaultAudience: 'Backend Engineers, Database Architects, System Engineers',
    suggestedTerms: ['MVCC Snapshot Isolation', 'Dead Tuple Bloat', 'Write-Ahead Log (WAL)', 'Autovacuum Tuning', 'Transaction Visibility Horizon'],
    coreMechanisms: [
      'Multi-Version Concurrency Control retaining row revisions until transaction completion',
      'Background autovacuum worker sweeping dead tuples to reclaim page space for new writes',
      'Write-Ahead Logging guaranteeing ACID durability prior to shared buffer flush',
    ],
    practicalTakeaways: [
      'Tune autovacuum settings aggressively on high-throughput append tables to prevent table bloat',
      'Monitor long-running transactions that prevent the vacuum horizon from advancing',
      'Verify shared buffer hit ratio before assuming query bottlenecks are purely disk I/O bound',
    ],
    primaryNarrative: 'problem_investigation_solution',
    suggestedMode: 'technical',
  },

  // 6. Database Migrations
  {
    id: 'database_migrations',
    keywords: ['schema migration', 'alter table', 'zero-downtime', 'migration lock', 'ddl'],
    category: 'databases',
    complexity: 'deep',
    defaultAudience: 'Backend Engineers, Technical Leads, DevOps Specialists',
    suggestedTerms: ['Lock Timeouts', 'Online DDL', 'Backward-Compatible Schema Changes', 'Shadow Tables', 'ACCESS EXCLUSIVE Lock'],
    coreMechanisms: [
      'Granular DDL lock acquisition preventing table starvation on concurrent queries',
      'Phased rollout decoupling schema addition, application deployment, and column constraints',
      'Backward-compatible column defaults allowing older running instances to function safely',
    ],
    practicalTakeaways: [
      'Always configure an explicit lock_timeout before executing DDL migrations in production',
      'Separate schema expansion from code deployment across distinct release stages',
      'Avoid adding columns with volatile or non-constant defaults on large existing tables',
    ],
    primaryNarrative: 'architecture_tradeoffs',
    suggestedMode: 'technical',
  },

  // 7. Database Connection Pooling
  {
    id: 'database_pooling',
    keywords: ['connection pool', 'pgbouncer', 'max_connections', 'connection starvation'],
    category: 'databases',
    complexity: 'deep',
    defaultAudience: 'Backend Developers, System Architects, SREs',
    suggestedTerms: ['Transaction Pooling vs Session Pooling', 'Connection Starvation', 'PgBouncer', 'File Descriptor Limits', 'Socket Multiplexing'],
    coreMechanisms: [
      'Multiplexing numerous application connections across a compact pool of database worker backends',
      'Transaction-level connection recycling releasing server processes immediately between queries',
      'Preventing operating system process exhaustion from unbounded backend connections',
    ],
    practicalTakeaways: [
      'Use transaction pooling for web workloads; preserve session pooling only when prepared statements require it',
      'Keep max_connections sized appropriately for server core count rather than inflating backend limits',
      'Monitor client wait queue metrics in pooling telemetry to detect backend query saturation',
    ],
    primaryNarrative: 'architecture_tradeoffs',
    suggestedMode: 'technical',
  },

  // 8. AI Retrieval-Augmented Generation (RAG)
  {
    id: 'ai_rag',
    keywords: ['rag', 'retrieval', 'embeddings', 'vector search', 'vector', 'bm25'],
    category: 'artificial_intelligence',
    complexity: 'deep',
    defaultAudience: 'AI Engineers, Machine Learning Developers, Product Architects',
    suggestedTerms: ['Hybrid Search (Dense + BM25)', 'Chunking Strategy', 'Cosine Similarity', 'Retrieval Precision', 'Context Window Packing'],
    coreMechanisms: [
      'Hybrid semantic vector retrieval combined with lexical BM25 keyword matching',
      'Semantic chunking preserving sentence boundaries and metadata annotations',
      'Re-ranking retrieved passages before injecting into the language model context',
    ],
    practicalTakeaways: [
      'Document chunking and metadata filtering impact retrieval quality more than raw embedding model size',
      'Evaluate retrieval precision on real domain queries before tweaking generation prompts',
      'Implement strict context window budgeting to avoid latency spikes and token waste',
    ],
    primaryNarrative: 'concept_why_how',
    suggestedMode: 'analytical',
  },

  // 9. Deep Learning & Transformer Architectures
  {
    id: 'ai_transformers',
    keywords: ['transformer', 'self-attention', 'attention', 'qkv', 'neural', 'deep learning'],
    category: 'artificial_intelligence',
    complexity: 'deep',
    defaultAudience: 'Machine Learning Practitioners, Research Engineers, Software Engineers',
    suggestedTerms: ['Query-Key-Value Projections', 'Scaled Dot-Product Attention', 'Multi-Head Attention', 'Softmax Normalization', 'Residual Connections'],
    coreMechanisms: [
      'Computing pairwise token affinity matrices via scaled query-key dot products',
      'Linear projection of token representations across multiple specialized attention heads',
      'Preserving gradient flow through layer normalization and residual bypass connections',
    ],
    practicalTakeaways: [
      'Attention complexity scales quadratically with sequence length; leverage flash attention for long contexts',
      'Inspect attention weight distributions to evaluate token relationship capture',
      'Understand parameter precision (FP16 vs INT8 vs FP8) trade-offs for inference latency',
    ],
    primaryNarrative: 'concept_why_how',
    suggestedMode: 'analytical',
  },

  // 10. Security & Authentication
  {
    id: 'cybersecurity_auth',
    keywords: ['oauth', 'pkce', 'jwt', 'token', 'auth', 'rls', 'idor', 'zero trust', 'csrf'],
    category: 'cybersecurity',
    complexity: 'deep',
    defaultAudience: 'Security Engineers, Lead Developers, CTOs',
    suggestedTerms: ['Proof Key for Code Exchange (PKCE)', 'Cryptographic Nonces', 'Row Level Security (RLS)', 'Token Verification', 'IDOR Protection'],
    coreMechanisms: [
      'Cryptographic code verifier challenge preventing authorization code interception',
      'Database-level Row Level Security policies evaluating tenant context per query',
      'Stateless JWT verification enforcing signature integrity, audience, and expiration',
    ],
    practicalTakeaways: [
      'Always mandate PKCE for public and single-page clients to mitigate code interception',
      'Enforce multi-tenant authorization at the database layer (RLS), never solely in application routes',
      'Never expose internal predictable sequence IDs in client-accessible API URLs',
    ],
    primaryNarrative: 'problem_investigation_solution',
    suggestedMode: 'technical',
  },

  // 11. Hands-on Terminal Certifications
  {
    id: 'cert_hands_on',
    keywords: ['cka', 'ckad', 'rhcsa', 'linux certification', 'practical exam'],
    category: 'certifications',
    complexity: 'moderate',
    defaultAudience: 'Systems Engineers, Cloud Engineers, Students, Community',
    suggestedTerms: ['Exam Blueprint Domains', 'Command-Line Troubleshooting', 'Time Management', 'Live Cluster Debugging', 'Imperative vs Declarative Commands'],
    coreMechanisms: [
      'Systematic progression across hands-on exam blueprint objectives',
      'Rapid diagnostic evaluation of live broken environments under time constraints',
      'Command-line fluency and documentation navigation under exam conditions',
    ],
    practicalTakeaways: [
      'Prioritize hands-on lab exercises that intentionally inject configuration breakages',
      'Master imperative command generation to construct baseline resource manifests quickly',
      'Review failure diagnostics (logs, describe, events) before attempting speculative fixes',
    ],
    primaryNarrative: 'context_milestone_reflection',
    suggestedMode: 'educational',
  },

  // 12. Conceptual / Architectural Certifications
  {
    id: 'cert_conceptual',
    keywords: ['pmp', 'cissp', 'security+', 'solutions architect', 'ccna', 'comptia', 'aws-certified', 'certified', 'certification'],
    category: 'certifications',
    complexity: 'moderate',
    defaultAudience: 'Practitioners, Engineering Managers, Hiring Leaders, Community',
    suggestedTerms: ['Syllabus Blueprint', 'Scenario-Based Decision Making', 'Architecture & Governance Principles', 'Domain Competencies', 'Industry Best Practices'],
    coreMechanisms: [
      'Comprehensive mastery of the credential syllabus and core governance domains',
      'Applying standard framework principles to realistic scenario trade-offs',
      'Translating theoretical domain guidelines into sound operational judgment',
    ],
    practicalTakeaways: [
      'Focus study on understanding the underlying architectural rationale rather than memorizing practice question answers',
      'Map syllabus domains to real-world operational challenges encountered in daily practice',
      'Treat the credential as a structured baseline for disciplined professional practice',
    ],
    primaryNarrative: 'context_milestone_reflection',
    suggestedMode: 'reflective',
  },

  // 13. Distributed Systems & Queues
  {
    id: 'distributed_systems',
    keywords: ['distributed', 'queue', 'bullmq', 'redis', 'event-driven', 'idempotency', 'microservices', 'dead-letter', 'dlq', 'cas'],
    category: 'software_engineering',
    complexity: 'deep',
    defaultAudience: 'Software Engineers, Technical Architects, Engineering Managers',
    suggestedTerms: ['Idempotency Keys', 'At-Least-Once Delivery', 'Dead Letter Queues (DLQ)', 'Backpressure', 'Compare-And-Swap (CAS)'],
    coreMechanisms: [
      'Decoupling synchronous request paths from slow downstream workloads via persistent message queues',
      'Idempotent worker execution preventing duplicate side-effects on network retries',
      'Controlled concurrency and rate limiting protecting downstream service boundaries',
    ],
    practicalTakeaways: [
      'Design every queue worker with idempotency; duplicate deliveries are guaranteed in distributed networks',
      'Implement exponential backoff with jitter on transient downstream failures',
      'Preserve failed message context in dead letter queues with actionable alerting',
    ],
    primaryNarrative: 'architecture_tradeoffs',
    suggestedMode: 'technical',
  },

  // 14. Frontend Architecture
  {
    id: 'frontend_architecture',
    keywords: ['react', 'next.js', 'hooks', 'component', 'ssr', 'god component', 'custom hook', 'frontend'],
    category: 'software_engineering',
    complexity: 'moderate',
    defaultAudience: 'Frontend Developers, Full-Stack Engineers, UI Architects',
    suggestedTerms: ['Custom Hook Decomposition', 'Separation of Concerns', 'Server vs Client Components', 'State Isolation', 'Render Optimization'],
    coreMechanisms: [
      'Encapsulating stateful business logic and side effects into modular custom hooks',
      'Keeping presentation components strictly declarative and driven by explicit props',
      'Minimizing unnecessary re-renders by isolating frequently changing state',
    ],
    practicalTakeaways: [
      'Decompose large components by grouping related state variables with their specific mutations',
      'Separate pure presentation components from data-fetching and orchestration logic',
      'Co-locate state as close to the consuming leaf components as possible',
    ],
    primaryNarrative: 'concept_why_how',
    suggestedMode: 'technical',
  },

  // 15. Startup & Product Strategy
  {
    id: 'startup_strategy',
    keywords: ['startup', 'founder', 'churn', 'pmf', 'b2b saas', 'mrr', 'customers', 'bootstrapping', 'pricing'],
    category: 'business_entrepreneurship',
    complexity: 'moderate',
    defaultAudience: 'Founders, Product Leaders, Growth Engineers, Operators',
    suggestedTerms: ['Customer Discovery Interviews', 'Net Revenue Retention', 'Core Job-to-be-Done', 'Unit Economics', 'Product-Market Fit (PMF)'],
    coreMechanisms: [
      'Validating customer willingness to pay through structured discovery conversations',
      'Focusing engineering velocity on the single acute pain point driving adoption',
      'Measuring active retention cohorts rather than top-line vanity registrations',
    ],
    practicalTakeaways: [
      'Validate acute customer friction with paying users before writing hundreds of lines of speculative code',
      'Retention is the definitive signal of product-market fit; high churn cannot be outgrown',
      'Keep the core value proposition aggressively focused on the primary workflow',
    ],
    primaryNarrative: 'market_problem_execution',
    suggestedMode: 'storytelling',
  },

  // 16. Engineering Leadership
  {
    id: 'engineering_leadership',
    keywords: ['tech lead', 'engineering manager', 'delegation', 'code review', '1:1', 'leadership', 'team leads', 'management'],
    category: 'leadership',
    complexity: 'moderate',
    defaultAudience: 'Engineering Leaders, Managers, Team Leads, Founders',
    suggestedTerms: ['High-Agency Delegation', 'Architectural Risk Assessment', 'Context Over Control', 'Psychological Safety', 'Async Communication'],
    coreMechanisms: [
      'Empowering engineers with problem context and constraints rather than micro-managing tasks',
      'Focusing technical reviews on architectural risk, security boundaries, and failure modes',
      'Building blameless review and post-mortem cultures that convert errors into institutional knowledge',
    ],
    practicalTakeaways: [
      'Focus code reviews on architectural invariants, error handling, and testability rather than cosmetic style',
      'Delegate full ownership of problem domains rather than delegating fragmented checklist items',
      'Invest in written documentation to unblock asynchronous team execution',
    ],
    primaryNarrative: 'experience_observation_insight',
    suggestedMode: 'reflective',
  },
];

export class ContentIntelligenceEngine {
  /**
   * Stage A: Comprehensive Topic Understanding
   */
  analyzeTopic(rawTopic: string, userAudience?: string, userObjective?: string): TopicAnalysis {
    const cleaned = (rawTopic || '').trim();
    const lower = cleaned.toLowerCase();

    // Check for comparison intent
    const isComparison = /\b(vs|versus|compare|comparing|trade-offs|tradeoffs)\b/i.test(cleaned);
    const isTroubleshooting = /\b(troubleshoot|debug|fix|crash|outage|incident|error|latency)\b/i.test(cleaned);
    const isPersonalPrompt = /\b(my|i passed|we built|we launched|our outage|my experience|i learned)\b/i.test(cleaned);

    // Score ontologies with word boundaries
    let matchedOntology: DomainOntology | undefined;
    let bestScore = 0;
    for (const onto of SUBTOPIC_ONTOLOGIES) {
      let score = 0;
      for (const kw of onto.keywords) {
        const regex = new RegExp(`\\b${kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
        if (regex.test(cleaned)) {
          // Weight multi-word keyword matches higher for precision
          score += kw.includes(' ') ? 3 : 1;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        matchedOntology = onto;
      }
    }

    // Determine category
    let primaryCategory: ContentCategory = matchedOntology ? matchedOntology.category : 'technical_knowledge';
    const secondaryCategories: ContentCategory[] = [];

    // Additional category checks
    if (lower.includes('certif') || lower.includes('passed') || lower.includes('exam')) {
      primaryCategory = 'certifications';
    } else if (lower.includes('launch') || lower.includes('release') || lower.includes('v1.') || lower.includes('v2.')) {
      primaryCategory = 'product_releases';
    } else if (lower.includes('retrospective') || lower.includes('outage') || lower.includes('lesson')) {
      if (primaryCategory !== 'certifications') primaryCategory = 'lessons_learned';
    } else if (lower.includes('reflect') || lower.includes('journey') || lower.includes('years in')) {
      primaryCategory = 'personal_reflections';
    }

    const isHybrid = secondaryCategories.length > 0;

    // Determine industry
    let industry = 'Technology & Software Engineering';
    if (primaryCategory === 'databases' || primaryCategory === 'cloud_architecture' || primaryCategory === 'cybersecurity') {
      industry = 'Cloud Infrastructure & Systems Engineering';
    } else if (primaryCategory === 'artificial_intelligence' || primaryCategory === 'data_science') {
      industry = 'Artificial Intelligence & Applied ML';
    } else if (primaryCategory === 'business_entrepreneurship' || primaryCategory === 'startup_updates') {
      industry = 'B2B Software & SaaS Strategy';
    } else if (primaryCategory === 'leadership') {
      industry = 'Engineering Management & Leadership';
    }

    // Audience selection
    const intendedAudience =
      userAudience && userAudience.trim()
        ? userAudience.trim()
        : matchedOntology
        ? matchedOntology.defaultAudience
        : 'Senior Engineers, Technical Leaders, and Engineering Managers';

    // Objective definition without fabricated assumptions
    let objective = 'Deliver clear, technically grounded analysis respecting professional peer intelligence.';
    if (userObjective && userObjective.trim()) {
      objective = userObjective.trim();
    } else if (isComparison) {
      objective = `Compare the trade-offs, constraints, and ideal operational use-cases for ${cleaned}.`;
    } else if (isTroubleshooting) {
      objective = `Walk through practical diagnosis, root cause analysis, and resolution for ${cleaned}.`;
    } else if (primaryCategory === 'certifications') {
      objective = isPersonalPrompt
        ? `Share authentic milestone context and practical technical insights gained during preparation.`
        : `Break down the core syllabus blueprint domains and practical competencies for ${cleaned}.`;
    } else if (primaryCategory === 'startup_updates' || primaryCategory === 'business_entrepreneurship') {
      objective = `Analyze real-world execution trade-offs, customer feedback dynamics, and business lessons.`;
    }

    // Domain terms and mechanics
    let domainTerms: string[] = [];
    let coreMechanics: string[] = [];
    let practicalTakeaways: string[] = [];

    if (matchedOntology && bestScore > 0) {
      domainTerms = matchedOntology.suggestedTerms;
      coreMechanics = matchedOntology.coreMechanisms;
      practicalTakeaways = matchedOntology.practicalTakeaways;
    } else {
      // Unfamiliar topic: extract clean keywords from prompt without irrelevant injection
      domainTerms = this.extractKeywords(cleaned);
      coreMechanics = [
        `Core operational mechanisms governing ${cleaned}`,
        `Key constraints, trade-offs, and failure boundaries`,
        `Real-world implementation heuristics for practitioners`,
      ];
      practicalTakeaways = [
        `Evaluate constraints against verified production workload requirements`,
        `Prioritize system observability and explicit failure recovery`,
        `Document key design decisions and intentional trade-offs`,
      ];
    }

    // Determine narrative arc
    let recommendedNarrative: NarrativeArc = isComparison
      ? 'architecture_tradeoffs'
      : isTroubleshooting
      ? 'problem_investigation_solution'
      : matchedOntology
      ? matchedOntology.primaryNarrative
      : 'concept_why_how';

    if (primaryCategory === 'certifications') {
      recommendedNarrative = 'context_milestone_reflection';
    } else if (primaryCategory === 'personal_reflections') {
      recommendedNarrative = 'experience_observation_insight';
    }

    return {
      mainSubject: cleaned,
      subtopic: domainTerms[0] || cleaned,
      industry,
      intendedAudience,
      objective,
      category: primaryCategory,
      secondaryCategories,
      isHybrid,
      technicalComplexity: matchedOntology ? matchedOntology.complexity : 'moderate',
      domainTerms,
      coreMechanics,
      practicalTakeaways,
      recommendedMode: matchedOntology ? matchedOntology.suggestedMode : 'technical',
      recommendedNarrative,
      isComparison,
      isPersonalPrompt,
      isTroubleshooting,
      isOntologyMatched: bestScore > 0,
    };
  }

  /**
   * Extracts salient keywords when topic is outside standard ontologies
   */
  private extractKeywords(topic: string): string[] {
    const stopWords = new Set([
      'the', 'and', 'for', 'with', 'about', 'from', 'this', 'that', 'into', 'what', 'how', 'why',
      'most', 'some', 'your', 'will', 'have', 'over', 'under', 'between', 'using', 'when',
    ]);
    return topic
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !stopWords.has(w.toLowerCase()))
      .slice(0, 6);
  }

  /**
   * Stage D: Dynamic Narrative Instruction Builder
   */
  buildNarrativeGuidance(arc: NarrativeArc, analysis: TopicAnalysis): string {
    switch (arc) {
      case 'problem_investigation_solution':
        return `NARRATIVE STRUCTURE: Problem Context → Root Cause Investigation → Concrete Resolution → Practical Takeaway
- Open directly with the specific operational friction without buzzword filler.
- Walk through the diagnostic investigation: metrics, traces, or constraints observed.
- Detail the exact resolution mechanism cleanly.
- Close with a concrete practitioner takeaway for peers.`;

      case 'architecture_tradeoffs':
        return `NARRATIVE STRUCTURE: Architectural Decision → Alternatives Evaluated → Explicit Trade-offs → Lessons
- Ground the decision in real technical constraints (latency, throughput, state consistency, team cognitive load).
- Compare approaches directly, explicitly detailing what was prioritized vs sacrificed.
- Close with an honest heuristic on when NOT to use this pattern.`;

      case 'misconception_reality':
        return `NARRATIVE STRUCTURE: Common Industry Myth → Technical Reality → Concrete Evidence → Practitioner Rule
- State the widely accepted assumption directly without condescension.
- Unpack why that assumption breaks down under production scale or edge cases.
- Provide the technical or empirical reality with domain-specific mechanics.
- Leave the reader with an actionable decision rule.`;

      case 'concept_why_how':
        return `NARRATIVE STRUCTURE: Concept Definition → Why It Matters → Step-by-Step Mechanics → Practical Retentive Takeaway
- Define the core concept with precision.
- Explain the specific friction or operational bottleneck that created the need for this concept.
- Walk through how it executes conceptually and practically.
- Conclude with an objective mental model or summary.`;

      case 'context_milestone_reflection':
        return `NARRATIVE STRUCTURE: Focus Areas & Syllabus Context → Key Technical Competencies → Practical Lessons
- State the credential or milestone factually. DO NOT open with "Excited to share" or "Proud to announce".
- Highlight 2-3 genuine technical competencies or domain areas from the syllabus.
- Share practical takeaways connecting theory to real-world engineering.
- Conclude with a modest, forward-looking reflection.`;

      case 'market_problem_execution':
        return `NARRATIVE STRUCTURE: Market Friction → Tactical Decision → Operational Execution → Measured Takeaway
- Identify the genuine friction observed in user workflows or market operations.
- Explain why the conventional approach proved inadequate.
- Detail the tactical execution choices without exaggerating outcomes.
- Share an honest reflection on the remaining challenges.`;

      case 'experience_observation_insight':
        return `NARRATIVE STRUCTURE: Context Observation → Honest Perspective Shift → Enduring Insight
- Anchor in a concrete engineering context or observation.
- Describe what became obvious once you evaluated the trade-offs carefully.
- End with a quiet, thought-provoking takeaway for practitioners.`;

      default:
        return `NARRATIVE STRUCTURE: Clear Topic Anchor → Structured Substance → Actionable Takeaway
- Deliver high information density with zero generic filler.
- Maintain logical progression between paragraphs.
- Respect the reader's time and professional intelligence.`;
    }
  }

  /**
   * Generates a truthful, deterministic topic-grounded fallback post when offline.
   * STRICTLY FORBIDS FABRICATED PERSONAL STORIES, INVENTED STATS, OR LAB CLAIMS.
   */
  generateGroundedFallback(analysis: TopicAnalysis, mode: GenerationMode, narrative: NarrativeArc): string {
    const topic = analysis.mainSubject.trim();
    if (topic.length < 3) {
      return `[Generation Unavailable] Please provide a specific topic or prompt with sufficient domain context to generate a verified LinkedIn post.`;
    }

    const terms = analysis.domainTerms;
    const mechanics = analysis.coreMechanics;
    const takeaways = analysis.practicalTakeaways;

    // 1. Comparison Intent (e.g. CAS vs Redlock, PKCE vs Auth Code)
    if (analysis.isComparison) {
      const parts = topic.split(/\b(?:vs|versus|compare|comparing)\b/i).map((p) => p.trim()).filter(Boolean);
      const optA = parts[0] || 'the primary approach';
      const optB = parts[1] || 'the alternative';

      return `Comparing ${topic}:

When choosing between ${optA} and ${optB}, the decision comes down to understanding explicit operational trade-offs rather than defaulting to popular consensus.

Key architectural considerations:

1. Consistency vs Simplicity: ${mechanics[0] || `How each approach manages state synchronization and failure boundaries under contention.`}
2. Failure Domains: ${mechanics[1] || `How network partitions and latency spikes affect execution safety.`}
3. Operational Overhead: ${takeaways[0] || `The maintenance cost of running additional distributed dependencies vs leveraging existing database primitives.`}

Core decision heuristic: Choose ${optA} when your primary constraint is strict consistency and minimal infrastructure footprint; lean toward ${optB} when scale demands decoupled asynchronous distribution.

What factors drive your team's decision when evaluating these two patterns?

#SystemDesign #Architecture #SoftwareEngineering`;
    }

    // 2. Certifications (Truthful syllabus & focus areas, NO fabricated personal claims)
    if (analysis.category === 'certifications') {
      const hasPersonalClaim = analysis.isPersonalPrompt;
      const opening = hasPersonalClaim
        ? `Reflecting on preparing for the ${topic}:`
        : `Key architectural domains and focus areas for the ${topic}:`;

      return `${opening}

Approaching the syllabus methodically requires connecting theoretical blueprint concepts to real-world production realities:

1. ${terms[0] || 'Core System Architecture'}: Understanding foundational boundaries, service interactions, and failure modes rather than memorizing sanitized practice questions.
2. ${terms[1] || 'Security & Governance'}: ${mechanics[1] || 'Enforcing least-privilege policies, identity boundaries, and data encryption invariants.'}
3. ${terms[2] || 'Reliability & Operational Recovery'}: Designing for graceful degradation, automated failover, and operational observability.

${takeaways[0] ? `Key rule: ${takeaways[0]}.` : 'The real value of professional credentials is using the structured blueprint to solidify sound operational heuristics.'}

For anyone evaluating or studying for this credential: focus on understanding why specific architectural patterns are chosen over their alternatives under constraint.

What domain within this syllabus do you find most critical in production?

#${topic.replace(/[^a-zA-Z0-9]/g, '').slice(0, 25)} #ContinuousLearning #Engineering`;
    }

    // 3. Business & Entrepreneurship (No technical boilerplate, strictly business/startup heuristics)
    if (analysis.category === 'business_entrepreneurship') {
      return `When evaluating startup velocity and ${topic}:

The most common trap early-stage teams fall into is confusing activity with customer progress. Building features in a vacuum feels productive, but distribution and customer validation dictate survival:

1. Customer Problem Clarity: Five in-depth customer conversations uncover more actionable friction than shipping fifty unvalidated roadmap items.
2. Retention Over Acquisition: Churn is rarely a pricing problem; it is an indicator that the core workflow has not become indispensable.
3. Radical Focus: Every non-essential feature adds cognitive load for users and maintenance drag for the engineering team.

Build for the smallest viable customer segment whose pain is acute enough that they will use an imperfect product today.

What customer insight fundamentally shifted your product roadmap this quarter?

#Startups #B2B #Entrepreneurship #ProductStrategy #SaaS`;
    }

    // 4. Engineering Leadership & Team Management
    if (analysis.category === 'leadership') {
      return `Lessons on engineering leadership and ${topic}:

Moving from hands-on execution to technical leadership requires rewiring how you measure impact. Your primary deliverable shifts from lines of code to organizational leverage:

1. Delegating Ownership, Not Just Tasks: Give engineers complete problem boundaries with explicit success metrics rather than prescriptive implementation checklists.
2. Architectural Risk Over Syntax: Code reviews should prioritize data consistency, failure blast radius, and migration safety rather than stylistic nitpicks.
3. Removing Bottlenecks: A lead who reviews everything personally becomes the single point of failure that throttles team momentum.

The strongest engineering teams are built on high agency, transparent context, and psychological safety under pressure.

How does your team ensure architectural decisions scale without creating review bottlenecks?

#EngineeringLeadership #TechLead #Management #SoftwareEngineering #TeamCulture`;
    }

    // 5. Personal & Career Reflections
    if (analysis.category === 'personal_reflections') {
      return `Reflections on career growth and ${topic}:

Navigating a sustainable career in software engineering is less about mastering every fleeting tool and more about cultivating evergreen mental models:

• High Agency: When an operational problem lacks clear ownership, stepping up to define the boundary creates immediate organizational value.
• Depth Over Breadth: Deeply understanding how databases, networks, and operating systems handle failure outlasts any particular frontend framework.
• Writing as a Superpower: Clear documentation and written proposals scale your thinking across teams far faster than meetings.

Compounding small daily improvements across fundamental disciplines produces outsized results over a decade.

What piece of advice would you share with an engineer starting their career today?

#CareerGrowth #SoftwareEngineering #Engineering #ProfessionalDevelopment`;
    }

    // 6. Frontend Architecture
    if (topic.toLowerCase().includes('react') || topic.toLowerCase().includes('frontend') || topic.toLowerCase().includes('hook') || topic.toLowerCase().includes('component')) {
      return `A practical look at ${topic}:

When decomposing complex UI components, the goal is not merely reducing line counts. The goal is establishing clean boundaries between view presentation and state orchestration:

• Identify state clusters: Group tightly coupled state variables with their specific mutations into dedicated custom hooks.
• Decouple side-effects: Keep data fetching, local caching, and synchronization logic out of declarative view components.
• Co-locate state responsibly: Push state down as close to the consuming leaf components as possible to prevent wide re-render cascades.

When presentation components remain strictly declarative, testing becomes straightforward and UI maintenance scales predictably.

What strategies does your team use when refactoring complex frontend state?

#React #WebDevelopment #SoftwareEngineering #FrontendArchitecture`;
    }

    // 7. Cloud Storage & S3
    if (topic.toLowerCase().includes('s3') || topic.toLowerCase().includes('storage replication') || topic.toLowerCase().includes('blob')) {
      return `Architecting for resilience with ${topic}:

When designing multi-region storage replication, three considerations ensure data availability without runaway operational costs:

1. ${terms[0] || 'Replication Latency & SLA'}: Acknowledge asynchronous replication lag and design read paths to tolerate eventual consistency across regions.
2. ${terms[1] || 'Lifecycle Transition Rules'}: Automatically transition infrequently accessed objects to cold tiers to balance availability against storage overhead.
3. ${terms[2] || 'Consistency & Versioning Invariants'}: Enforce bucket versioning to prevent accidental overwrites during cross-region sync operations.

Simple storage architectures with predictable lifecycle rules consistently outperform fragile manual synchronization pipelines.

How does your team validate cross-region storage recovery before an outage occurs?

#CloudArchitecture #Storage #AWS #SystemDesign`;
    }

    // 8. General Subtopic Grounded Synthesis - Dynamic Narrative Framing
    const hashTag = terms[0] ? terms[0].replace(/[^a-zA-Z0-9]/g, '') : 'Engineering';

    if (narrative === 'architecture_tradeoffs') {
      return `Every architectural decision in ${topic} is an exercise in choosing your constraints:

Rather than searching for an ideal universal design, resilient engineering focuses on balancing explicit operational trade-offs:

1. Throughput vs Latency: ${mechanics[0] || 'Optimizing batch processing efficiency against single-request round-trip responsiveness.'}
2. Operational Simplicity: ${mechanics[1] || 'Balancing specialized infrastructure primitives against the maintenance burden of running extra dependencies.'}
3. Blast Radius: ${takeaways[0] || 'Designing failure domains so localized degradation does not cascade through downstream services.'}

The best production architectures do not eliminate trade-offs; they make them observable and deliberate.

What constraints govern your architectural decisions in this domain?

#${hashTag} #SoftwareArchitecture #SystemDesign #Engineering`;
    }

    if (narrative === 'problem_investigation_solution') {
      return `When diagnosing unexpected behavior in ${topic}, symptoms are frequently mistaken for root causes:

In high-throughput environments, superficial errors usually mask deeper structural constraints:

1. Immediate Symptom: ${mechanics[0] || 'Sudden latency spikes and backpressure on dependent service queues.'}
2. Root Cause Investigation: ${mechanics[1] || 'Underlying resource contention, unindexed scans, or unobserved locking contention.'}
3. Durable Remediation: ${takeaways[0] || 'Enforcing strict timeouts, bounded retry policies, and automated circuit breaking.'}

Addressing the structural failure domain once eliminates recurring on-call firefighting.

How does your team isolate root causes when diagnosing incidents in production?

#${hashTag} #DevOps #Observability #Reliability`;
    }

    if (narrative === 'misconception_reality' || (narrative as string) === 'contrarian_observation') {
      return `A contrarian observation regarding ${topic}:

Industry consensus often encourages adding complex layers of abstraction where simpler primitives would suffice:

1. Conventional Pattern: Reaching for distributed orchestration tools before exhausting existing database or queue capabilities.
2. Where It Breaks: ${mechanics[0] || 'Operational fragility increases exponentially with each new network hop and state store.'}
3. Pragmatic Alternative: ${takeaways[0] || 'Relying on idempotent state transitions and verifiable database invariants.'}

Simplicity in production systems is an operational superpower that pays dividends over time.

Where has reducing architectural complexity delivered the biggest win for your team?

#${hashTag} #SystemDesign #SoftwareEngineering #Architecture`;
    }

    if (narrative === 'concept_why_how' || narrative === 'deep_dive_mechanics' || (narrative as string) === 'actionable_framework') {
      return `A battle-tested framework for executing ${topic} in production:

Translating architectural theory into reliable execution requires three core implementation phases:

• Phase 1 (Baseline & Invariants): ${mechanics[0] || 'Define unambiguous state boundaries and establish clear observability metrics.'}
• Phase 2 (Decoupling): ${mechanics[1] || 'Isolate long-running tasks asynchronously to protect critical request paths.'}
• Phase 3 (Failure Hardening): ${takeaways[0] || 'Validate graceful degradation and circuit breakers before traffic hits scale.'}

Disciplined execution around predictable constraints consistently outperforms ad-hoc optimization.

Which phase typically presents the greatest hurdle during rollout in your environment?

#${hashTag} #SoftwareEngineering #SystemArchitecture #TechFramework`;
    }

    // Default lessons_learned or standard grounded synthesis
    return `Operational takeaways from deploying and scaling ${topic}:

Working with this domain in real-world environments reinforces several foundational rules:

1. ${mechanics[0] || 'System state transitions must be explicit and deterministic from day one.'}
2. ${mechanics[1] || 'Network latency and transient dependencies must be treated as standard operating conditions.'}
3. ${takeaways[0] || 'Observable metrics and automated health checks must precede architectural refactoring.'}

When systems are built around clear constraints from day one, maintainability and scale follow naturally.

What has been your team's experience navigating ${topic.toLowerCase()} in production?

#${hashTag} #SoftwareArchitecture #Technology #ProductionReadiness`;
  }
}

export const contentIntelligence = new ContentIntelligenceEngine();
