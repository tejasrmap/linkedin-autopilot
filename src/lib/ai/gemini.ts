// ==============================================================
// LINKEDIN AUTOPILOT - GOOGLE GEMINI AI STUDIO CLIENT
// BY GT INNOX LLP
// ==============================================================

import { GoogleGenerativeAI } from '@google/generative-ai';

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
  apiKey?: string;
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
  apiKey?: string;
}

export class AIService {
  /**
   * Generates a viral, high-converting LinkedIn post based on options
   */
  async generatePost(options: GeneratePostOptions): Promise<string> {
    const model = getGeminiModel(options.apiKey);

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

    // High-Converting Multi-Paradigm Generative Synthesis Engine
    // Dynamically generates varied, non-repeating posts across multiple archetypes, tones, and lengths
    const topic = (options.topic || 'Enterprise Software Architecture and Growth').trim();
    const audience = options.targetAudience || 'Founders, CTOs, and Engineers';
    const tone = options.tone || 'Thought leadership & inspiring';
    const cType = options.contentType || 'Actionable Framework';
    const pLength = options.length || 'medium';

    const words = topic.split(/\s+/).filter((w) => w.length > 2);
    const domainTag = words.length > 0 ? words[0].replace(/[^a-zA-Z]/g, '') : 'Leadership';
    const secondTag = words.length > 1 ? words[1].replace(/[^a-zA-Z]/g, '') : 'Growth';
    const tags = `#${domainTag} #${secondTag} #Leadership #Strategy #GTInnoX`;

    // Randomized variation index to ensure clicking "Generate" multiple times always produces fresh content
    const randomVariation = Math.floor(Math.random() * 4);

    // 1. CONTRARIAN TAKE / MYTH BUSTING
    if (cType.toLowerCase().includes('contrarian') || cType.toLowerCase().includes('myth') || randomVariation === 1 && !cType.toLowerCase().includes('case')) {
      const contrarianHooks = [
        `Unpopular opinion about ${topic.toLowerCase()}: most conventional playbooks are completely backwards.`,
        `The biggest lie leaders are told about ${topic.toLowerCase()}: work harder and volume will solve it.`,
        `Why 90% of strategies around ${topic.toLowerCase()} fail before they ever reach production:`,
        `Stop treating ${topic.toLowerCase()} like a checklist. Here is the uncomfortable truth:`,
      ];
      const hook = contrarianHooks[Math.floor(Math.random() * contrarianHooks.length)];

      if (pLength === 'short') {
        return `${hook}

The conventional approach focuses on vanity metrics and superficial activity.

In reality, sustainable results come down to three fundamentals:
• Ruthlessly delete redundant friction
• Align incentives with high-leverage outcomes
• Automate the repeatable steps so humans can think

When you eliminate operational drag, momentum takes care of itself.

Agree or disagree?

${tags}`;
      }

      return `${hook}

Every quarter, teams burn thousands of hours optimizing the wrong side of the equation.

They add more reviews, more coordinators, and more point solutions.
And then they wonder why execution speed grinds to a halt.

Here are the 3 hard truths nobody wants to acknowledge about ${topic.toLowerCase()}:

1. Activity is not progress.
Measuring how busy your team looks is an expensive distraction. The only metric that matters is cycle turnaround time and customer delivery.

2. Complexity is a vulnerability disguised as sophistication.
If your workflow requires 10 hand-offs and a 20-page guide, it will collapse under real market pressure. The best systems are aggressively simple.

3. Tools don't fix broken process architecture.
Digitizing chaos just gives you automated chaos. Fix the manual foundation first, then automate.

The organizations that dominate their market aren't doing 100 things differently. They do 3 non-negotiables with relentless discipline.

What is the biggest misconception you see around ${topic.toLowerCase()}?

${tags}`;
    }

    // 2. CASE STUDY & RETROSPECTIVE
    if (cType.toLowerCase().includes('case') || cType.toLowerCase().includes('story') || randomVariation === 2) {
      const caseHooks = [
        `We spent 4 months building a solution for ${topic.toLowerCase()}. Here was the exact moment we realized we were wrong:`,
        `A real breakdown of how addressing ${topic.toLowerCase()} unlocked a 40% gain in team execution:`,
        `The most expensive lesson we learned in our first year of tackling ${topic.toLowerCase()}:`,
      ];
      const hook = caseHooks[Math.floor(Math.random() * caseHooks.length)];

      return `${hook}

At the start, we believed the hardest part was the technical execution.

We spent late nights drafting multi-tier approvals, complex tracking dashboards, and detailed spreadsheets.

The result? Almost nobody used it.

The workflow was so cumbersome that our own team bypassed it to get real work done.

That failure forced us to adopt 3 radical changes:

1. Shadow the End-User Directly
We stopped guessing what was needed in meeting rooms and watched the actual execution friction in the field.

2. Cut 70% of the Steps
We eliminated every field, sign-off, and notification that didn't directly drive execution safety or customer delivery.

3. Automate Background Dispatch
We replaced manual check-ins with automated background queue workers that run reliably without human intervention.

Within 2 weeks, turnaround time dropped in half and team adoption reached 98%.

The takeaway: Your strategy is only as good as the friction it removes for the person executing it.

Have you ever over-engineered a workflow before simplifying it?

${tags}`;
    }

    // 3. THOUGHT LEADERSHIP & MACRO THESIS
    if (cType.toLowerCase().includes('thought') || cType.toLowerCase().includes('leadership') || randomVariation === 3) {
      const leadershipHooks = [
        `The landscape of ${topic.toLowerCase()} is shifting faster than most organizations realize.`,
        `Over the next 12 months, how teams approach ${topic.toLowerCase()} will separate market leaders from laggards.`,
        `The traditional playbook for ${topic.toLowerCase()} is expiring. Here is what is replacing it:`,
      ];
      const hook = leadershipHooks[Math.floor(Math.random() * leadershipHooks.length)];

      return `${hook}

We are moving away from manual coordination and fragmented silos toward unified, automated operational engines.

The organizations thriving in this environment share three distinct operating characteristics:

1. Unified Real-Time Visibility
They don't wait for end-of-week status syncs. Critical data flows automatically from the edge to executive leadership instantaneously.

2. Asynchronous Execution by Default
Synchronous meetings are reserved for high-stakes strategic debates. Everything else moves asynchronously through structured updates.

3. High-Agency Ownership
Individual operators are empowered with clear guardrails to make decisions independently, removing approval bottlenecks.

When your systems handle the baseline execution, your team has the cognitive bandwidth to innovate.

Where is your team on this operational maturity curve?

${tags}`;
    }

    // 4. ACTIONABLE FRAMEWORK / BLUEPRINT (Default)
    const frameworkHooks = [
      `If you want to master ${topic.toLowerCase()}, stop overcomplicating it. Here is the 3-pillar blueprint:`,
      `Most ${audience} get this completely wrong when it comes to ${topic.toLowerCase()}:`,
      `The 3-step operational framework we use to systematically solve ${topic.toLowerCase()}:`,
      `How high-velocity organizations solve ${topic.toLowerCase()} without burning out their teams:`,
    ];
    const hook = frameworkHooks[Math.floor(Math.random() * frameworkHooks.length)];

    return `${hook}

Execution isn't about working 14-hour days. It's about building airtight systems that eliminate friction.

Here is the exact playbook:

1. Diagnose the Root Constraint First
Don't treat symptoms. Measure turnaround velocity and identify the single bottleneck slowing down your delivery cycle.

2. Automate the Repeatable Hand-offs
Human focus belongs on high-leverage strategic decisions. Every status check, reminder, and recurring dispatch should run in persistent background queues.

3. Establish 24-Hour Feedback Loops
Catch anomalies and blockers the day they occur. When feedback loops are tight, compounding progress becomes inevitable.

Keep the architecture lean. Enforce rigor. Iterate relentlessly.

What is the single biggest bottleneck your team is tackling right now with ${topic.toLowerCase()}?

Let's discuss in the comments below.

${tags}`;
  }

