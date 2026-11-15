// ==============================================================
// LINKEDIN AUTOPILOT — CONTENT UNIQUENESS & SIMILARITY ENGINE
// MULTI-DIMENSIONAL QUALITY & ANTI-REPETITION EVALUATION
// BY GT INNOX LLP
// ==============================================================

import { SupabaseClient } from '@supabase/supabase-js';

export interface UniquenessScore {
  totalScore: number; // 0 - 100
  dimensions: {
    topicRelevance: number; // 0 - 20
    subjectSpecificDetail: number; // 0 - 20
    originality: number; // 0 - 20
    writingNaturalness: number; // 0 - 15
    factualGrounding: number; // 0 - 15
    audienceValue: number; // 0 - 10
  };
  passed: boolean;
  maxHistoricalSimilarity: number; // 0.0 - 1.0
  reasons: string[];
  detectedRepetitions: {
    hookRepeated: boolean;
    conclusionRepeated: boolean;
    matchedPastPostSnippet?: string;
    bannedClichesDetected: string[];
  };
  recommendedNarrativePivot?: string;
}

export interface HistoricalPostSummary {
  content: string;
  hook: string;
  conclusion: string;
  ngrams: Set<string>;
}

export class UniquenessEngine {
  /**
   * Fetches historical posts for the tenant to build an anti-repetition corpus
   * Strictly enforces workspace isolation.
   */
  async getTenantHistory(
    supabase: SupabaseClient,
    workspaceId: string,
    limit = 20
  ): Promise<HistoricalPostSummary[]> {
    try {
      const { data: posts, error } = await supabase
        .from('posts')
        .select('content')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(limit);

      const items: string[] = [];
      if (!error && posts) {
        for (const p of posts) {
          if (p.content && p.content.trim()) items.push(p.content.trim());
        }
      }

      // Also grab recent AI generations if fewer than 10 posts
      if (items.length < 10) {
        const { data: gens } = await supabase
          .from('ai_generations')
          .select('generated_content')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (gens) {
          for (const g of gens) {
            if (g.generated_content && g.generated_content.trim() && !items.includes(g.generated_content.trim())) {
              items.push(g.generated_content.trim());
            }
          }
        }
      }

      return items.map((content) => this.summarizePost(content));
    } catch (err) {
      console.warn('[UniquenessEngine] Could not load tenant history:', err);
      return [];
    }
  }

  /**
   * Evaluates a candidate post against tenant history and objective quality standards
   */
  evaluateContent(
    candidate: string,
    topic: string,
    history: HistoricalPostSummary[],
    domainTerms: string[] = []
  ): UniquenessScore {
    const candidateSummary = this.summarizePost(candidate);
    const reasons: string[] = [];
    const bannedCliches = this.findBannedCliches(candidate);

    // 1. Topic Relevance (20 points)
    const topicWords = topic
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2);
    const candidateLower = candidate.toLowerCase();

    let matchedTopicWords = 0;
    for (const tw of topicWords) {
      if (candidateLower.includes(tw)) matchedTopicWords++;
    }
    const topicCoverageRatio = topicWords.length > 0 ? matchedTopicWords / topicWords.length : 1.0;
    let topicRelevanceScore = Math.min(20, Math.round(topicCoverageRatio * 20));
    if (topicRelevanceScore < 12) {
      reasons.push('Post does not sufficiently reference core keywords from the topic.');
    }

    // 2. Subject-Specific Detail (20 points)
    let domainTermHits = 0;
    for (const dt of domainTerms) {
      const dtLower = dt.toLowerCase();
      const tokens = dtLower.split(/[^a-z0-9]+/g).filter((t) => t.length > 2);
      if (candidateLower.includes(dtLower) || tokens.some((tok) => candidateLower.includes(tok))) {
        domainTermHits++;
      }
    }
    // Specificity score based on technical/domain vocabulary and absence of vague adjectives
    let specificityScore = domainTerms.length > 0
      ? Math.min(20, Math.round((domainTermHits / Math.min(domainTerms.length, 3)) * 20))
      : 16;
    if (domainTermHits === 0 && domainTerms.length > 0) {
      reasons.push('Lacks concrete subject-specific mechanics or terminology.');
      specificityScore = Math.max(8, specificityScore - 6);
    }

    // 3. Originality vs Tenant History (20 points)
    let maxSim = 0;
    let matchedSnippet: string | undefined;
    let hookRepeated = false;
    let conclusionRepeated = false;

    for (const past of history) {
      const sim = this.calculateNgramSimilarity(candidateSummary.ngrams, past.ngrams);
      if (sim > maxSim) {
        maxSim = sim;
        matchedSnippet = past.content.slice(0, 100);
      }

      // Check hook similarity
      const hookSim = this.calculateStringSimilarity(candidateSummary.hook, past.hook);
      if (hookSim > 0.65) {
        hookRepeated = true;
      }

      // Check conclusion similarity
      const conclusionSim = this.calculateStringSimilarity(candidateSummary.conclusion, past.conclusion);
      if (conclusionSim > 0.70) {
        conclusionRepeated = true;
      }
    }

    let originalityScore = 20;
    if (maxSim > 0.50) {
      originalityScore -= 10;
      reasons.push(`High content overlap (${Math.round(maxSim * 100)}%) with a previous post.`);
    } else if (maxSim > 0.35) {
      originalityScore -= 5;
      reasons.push(`Moderate phrasing overlap (${Math.round(maxSim * 100)}%) with previous posts.`);
    }

