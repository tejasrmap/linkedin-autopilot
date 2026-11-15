// ==============================================================
// LINKEDIN AUTOPILOT — POST-GENERATION QUALITY GATE
// STRICT TOPIC VALIDATION, CLICHÉ REJECTION & BOUNDED RETRIES
// BY GT INNOX LLP
// ==============================================================

import { TopicAnalysis } from './content-intelligence';
import { UniquenessScore, HistoricalPostSummary, uniquenessEngine } from './uniqueness-engine';

export interface QualityGateResult {
  passed: boolean;
  qualityStatus: 'verified' | 'degraded' | 'failed';
  score: UniquenessScore;
  sanitizedContent: string;
  retryNeeded: boolean;
  qualityWarnings: string[];
  retryDirectives?: {
    narrativeAdjustment: string;
    bannedPhrases: string[];
    focusKeywords: string[];
  };
}

export class QualityGate {
  /**
   * Evaluates candidate post against strict quality, uniqueness, and grounding criteria
   */
  evaluate(
    content: string,
    topic: string,
    analysis: TopicAnalysis,
    history: HistoricalPostSummary[]
  ): QualityGateResult {
    // 1. Clean markdown artifacts (e.g. meta-commentary like "Here is your post:")
    let cleaned = content.trim();
    cleaned = cleaned.replace(/^Here is (your|a) [^\n]+:\s*/i, '');
    cleaned = cleaned.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/i, '');

    // 2. Evaluate uniqueness & quality score
    const score = uniquenessEngine.evaluateContent(cleaned, topic, history, analysis.domainTerms);

    // 3. Strict pass determination
    const passed = score.passed;
    const qualityStatus = score.qualityStatus;
    const retryNeeded = !passed;

    return {
      passed,
      qualityStatus,
      score,
      sanitizedContent: cleaned,
      retryNeeded,
      qualityWarnings: score.reasons,
      retryDirectives: retryNeeded
        ? {
            narrativeAdjustment:
              score.recommendedNarrativePivot ||
              'Change the structural angle. Focus on concrete implementation trade-offs rather than high-level statements.',
            bannedPhrases: [
              ...score.detectedRepetitions.bannedClichesDetected,
              ...score.detectedRepetitions.fabricatedClaimsDetected,
            ],
            focusKeywords: analysis.domainTerms.slice(0, 4),
          }
        : undefined,
    };
  }
}

export const qualityGate = new QualityGate();