  /**
   * Rewrites an existing draft into a desired tone or structure
   */
  async rewritePost(options: RewritePostOptions): Promise<string> {
    const model = getGeminiModel(options.apiKey);

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
   * Generates creative post concepts and hooks with full ready-to-publish drafts
   */
  async generateIdeas(industryOrCategory: string, count = 5, apiKey?: string): Promise<Array<{ title: string; hook: string; outline: string; fullDraft: string }>> {
    const model = getGeminiModel(apiKey);

    if (model) {
      try {
        const prompt = `Generate ${count} compelling, viral LinkedIn post concepts and FULL publication-ready drafts for the topic/industry: "${industryOrCategory}".

For each idea, write a complete, rich, high-value LinkedIn post (approx 800-1200 characters) with:
- An irresistible hook line
- A 3-point breakdown or actionable framework
- Clear takeaways
- A strong discussion CTA
- 3-5 relevant hashtags

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
          const parsed = JSON.parse(match[0]);
          return parsed.map((item: any) => ({
            ...item,
            fullDraft: item.fullDraft || `${item.hook}\n\n${item.outline}\n\nKey Execution Takeaways:\n• Focus on core business leverage\n• Eliminate operational friction\n• Standardize high-impact workflows\n\nWhat is your team's approach to this?\n\n#Leadership #Innovation #Growth #LinkedInStrategy`,
          }));
        }
      } catch {
        // Fallback
      }
    }

    const cleanIndustry = industryOrCategory.replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Modern Business';
    const tag = cleanIndustry.split(' ')[0] || 'Leadership';

    // Built-in dynamic viral hook pool with complete publication-ready drafts
    const allIdeas = [
      {
        title: 'The Uncomfortable Truth About Scaling',
        hook: `90% of leaders in ${cleanIndustry} focus on the wrong metric in their first 12 months.`,
        outline: 'Why vanity growth without workflow automation creates unsustainable operational debt, and how to fix it before you burn out.',
        fullDraft: `90% of leaders in ${cleanIndustry} focus on the wrong metric in their first 12 months.

They celebrate vanity volume while their team drowns in manual friction, disjointed hand-offs, and avoidable rework.

Here is the truth: Scaling without workflow automation doesn't create leverage. It creates operational debt.

If you want sustainable, high-velocity output, focus on these 3 principles:

1. Standardize Before You Scale
Never automate a broken process. Map every hand-off, cut redundant reviews, and ensure your single source of truth is spotless.

2. Eliminate Asynchronous Bottlenecks
Every minute your team waits on status updates or manual verifications is pure friction. Real-time visibility beats weekly sync meetings every single time.

3. Measure Operational Health Over Top-Line Noise
Track error rates, turnaround cycles, and team bandwidth. When your internal execution engine is sound, consistent delivery becomes inevitable.

The most resilient organizations in ${cleanIndustry} don't work 14-hour days. They build airtight systems that execute flawlessly.

What metric do you prioritize when evaluating your team's operational health?

#${tag} #Operations #Leadership #Productivity #ScalingStrategy`,
      },
      {
        title: 'The 3-Step Execution Framework',
        hook: `We simplified our entire ${cleanIndustry} operations down to 3 non-negotiable rules. Here is what happened:`,
        outline: 'A practical breakdown of removing meeting fatigue and replacing synchronous syncs with asynchronous updates.',
        fullDraft: `We simplified our entire ${cleanIndustry} operations down to 3 non-negotiable rules. Here is what happened:

Output increased by 40%. Turnaround time dropped by half. And team morale reached an all-time high.

Here was the framework:

Rule 1: If it can be an asynchronous update, cancel the meeting.
Status meetings are an expensive crutch. Replace them with structured written summaries and automated dashboards.

Rule 2: Every deliverable has exactly one accountable owner.
When two people own a task, nobody owns it. Clear ownership drives rapid execution and decisive problem-solving.

Rule 3: Enforce a 24-hour feedback loop.
Blockers are addressed the same business day they appear. Velocity isn't about rushing; it's about eliminating waiting time.

Simplicity is the ultimate competitive advantage in high-stakes environments.

How many hours could your team reclaim this week by eliminating low-value meetings?

#${tag} #Frameworks #Productivity #WorkplaceExcellence #TeamLeadership`,
      },
      {
        title: 'The Cost of Premature Optimization',
        hook: `The biggest mistake technical and business leaders make in ${cleanIndustry}: solving problems they do not have yet.`,
        outline: 'Why building complex architectures before finding repeatable validation kills velocity faster than lack of capital.',
        fullDraft: `The biggest mistake technical and business leaders make in ${cleanIndustry}: solving problems they do not have yet.

We often confuse complexity with sophistication.

We see teams design massive multi-tier architectures before having their first 100 steady users. Or draft 40-page standard operating procedures for workflows that haven't been validated in the field.

Here is what happens when you prematurely optimize:
• Capital is tied up in speculative features
• Core feedback loops get delayed by weeks
• The team loses the agility needed to pivot

The antidote is radical pragmatism:
1. Build for the current stage plus 3 months — never 3 years ahead.
2. Validate actual operational friction before introducing new tooling.
3. Keep your tech stack and workflows lean enough to refactor overnight.

Build what delivers immediate, measurable value today. Optimize when the data forces you to.

Have you ever caught your team over-engineering a solution too early?

#${tag} #Technology #Strategy #EngineeringLeadership #BusinessAdvice`,
      },
      {
        title: 'What Nobody Tells You About B2B Growth',
        hook: `Enterprise sales in ${cleanIndustry} isn't about persuasive closing pitches. It’s about trust architecture.`,
        outline: 'A real-world breakdown of turning organic LinkedIn thought leadership into inbound qualified enterprise inquiries.',
        fullDraft: `Enterprise sales in ${cleanIndustry} isn't about persuasive closing pitches. It’s about trust architecture.

Enterprise buyers don't buy because of flashy slides. They buy when you systematically de-risk their decision.

Here is the exact playbook we use to build inbound authority:

1. Publish Insights, Not Promotional Hype
Share real breakdowns of challenges your industry faces. Explain the root causes and show the exact methodology to resolve them.

2. Document Real Production Lessons
Don't just highlight the wins. Transparently discuss edge cases, architectural trade-offs, and lessons learned from past mistakes. Transparency builds unbreakable trust.

3. Speak Directly to Decision-Maker Metrics
Focus on risk reduction, operational uptime, compliance, and ROI. When you speak the language of leadership, conversations shift from cost to strategic investment.

When your brand consistently delivers high-value perspective in public, inbound enterprise interest follows naturally.

What is the biggest objection your team hears during high-ticket sales cycles?

#${tag} #B2BGrowth #EnterpriseSales #ThoughtLeadership #Strategy`,
      },
      {
        title: 'The Power of Consistency Over Intensity',
        hook: 'Consistency looks boring from the outside until compound growth kicks in.',
        outline: 'How publishing 3 structured, high-value LinkedIn posts per week outperforms erratic daily posting every single time.',
        fullDraft: `Consistency looks boring from the outside until compound growth kicks in.

Everyone wants exponential results in 30 days.

They post furiously for two weeks, get overwhelmed by operational demands, vanish for a month, and wonder why their momentum evaporated.

Here is how high-performing leaders approach LinkedIn content:

• Quality over noise: 3 deeply valuable, well-structured posts per week outperform 10 low-effort blurbs.
• Batch and automate: Set aside 60 minutes on Monday to outline your weekly content calendar and schedule posts automatically.
• Engage authentically: Dedicate 10 minutes post-publish to engage with commenters, peers, and industry colleagues.

The leaders who dominate their niche 12 months from now aren't the ones burning out on content daily.

They are the ones who put reliable systems in place and never missed a week.

Are you treating your industry presence like a daily chore or an automated system?

#${tag} #Consistency #PersonalBranding #ExecutiveLeadership #GrowthHacking`,
      },
      {
        title: 'The Single-Point-of-Failure Risk',
        hook: `If your ${cleanIndustry} operations pause when one key person goes on vacation, you do not have a company. You have an emergency waiting to happen.`,
        outline: 'Why cross-functional documentation and asynchronous tooling protect businesses from key-person dependency.',
        fullDraft: `If your ${cleanIndustry} operations pause when one key person goes on vacation, you do not have a company. You have an emergency waiting to happen.

The hallmark of mature operations is resilience.

When critical information lives solely in someone's head:
• Decision-making bottlenecks at their inbox
• Work stalls whenever they are unavailable
• Onboarding new talent takes months instead of days

3 ways to build operational redundancy:
1. Mandate written operating procedures for every core hand-off.
2. Automate notifications and escalations so tasks don't get trapped.
3. Rotate second-in-command operators across critical pipelines.

Build systems strong enough that no single absence disrupts customer delivery.

How does your team protect against single-point-of-failure bottlenecks?

#${tag} #Operations #BusinessResilience #Leadership #SystemsThinking`,
      },
    ];

    // Shuffle and slice count to ensure fresh ideas on every generation click
    const shuffled = [...allIdeas].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  /**
   * Generates a 7-day content calendar with complete publication-ready drafts
   */
  async generateContentCalendar(industry: string, brandTone: string, apiKey?: string): Promise<Array<{
    day: string;
    theme: string;
    hook: string;
    format: string;
    contentType: string;
    fullDraft: string;
  }>> {
    const model = getGeminiModel(apiKey);

    if (model) {
      try {
        const prompt = `Create a high-performing 7-Day LinkedIn Content Calendar for an organization in "${industry}" with a brand tone of "${brandTone}".

For each day (Monday through Sunday), generate a COMPLETE, publication-ready LinkedIn post (approx 800-1200 characters) including:
- An irresistible hook line
- A high-value breakdown (framework, story, or analysis)
- Bullet points or numbered steps with practical takeaways
- An engaging call-to-action question
- 3-5 relevant LinkedIn hashtags

Return ONLY a valid JSON array of 7 objects with the structure:
[
  {
    "day": "Monday",
    "theme": "Strategic Perspective & Industry Thesis",
    "hook": "Why the next 12 months will redefine how...",
    "format": "Text + Framework Checklist",
    "contentType": "Thought Leadership",
    "fullDraft": "The complete 800-1200 character publication-ready LinkedIn post text..."
  }
]
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim();

        const match = text.match(/\[[\s\S]*\]/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          return parsed.map((item: any) => ({
            ...item,
            fullDraft: item.fullDraft || `${item.hook}\n\nStrategic Perspective:\nIn ${industry}, execution excellence is built on clear workflows and disciplined habits.\n\n3 Key Principles:\n1. Standardize critical data pipelines\n2. Eliminate repetitive manual handoffs\n3. Review operational bottlenecks weekly\n\nWhat is your team focusing on this week?\n\n#${industry.replace(/[^a-zA-Z]/g, '') || 'Leadership'} #Strategy #Growth`,
          }));
        }
      } catch {
        // Fallback
      }
    }

    const cleanIndustry = industry.replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Modern Enterprise';
    const tag = cleanIndustry.split(' ')[0] || 'Leadership';

    // Dynamic Multi-Variant Strategy Matrix: Every call to generateContentCalendar / Rebuild picks fresh angles
    const mondayPool = [
      {
        theme: 'Strategic Perspective & Industry Thesis',
        hook: `Why the next 12 months will redefine how ${cleanIndustry} teams operate.`,
        format: 'Text + Framework Checklist',
        contentType: 'Thought Leadership',
        fullDraft: `Why the next 12 months will redefine how ${cleanIndustry} teams operate.

For years, conventional wisdom said you could solve execution bottlenecks simply by hiring more coordinators or layering on more point solutions.

In reality, that only amplified the friction.

Here are the 3 structural shifts separating top-performing teams from everyone else today:

1. Unified Real-Time Visibility
Siloed spreadsheets and fragmented communication channels are costing operations 15-20% in avoidable delays. Winning organizations treat real-time data flow as core infrastructure.

2. Automated Workflows Over Manual Hand-offs
Every time a task requires manual follow-up or re-entry, the probability of variance increases exponentially. Automation isn't about replacing people; it's about eliminating operational drag.

3. Continuous Feedback Loops
The fastest teams don't wait for end-of-quarter reviews. They capture anomalies immediately at the source, allowing field and executive leadership to align instantaneously.

The organizations that thrive in this environment aren't working harder. They are systematically eliminating friction.

What's the single biggest operational bottleneck you're solving right now?

#${tag} #Leadership #OperationalExcellence #Enterprise #Innovation`,
      },
      {
        theme: 'The Invisible Bottleneck in Operations',
        hook: `In ${cleanIndustry}, 80% of project delays don't happen in the field. They happen in the hand-offs.`,
        format: 'Analytical Breakdown',
        contentType: 'Strategic Insight',
        fullDraft: `In ${cleanIndustry}, 80% of project delays don't happen in the field. They happen in the hand-offs.

When you analyze root causes across multi-million dollar projects, the pattern is startlingly consistent:

It's almost never a lack of technical skill on the ground.
It's the friction between departments:
• Waiting 48 hours for an approval signature
• Re-entering data from field paper into central systems
• Misaligned inventory updates between procurement and scheduling

To solve this, leading organizations are doing three things differently:

1. Single Source of Operational Truth: Eliminate duplicate spreadsheets.
2. Automated Escalation Triggers: If an approval sits for 4 hours, it escalates automatically.
3. Mobile-First Field Logging: Empower site teams to capture updates in under 30 seconds.

Stop optimizing the work that takes 1 hour while ignoring the waiting time that takes 3 days.

Where does the biggest communication delay happen in your pipeline?

#${tag} #ProjectManagement #Operations #Productivity #Efficiency`,
      },
    ];

    const tuesdayPool = [
      {
        theme: 'Failure to Success Case Breakdown',
        hook: `We spent 3 months building a workflow nobody used in ${cleanIndustry}. Here was the exact moment we realized we were wrong:`,
        format: 'Personal Narrative / Story',
        contentType: 'Case Study',
        fullDraft: `We spent 3 months building a workflow nobody used in ${cleanIndustry}. Here was the exact moment we realized we were wrong:

We had designed what we thought was the "ultimate" 14-step review dashboard. It had analytics, multi-tier approvals, and color-coded status trees.

When we deployed it to the field team, adoption was virtually zero.

Why? Because in high-pressure field operations, nobody has time to fill out 8 mandatory fields just to log an update.

Here is how we turned failure into our most adopted tool:
• We shadowed actual end-users on site for 3 days.
• We scrapped 11 of the 14 steps, keeping only the 3 essential data points.
• We automated the notification pipeline directly to mobile alerts.

The result? 98% adoption within 48 hours and a 50% decrease in reporting lag.

The lesson: Sophistication is worthless if it increases friction for the person doing the actual work.

Have you ever over-engineered a process before realizing simple is better?

#${tag} #CaseStudy #ProductManagement #LessonsLearned #FieldOperations`,
      },
      {
        theme: 'Operational Turnaround Retrospective',
        hook: `How cutting 4 recurring meetings gave our ${cleanIndustry} team back 220 hours a month:`,
        format: 'Before / After Breakdown',
        contentType: 'Case Study',
        fullDraft: `How cutting 4 recurring meetings gave our ${cleanIndustry} team back 220 hours a month:

6 months ago, our team was suffering from acute sync-fatigue.
Mondays started with a 2-hour status meeting.
Wednesdays had a mid-week sync.
Fridays had a retro.

Everyone was constantly talking about the work, but milestone completion dates kept slipping.

We made one radical rule change:
"If a meeting exists solely to inform people of status, cancel it. Replace it with an automated async report."

Here is what happened:
1. Team reclaimed 220 productive engineering and operational hours every month.
2. Blockers were resolved 3x faster because issues were logged in real-time instead of waiting for the weekly meeting.
3. Documentation quality skyrocketed because updates were captured in written, searchable records.

Meetings should be for high-stakes decision making, not reading status updates off slides.

How many hours could your team reclaim by canceling low-value status meetings?

#${tag} #WorkplaceExcellence #Productivity #TimeManagement #Leadership`,
      },
    ];

    const wednesdayPool = [
      {
        theme: 'Actionable How-To Guide',
        hook: `The 5-step framework to audit and improve your team's weekly output in ${cleanIndustry}:`,
        format: 'Numbered Step-by-Step Breakdown',
        contentType: 'Educational',
        fullDraft: `The 5-step framework to audit and improve your team's weekly output in ${cleanIndustry}:

If your team feels constantly busy but major milestones are lagging, run this 30-minute audit:

Step 1: Map Every Recurring Touchpoint
List every weekly meeting, report, and approval. Identify which ones directly drive customer delivery versus internal anxiety.

Step 2: Flag Single-Point-of-Failure Dependencies
Where is work waiting on a single individual's signature or manual input? Document these bottlenecks immediately.

Step 3: Establish Asynchronous Status Updates
Replace 15-minute daily standups with an automated 3-bullet written summary (Completed, In Progress, Blockers).

Step 4: Standardize Exception Handling
Give your team clear thresholds for when they can make decisions independently without waiting for executive sign-off.

Step 5: Review Metrics Weekly, Not Annually
Track turnaround time and hand-off velocity. When you inspect bottlenecks continuously, progress compounds.

Great teams aren't built on heroic overtime; they are built on frictionless execution.

Which of these 5 steps would have the highest immediate impact on your team?

#${tag} #Management #ProcessOptimization #WorkplaceEfficiency #Systems`,
      },
      {
        theme: 'The 3-Tier Operational Scorecard',
        hook: `Stop tracking 40 different KPIs in ${cleanIndustry}. Here are the only 3 that predict delivery success:`,
        format: 'Executive Framework',
        contentType: 'Educational',
        fullDraft: `Stop tracking 40 different KPIs in ${cleanIndustry}. Here are the only 3 that predict delivery success:

Dashboard bloat is a real problem. When leadership tries to track everything, nobody focuses on the levers that move the needle.

Here is the simplified 3-metric scorecard we recommend:

1. Cycle Velocity (Lead Time to Delivery)
From the moment a task or site change order is submitted, how many hours until it is fully resolved? This measures organizational friction better than any survey.

2. Variance Rate (% Unplanned Work)
What percentage of your team's weekly bandwidth is consumed by emergencies and rework? Top organizations keep this under 15%.

3. Hand-off Lag (Queue Dwell Time)
How long does work sit in waiting state between departments? Eliminating dwell time delivers instant capacity without hiring more staff.

Focus on reducing friction in these three areas, and your top-line revenue follows naturally.

What is the single most important metric your team tracks each week?

#${tag} #KPIs #Metrics #Performance #ExecutiveStrategy`,
      },
    ];

    const thursdayPool = [
      {
        theme: 'Contrarian Take / Myth Busting',
        hook: `Unpopular opinion in ${cleanIndustry}: More software tools won't solve your operational problems.`,
        format: 'Short & Punchy Argument',
        contentType: 'Contrarian Analysis',
        fullDraft: `Unpopular opinion in ${cleanIndustry}: More software tools won't solve your operational problems.

Every year, companies spend six figures adding another SaaS tool to their stack.

And every year, their teams spend more time synchronizing tools than executing actual core work.

Here is the reality:
• A disorganized process digitized is just automated chaos.
• Adding another communication channel creates cognitive fragmentation.
• Tools don't create discipline; discipline chooses the right tools.

Before you invest in your next platform, ask three questions:
1. Does our team follow the manual version of this process with 100% rigor today?
2. Will this tool reduce the total number of clicks/steps our team takes daily?
3. Does it integrate natively with our central source of truth?

If the answer to any of these is no, the problem isn't software. It's process architecture.

Do you think most companies have too many tools or too few?

#${tag} #Contrarian #TechStrategy #DigitalTransformation #Efficiency`,
      },
      {
        theme: 'The Premature Optimization Fallacy',
        hook: `The biggest trap in ${cleanIndustry} scaling: automating workflows before validating them in the field.`,
        format: 'Critical Analysis',
        contentType: 'Contrarian Analysis',
        fullDraft: `The biggest trap in ${cleanIndustry} scaling: automating workflows before validating them in the field.

We frequently see leaders spend months building complex automation pipelines for workflows that haven't even stabilized manually.

Here is what happens when you automate prematurely:
• You hardcode assumptions that turn out to be wrong
• Changes require engineering sprints instead of a quick protocol update
• Teams become rigid and resistant to changing field realities

The golden rule of systems engineering:
1. Do it manually until you feel the real operational pain.
2. Standardize the checklist until variance is near zero.
3. ONLY THEN automate the mechanical steps.

Automation should accelerate verified processes, never compensate for missing discipline.

Have you ever had to unwind an automated workflow that was built too early?

#${tag} #ProcessDesign #SystemsThinking #Automation #Operations`,
      },
    ];

    const fridayPool = [
      {
        theme: 'Behind-the-Scenes & Team Culture',
        hook: `The one hiring and culture principle that saved our ${cleanIndustry} operations hundreds of wasted hours:`,
        format: 'Conversational Reflection',
        contentType: 'Hiring & Culture',
        fullDraft: `The one hiring and culture principle that saved our ${cleanIndustry} operations hundreds of wasted hours:

"Hire for high agency and systemic thinking, not just domain certifications."

Early on, we looked for candidates who had memorized specific legacy software suites. But whenever unexpected edge cases arose, execution ground to a halt.

Now, we evaluate for three different qualities:

1. High Agency
When an obstacle arises, do they stop and wait to be told what to do, or do they immediately formulate 2 viable paths forward?

2. Workflow Empathy
Do they understand how their work impacts the next person in line, or do they simply throw tasks over the wall?

3. Clear Written Communication
In an asynchronous, modern work environment, the ability to write concise, structured thoughts is a superpower.

When you surround yourself with high-agency operators, management overhead plummets and velocity accelerates.

What is the single most important trait you look for when hiring?

#${tag} #Culture #Hiring #Leadership #TalentAcquisition #HighAgency`,
      },
      {
        theme: 'Building Workflow Empathy',
        hook: `The most common operational failure in ${cleanIndustry} isn't incompetence. It's lack of workflow empathy.`,
        format: 'Team Leadership Reflection',
        contentType: 'Hiring & Culture',
        fullDraft: `The most common operational failure in ${cleanIndustry} isn't incompetence. It's lack of workflow empathy.

When site field teams don't understand how their paperwork affects procurement...
When engineering doesn't understand how their updates affect sales...
When management doesn't understand the daily friction on the ground...

Silos form. Finger-pointing starts. And delivery velocity dies.

Here is the simple habit we use to bridge the gap:
Every manager spends 1 day each quarter shadowing someone in a completely different functional department.

Field coordinators spend a day in procurement.
Software engineers spend a day with customer support.
Executives spend a day on site.

The clarity you gain in 8 hours of direct observation is worth more than 50 slide decks.

When was the last time you shadowed someone on the front lines of your operations?

#${tag} #TeamAlignment #Empathy #Leadership #WorkplaceCulture`,
      },
    ];

    const saturdayPool = [
      {
        theme: 'Curated Tools & Resources',
        hook: `The 4 high-leverage frameworks and tools that delivered 10x ROI for ${cleanIndustry} teams this year:`,
        format: 'Resource List + Commentary',
        contentType: 'Curated Insights',
        fullDraft: `The 4 high-leverage frameworks and tools that delivered 10x ROI for ${cleanIndustry} teams this year:

If you are planning your operational roadmap for the upcoming quarter, these four resources are essential:

1. Unified ERP & Field Scheduling Integration
Automating the bridge between field site updates and central resource planning eliminates 90% of scheduling conflicts before they happen.

2. Automated LinkedIn & Thought Leadership Distribution
Building executive visibility shouldn't require manual daily drafting. Schedule your weekly content batch in one sitting with persistent queue automation.

3. The "Two-Pizza Team" Autonomy Principle
Keep cross-functional delivery units small and decoupled. Smaller teams make decisions 3x faster with zero coordination bloat.

4. The 80/20 Documentation Standard
Stop writing 100-page manuals that nobody reads. Maintain short, dynamic checklists linked directly inside task management workflows.

Invest in tools and habits that free your highest-leverage people to do their best creative and strategic work.

Which operational tool has given your team the highest return on investment this year?

#${tag} #ProductivityTools #TechStack #ROI #ExecutiveResources`,
      },
      {
        theme: 'The 80/20 Documentation Playbook',
        hook: `Nobody reads your 60-page operations manual in ${cleanIndustry}. Here is the 80/20 format that actually works:`,
        format: 'Tactical Playbook',
        contentType: 'Curated Insights',
        fullDraft: `Nobody reads your 60-page operations manual in ${cleanIndustry}. Here is the 80/20 format that actually works:

Most companies spend months writing exhaustive SOPs that end up buried in a Google Drive folder nobody ever opens.

When edge cases arise, people just ask their peers or wing it.

Here is the dynamic documentation standard that transformed our operations:

1. One-Page Action Checklists
If a procedure can't be distilled into 5 non-negotiable checklist steps with clear checkboxes, it's too complex.

2. Video Walkthroughs Under 90 Seconds
A screen recording showing the exact clicks or physical procedure is 10x more effective than three paragraphs of text.

3. Live "Last Updated" Tags
Every document has a named owner and an expiration date. If it hasn't been reviewed in 90 days, it's flagged as outdated.

Keep your knowledge base lean, visible, and directly integrated into daily execution tools.

How does your organization keep documentation fresh and actionable?

#${tag} #SOPs #KnowledgeManagement #Operations #Documentation`,
      },
    ];

    const sundayPool = [
      {
        theme: 'Executive Reflection & Weekly Reset',
        hook: 'Rest isn’t a reward for finishing your work. It’s an essential prerequisite for high-leverage execution.',
        format: 'Inspirational Reflection',
        contentType: 'Mindset & Leadership',
        fullDraft: `Rest isn’t a reward for finishing your work. It’s an essential prerequisite for high-leverage execution.

For a long time, the tech and startup world idolized working until exhaustion.

The badge of honor was 80-hour weeks, midnight Slack pings, and skipping weekends.

Here is what that actually produced:
• Sluggish decision-making that cost weeks in misaligned pivots
• High turnover among top performers
• Tunnel vision that missed massive strategic opportunities

The best leaders don't measure dedication by hours logged in a chair. They measure it by the clarity and leverage of their decisions.

Taking time to step away, reflect, and reset on Sunday is how you bring sharp, calm, and decisive leadership to your team on Monday.

Disconnect fully today. Tomorrow we build.

How do you reset your mind before a demanding week of execution?

#${tag} #Leadership #Mindset #ExecutiveWellness #SundayReflection`,
      },
      {
        theme: 'The Sunday Evening Clarity Ritual',
        hook: `3 questions every leader in ${cleanIndustry} should ask before Monday morning begins:`,
        format: 'Strategic Planning Reset',
        contentType: 'Mindset & Leadership',
        fullDraft: `3 questions every leader in ${cleanIndustry} should ask before Monday morning begins:

Walking into Monday without a crystal-clear focus is how you spend the entire week reacting to other people's emergencies.

Here is the 15-minute Sunday evening audit:

1. "If only ONE major outcome gets achieved this week, what must it be?"
Identify the single domino that makes everything else easier or unnecessary. Protect the time needed to finish it.

2. "What meeting or task on my calendar can be deleted or delegated?"
Ruthlessly protect your cognitive bandwidth for high-leverage strategic work.

3. "Where is my team currently waiting on me for unblocking?"
Clear the bottlenecks on your end so your operators can execute at full velocity from 9:00 AM Monday.

Clarity creates confidence. Discipline creates momentum.

What is your #1 non-negotiable priority for the upcoming week?

#${tag} #WeeklyPlanning #ExecutiveHabits #Strategy #Focus`,
      },
    ];

    // Pick a random variant for each day so repeated clicks on "Rebuild 7-Day Plan" always produce a fresh schedule!
    const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

    return [
      { day: 'Monday', ...pickRandom(mondayPool) },
      { day: 'Tuesday', ...pickRandom(tuesdayPool) },
      { day: 'Wednesday', ...pickRandom(wednesdayPool) },
      { day: 'Thursday', ...pickRandom(thursdayPool) },
      { day: 'Friday', ...pickRandom(fridayPool) },
      { day: 'Saturday', ...pickRandom(saturdayPool) },
      { day: 'Sunday', ...pickRandom(sundayPool) },
    ];
  }
}

export const aiService = new AIService();
