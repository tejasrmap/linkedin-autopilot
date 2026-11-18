// ==============================================================
// LINKEDIN AUTOPILOT - GOOGLE GEMINI AI STUDIO CLIENT
// CONTENT INTELLIGENCE, UNIQUENESS & DYNAMIC NARRATIVE ARCHITECTURE
// STRICT QUALITY GATE CONTRACT, TRUTHFUL FALLBACK & USER ISOLATION
// BY GT INNOX LLP
// ==============================================================

import { GoogleGenerativeAI } from '@google/generative-ai';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  contentIntelligence,
  ContentCategory,
  GenerationMode,
  NarrativeArc,
  TopicAnalysis,
} from './content-intelligence';
import { writingProfileEngine, WritingProfile, HistoryScope } from './writing-profile';
import {
  uniquenessEngine,
  UniquenessScore,
  HistoricalPostSummary,
} from './uniqueness-engine';
import { qualityGate, QualityGateResult } from './quality-gate';

function getGeminiModel(customApiKey?: string) {
  const apiKey = (customApiKey || process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'your_gemini_api_key') {
    return null;
  }
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  } catch {
    return null;
  }
}

export interface GeneratePostOptions {
  topic: string;
  targetAudience?: string;
  tone?: string;
  length?: 'short' | 'medium' | 'long';
  contentType?: string;
  generationMode?: GenerationMode;
  narrativeArc?: NarrativeArc;
  workspaceId?: string;
  userId?: string;
  historyScope?: HistoryScope;
  supabaseClient?: SupabaseClient;
  apiKey?: string;
  brandVoice?: {
    brandName?: string;
    industry?: string;
    targetAudience?: string;
    brandVoice?: string;
    preferredHashtags?: string[];
  };
}

export interface GeneratePostResult {
  content: string;
  analysis: TopicAnalysis;
  uniquenessScore: UniquenessScore;
  retriesUsed: number;
  passed: boolean;
  qualityStatus: 'verified' | 'degraded' | 'failed';
  qualityWarnings: string[];
}

export interface RewritePostOptions {
  content: string;
  targetTone: 'professional' | 'conversational' | 'technical' | 'educational' | 'persuasive' | 'storytelling';
  improveHook?: boolean;
  workspaceId?: string;
  userId?: string;
  supabaseClient?: SupabaseClient;
  apiKey?: string;
}

export class AIService {
  /**
   * Generates a topic-grounded, structurally unique, non-generic LinkedIn post
   */
  async generatePost(options: GeneratePostOptions): Promise<string> {
    const result = await this.generatePostWithReport(options);
    return result.content;
  }

