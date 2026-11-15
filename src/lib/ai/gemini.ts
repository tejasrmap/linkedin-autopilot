// ==============================================================
// LINKEDIN AUTOPILOT - GOOGLE GEMINI AI STUDIO CLIENT
// CONTENT INTELLIGENCE, UNIQUENESS & DYNAMIC NARRATIVE ARCHITECTURE
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
import { writingProfileEngine, WritingProfile } from './writing-profile';
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
   * Generates a post while providing complete uniqueness & quality audit telemetry
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

    // 2. Stage E & F: Load Tenant History & Writing Profile
    let history: HistoricalPostSummary[] = [];
    let profile: WritingProfile = writingProfileEngine.getDefaultProfile();

    if (options.supabaseClient && options.workspaceId) {
      try {
        const [fetchedHistory, fetchedProfile] = await Promise.all([
          uniquenessEngine.getTenantHistory(options.supabaseClient, options.workspaceId),
          writingProfileEngine.extractProfile(options.supabaseClient, options.workspaceId, options.userId),
        ]);
        history = fetchedHistory;
        profile = fetchedProfile;
      } catch (err) {
        console.warn('[AIService] Error fetching historical context:', err);
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
          console.info(`[AIService] Quality gate retry #${retriesUsed} triggered. Reasons:`, gateResult.score.reasons);

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
          return {
            content: gateResult.sanitizedContent,
            analysis,
            uniquenessScore: gateResult.score,
            retriesUsed,
          };
        }
      } catch (err) {
        console.warn('[AIService] Gemini API generation error, using Grounded Intelligence Fallback:', err);
      }
    }

    // 4. Fallback Engine: Topic-grounded, factually substantive, zero-boilerplate generation
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

    return {
      content: fallbackContent,
      analysis,
      uniquenessScore: fallbackScore,
      retriesUsed,
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
        ? 'between 1200 and 2200 characters, comprehensive technical or strategic breakdown'
        : 'between 600 and 1200 characters, balanced structure';

    let prompt = `You are a distinguished technical practitioner and executive writer crafting an authentic, high-impact LinkedIn post.
You write with deep domain credibility, intellectual honesty, and natural human voice.
NEVER sound like a generic AI ghostwriter or marketing bot.

TOPIC: ${analysis.mainSubject}
CONTENT CATEGORY: ${analysis.category} (${analysis.isHybrid ? 'Hybrid: ' + analysis.secondaryCategories.join(', ') : 'Direct'})
GENERATION MODE: ${mode}
TARGET AUDIENCE: ${analysis.intendedAudience}
TECHNICAL COMPLEXITY: ${analysis.technicalComplexity}
PRIMARY OBJECTIVE: ${analysis.objective}
TARGET LENGTH: ${charRange}

CORE DOMAIN MECHANICS & TERMINOLOGY TO LEVERAGE:
${analysis.domainTerms.map((t) => `- ${t}`).join('\n')}

${contentIntelligence.buildNarrativeGuidance(narrativeArc, analysis)}

${writingProfileEngine.formatProfilePrompt(profile)}
`;

    if (options.brandVoice) {
      prompt += `
BRAND VOICE CONSTRAINTS:
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
2. NO FABRICATED STATISTICS OR EXPERIENCES:
   - Do not invent quantitative metrics (e.g. "improved efficiency by 43.8%") or fake anecdotes not provided in the topic prompt.
3. NO CLICHÉD THREE-PART LIST BOILERPLATE:
   - Do not default to "1. Activity is not progress... 2. Complexity is a vulnerability...".
   - If using bullet points, each must contain concrete subject-specific mechanisms.
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
   * Rewrites an existing draft into a desired tone or structure while preserving factual core
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
- Preserve the exact factual details, architecture terms, and technical mechanisms.
- Eliminate generic fluff, filler adjectives, and corporate buzzwords.
- Tone target: ${options.targetTone}.
- Use natural paragraph cadence with clean typographic spacing.
- Return ONLY the rewritten post text with no meta-commentary.
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim();
        if (text) return text;
      } catch (err) {
        console.warn('[AIService] Gemini rewrite failed, using intelligent rewriter:', err);
      }
    }

    // Grounded fallback rewriter
    const lines = options.content.trim().split('\n').filter((l) => l.trim().length > 0);
    const coreThought = lines[0] || options.content;
    const body = lines.slice(1).join('\n\n');

    if (options.targetTone === 'technical') {
      return `Technical breakdown on ${coreThought.replace(/[#*]/g, '').slice(0, 60)}:

Core considerations:
• Decouple state mutations from asynchronous event processing
• Enforce strict idempotency on network retries
• Validate constraints at both application boundaries and the database schema

${body || 'Building with architectural rigor ensures systems scale predictably under production pressure.'}

What patterns does your team prioritize when hardening these pipelines?`;
    }

    if (options.targetTone === 'storytelling') {
      return `A lesson learned from hands-on production experience:

"${coreThought.replace(/[#*]/g, '').trim()}"

When we first tackled this, the focus was entirely on output velocity.
The real bottleneck turned out to be architectural clarity and eliminating avoidable complexity.

${body}

Clarity in design beats premature complexity every time.`;
    }

    // Default professional rewrite
    return `${coreThought}

${body || 'Focusing on reliable execution over superficial noise compounds results over time.'}

How does your team approach this in your current workflows?`;
  }

  /**
   * Generates relevant hashtags for a topic or post content
   */
  async generateHashtags(topicOrContent: string, count = 5, apiKey?: string): Promise<string[]> {
    const model = getGeminiModel(apiKey);

    if (model) {
      try {
        const prompt = `Based on the following LinkedIn post topic or text, provide the ${count} most effective, high-reach, industry-relevant LinkedIn hashtags.

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

    const words = topicOrContent
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3);

    const tags = new Set<string>();
    tags.add('#Engineering');
    tags.add('#Technology');
    tags.add('#SoftwareDevelopment');

    for (const w of words.slice(0, 3)) {
      tags.add('#' + w.charAt(0).toUpperCase() + w.slice(1));
    }

    return Array.from(tags).slice(0, count);
  }

  /**
   * Generates creative post concepts and hooks with full ready-to-publish drafts
   */
  async generateIdeas(
    industryOrCategory: string,
    count = 5,
    apiKey?: string
  ): Promise<Array<{ title: string; hook: string; outline: string; fullDraft: string }>> {
    const model = getGeminiModel(apiKey);

    if (model) {
      try {
        const prompt = `Generate ${count} compelling, diverse LinkedIn post concepts and FULL publication-ready drafts for the industry/topic: "${industryOrCategory}".

Each idea must have a distinct narrative structure (e.g. Architectural Tradeoff, Real Incident Retrospective, Practical Tutorial, Mental Model).
AVOID repetitive clichés like "90% of leaders focus on the wrong metric" or "Activity is not progress".

Return a valid JSON array of objects with the structure:
[
  {
    "title": "Short descriptive topic title",
    "hook": "The exact scroll-stopping opening hook line",
    "outline": "2-3 sentences summarizing the key takeaway or lesson",
    "fullDraft": "The complete, publication-ready LinkedIn post text ready to schedule immediately"
  }
]

Return ONLY valid JSON.
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

    // Dynamic grounded idea pool
    const analysis = contentIntelligence.analyzeTopic(industryOrCategory);
    return [
      {
        title: `Architectural Decisions in ${analysis.industry}`,
        hook: `The most expensive technical decisions aren't the ones that fail immediately. They are the ones that work just well enough to incur architectural debt.`,
        outline: `A practical breakdown of choosing decoupled event boundaries over premature microservices.`,
        fullDraft: `The most expensive technical decisions aren't the ones that fail immediately. They are the ones that work just well enough to incur architectural debt.

When building for scale, three principles keep systems maintainable:

1. Validate the write path: Ensure state transitions are idempotent and safe to retry.
2. Isolate failure domains: A slowdown in a third-party API should never degrade user-facing read paths.
3. Keep mental models simple: If a new engineer cannot trace a transaction in 15 minutes, the abstraction is leaking.

Build what solves today's constraints cleanly. Refactor when real telemetry demands it.

#Architecture #Engineering #SystemDesign`,
      },
      {
        title: `The Reality of Preparing for Certifications`,
        hook: `Sanitized practice exams teach you how to pass a test. Production incidents teach you how the system actually works.`,
        outline: `Why hands-on troubleshooting labs matter 10x more than memorizing multiple-choice questions.`,
        fullDraft: `Sanitized practice exams teach you how to pass a test. Production incidents teach you how the system actually works.

If you are preparing for technical credentials in ${analysis.industry}:

• Break configurations intentionally in sandbox labs.
• Inspect logs and traces when pods or instances enter crash loops.
• Understand least-privilege security boundaries rather than using wildcard permissions.

The credential is proof of study discipline. The real competence is remaining calm when production alerts fire.

#ContinuousLearning #Engineering #CareerGrowth`,
      },
      {
        title: `Lessons from Building Scalable Workflows`,
        hook: `Before automating any workflow, spend three days watching the manual friction by hand.`,
        outline: `Why digitizing an unvalidated process creates automated chaos rather than operational leverage.`,
        fullDraft: `Before automating any workflow, spend three days watching the manual friction by hand.

It is tempting to write code or configure complex queue orchestrations right away.
In practice:

• 40% of steps in most manual workflows are legacy habits that can simply be deleted.
• Complex notification rules create alert fatigue rather than faster turnaround.
• Tight feedback loops outperform elaborate multi-tier approval chains.

Simplify the workflow first. Then let background workers handle the repetition.

#Operations #Engineering #Automation`,
      },
    ].slice(0, count);
  }

  /**
   * Generates a 7-day content calendar with complete publication-ready drafts
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
        const prompt = `Create a high-performing 7-Day LinkedIn Content Calendar for an organization in "${industry}" with a tone of "${brandTone}".

For each day (Monday through Sunday), generate a COMPLETE, publication-ready LinkedIn post with genuine subject-specific substance.
Ensure diverse narrative angles across the 7 days (e.g. Architecture Deep Dive, Failure Retrospective, Practical Tip, Industry Trend Analysis, Team Heuristic).
AVOID repeating the same format or clichés across days.

Return ONLY a valid JSON array of 7 objects with the structure:
[
  {
    "day": "Monday",
    "theme": "Theme title",
    "hook": "Opening hook",
    "format": "Text format",
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
      } catch {
        // Fallback
      }
    }

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const themes = [
      'Architectural Deep Dive & System Trade-offs',
      'Real-World Production Retrospective',
      'Actionable Engineering Heuristic',
      'Industry Analysis & Technical Direction',
      'Team Operations & Execution Culture',
      'Practical Tooling & Optimization',
      'Weekly Engineering Reflection',
    ];

    return days.map((day, idx) => ({
      day,
      theme: themes[idx],
      hook: `A concrete observation from building in ${industry}:`,
      format: 'Analytical Prose + Takeaways',
      contentType: 'Technical Knowledge',
      fullDraft: `A concrete observation from building in ${industry}:

Focusing on simplicity and explicit failure handling pays compounding dividends.
When systems are designed with clear boundaries:
• Latency remains predictable
• Incidents are straightforward to debug
• Teams execute with autonomy

What is your team prioritizing this week?

#${industry.replace(/[^a-zA-Z0-9]/g, '')} #Engineering`,
    }));
  }
}

export const aiService = new AIService();
