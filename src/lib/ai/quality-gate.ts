// ==============================================================
// LINKEDIN AUTOPILOT — POST-GENERATION QUALITY GATE
// STRICT TOPIC VALIDATION, CLICHÉ REJECTION & BOUNDED RETRIES
// BY GT INNOX LLP
// ==============================================================

import { TopicAnalysis } from './content-intelligence';
import { UniquenessScore, HistoricalPostSummary, uniquenessEngine } from './uniqueness-engine';

export interface QualityGateResult {
  passed: boolean;
  score: UniquenessScore;
  sanitizedContent: string;
  retryNeeded: boolean;
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
    // 1. Clean markdown artifacts (e.g., if model added "Here is your post:")
    let cleaned = content.trim();
    cleaned = cleaned.replace(/^Here is (your|a) [^\n]+:\s*/i, '');
    cleaned = cleaned.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/i, '');

    // 2. Evaluate uniqueness & quality score
    const score = uniquenessEngine.evaluateContent(cleaned, topic, history, analysis.domainTerms);

    // 3. Check for immediate rejection triggers
    const hasBannedCliches = score.detectedRepetitions.bannedClichesDetected.length > 0;
    const isHookRepeated = score.detectedRepetitions.hookRepeated;
    const isScoreTooLow = score.totalScore < 68;

    const passed = !hasBannedCliches && !isHookRepeated && !isScoreTooLow;

    if (!passed) {
      return {
        passed: false,
        score,
        sanitizedContent: cleaned,
        retryNeeded: true,
        retryDirectives: {
          narrativeAdjustment:
            score.recommendedNarrativePivot ||
            'Change the structural angle. Focus on concrete implementation trade-offs rather than high-level statements.',
          bannedPhrases: score.detectedRepetitions.bannedClichesDetected,
          focusKeywords: analysis.domainTerms.slice(0, 4),
        },
      };
    }

    return {
      passed: true,
      score,
      sanitizedContent: cleaned,
      retryNeeded: false,
    };
  }
}

export const qualityGate = new QualityGate();
