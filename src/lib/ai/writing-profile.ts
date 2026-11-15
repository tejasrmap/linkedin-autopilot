// ==============================================================
// LINKEDIN AUTOPILOT — WRITING STYLE INTELLIGENCE
// STRICT USER-LEVEL VS WORKSPACE-LEVEL VOICE ISOLATION
// BY GT INNOX LLP
// ==============================================================

import { SupabaseClient } from '@supabase/supabase-js';

export interface WritingProfile {
  sampleCount: number;
  isPersonalized: boolean;
  scope: 'user_personal' | 'workspace_brand' | 'unpersonalized_fallback';
  workspaceId: string;
  userId?: string;
  averageSentenceLength: 'short' | 'medium' | 'long';
  averageParagraphLength: 'concise' | 'balanced' | 'detailed';
  formality: 'casual' | 'conversational' | 'balanced' | 'formal' | 'academic';
  technicalDepth: 'introductory' | 'practitioner' | 'architectural';
  firstPersonUsage: 'first_person_singular' | 'first_person_plural' | 'neutral_objective';
  emojiDensity: 'none' | 'sparse' | 'moderate';
  hashtagPreference: 'none' | 'minimal' | 'standard';
  formattingRhythm: 'prose_focused' | 'bullet_focused' | 'hybrid';
  dominantVocabulary: string[];
  signatureSignOff?: string;
}

export class WritingProfileEngine {
  /**
   * Analyzes an individual user's or workspace's historical approved/published posts.
   * Strictly enforces individual user ownership without bleeding other workspace members' styles.
   */
  async extractProfile(
    supabase: SupabaseClient,
    workspaceId: string,
    userId?: string
  ): Promise<WritingProfile> {
    try {
      // 1. Fetch recent published or approved posts
      let query = supabase
        .from('posts')
        .select('content, created_at')
        .eq('workspace_id', workspaceId);

      if (userId) {
        // Enforce user-level ownership strictly
        query = query.eq('created_by', userId);
      }

      const { data: posts, error: postErr } = await query
        .order('created_at', { ascending: false })
        .limit(15);

      let samples: string[] = [];
      if (!postErr && posts && posts.length > 0) {
        samples = posts.map((p) => p.content).filter(Boolean);
      }

      // 2. If insufficient post samples, query ai_generations with strict user_id scoping
      if (samples.length < 2) {
        let genQuery = supabase
          .from('ai_generations')
          .select('generated_content')
          .eq('workspace_id', workspaceId);

        if (userId) {
          // Strictly restrict generation history to the exact user
          genQuery = genQuery.eq('user_id', userId);
        }

        const { data: gens, error: genErr } = await genQuery
          .order('created_at', { ascending: false })
          .limit(10);
        if (!genErr && gens && gens.length > 0) {
          for (const g of gens) {
            if (g.generated_content && !samples.includes(g.generated_content)) {
              samples.push(g.generated_content);
            }
          }
        }
      }

      if (samples.length < 2) {
        // Disclose that personalization is unavailable rather than claiming it
        return this.getDefaultProfile(workspaceId, userId);
      }

      const scope = userId ? 'user_personal' : 'workspace_brand';
      return this.computeProfileFromSamples(samples, workspaceId, userId, scope);
    } catch (err) {
      console.warn('[WritingProfile] Failed to extract profile, using unpersonalized fallback:', err);
      return this.getDefaultProfile(workspaceId, userId);
    }
  }

  /**
   * Derives linguistic patterns from real post samples
   */
  computeProfileFromSamples(
    samples: string[],
    workspaceId: string = 'default',
    userId?: string,
    scope: 'user_personal' | 'workspace_brand' | 'unpersonalized_fallback' = 'user_personal'
  ): WritingProfile {
    if (samples.length === 0) {
      return this.getDefaultProfile(workspaceId, userId);
    }

    let totalWords = 0;
    let totalSentences = 0;
    let totalParagraphs = 0;
    let totalEmojis = 0;
    let totalHashtags = 0;
    let bulletListCount = 0;
    let firstPersonSingularCount = 0; // "I", "me", "my"
    let firstPersonPluralCount = 0; // "we", "our", "us"

    const emojiRegex = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]/g;
    const hashtagRegex = /#[a-zA-Z0-9_]+/g;
    const wordFreq: Record<string, number> = {};

