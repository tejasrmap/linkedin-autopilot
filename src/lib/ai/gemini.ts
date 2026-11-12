// ==============================================================
// LINKEDIN AUTOPILOT - GOOGLE GEMINI AI STUDIO CLIENT
// BY GT INNOX LLP
// ==============================================================

import { GoogleGenerativeAI } from '@google/generative-ai';

function getGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY || '';
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

    if (model) {
      try {
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
        const text = response.text().trim();
        if (text) return text;
      } catch (err) {
        console.warn('Gemini API call failed, falling back to GT InnoX Framework Engine:', err);
      }
    }

    // High-Converting Fallback Framework Engine (Guarantees AI Studio never fails)
    const topic = options.topic || 'Enterprise Software Architecture and Growth';
    const audience = options.targetAudience || 'Engineers and Founders';
    const tone = options.tone || 'Actionable & Visionary';

    return `Most ${audience} get this completely wrong when it comes to ${topic.toLowerCase()}.

Here is the exact framework we use at GT InnoX LLP to eliminate friction and build for scale:

1. Diagnose the Root Bottleneck First
Don't solve symptoms. Measure cycle velocity and remove the single constraint slowing your workflow down.

2. Automate the Repetitive Work
Human focus should be reserved for high-leverage decisions. Everything else belongs in automated queues with failure recovery.

3. Measure Outcomes, Not Busywork
Velocity without directional clarity is just noise. Focus on high-signal output every single sprint.

What is the single biggest lesson you've learned while scaling ${topic.toLowerCase()}?

Let's discuss in the comments below.

#Leadership #SoftwareEngineering #Automation #Growth #GTInnoX`;
  }

  /**
   * Rewrites an existing draft into a desired tone or structure
   */
  async rewritePost(options: RewritePostOptions): Promise<string> {
    const model = getGeminiModel();

    if (model) {
      try {
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
        const text = response.text().trim();
        if (text) return text;
      } catch (err) {
        console.warn('Gemini rewrite failed, using Framework rewriter:', err);
      }
    }

    // Built-in Tone Transformation Engine
    const lines = options.content.trim().split('\n').filter((l) => l.trim().length > 0);
    const coreThought = lines[0] || options.content;
    const body = lines.slice(1).join('\n\n') || 'Execution is everything. The teams that win are those who build resilient workflows and never settle for mediocrity.';

    if (options.targetTone === 'storytelling') {
      return `Two years ago, we learned a lesson that permanently changed how we think:

"${coreThought}"

At the time, we thought the hardest part was the technical execution. We were wrong.
The real challenge was stripping away the unnecessary noise.

${body}

If you're going through a similar journey right now, remember: clarity beats complexity every time.

What was your biggest breakthrough this year?

#Storytelling #Leadership #Growth`;
    }

    if (options.targetTone === 'technical') {
      return `Architectural Breakdown:

${coreThought}

Key technical considerations:
• Decouple state mutation from asynchronous dispatch
• Enforce idempotent CAS (Compare-And-Swap) locking mechanisms
• Guarantee 100% token vault security with AES-256-GCM authentication tags

${body}

How does your team architect for resilience under production load?

#SystemDesign #Architecture #Engineering #Software`;
    }

    return `The secret to sustainable results isn't more hours. It's leverage:

${coreThought}

${body}

Keep it simple. Execute with rigor. Iterate daily.

Agree or disagree?

#Productivity #Workplace #Success`;
  }

  /**
   * Generates relevant hashtags for a topic or post content
   */
  async generateHashtags(topicOrContent: string, count = 5): Promise<string[]> {
    const model = getGeminiModel();

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

    // Keyword-based hashtag extraction fallback
    const words = topicOrContent
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3);

    const tags = new Set<string>();
    tags.add('#LinkedIn');
    tags.add('#Growth');
    tags.add('#Automation');

    for (const w of words.slice(0, 3)) {
      tags.add('#' + w.charAt(0).toUpperCase() + w.slice(1));
    }

    return Array.from(tags).slice(0, count);
  }

  /**
   * Generates creative post concepts and hooks
   */
  async generateIdeas(industryOrCategory: string, count = 5): Promise<Array<{ title: string; hook: string; outline: string }>> {
    const model = getGeminiModel();

    if (model) {
      try {
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

        const match = text.match(/\[[\s\S]*\]/);
        if (match) {
          return JSON.parse(match[0]);
        }
      } catch {
        // Fallback
      }
    }

    // Built-in viral hook concepts
    return [
      {
        title: 'The Uncomfortable Truth About Scaling',
        hook: `90% of leaders in ${industryOrCategory} focus on the wrong metric in their first 12 months.`,
        outline: 'Why revenue without workflow automation creates unsustainable operational debt, and how to fix it before you burn out.',
      },
      {
        title: 'The 3-Step Execution Framework',
        hook: 'We simplified our entire weekly operations down to 3 non-negotiable rules. Here is what happened:',
        outline: 'A practical breakdown of removing meeting fatigue and replacing synchronous syncs with asynchronous updates.',
      },
      {
        title: 'The Cost of Premature Optimization',
        hook: 'The biggest mistake technical founders make: solving problems they do not have yet.',
        outline: 'Why building complex architectures before finding product-market fit kills startups faster than lack of capital.',
      },
      {
        title: 'What Nobody Tells You About B2B Growth',
        hook: 'High-ticket sales isn’t about persuasive closing pitches. It’s about trust architecture.',
        outline: 'A real-world breakdown of turning organic LinkedIn thought leadership into inbound qualified enterprise inquiries.',
      },
      {
        title: 'The Power of Consistency Over Intensity',
        hook: 'Consistency looks boring from the outside until compound growth kicks in.',
        outline: 'How publishing 3 structured, high-value LinkedIn posts per week outperforms erratic daily posting every single time.',
      },
    ].slice(0, count);
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

    if (model) {
      try {
        const prompt = `Create a high-performing 7-Day LinkedIn Content Calendar for an organization in "${industry}" with a tone of "${brandTone}".

For each day (Monday through Sunday), define:
- day: Day name (e.g. "Monday")
- theme: Strategic theme
- hook: Suggested opening line
- format: Recommended format
- contentType: Category

Return ONLY a valid JSON array of 7 objects.
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

    // Built-in 7-day strategy matrix
    return [
      {
        day: 'Monday',
        theme: 'Strategic Perspective & Industry Thesis',
        hook: `Why the next 12 months will redefine how ${industry} teams operate.`,
        format: 'Text + Framework Checklist',
        contentType: 'Thought Leadership',
      },
      {
        day: 'Tuesday',
        theme: 'Failure to Success Case Breakdown',
        hook: 'We spent 3 months building a feature nobody used. Here was the exact moment we realized we were wrong:',
        format: 'Personal Narrative / Story',
        contentType: 'Case Study',
      },
      {
        day: 'Wednesday',
        theme: 'Actionable How-To Guide',
        hook: `The 5-step framework to audit and improve your team's weekly output:`,
        format: 'Numbered Step-by-Step Breakdown',
        contentType: 'Educational',
      },
      {
        day: 'Thursday',
        theme: 'Contrarian Take / Myth Busting',
        hook: `Unpopular opinion in ${industry}: More tools won't solve your workflow problems.`,
        format: 'Short & Punchy Argument',
        contentType: 'Contrarian Analysis',
      },
      {
        day: 'Friday',
        theme: 'Behind-the-Scenes & Team Culture',
        hook: 'The one hiring question that saved us hundreds of wasted hours:',
        format: 'Conversational Reflection',
        contentType: 'Hiring & Culture',
      },
      {
        day: 'Saturday',
        theme: 'Curated Tools & Resources',
        hook: 'The 4 books and tools that delivered 10x ROI for our team this year:',
        format: 'Resource List + Commentary',
        contentType: 'Curated Insights',
      },
      {
        day: 'Sunday',
        theme: 'Executive Reflection & Weekly Reset',
        hook: 'Rest isn’t a reward for finishing your work. It’s an essential prerequisite for high-leverage execution.',
        format: 'Inspirational Reflection',
        contentType: 'Mindset & Leadership',
      },
    ];
  }
}

export const aiService = new AIService();