  /**
   * Generates a post while providing complete uniqueness & quality audit telemetry.
   * Correctly reflects degraded/failed status if quality gate rejects after retries.
   */
  async generatePostWithReport(options: GeneratePostOptions): Promise<GeneratePostResult> {
    // 1. Stage A: Topic Understanding & Domain Analysis
    const analysis = contentIntelligence.analyzeTopic(
      options.topic,
      options.targetAudience,
      options.tone
    );

    const mode: GenerationMode = options.generationMode || analysis.recommendedMode;
    let activeNarrative: NarrativeArc = options.narrativeArc || analysis.recommendedNarrative;

    // Resolve explicit history scope architecture
    const requestedScope = options.historyScope;
    let activeScope: HistoryScope;
    if (requestedScope === 'unpersonalized') {
      activeScope = 'unpersonalized';
    } else if (requestedScope === 'workspace_brand') {
      activeScope = 'workspace_brand';
    } else {
      // Default scope is user_personal. If userId is not provided, fail closed to unpersonalized
      activeScope = options.userId ? 'user_personal' : 'unpersonalized';
    }

    // 2. Stage E & F: Load Tenant History & User-Scoped Writing Profile
    let history: HistoricalPostSummary[] = [];
    let profile: WritingProfile = writingProfileEngine.getDefaultProfile(options.workspaceId, options.userId);

    if (options.supabaseClient && options.workspaceId && activeScope !== 'unpersonalized') {
      try {
        const [fetchedHistory, fetchedProfile] = await Promise.all([
          uniquenessEngine.getTenantHistory(
            options.supabaseClient,
            options.workspaceId,
            20,
            activeScope,
            options.userId
          ),
          writingProfileEngine.extractProfile(
            options.supabaseClient,
            options.workspaceId,
            options.userId,
            activeScope
          ),
        ]);
        history = fetchedHistory;
        profile = fetchedProfile;
      } catch (err) {
        console.warn('[AIService] Error fetching historical context, proceeding with unpersonalized fallback:', err);
      }
    }

    const model = getGeminiModel(options.apiKey);
    let candidatePost = '';
    let retriesUsed = 0;
    const maxRetries = 2;

    if (model) {
      try {
        // Build initial prompt
        let prompt = this.buildGenerationPrompt(
          analysis,
          mode,
          activeNarrative,
          profile,
          options
        );

        let result = await model.generateContent(prompt);
        let response = await result.response;
        candidatePost = response.text().trim();

        // 3. Stage H: Quality Gate & Bounded Retries
        let gateResult: QualityGateResult = qualityGate.evaluate(
          candidatePost,
          options.topic,
          analysis,
          history
        );

        while (gateResult.retryNeeded && retriesUsed < maxRetries) {
          retriesUsed++;
          console.info(`[AIService] Quality gate retry #${retriesUsed} triggered. Warnings:`, gateResult.qualityWarnings);

          // Pivot narrative arc for structural uniqueness
          activeNarrative = this.selectAlternativeNarrative(activeNarrative, analysis.category);

          prompt = this.buildGenerationPrompt(
            analysis,
            mode,
            activeNarrative,
            profile,
            options,
            gateResult.retryDirectives
          );

          result = await model.generateContent(prompt);
          response = await result.response;
          candidatePost = response.text().trim();

          gateResult = qualityGate.evaluate(
            candidatePost,
            options.topic,
            analysis,
            history
          );
        }

        if (candidatePost) {
          // Explicitly report passed status and quality status from the evaluator
          return {
            content: gateResult.sanitizedContent,
            analysis,
            uniquenessScore: gateResult.score,
            retriesUsed,
            passed: gateResult.passed,
            qualityStatus: gateResult.qualityStatus,
            qualityWarnings: gateResult.qualityWarnings,
          };
        }
      } catch (err) {
        console.warn('[AIService] Gemini API error, falling back to Truthful Grounded Synthesis:', err);
      }
    }

    // 4. Fallback Engine: Topic-grounded, factually substantive, zero-fabrication synthesis
    const fallbackContent = contentIntelligence.generateGroundedFallback(
      analysis,
      mode,
      activeNarrative
    );

    const fallbackScore = uniquenessEngine.evaluateContent(
      fallbackContent,
      options.topic,
      history,
      analysis.domainTerms
    );

    const isUnavailable = fallbackContent.startsWith('[Generation Unavailable]');
    const fallbackStatus: 'verified' | 'degraded' | 'failed' = isUnavailable ? 'failed' : 'degraded';

    return {
      content: fallbackContent,
      analysis,
      uniquenessScore: {
        ...fallbackScore,
        qualityStatus: fallbackStatus,
        passed: !isUnavailable && fallbackScore.passed,
      },
      retriesUsed,
      passed: !isUnavailable && fallbackScore.passed,
      qualityStatus: fallbackStatus,
      qualityWarnings: [
        isUnavailable
          ? 'Insufficient context provided to generate a post.'
          : 'Generated using deterministic offline synthesis because Gemini AI service was unavailable.',
        ...fallbackScore.reasons,
      ],
    };
  }