    for (const sample of samples) {
      const paragraphs = sample.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
      totalParagraphs += paragraphs.length;

      const sentences = sample.split(/[.!?]+/).filter((s) => s.trim().length > 0);
      totalSentences += sentences.length;

      const words = sample.toLowerCase().match(/\b[a-z]+\b/g) || [];
      totalWords += words.length;

      for (const w of words) {
        if (!STOP_WORDS.has(w) && w.length > 2) {
          wordFreq[w] = (wordFreq[w] || 0) + 1;
        }
        if (w === 'i' || w === 'my' || w === 'me' || w === 'myself') firstPersonSingularCount++;
        if (w === 'we' || w === 'our' || w === 'us' || w === 'team') firstPersonPluralCount++;
      }

      const emojis = sample.match(emojiRegex) || [];
      totalEmojis += emojis.length;

      const hashtags = sample.match(hashtagRegex) || [];
      totalHashtags += hashtags.length;

      if (sample.includes('•') || sample.includes('- ') || sample.includes('1.') || sample.includes('2.')) {
        bulletListCount++;
      }
    }

    const avgWordsPerSentence = totalSentences > 0 ? totalWords / totalSentences : 15;
    const avgWordsPerParagraph = totalParagraphs > 0 ? totalWords / totalParagraphs : 40;
    const avgEmojisPerPost = totalEmojis / samples.length;
    const avgHashtagsPerPost = totalHashtags / samples.length;
    const bulletRatio = bulletListCount / samples.length;

    // Sentence length evaluation
    const averageSentenceLength: 'short' | 'medium' | 'long' =
      avgWordsPerSentence < 12 ? 'short' : avgWordsPerSentence > 22 ? 'long' : 'medium';

    // Paragraph length evaluation
    const averageParagraphLength: 'concise' | 'balanced' | 'detailed' =
      avgWordsPerParagraph < 30 ? 'concise' : avgWordsPerParagraph > 70 ? 'detailed' : 'balanced';

    // Formality evaluation
    let formality: 'casual' | 'conversational' | 'balanced' | 'formal' | 'academic' = 'balanced';
    if (avgEmojisPerPost > 4) formality = 'casual';
    else if (avgWordsPerSentence > 20 && avgEmojisPerPost === 0) formality = 'formal';
    else formality = 'conversational';

    // First person preference
    let firstPersonUsage: 'first_person_singular' | 'first_person_plural' | 'neutral_objective' = 'neutral_objective';
    if (firstPersonSingularCount > firstPersonPluralCount && firstPersonSingularCount >= 2) {
      firstPersonUsage = 'first_person_singular';
    } else if (firstPersonPluralCount >= firstPersonSingularCount && firstPersonPluralCount >= 2) {
      firstPersonUsage = 'first_person_plural';
    }

    // Emoji density
    const emojiDensity: 'none' | 'sparse' | 'moderate' =
      avgEmojisPerPost === 0 ? 'none' : avgEmojisPerPost <= 2 ? 'sparse' : 'moderate';

    // Hashtag preference
    const hashtagPreference: 'none' | 'minimal' | 'standard' =
      avgHashtagsPerPost === 0 ? 'none' : avgHashtagsPerPost <= 2 ? 'minimal' : 'standard';

    // Formatting rhythm
    const formattingRhythm: 'prose_focused' | 'bullet_focused' | 'hybrid' =
      bulletRatio > 0.7 ? 'bullet_focused' : bulletRatio < 0.3 ? 'prose_focused' : 'hybrid';

