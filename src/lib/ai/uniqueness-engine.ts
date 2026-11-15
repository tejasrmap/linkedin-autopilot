// ==============================================================
// LINKEDIN AUTOPILOT — CONTENT UNIQUENESS & QUALITY ENGINE
// MULTI-DIMENSIONAL QUALITY, FACTUAL INTEGRITY & ARGUMENT REPETITION GUARD
// BY GT INNOX LLP
// ==============================================================

import { SupabaseClient } from '@supabase/supabase-js';

export interface UniquenessScore {
  totalScore: number; // 0 - 100
  qualityStatus: 'verified' | 'degraded' | 'failed';
  passed: boolean;
  dimensions: {
    topicRelevance: number; // 0 - 20 (Factual purpose & intent alignment)
    subjectSpecificDetail: number; // 0 - 20 (Subtopic concept depth)
    originality: number; // 0 - 20 (Non-repetition of arguments & skeletons)
    writingNaturalness: number; // 0 - 15 (Cliché-free, human phrasing)
    factualGrounding: number; // 0 - 15 (No fabricated claims or fake metrics)
    audienceValue: number; // 0 - 10 (Practical actionable substance)
  };
  maxHistoricalSimilarity: number; // 0.0 - 1.0
  reasons: string[];
  detectedRepetitions: {
    hookRepeated: boolean;
    conclusionRepeated: boolean;
    argumentSkeletonRepeated: boolean;
    matchedPastPostSnippet?: string;
    bannedClichesDetected: string[];
    fabricatedClaimsDetected: string[];
  };
  recommendedNarrativePivot?: string;
}

export interface HistoricalPostSummary {
  content: string;
  hook: string;
  conclusion: string;
  structuralPattern: string; // e.g. "bullets_3", "prose_paragraphs", "qa_framework"
  ngrams: Set<string>;
}

export class UniquenessEngine {
  /**
   * Fetches historical posts for the tenant to build an anti-repetition corpus.
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

      // Also query recent generations if fewer than 10 posts
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
   * Evaluates a candidate post against topic intent, factual grounding, and tenant history
   */
  evaluateContent(
    candidate: string,
    topic: string,
    history: HistoricalPostSummary[],
    domainTerms: string[] = []
  ): UniquenessScore {
    if (candidate.startsWith('[Generation Unavailable]')) {
      return {
        totalScore: 0,
        qualityStatus: 'failed',
        passed: false,
        dimensions: {
          topicRelevance: 0,
          subjectSpecificDetail: 0,
          originality: 0,
          writingNaturalness: 0,
          factualGrounding: 0,
          audienceValue: 0,
        },
        maxHistoricalSimilarity: 0,
        reasons: ['Topic contains insufficient context to generate a factual post.'],
        detectedRepetitions: {
          hookRepeated: false,
          conclusionRepeated: false,
          argumentSkeletonRepeated: false,
          bannedClichesDetected: [],
          fabricatedClaimsDetected: [],
        },
      };
    }

    const candidateSummary = this.summarizePost(candidate);
    const reasons: string[] = [];
    const bannedCliches = this.findBannedCliches(candidate);
    const fabricatedClaims: string[] = [];

    const candidateLower = candidate.toLowerCase();
    const topicLower = topic.toLowerCase();

    // 1. Topic Purpose & Intent Alignment (20 points)
    const isComparison = /\b(vs|versus|compare|comparing|trade-offs|tradeoffs)\b/i.test(topic);
    let topicRelevanceScore = 20;

    if (isComparison) {
      const parts = topicLower.split(/\b(?:vs|versus|compare|comparing)\b/i).map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const optA = parts[0].split(' ').pop() || '';
        const optB = parts[1].split(' ')[0] || '';
        const mentionsA = candidateLower.includes(optA);
        const mentionsB = candidateLower.includes(optB);

        if (!mentionsA || !mentionsB) {
          topicRelevanceScore -= 8;
          reasons.push(`Prompt requests comparison between ${parts[0]} and ${parts[1]}, but post fails to address both.`);
        }
      }
    }