  /**
   * Constructs the structured anti-generic prompt for Gemini
   */
  private buildGenerationPrompt(
    analysis: TopicAnalysis,
    mode: GenerationMode,
    narrativeArc: NarrativeArc,
    profile: WritingProfile,
    options: GeneratePostOptions,
    retryDirectives?: { narrativeAdjustment: string; bannedPhrases: string[]; focusKeywords: string[] }
  ): string {
    const charRange =
      options.length === 'short'
        ? 'under 500 characters, punchy and direct'
        : options.length === 'long'
        ? 'between 1200 and 2200 characters, comprehensive breakdown'
        : 'between 600 and 1200 characters, balanced structure';

    let prompt = `You are an authoritative professional writer crafting an authentic, high-impact LinkedIn post.
You write with deep domain credibility, intellectual honesty, and natural human voice.
NEVER sound like a generic AI ghostwriter or marketing bot.

TOPIC: ${analysis.mainSubject}
CONTENT CATEGORY: ${analysis.category} (${analysis.isHybrid ? 'Hybrid: ' + analysis.secondaryCategories.join(', ') : 'Direct'})
GENERATION MODE: ${mode}
TARGET AUDIENCE: ${analysis.intendedAudience}
TECHNICAL COMPLEXITY: ${analysis.technicalComplexity}
PRIMARY OBJECTIVE: ${analysis.objective}
TARGET LENGTH: ${charRange}

CORE SUBTOPIC CONCEPTS & MECHANICS:
${analysis.domainTerms.map((t) => `- ${t}`).join('\n')}

${contentIntelligence.buildNarrativeGuidance(narrativeArc, analysis)}

${writingProfileEngine.formatProfilePrompt(profile)}
`;

    if (options.brandVoice) {
      prompt += `
SHARED WORKSPACE BRAND VOICE:
- Organization: ${options.brandVoice.brandName || 'GT InnoX LLP'}
- Industry: ${options.brandVoice.industry || analysis.industry}
- Custom Tone Guidance: ${options.brandVoice.brandVoice || options.tone || 'Authoritative and practical'}
- Preferred Hashtags: ${(options.brandVoice.preferredHashtags || []).join(' ')}
`;
    }

    prompt += `
STRICT ANTI-GENERIC & GROUNDING RULES:
1. ABSOLUTELY FORBIDDEN OPENING PHRASES:
   - Do NOT start with "Excited to share", "Thrilled to announce", "In today's fast-paced world", "In today's rapidly evolving", "Let's dive into", "The journey has been incredible", "Another milestone achieved", or "I'm happy to announce".
   - Start immediately with the core technical mechanism, observation, or decision.
2. NO FABRICATED PERSONAL EXPERIENCES, INCIDENTS, OR STATISTICS:
   - Do not invent personal claims ("I passed", "We deployed", "Our team faced an outage") unless explicitly stated in the topic prompt.
   - Do not invent fake quantitative metrics (e.g. "improved efficiency by 43.8%") not provided in the topic prompt.
3. NO CLICHÉD THREE-PART LIST BOILERPLATE:
   - Do not default to "1. Activity is not progress... 2. Complexity is a vulnerability...".
   - If using bullet points, each must contain concrete, subject-specific mechanisms.
4. VARIED NATURAL CADENCE:
   - Flow naturally between explanatory prose and structured takeaways. Avoid robotic 1-sentence paragraphs throughout.
5. GROUNDED VALUE:
   - Focus on trade-offs, architecture decisions, lessons learned, or actionable knowledge that respects peer intelligence.
6. Return ONLY the final post content ready for LinkedIn. Do NOT include meta-commentary like "Here is your post:".
`;

    if (retryDirectives) {
      prompt += `
PREVIOUS ATTEMPT CORRECTION DIRECTIVES:
- Adjustment: ${retryDirectives.narrativeAdjustment}
- Explicitly banned phrases that appeared in previous attempt: ${retryDirectives.bannedPhrases.join(', ')}
- Deepen concrete references to: ${retryDirectives.focusKeywords.join(', ')}
`;
    }

    return prompt;
  }

