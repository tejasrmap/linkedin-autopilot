// ==============================================================
// LINKEDIN AUTOPILOT - GOOGLE GEMINI AI STUDIO CLIENT
// BY GT INNOX LLP
// ==============================================================

import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || '';

function getGeminiModel() {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the environment.');
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  // Default to gemini-1.5-flash for high quality and speed
  return genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
}

export interface GeneratePostOptions {
  topic: string;
  targetAudience?: string;
  tone?: string;
  length?: 'short' | 'medium' | 'long';
  contentType?: string;
  brandVoice?: {
    brandName?: string;
    industry?: string;
    targetAudience?: string;
    brandVoice?: string;
    preferredHashtags?: string[];
  };
}

export interface RewritePostOptions {
  content: string;
  targetTone: 'professional' | 'conversational' | 'technical' | 'educational' | 'persuasive' | 'storytelling';
  improveHook?: boolean;
}

export class AIService {
  /**
   * Generates a viral, high-converting LinkedIn post based on options
   */
  async generatePost(options: GeneratePostOptions): Promise<string> {
    const model = getGeminiModel();

    const charRange =
      options.length === 'short'
        ? 'under 500 characters, punchy and direct'
        : options.length === 'long'
        ? 'between 1200 and 2200 characters, in-depth breakdown with rich value'
        : 'between 600 and 1200 characters, balanced structure';

    let prompt = `You are an elite LinkedIn ghostwriter and B2B growth strategist working for GT InnoX LLP.
Write an engaging LinkedIn post based on the following specifications:

TOPIC: ${options.topic}
TARGET AUDIENCE: ${options.targetAudience || 'Professionals, Founders, and Tech Leaders'}
TONE: ${options.tone || 'Professional yet engaging'}
CONTENT TYPE: ${options.contentType || 'Thought Leadership'}
POST LENGTH TARGET: ${charRange}
`;

    if (options.brandVoice) {
      prompt += `
BRAND VOICE CONSTRAINTS:
- Brand Name: ${options.brandVoice.brandName || 'GT InnoX LLP'}
- Industry: ${options.brandVoice.industry || 'Technology'}
- Audience: ${options.brandVoice.targetAudience || 'B2B Executives'}
- Writing Style: ${options.brandVoice.brandVoice || 'Authoritative, innovative, practical'}
- Preferred Hashtags: ${(options.brandVoice.preferredHashtags || []).join(' ')}
`;
    }

    prompt += `
FORMATTING & BEST PRACTICES:
1. Start with an arresting first line (scroll-stopping hook). Leave a blank line after the hook.
2. Use short 1-2 sentence paragraphs for maximum mobile readability.
3. Include clear insights, actionable bullet points (using emojis or clean dashes), and real substance.
4. End with a conversational call-to-action (CTA) that invites comments.
5. Include 3-5 relevant hashtags at the very bottom.
6. Return ONLY the final post content. Do not include markdown meta-commentary like "Here is your post:".
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  }

  /**
   * Rewrites an existing draft into a desired tone or structure
   */
  async rewritePost(options: RewritePostOptions): Promise<string> {
    const model = getGeminiModel();

    const prompt = `You are a master LinkedIn copywriter. Rewrite the draft below to match the tone: "${options.targetTone.toUpperCase()}".
${options.improveHook ? 'Crucially, craft an irresistible, attention-grabbing opening line (hook).' : ''}

ORIGINAL DRAFT:
"""
${options.content}
"""

GUIDELINES:
- Preserve the core message and key insights.
- Match tone: ${options.targetTone}.
- Use clean formatting, generous line breaks, and professional spacing.
- Include a strong CTA at the end.
- Return ONLY the rewritten post text with no introductory or trailing explanations.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  }

  /**
   * Generates relevant hashtags for a topic or post content
   */
  async generateHashtags(topicOrContent: string, count = 5): Promise<string[]> {
    const model = getGeminiModel();

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

    try {
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        return JSON.parse(match[0]);
      }
    } catch {
      // Fallback parse by whitespace
    }

    return text
      .split(/\s+/)
      .filter((w) => w.startsWith('#'))
      .slice(0, count);
  }

  /**
   * Generates creative post concepts and hooks
   */
  async generateIdeas(industryOrCategory: string, count = 5): Promise<Array<{ title: string; hook: string; outline: string }>> {
    const model = getGeminiModel();

    const prompt = `Generate ${count} compelling, viral LinkedIn post concepts for the topic/industry: "${industryOrCategory}".

Return a valid JSON array of objects with the structure:
[
  {
    "title": "Short descriptive topic title",
    "hook": "The exact scroll-stopping opening hook line",
    "outline": "2-3 sentences summarizing the key takeaway or lesson"
  }
]

Return ONLY valid JSON.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();

    try {
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        return JSON.parse(match[0]);
      }
    } catch {
      // fallback
    }

    return [];
  }

  /**
   * Generates a 7-day content calendar
   */
  async generateContentCalendar(industry: string, brandTone: string): Promise<Array<{
    day: string;
    theme: string;
    hook: string;
    format: string;
    contentType: string;
  }>> {
    const model = getGeminiModel();

    const prompt = `Create a high-performing 7-Day LinkedIn Content Calendar for an organization in "${industry}" with a tone of "${brandTone}".

For each day (Monday through Sunday), define:
- day: Day name (e.g. "Monday")
- theme: Strategic theme (e.g. "Industry Prediction", "Failure to Success Breakdown", "Actionable Framework", "Behind-the-scenes", etc.)
- hook: Suggested opening line
- format: Recommended format (e.g. "Text + Checklist", "Infographic / Carousel", "Story", "Short Opinion")
- contentType: Category (e.g. "Thought Leadership", "Case Study", "Hiring / Culture", "Technical Tip")

Return ONLY a valid JSON array of 7 objects.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();

    try {
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        return JSON.parse(match[0]);
      }
    } catch {
      // fallback
    }

    return [];
  }
}

export const aiService = new AIService();