    // Verify topical keyword presence
    const topicWords = topicLower
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !COMMON_STOP_WORDS.has(w));

    let matchedWords = 0;
    for (const tw of topicWords) {
      if (candidateLower.includes(tw)) matchedWords++;
    }
    const topicRatio = topicWords.length > 0 ? matchedWords / topicWords.length : 1.0;
    if (topicRatio < 0.3) {
      topicRelevanceScore = Math.max(4, topicRelevanceScore - 8);
      reasons.push('Post diverges from the core subject requested in the prompt.');
    }

    // 2. Subject-Specific Concept Depth (20 points)
    let domainTermHits = 0;
    for (const dt of domainTerms) {
      const dtLower = dt.toLowerCase();
      const tokens = dtLower.split(/[^a-z0-9]+/g).filter((t) => t.length > 2);
      if (candidateLower.includes(dtLower) || tokens.some((tok) => candidateLower.includes(tok))) {
        domainTermHits++;
      }
    }
    let specificityScore = domainTerms.length > 0
      ? Math.min(20, Math.round((domainTermHits / Math.min(domainTerms.length, 3)) * 20))
      : 16;

    if (domainTermHits === 0 && domainTerms.length > 0) {
      reasons.push('Lacks concrete subtopic mechanics or technical terminology.');
      specificityScore = Math.max(6, specificityScore - 6);
    }

    // 3. Originality vs Tenant History (20 points)
    let maxSim = 0;
    let matchedSnippet: string | undefined;
    let hookRepeated = false;
    let conclusionRepeated = false;
    let argumentSkeletonRepeated = false;

    for (const past of history) {
      const sim = this.calculateNgramSimilarity(candidateSummary.ngrams, past.ngrams);
      if (sim > maxSim) {
        maxSim = sim;
        matchedSnippet = past.content.slice(0, 100);
      }

      // Hook similarity
      const hookSim = this.calculateStringSimilarity(candidateSummary.hook, past.hook);
      if (hookSim > 0.60) {
        hookRepeated = true;
      }

      // Conclusion similarity
      const conclusionSim = this.calculateStringSimilarity(candidateSummary.conclusion, past.conclusion);
      if (conclusionSim > 0.65) {
        conclusionRepeated = true;
      }

      // Argument skeleton match (e.g. repeated 3-part bullet lists with colon headers)
      if (candidateSummary.structuralPattern === past.structuralPattern && sim > 0.30) {
        argumentSkeletonRepeated = true;
      }
    }

    let originalityScore = 20;
    if (maxSim > 0.45) {
      originalityScore -= 10;
      reasons.push(`High content overlap (${Math.round(maxSim * 100)}%) with a previous post.`);
    } else if (maxSim > 0.30) {
      originalityScore -= 5;
      reasons.push(`Moderate phrasing overlap (${Math.round(maxSim * 100)}%) with previous posts.`);
    }

    if (hookRepeated) {
      originalityScore = Math.max(0, originalityScore - 6);
      reasons.push('Opening hook repeats framing from an earlier post.');
    }
    if (conclusionRepeated) {
      originalityScore = Math.max(0, originalityScore - 4);
      reasons.push('Conclusion/CTA repeats phrasing from an earlier post.');
    }
    if (argumentSkeletonRepeated) {
      originalityScore = Math.max(0, originalityScore - 3);
      reasons.push('Repeats argument structural skeleton from a previous post.');
    }

    // 4. Writing Naturalness & Anti-Clichés (15 points)
    let naturalnessScore = 15;
    if (bannedCliches.length > 0) {
      naturalnessScore -= Math.min(10, bannedCliches.length * 4);
      reasons.push(`Contains generic AI clichés: "${bannedCliches.join('", "')}".`);
    }

    // 5. Factual Grounding & Anti-Fabrication (15 points)
    let groundingScore = 15;
    const promptHasPersonal = /\b(my|i|we|our|me|myself)\b/i.test(topic);

    // Check for fabricated personal claims if prompt did not indicate personal experience
    if (!promptHasPersonal) {
      const personalClaims = candidate.match(/\b(i passed|we built|we spent|our team discovered|in our first year|we realized we were wrong)\b/gi);
      if (personalClaims && personalClaims.length > 0) {
        fabricatedClaims.push(...personalClaims);
        groundingScore = 0;
        topicRelevanceScore = Math.max(0, topicRelevanceScore - 10);
        reasons.push(`Fabricated personal claims ("${personalClaims[0]}") not provided in user prompt.`);
      }
    }

    // Check for fabricated metrics (% or $ or x) not in topic
    const statMatches = candidate.match(/\b\d{2,3}%\b|\$\d[\d,]*(?:k|m|b)?\b|\b\d+x\b/gi) || [];
    const topicHasStat = topic.match(/\b\d{2,3}%\b|\$\d[\d,]*(?:k|m|b)?\b|\b\d+x\b/gi);
    if (statMatches.length > 0 && !topicHasStat) {
      fabricatedClaims.push(...statMatches);
      groundingScore = Math.max(0, groundingScore - 8);
      reasons.push('Includes specific quantitative statistics not provided in the original prompt.');
    }

    // 6. Audience Value (10 points)
    let audienceScore = 10;
    if (candidate.length < 220) {
      audienceScore -= 5;
      reasons.push('Post is too short to provide actionable engineering or business value.');
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

    // Strict pass determination
    const passed =
      totalScore >= 70 &&
      !hookRepeated &&
      bannedCliches.length === 0 &&
      fabricatedClaims.length === 0;

    let qualityStatus: 'verified' | 'degraded' | 'failed' = 'verified';
    if (!passed) {
      qualityStatus = totalScore < 50 || bannedCliches.length > 0 || fabricatedClaims.length > 0 ? 'failed' : 'degraded';
    }

    let recommendedPivot: string | undefined;
    if (!passed) {
      if (fabricatedClaims.length > 0) {
        recommendedPivot = 'Remove fabricated first-person claims; frame the post as an objective practitioner analysis.';
      } else if (bannedCliches.length > 0) {
        recommendedPivot = 'Strip out promotional framing and focus purely on architectural trade-offs.';
      } else if (hookRepeated) {
        recommendedPivot = 'Open with a concrete technical observation rather than a rhetorical question or announcement.';
      } else if (maxSim > 0.35) {
        recommendedPivot = 'Shift from a high-level overview to an explicit diagnostic step-by-step breakdown.';
      }
    }

    return {
      totalScore,
      qualityStatus,
      passed,
      dimensions: {
        topicRelevance: topicRelevanceScore,
        subjectSpecificDetail: specificityScore,
        originality: originalityScore,
        writingNaturalness: naturalnessScore,
        factualGrounding: groundingScore,
        audienceValue: audienceScore,
      },
      maxHistoricalSimilarity: maxSim,
      reasons,
      detectedRepetitions: {
        hookRepeated,
        conclusionRepeated,
        argumentSkeletonRepeated,
        matchedPastPostSnippet: matchedSnippet,
        bannedClichesDetected: bannedCliches,
        fabricatedClaimsDetected: fabricatedClaims,
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

    // Determine structural pattern
    let structuralPattern = 'prose_paragraphs';
    const bulletCount = (content.match(/^[•\d\.\-]\s*[^:\n]+:/gm) || []).length;
    if (bulletCount >= 3) {
      structuralPattern = 'bullets_3_colon_headers';
    } else if (content.includes('•') || content.includes('- ')) {
      structuralPattern = 'bullet_list';
    }

    return {
      content,
      hook,
      conclusion,
      structuralPattern,
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

const COMMON_STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'about', 'from', 'this', 'that', 'into', 'what', 'how', 'why',
  'most', 'some', 'your', 'will', 'have', 'when', 'which', 'where', 'been',
]);

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