    if (hookRepeated) {
      originalityScore = Math.max(0, originalityScore - 5);
      reasons.push('Opening hook is nearly identical to an existing post.');
    }
    if (conclusionRepeated) {
      originalityScore = Math.max(0, originalityScore - 3);
      reasons.push('Conclusion/CTA repeats phrasing from an earlier post.');
    }

    // 4. Writing Naturalness (15 points)
    let naturalnessScore = 15;
    if (bannedCliches.length > 0) {
      naturalnessScore -= Math.min(8, bannedCliches.length * 3);
      reasons.push(`Contains generic AI clichés: "${bannedCliches.join('", "')}".`);
    }

    // Check for repetitive 3-part bullet lists with colon headers
    const colonBulletMatches = candidate.match(/^[•\d\.\-]\s*[^:\n]+:/gm) || [];
    if (colonBulletMatches.length >= 3 && history.some((h) => (h.content.match(/^[•\d\.\-]\s*[^:\n]+:/gm) || []).length >= 3)) {
      naturalnessScore = Math.max(5, naturalnessScore - 3);
      reasons.push('Repeats familiar 3-part bullet formatting from earlier posts.');
    }

    // 5. Factual Grounding (15 points)
    let groundingScore = 15;
    // Check for suspicious fabricated statistics (e.g. "increased by 43%", "reduced by 78%")
    const statMatches = candidate.match(/\b\d{2,3}%\b|\b\d+x\b/g) || [];
    const topicHasStat = topic.match(/\b\d{2,3}%\b|\b\d+x\b/g);
    if (statMatches.length > 1 && !topicHasStat) {
      groundingScore -= 5;
      reasons.push('Includes specific percentage/multiplier statistics not provided in the original topic prompt.');
    }

    // 6. Audience Value (10 points)
    let audienceScore = 10;
    if (candidate.length < 250) {
      audienceScore -= 4;
      reasons.push('Post is too short to deliver meaningful technical or professional substance.');
    }

    const totalScore = Math.max(
      0,
      Math.min(
        100,
        topicRelevanceScore +
          specificityScore +
          originalityScore +
          naturalnessScore +
          groundingScore +
          audienceScore
      )
    );

    const passed = totalScore >= 70 && !hookRepeated && bannedCliches.length === 0;

    let recommendedPivot: string | undefined;
    if (!passed) {
      if (hookRepeated) {
        recommendedPivot = 'Open with a concrete technical observation rather than a rhetorical question or announcement.';
      } else if (bannedCliches.length > 0) {
        recommendedPivot = 'Strip out promotional framing and focus purely on architectural trade-offs or implementation realities.';
      } else if (maxSim > 0.40) {
        recommendedPivot = 'Shift from a high-level overview to an explicit step-by-step diagnostic breakdown.';
      }
    }

    return {
      totalScore,
      dimensions: {
        topicRelevance: topicRelevanceScore,
        subjectSpecificDetail: specificityScore,
        originality: originalityScore,
        writingNaturalness: naturalnessScore,
        factualGrounding: groundingScore,
        audienceValue: audienceScore,
      },
      passed,
      maxHistoricalSimilarity: maxSim,
      reasons,
      detectedRepetitions: {
        hookRepeated,
        conclusionRepeated,
        matchedPastPostSnippet: matchedSnippet,
        bannedClichesDetected: bannedCliches,
      },
      recommendedNarrativePivot: recommendedPivot,
    };
  }

  /**
   * Helper to summarize a post into key components for comparison
   */
  summarizePost(content: string): HistoricalPostSummary {
    const lines = content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const hook = lines.length > 0 ? lines[0] : '';
    const conclusion = lines.length > 1 ? lines[lines.length - 1] : '';

    return {
      content,
      hook,
      conclusion,
      ngrams: this.extractNgrams(content, 2),
    };
  }

  /**
   * Extracts word n-grams
   */
  private extractNgrams(text: string, n = 2): Set<string> {
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 1);

    const ngrams = new Set<string>();
    for (let i = 0; i <= words.length - n; i++) {
      ngrams.add(words.slice(i, i + n).join(' '));
    }
    return ngrams;
  }

  /**
   * Computes Jaccard similarity between two sets of ngrams
   */
  private calculateNgramSimilarity(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0;
    let intersection = 0;
    a.forEach((item) => {
      if (b.has(item)) intersection++;
    });
    const union = a.size + b.size - intersection;
    return union > 0 ? intersection / union : 0;
  }

  /**
   * Token-based string similarity
   */
  private calculateStringSimilarity(s1: string, s2: string): number {
    const set1 = this.extractNgrams(s1, 1);
    const set2 = this.extractNgrams(s2, 1);
    return this.calculateNgramSimilarity(set1, set2);
  }

  /**
   * Identifies banned AI clichés
   */
  private findBannedCliches(text: string): string[] {
    const lower = text.toLowerCase();
    const detected: string[] = [];
    for (const phrase of BANNED_CLICHES) {
      if (lower.includes(phrase.toLowerCase())) {
        detected.push(phrase);
      }
    }
    return detected;
  }
}

export const BANNED_CLICHES = [
  'excited to share',
  'thrilled to announce',
  'in today’s fast-paced world',
  "in today's fast-paced world",
  "in today's rapidly evolving",
  'in today’s rapidly evolving',
  'the journey has been incredible',
  'this is just the beginning',
  'another milestone achieved',
  'i am happy to announce',
  "i'm happy to announce",
  'let’s dive into',
  "let's dive into",
  'game changer',
  'paradigm shift',
  'at the end of the day',
  'it is not just about',
  "it's not just about",
  'delighted to announce',
  'pleased to share',
];

export const uniquenessEngine = new UniquenessEngine();