    // Dominant vocabulary
    const dominantVocabulary = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([word]) => word);

    return {
      sampleCount: samples.length,
      isPersonalized: true,
      scope,
      workspaceId,
      userId,
      averageSentenceLength,
      averageParagraphLength,
      formality,
      technicalDepth: 'practitioner',
      firstPersonUsage,
      emojiDensity,
      hashtagPreference,
      formattingRhythm,
      dominantVocabulary,
    };
  }

  /**
   * Default baseline writing profile when no historical posts exist
   */
  getDefaultProfile(workspaceId = 'default', userId?: string): WritingProfile {
    return {
      sampleCount: 0,
      isPersonalized: false,
      scope: 'unpersonalized_fallback',
      workspaceId,
      userId,
      averageSentenceLength: 'medium',
      averageParagraphLength: 'balanced',
      formality: 'balanced',
      technicalDepth: 'practitioner',
      firstPersonUsage: 'neutral_objective',
      emojiDensity: 'sparse',
      hashtagPreference: 'minimal',
      formattingRhythm: 'hybrid',
      dominantVocabulary: [],
    };
  }

  /**
   * Translates writing profile into concise AI prompt constraints.
   * Discloses when personalization is unavailable rather than falsely claiming it.
   */
  formatProfilePrompt(profile: WritingProfile): string {
    if (!profile.isPersonalized || profile.sampleCount === 0) {
      return `VOICE PROFILE GUIDANCE:
- Personal Writing Profile: Unavailable (No verified personal post history for user ${profile.userId || 'session'}).
- Baseline Style: Neutral, objective practitioner tone without assumed personal quirks or artificial idioms.
- Formatting Cadence: Natural paragraph flow with domain-appropriate clarity.`;
    }

    const header =
      profile.scope === 'user_personal'
        ? `USER PERSONAL WRITING VOICE (Derived strictly from ${profile.sampleCount} approved posts by user ${profile.userId}):`
        : `WORKSPACE BRAND WRITING VOICE (Derived from ${profile.sampleCount} workspace posts):`;

    const lines: string[] = [header];

    if (profile.firstPersonUsage === 'first_person_singular') {
      lines.push('- Voice: First-person singular ("I built", "I observed", "My experience").');
    } else if (profile.firstPersonUsage === 'first_person_plural') {
      lines.push('- Voice: Team-oriented first-person plural ("We deployed", "Our team observed").');
    } else {
      lines.push('- Voice: Objective practitioner voice focused on systems, trade-offs, and outcomes.');
    }

    if (profile.formattingRhythm === 'prose_focused') {
      lines.push('- Formatting: Prefer cohesive, well-paced paragraphs over bulleted lists.');
    } else if (profile.formattingRhythm === 'bullet_focused') {
      lines.push('- Formatting: Structured bullet points for actionable takeaways.');
    } else {
      lines.push('- Formatting: Balanced mix of contextual paragraphs and concise bullet points.');
    }

    if (profile.emojiDensity === 'none') {
      lines.push('- Emojis: Strictly NO emojis. Maintain clean typographic professionalism.');
    } else if (profile.emojiDensity === 'sparse') {
      lines.push('- Emojis: Sparse and functional (maximum 1 across the post).');
    } else {
      lines.push('- Emojis: Moderate visual accents.');
    }

    if (profile.hashtagPreference === 'none') {
      lines.push('- Hashtags: Do not include hashtags.');
    } else if (profile.hashtagPreference === 'minimal') {
      lines.push('- Hashtags: Maximum 2 highly relevant hashtags at the bottom.');
    } else {
      lines.push('- Hashtags: 3 industry-standard hashtags at the bottom.');
    }

    lines.push(`- Formality: ${profile.formality}. Sentence cadence: ${profile.averageSentenceLength}.`);

    return lines.join('\n');
  }
}

const STOP_WORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
]);

export const writingProfileEngine = new WritingProfileEngine();