  /**
   * Rotates narrative arc when previous attempt triggered repetition
   */
  private selectAlternativeNarrative(current: NarrativeArc, category: ContentCategory): NarrativeArc {
    if (category === 'certifications') {
      return current === 'context_milestone_reflection'
        ? 'starting_point_growth'
        : 'context_milestone_reflection';
    }
    if (category === 'databases' || category === 'software_engineering' || category === 'cloud_architecture') {
      if (current === 'problem_investigation_solution') return 'architecture_tradeoffs';
      if (current === 'architecture_tradeoffs') return 'misconception_reality';
      return 'deep_dive_mechanics';
    }
    if (category === 'startup_updates' || category === 'business_entrepreneurship') {
      return current === 'market_problem_execution'
        ? 'observation_challenge_response'
        : 'customer_need_value';
    }
    return current === 'concept_why_how'
      ? 'question_explanation_application'
      : 'experience_observation_insight';
  }

  /**
   * Rewrites an existing draft into a desired tone while preserving 100% of the factual core.
   * NEVER INJECTS FABRICATED ARCHITECTURAL CLAIMS OR PERSONAL INCIDENTS.
   */
  async rewritePost(options: RewritePostOptions): Promise<string> {
    const model = getGeminiModel(options.apiKey);

    if (model) {
      try {
        const prompt = `You are a master technical editor and professional copywriter.
Rewrite the draft below to match the tone: "${options.targetTone.toUpperCase()}".
${options.improveHook ? 'Crucially, craft an authentic, scroll-stopping opening line grounded in the actual subject.' : ''}

ORIGINAL DRAFT:
"""
${options.content}
"""

STRICT EDITING RULES:
- Preserve the exact factual details, metrics, and domain terms from the original draft.
- Do NOT invent new architectural systems, personal stories, or unmentioned technologies.
- Tone target: ${options.targetTone}.
- Use clean, natural paragraph cadence with professional spacing.
- Return ONLY the rewritten post text with no meta-commentary.
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim();
        if (text) return text;
      } catch (err) {
        console.warn('[AIService] Gemini rewrite failed, using faithful rewriter fallback:', err);
      }
    }

    // Faithful rewriter fallback: refactors the user's actual text without hallucination
    const raw = options.content.trim();
    const paragraphs = raw.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
    const firstPara = paragraphs[0] || raw;
    const remainingBody = paragraphs.slice(1).join('\n\n');

    if (options.targetTone === 'technical') {
      return `Technical breakdown on ${firstPara.replace(/^[#*•\d\.\s-]+/, '').trim().slice(0, 80)}:

${remainingBody || firstPara}

Key engineering takeaway: Focus on verified constraints and explicit operational boundaries before adding complexity.

What considerations does your team prioritize when navigating this in production?`;
    }

    if (options.targetTone === 'conversational') {
      return `${firstPara.replace(/^[#*•\d\.\s-]+/, '').trim()}

${remainingBody || 'Focusing on reliable execution over superficial noise compounds results over time.'}

How does your team typically handle this in your daily workflows?`;
    }

    if (options.targetTone === 'storytelling') {
      return `A grounded observation from real-world execution:

${firstPara.replace(/^[#*•\d\.\s-]+/, '').trim()}

${remainingBody}

Clear systems and disciplined execution consistently beat premature complexity.`;
    }

    if (options.targetTone === 'educational') {
      return `An educational walkthrough of ${firstPara.replace(/^[#*•\d\.\s-]+/, '').trim().slice(0, 70)}:

${remainingBody || firstPara}

Core principle: Master the foundational mechanics before introducing higher-level abstractions.

What is the biggest takeaway your team has learned in this area?`;
    }

    // Default professional rewrite preserving user draft
    return `${firstPara}

${remainingBody}

How does your team evaluate this in your current projects?`;
  }

  /**
   * Generates relevant hashtags derived purely from the topic/content without hardcoded bias
   */
  async generateHashtags(topicOrContent: string, count = 5, apiKey?: string): Promise<string[]> {
    const model = getGeminiModel(apiKey);

    if (model) {
      try {
        const prompt = `Based on the following LinkedIn post topic or text, provide the ${count} most effective, industry-relevant LinkedIn hashtags.

CONTENT:
"""
${topicOrContent}
"""

Return ONLY a JSON array of strings containing the hashtags (each starting with #), e.g.:
["#AI", "#Innovation", "#B2BMarketing"]
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim();

        const match = text.match(/\[[\s\S]*\]/);
        if (match) {
          return JSON.parse(match[0]);
        }
      } catch {
        // Fallback
      }
    }

    // Dynamic keyword extraction from the input text
    const words = topicOrContent
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !HASHTAG_STOP_WORDS.has(w));

    const tags = new Set<string>();
    for (const w of words) {
      tags.add('#' + w.charAt(0).toUpperCase() + w.slice(1));
      if (tags.size >= count) break;
    }

    if (tags.size === 0) {
      tags.add('#ProfessionalDevelopment');
      tags.add('#IndustryInsights');
    }

    return Array.from(tags).slice(0, count);
  }

  /**
   * Generates diverse, industry-tailored post concepts without hardcoded templates
   */
  async generateIdeas(
    industryOrCategory: string,
    count = 5,
    apiKey?: string
  ): Promise<Array<{ title: string; hook: string; outline: string; fullDraft: string }>> {
    const model = getGeminiModel(apiKey);

    if (model) {
      try {
        const prompt = `Generate ${count} compelling, diverse LinkedIn post concepts and FULL publication-ready drafts tailored specifically to: "${industryOrCategory}".

Each idea must have a distinct narrative structure (e.g. Architectural Tradeoff, Problem Diagnosis, Practical Heuristic, Industry Perspective).
AVOID repetitive clichés or identical opening lines across ideas.

Return a valid JSON array of objects with the structure:
[
  {
    "title": "Short descriptive topic title",
    "hook": "The exact scroll-stopping opening hook line",
    "outline": "2-3 sentences summarizing the key takeaway or lesson",
    "fullDraft": "The complete, publication-ready LinkedIn post text ready to schedule immediately"
  }
]
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim();

        const match = text.match(/\[[\s\S]*\]/);
        if (match) {
          return JSON.parse(match[0]);
        }
      } catch (err: any) {
        if (process.env.MOCK_SUPABASE_FOR_TESTS !== 'true') {
          throw new Error(err.message || 'Gemini API call failed during idea generation.');
        }
      }
    }

    if (process.env.MOCK_SUPABASE_FOR_TESTS !== 'true') {
      throw new Error('Gemini API is unavailable or unconfigured. Please configure your GEMINI_API_KEY in Brand Voice settings.');
    }

    // Only in offline test harness: return basic test structures
    const cleanIndustry = industryOrCategory.replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Modern Operations';
    const tag = cleanIndustry.split(' ')[0] || 'Leadership';

    return [
      {
        title: `Strategic Trade-offs in ${cleanIndustry}`,
        hook: `When building for scale in ${cleanIndustry.toLowerCase()}, the hardest part is deciding what NOT to build.`,
        outline: `A practical breakdown of keeping systems lean and focusing engineering velocity on verified customer bottlenecks.`,
        fullDraft: `When building for scale in ${cleanIndustry.toLowerCase()}, the hardest part is deciding what NOT to build.

It is easy to add speculative features or over-engineer workflows ahead of demand. In practice:

• Feature breadth dilutes core product clarity.
• Complex processes introduce avoidable hand-off friction.
• The single metric that matters is whether users complete their primary job with zero drag.

Simplify the foundation first. Refactor when real telemetry demands it.

What constraints does your team prioritize when scoping new deliverables?

#${tag} #Strategy #Operations`,
      },
      {
        title: `Misconception vs Reality in ${cleanIndustry}`,
        hook: `The biggest misconception teams have about ${cleanIndustry.toLowerCase()}: assuming more tooling solves broken workflow architecture.`,
        outline: `Why digitizing an unvalidated process creates automated chaos rather than operational leverage.`,
        fullDraft: `The biggest misconception teams have about ${cleanIndustry.toLowerCase()}: assuming more tooling solves broken workflow architecture.

Before adopting new software or adding multi-tier workflows:

• Map the actual hand-offs by hand to identify where delays originate.
• Eliminate legacy sign-offs that do not directly protect execution safety.
• Ensure every deliverable has exactly one accountable owner.

A simple, well-understood workflow consistently outperforms complex toolchains that require constant intervention.

How does your team evaluate whether a process bottleneck needs new tools or simpler rules?

#${tag} #Productivity #SystemThinking`,
      },
      {
        title: `A Grounded Heuristic for ${cleanIndustry}`,
        hook: `In high-velocity ${cleanIndustry.toLowerCase()} environments, tight feedback loops beat exhaustive planning every time.`,
        outline: `How measuring cycle turnaround time helps teams catch delivery anomalies early.`,
        fullDraft: `In high-velocity ${cleanIndustry.toLowerCase()} environments, tight feedback loops beat exhaustive planning every time.

Three non-negotiables for sustainable delivery:

1. Diagnose constraints early: Measure turnaround cycles to spot bottlenecks before they compound.
2. Foster asynchronous clarity: Replace status-check meetings with clear written summaries.
3. Establish 24-hour blocker resolution: Address impediments the same day they appear.

Rigor in execution creates the bandwidth needed to innovate responsibly.

What heuristic has made the biggest difference in your team's delivery velocity?

#${tag} #Execution #WorkplaceExcellence`,
      },
    ].slice(0, count);
  }

  /**
   * Generates a 7-day content calendar with distinct, diverse formats across all days
   */
  async generateContentCalendar(
    industry: string,
    brandTone: string,
    apiKey?: string
  ): Promise<
    Array<{
      day: string;
      theme: string;
      hook: string;
      format: string;
      contentType: string;
      fullDraft: string;
    }>
  > {
    const model = getGeminiModel(apiKey);

    if (model) {
      try {
        const prompt = `Create a high-performing 7-Day LinkedIn Content Calendar for "${industry}" with a tone of "${brandTone}".

Each of the 7 days (Monday through Sunday) MUST feature a completely distinct format, theme, and opening hook.
AVOID repeating similar hooks or phrases across days.

Return ONLY a valid JSON array of 7 objects with the structure:
[
  {
    "day": "Monday",
    "theme": "Theme title",
    "hook": "Opening hook",
    "format": "Format type",
    "contentType": "Category",
    "fullDraft": "Complete post content..."
  }
]
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim();

        const match = text.match(/\[[\s\S]*\]/);
        if (match) {
          return JSON.parse(match[0]);
        }
      } catch (err: any) {
        if (process.env.MOCK_SUPABASE_FOR_TESTS !== 'true') {
          throw new Error(err.message || 'Gemini API call failed during calendar generation.');
        }
      }
    }

    if (process.env.MOCK_SUPABASE_FOR_TESTS !== 'true') {
      throw new Error('Gemini API is unavailable or unconfigured. Please configure your GEMINI_API_KEY in Brand Voice settings.');
    }

    // Only in offline test harness: return basic test structures
    const cleanInd = industry.replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Engineering';
    const tag = cleanInd.split(' ')[0] || 'Leadership';

    return [
      {
        day: 'Monday',
        theme: 'Macro Trend & Strategic Direction',
        hook: `The landscape of ${cleanInd.toLowerCase()} is shifting toward verifiable operational simplicity.`,
        format: 'Analytical Prose',
        contentType: 'Strategic Perspective',
        fullDraft: `The landscape of ${cleanInd.toLowerCase()} is shifting toward verifiable operational simplicity.

Organizations that succeed in this environment share three operating traits:
• Asynchronous documentation by default
• Clear single-owner accountability
• Objective telemetry over speculative assumptions

Where is your team focusing its operational improvements this quarter?

#${tag} #Strategy`,
      },
      {
        day: 'Tuesday',
        theme: 'Operational Deep-Dive & Architecture',
        hook: `When evaluating systems in ${cleanInd.toLowerCase()}, the write path reveals where architectural debt is hiding.`,
        format: 'Deep Dive + Key Mechanics',
        contentType: 'Technical Knowledge',
        fullDraft: `When evaluating systems in ${cleanInd.toLowerCase()}, the write path reveals where architectural debt is hiding.

Three non-negotiables for resilient execution:
1. Enforce idempotent state transitions on network retries
2. Isolate failure domains so downstream blips don't cascade
3. Monitor end-to-end latency at p99, not just the happy-path median

How does your team test failure recovery before deploying major architecture updates?

#${tag} #SystemDesign`,
      },
      {
        day: 'Wednesday',
        theme: 'Common Misconception vs Operational Reality',
        hook: `A widespread myth in ${cleanInd.toLowerCase()}: more meetings mean tighter team alignment.`,
        format: 'Myth Buster',
        contentType: 'Practitioner Heuristics',
        fullDraft: `A widespread myth in ${cleanInd.toLowerCase()}: more meetings mean tighter team alignment.

In reality:
• Status meetings often mask unclear written specifications.
• Synchronous interruptions fragment focused engineering time.
• High-agency teams align through written proposals and clear success metrics.

Have you noticed your team's velocity change when shifting to asynchronous updates?

#${tag} #Productivity`,
      },
      {
        day: 'Thursday',
        theme: 'Real-World Retrospective & Incident Analysis',
        hook: `The most valuable insights in ${cleanInd.toLowerCase()} come from dissecting edge-case anomalies.`,
        format: 'Incident Breakdown',
        contentType: 'Lessons Learned',
        fullDraft: `The most valuable insights in ${cleanInd.toLowerCase()} come from dissecting edge-case anomalies.

When an unexpected bottleneck occurs:
• Blameless post-mortems turn operational failures into team leverage.
• Root-cause analysis should focus on process gaps, not individual blame.
• Preventive guardrails protect future maintainers from repeating the error.

What is the most enduring lesson a production issue has taught your team?

#${tag} #EngineeringCulture`,
      },
      {
        day: 'Friday',
        theme: 'Practitioner Checklist & Actionable Framework',
        hook: `Before approving changes to core ${cleanInd.toLowerCase()} workflows, run through this 3-point checklist:`,
        format: 'Checklist Framework',
        contentType: 'Actionable Framework',
        fullDraft: `Before approving changes to core ${cleanInd.toLowerCase()} workflows, run through this 3-point checklist:

1. Verification: Can the outcome be confirmed through metrics, logs, or automated tests?
2. Blast Radius: What happens if downstream dependencies throttle or fail completely?
3. Rollback Safety: Is there an explicit, tested rollback path if anomalies appear?

Simple checklists prevent avoidable production surprises.

What is on your team's non-negotiable pre-deploy checklist?

#${tag} #Checklists`,
      },
      {
        day: 'Saturday',
        theme: 'Continuous Learning & Recommended Deep-Dive',
        hook: `Continuous learning in ${cleanInd.toLowerCase()} requires studying foundational papers alongside current tools.`,
        format: 'Educational Recommendation',
        contentType: 'Continuous Learning',
        fullDraft: `Continuous learning in ${cleanInd.toLowerCase()} requires studying foundational papers alongside current tools.

Frameworks evolve rapidly, but underlying principles—state distribution, concurrency, and constraint modeling—remain remarkably durable.

Investing 30 minutes a week into understanding foundational design patterns pays compounding dividends.

What technical book or paper has most influenced your engineering perspective?

#${tag} #Learning`,
      },
      {
        day: 'Sunday',
        theme: 'Weekly Perspective & Team Reflection',
        hook: `Reflecting on the week in ${cleanInd.toLowerCase()}: consistency in fundamentals beats sporadic intensity every single time.`,
        format: 'Reflective Discussion',
        contentType: 'Personal Reflection',
        fullDraft: `Reflecting on the week in ${cleanInd.toLowerCase()}: consistency in fundamentals beats sporadic intensity every single time.

Teams that thrive don't burn out on heroic late-night fixes. They build dependable systems that make consistent delivery routine.

Recharge, reflect on what worked, and head into the new week with clear priorities.

What is your primary focus for the week ahead?

#${tag} #Leadership`,
      },
    ];
  }
}

const HASHTAG_STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'about', 'from', 'this', 'that', 'into', 'what', 'how', 'why',
  'most', 'some', 'your', 'will', 'have', 'when', 'which', 'where', 'been', 'their', 'there',
]);

export const aiService = new AIService();
