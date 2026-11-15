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
    if (topic.length < 5 || topic.split(/\s+/).filter(Boolean).length < 2) {
      return `[Generation Unavailable] The topic "${topic}" lacks sufficient domain context to generate a verified, high-quality post. Please provide specific architectural constraints, tools, or subject details.`;
    }

    const lower = topic.toLowerCase();
    const terms = analysis.domainTerms;
    const mechanics = analysis.coreMechanics;
    const takeaways = analysis.practicalTakeaways;

    // 1. Comparison Intent (e.g. CAS vs Redlock, PKCE vs Auth Code, Provisioned vs On-Demand)
    if (analysis.isComparison) {
      const parts = topic.split(/\b(?:vs|versus|compare|comparing)\b/i).map((p) => p.trim()).filter(Boolean);
      const optA = parts[0] || 'the primary approach';
      const optB = parts[1] || 'the alternative';

      if (narrative === 'architecture_tradeoffs') {
        return `Evaluating ${topic}:

Choosing between ${optA} and ${optB} is fundamentally a decision about where your team is willing to manage operational complexity.

${optA} provides a predictable baseline with minimal infrastructure footprint, making it ideal when simplicity and low operational overhead are paramount constraints. However, under high concurrency or throughput spikes, its state boundaries require strict discipline.

In contrast, ${optB} decouples execution and scales across distributed boundaries, but introduces additional failure domains, network latency, and synchronization overhead.

Decision heuristic: Start with ${optA} until verified throughput measurements or multi-node distribution requirements genuinely justify the operational weight of ${optB}.`;
      }

      return `Comparing ${topic}:

When evaluating ${optA} against ${optB}, the choice comes down to explicit architectural trade-offs rather than defaulting to popular industry consensus.

Core operational distinctions:
- State Synchronization: ${optA} focuses on localized consistency, whereas ${optB} distributes state across network boundaries.
- Failure Recovery: Network partitions and latency degradation impact each approach differently during unexpected failovers.
- Maintenance Overhead: The long-term cost of managing specialized dependencies compared to leveraging existing database or language primitives.

Choose ${optA} when your primary constraint is deterministic execution and minimal moving parts; lean toward ${optB} when scale demands decoupled asynchronous distribution.`;
    }

    // 2. Certifications (Truthful syllabus blueprint & focus areas, NO fabricated personal claims)
    if (analysis.category === 'certifications') {
      const isHandsOn = lower.includes('cka') || lower.includes('terminal') || lower.includes('kubernetes administrator') || lower.includes('rhce');
      const hasPersonal = analysis.isPersonalPrompt;

      if (isHandsOn) {
        const opening = hasPersonal
          ? `Key takeaways from preparing for the ${topic}:`
          : `Preparing for the ${topic} is fundamentally an exercise in terminal muscle memory and operational speed.`;

        return `${opening}

Unlike multiple-choice exams, practical certification testing evaluates how quickly you diagnose and resolve live issues directly in the CLI:

- Imperative Command Speed: Rapid manifest generation using imperative commands and dry-run flags rather than drafting YAML manifests from scratch.
- Context Switching & Triage: Fast namespace scoping, jsonpath filtering, and resource inspection under time constraints.
- Control Plane Troubleshooting: Diagnosing component failures by inspecting journalctl logs, kubelet status, and static pod manifests directly on nodes.

The most effective preparation is spending time in live terminal environments deliberately breaking configurations and restoring them to healthy state.`;
      }

      // Conceptual certification (AWS SAA, Security+, AZ-900, CISSP, etc.)
      const opening = hasPersonal
        ? `Reflecting on the core architectural domains of the ${topic}:`
        : `Mastering the blueprint domains for the ${topic} requires connecting architectural theory to real-world operational constraints.`;

      return `${opening}

Rather than memorizing question patterns, practical competency focuses on understanding why specific architectures are selected under constraint:

- Network Isolation & Security: Designing multi-tier VPC topologies, secure peering, and enforcing least-privilege identity boundaries.
- Resilient Data Architecture: Balancing read throughput, automated failover, and asynchronous cross-region replication lag.
- Operational Recovery: Establishing automated backup policies and lifecycle rules that meet recovery time objectives without runaway storage overhead.

The true value of professional credentials lies in internalizing sound operational heuristics that transfer directly to production systems.`;
    }

    // 3. Databases (MVCC, Indexing, Schema Migrations, Connection Pooling)
    if (analysis.category === 'databases') {
      if (lower.includes('mvcc') || lower.includes('vacuum') || lower.includes('dead tuple') || lower.includes('bloat')) {
        return `In PostgreSQL, dead tuple accumulation is rarely an issue of disk space—it is an issue of buffer cache efficiency.

When high-frequency UPDATEs or DELETEs generate dead tuples, table and index bloat force queries to scan cold disk pages instead of remaining memory-resident in shared buffers.

Operational priorities for maintaining query throughput:
- Configure autovacuum cost limits and vacuum_cost_delay per table to keep pace with high-write tables.
- Monitor pg_stat_user_tables for dead tuple ratios before bloat degrades sequential scan performance.
- Avoid long-running transactions that hold open the oldest transaction ID (xmin horizon), preventing autovacuum from cleaning dead rows.

Keeping tables lean and autovacuum aggressive directly preserves shared memory buffers and index scan speeds.`;
      }

      if (lower.includes('index') || lower.includes('indexing')) {
        return `When query latency spikes under write-heavy workloads, adding another database index is often the default instinct—and frequently the wrong one.

Every secondary index introduces write amplification: every INSERT and UPDATE must synchronously update the B-Tree structure, generating Write-Ahead Log (WAL) volume and competing for buffer cache memory.

Before introducing an index:
- Run EXPLAIN (ANALYZE, BUFFERS) to determine whether the bottleneck is CPU filtering or disk I/O.
- Verify filter selectivity: if a query matches more than 10-15% of total table rows, the query planner will correctly bypass the index for a sequential scan.
- Audit existing unused indexes via pg_stat_user_indexes to reclaim shared memory.

The best indexing strategy is minimal, selective, and verified against actual production query plans.`;
      }

      if (lower.includes('migration') || lower.includes('schema')) {
        return `Zero-downtime database migrations on high-traffic tables are not about SQL syntax; they are about lock queues.

Running an ALTER TABLE statement acquires an ACCESS EXCLUSIVE lock. While the operation itself may be instantaneous, any open query preceding it blocks the lock—and all incoming queries pile up behind it, exhausting the connection pool in seconds.

Production migration guidelines:
- Always set a low lock_timeout (e.g. 2-3 seconds) and retry with exponential backoff if the lock cannot be acquired immediately.
- Create indexes concurrently using CREATE INDEX CONCURRENTLY to avoid blocking table reads and writes.
- Apply additive schema changes in phases: add the new column first, dual-write in application code, backfill asynchronously, and remove deprecated columns in a separate release.

Safe schema migrations isolate lock acquisition risk from active customer traffic paths.`;
      }
    }

    // 4. Cloud Architecture & Containers (Kubernetes, S3, Lambda)
    if (analysis.category === 'cloud_architecture') {
      if (lower.includes('kubernetes') || lower.includes('pod') || lower.includes('crashloop')) {
        if (narrative === 'architecture_tradeoffs') {
          return `Architectural trade-offs in Kubernetes Pod lifecycle management:

Balancing rapid cluster autoscaling against graceful workload termination requires navigating competing operational tensions:

- Drain Speed vs In-Flight Safety: Setting terminationGracePeriodSeconds too low forces SIGKILL on active requests; setting it too high stalls node draining and cluster upgrades.
- Resource Requests vs Node Packing: Tight memory requests improve bin-packing density, but spike vulnerability to sudden OOMKilled evictions under traffic surges.
- Readiness Gating vs Rollout Velocity: Strict readiness probe periods ensure zero-downtime rollouts, but increase deployment duration during emergency rollbacks.

Resilient Kubernetes architecture prioritizes observable termination over aggressive bin-packing.`;
        }

        return `Troubleshooting Kubernetes Pod lifecycle transitions and CrashLoopBackOff events requires moving past restart counts to container exit codes and probes.

Key failure boundaries:
- Exit code 137 indicates OOMKilled: the container exceeded its configured memory limit and the kernel terminated the process.
- Misconfigured liveness probes that trigger prematurely during cold starts, killing containers before they finish initialization.
- Unhandled process terminations where the application fails to handle SIGTERM, causing abrupt disconnection of in-flight client requests.

Configure explicit startup probes to protect long initialization paths, and pair resource requests with realistic limits based on observed p95 usage.`;
      }

      if (lower.includes('s3') || lower.includes('storage') || lower.includes('blob')) {
        return `Designing resilient multi-region object storage replication requires designing the read path to tolerate eventual consistency.

When objects are replicated asynchronously across cloud regions, cross-region latency means recently uploaded assets may not be immediately readable in failover regions.

Key considerations:
- Decouple metadata persistence from raw object storage, tracking object readiness explicitly in transactional storage.
- Define automated lifecycle transition rules to migrate older versions to colder tiers while balancing availability against storage overhead.
- Verify disaster recovery through automated read-fallback testing before an actual region outage occurs.

Predictable storage lifecycle policies consistently outperform complex manual synchronization scripts.`;
      }

      if (lower.includes('lambda') || lower.includes('serverless') || lower.includes('concurrency') || lower.includes('cold start')) {
        return `In serverless architectures, managing cold start latency is an intentional balance between provisioned capacity and application footprint.

When invocation volume spikes, unprovisioned functions face initialization overhead as the runtime provisions the container, initializes dependencies, and establishes database connections.

Pragmatic heuristics:
- Use provisioned concurrency selectively on user-facing synchronous request paths, allowing asynchronous background queues to use standard on-demand scaling.
- Minimize bundle size and lazy-load heavy SDK modules to reduce initial script execution time.
- Initialize database connection pools outside the request handler to reuse active sockets across warm invocations.

Serverless efficiency comes from matching runtime concurrency to explicit latency tolerances.`;
      }
    }

    // 5. Software Engineering & Systems (Queues, Webhooks, React, Redis)
    if (analysis.category === 'software_engineering') {
      if (lower.includes('webhook') || lower.includes('idempotent') || lower.includes('payment')) {
        return `In payment processing and critical webhook integrations, duplicate delivery is not an edge case—it is a guaranteed characteristic of distributed networks.

Reliable webhook architectures enforce idempotency before touching business logic:
- Record the unique webhook event ID in an idempotent transactions ledger with a unique database constraint.
- Process the payload inside a database transaction that commits the business mutation and records the processed state atomically.
- Return an immediate HTTP 200 OK once recorded to acknowledge receipt and prevent unneeded upstream retries.

Designing for at-least-once delivery from day one eliminates double-credits and payment reconciliation headaches.`;
      }

      if (lower.includes('react') || lower.includes('hook') || lower.includes('component') || lower.includes('frontend')) {
        return `Refactoring complex frontend components is not merely an exercise in reducing line counts—it is about establishing clear boundaries between declarative rendering and state orchestration.

When components grow into unwieldy monoliths:
- Extract related state variables and their mutations into dedicated custom hooks, keeping view components purely declarative.
- Isolate asynchronous side effects and caching logic from presentation components.
- Co-locate state as close to consuming leaf components as possible to eliminate wide, unnecessary re-render cascades across the DOM tree.

When presentation components remain strictly declarative, testing becomes straightforward and UI maintenance scales predictably.`;
      }

      if (lower.includes('lock') || lower.includes('redis') || lower.includes('cas') || lower.includes('redlock')) {
        return `Distributed locking in Redis requires acknowledging the trade-offs between atomic single-instance operations (CAS) and multi-instance consensus algorithms (Redlock).

When single-instance locking using SET resource_name my_random_value NX PX 30000 suffices:
- Always use a unique token and release locks via Lua scripts to verify token ownership before deletion.
- Implement a renewal watchdog if processing durations can unpredictably exceed lock TTLs.
- Evaluate whether eventual consistency or idempotent database transactions can eliminate the distributed lock entirely.

Simplicity in locking primitives avoids split-brain anomalies and unhandled lock expiration bugs.`;
      }

      if (lower.includes('dead-letter') || lower.includes('dlq') || lower.includes('backoff')) {
        return `Building resilient asynchronous message processing requires designing the dead-letter queue (DLQ) as a deliberate operational workflow, not a graveyard for forgotten errors.

When a consumer fails to process a job:
- Distinguish transient failures (network blips, rate limits) from permanent failures (malformed JSON, schema violations).
- Apply exponential backoff with jitter to transient errors to prevent overwhelming recovering downstream services.
- Route permanently failing jobs to a DLQ with actionable context—including failure timestamps, retry count, and original error messages—paired with automated team alerting.

Observable retry pipelines make failure recovery predictable and debuggable.`;
      }
    }

    // 6. Cybersecurity (PKCE, IAM, Zero-Trust)
    if (analysis.category === 'cybersecurity') {
      if (lower.includes('pkce') || lower.includes('oauth')) {
        return `When securing modern web and mobile applications, OAuth 2.0 with PKCE (Proof Key for Code Exchange) eliminates the security vulnerability of exposing client secrets in public clients.

By generating a cryptographically random code verifier and sending its hashed code challenge in the initial authorization request, the authorization server can verify that the client exchanging the authorization code is the exact client that initiated the request.

For single-page applications and mobile clients, PKCE is the gold standard because client-side JavaScript can never securely store a persistent secret.`;
      }

      return `Implementing zero-trust architecture is not a product purchase; it is the discipline of continuous authentication and least-privilege access.

Rather than assuming internal network traffic is trusted:
- Enforce microsegmentation so that services can only communicate over explicitly allowed, mutually authenticated TLS channels.
- Bind service identities to short-lived cryptographic tokens rather than static long-lived credentials.
- Enforce explicit authorization checks at the data layer using row-level security or fine-grained policy engines.

Zero-trust shifts security from brittle perimeter firewalls to continuous cryptographic verification.`;
    }

    // 7. Business & Entrepreneurship (Startup velocity, Churn, Customer Discovery)
    if (analysis.category === 'business_entrepreneurship' || analysis.category === 'startup_updates') {
      if (lower.includes('churn')) {
        return `When analyzing customer retention in B2B SaaS, churn is rarely a pricing problem—it is a signal that the core workflow has not become indispensable.

Customers rarely leave because a product is $50 too expensive. They leave because:
- The product solved a peripheral problem rather than an acute, recurring operational headache.
- Onboarding friction prevented the user from reaching the primary value milestone in their first week.
- Feature bloat added cognitive overhead that obscured the core workflow.

The most effective churn reduction strategy is speaking directly with inactive accounts to uncover where the product failed to deliver on its primary promise.`;
      }

      return `In early-stage software companies, velocity is bounded by customer clarity, not engineering output.

The most frequent trap is building roadmap features in an echo chamber. Shipping fifty unvalidated features feels productive, but talking in-depth with five target customers reveals where real operational friction lies.

Core principles for early traction:
- Prioritize radical focus on the single sharpest customer pain point over broad, shallow platform capabilities.
- Build for the smallest viable customer segment whose pain is acute enough that they will use an imperfect product today.
- Direct, unfiltered customer feedback loops consistently outperform speculative feature development.

Real velocity is the speed at which you validate customer truths, not the speed at which you write code.`;
    }

    // 8. Engineering Leadership & Management
    if (analysis.category === 'leadership') {
      if (lower.includes('code review') || lower.includes('review')) {
        return `Why most code reviews focus on stylistic formatting instead of architectural risk:

When code review culture lacks clear guidance, reviewers naturally gravitate toward what is easy to spot—variable naming, line spacing, and syntax preferences.

High-impact code reviews prioritize system invariants:
- Failure Blast Radius: If this service or query fails under load, how does it affect upstream callers?
- Data Consistency: Are database migrations backward-compatible, and are state mutations transactional?
- Observability: Are critical error paths logged with sufficient context for on-call triage?

Automate stylistic checks with linters and formatters so human reviews can focus on architectural risk and long-term maintainability.`;
      }

      return `Moving from hands-on execution to technical leadership requires rewiring how you measure impact: from personal code volume to organizational leverage.

Key leadership practices:
- Delegate problem boundaries and explicit success metrics rather than dictating step-by-step implementation details.
- Shift code review culture away from stylistic nitpicks toward architectural risk, data consistency, and failure blast radius.
- Remove operational bottlenecks so engineers maintain focused flow without waiting for centralized approvals.

The strongest engineering teams are built on high agency, transparent context, and psychological safety under pressure.`;
    }

    // 9. Personal Reflections & Career Milestones
    if (analysis.category === 'personal_reflections') {
      return `Reflections on career growth in software engineering:

Navigating a sustainable career in software is less about mastering every fleeting framework and more about cultivating evergreen mental models:

- High Agency: When an operational problem lacks clear ownership, stepping up to define the boundary creates immediate organizational value.
- Depth Over Breadth: Deeply understanding how databases, networks, and operating systems handle failure outlasts any particular frontend library.
- Writing as a Superpower: Clear documentation and written proposals scale your thinking across teams far faster than meetings.

Compounding small daily improvements across fundamental disciplines produces outsized results over a decade.`;
    }

    // 10. General Grounded Synthesis - Adapt to Narrative Arc
    if (narrative === 'architecture_tradeoffs') {
      return `Every architectural decision in ${topic} is an exercise in choosing your constraints:

Rather than searching for an ideal universal design, resilient engineering focuses on balancing explicit operational trade-offs:
- Throughput vs Latency: Balancing batch processing efficiency against single-request round-trip responsiveness.
- Operational Simplicity: Balancing specialized infrastructure primitives against the maintenance burden of running extra dependencies.
- Failure Blast Radius: Designing failure domains so localized degradation does not cascade through downstream services.

The best production architectures do not eliminate trade-offs; they make them observable and deliberate.`;
    }

    if (narrative === 'problem_investigation_solution') {
      return `When diagnosing unexpected behavior in ${topic}, symptoms are frequently mistaken for root causes:

In high-throughput environments, superficial errors usually mask deeper structural constraints:
- Immediate Symptom: Sudden latency spikes and backpressure on dependent service queues.
- Root Cause Investigation: Underlying resource contention, unindexed scans, or unobserved locking contention.
- Durable Remediation: Enforcing strict timeouts, bounded retry policies, and automated circuit breaking.

Addressing the structural failure domain once eliminates recurring on-call firefighting.`;
    }

    if (narrative === 'misconception_reality' || (narrative as string) === 'contrarian_observation') {
      return `A contrarian observation regarding ${topic}:

Industry consensus often encourages adding complex layers of abstraction where simpler primitives would suffice:
- Conventional Pattern: Reaching for distributed orchestration tools before exhausting existing database or queue capabilities.
- Where It Breaks: Operational fragility increases exponentially with each new network hop and state store.
- Pragmatic Alternative: Relying on idempotent state transitions and verifiable database invariants.

Simplicity in production systems is an operational superpower that pays dividends over time.`;
    }

    // Default deep dive / analytical breakdown
    return `Operational takeaways from deploying and scaling ${topic}:

Working with this domain in real-world environments reinforces foundational rules:
- System state transitions must be explicit and deterministic from day one.
- Network latency and transient dependencies must be treated as standard operating conditions.
- Observable metrics and automated health checks must precede architectural refactoring.

When systems are built around clear constraints from day one, maintainability and scale follow naturally.`;
  }
}

export const contentIntelligence = new ContentIntelligenceEngine();
