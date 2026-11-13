'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Circle,
  Sparkles,
  Linkedin,
  Sliders,
  Calendar,
  Users,
  ChevronRight,
  X,
  Compass,
} from 'lucide-react';

interface OnboardingCardProps {
  accountsConnected: number;
  totalPosts: number;
}

export function OnboardingCard({ accountsConnected, totalPosts }: OnboardingCardProps) {
  const [dismissed, setDismissed] = useState(true); // default true to avoid hydration flicker
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const isDismissed = localStorage.getItem('autopilot_onboarding_dismissed') === 'true';
      setDismissed(isDismissed);

      const saved = localStorage.getItem('autopilot_onboarding_steps');
      if (saved) {
        setCompletedSteps(JSON.parse(saved));
      }
    } catch {}
  }, []);

  const steps = [
    {
      id: 'connect_linkedin',
      title: 'Connect your LinkedIn account',
      description: 'Authorize your personal profile or company page via official OAuth 2.0.',
      href: '/accounts',
      autoDone: accountsConnected > 0,
      icon: Linkedin,
    },
    {
      id: 'brand_voice',
      title: 'Define your Brand Voice',
      description: 'Configure your company tone, industry niche, and core guidelines.',
      href: '/settings',
      autoDone: false,
      icon: Sliders,
    },
    {
      id: 'ai_post',
      title: 'Generate your first AI post',
      description: 'Use Google Gemini in AI Studio to craft high-conversion LinkedIn posts.',
      href: '/ai-studio',
      autoDone: totalPosts > 0,
      icon: Sparkles,
    },
    {
      id: 'schedule_post',
      title: 'Schedule a post on the calendar',
      description: 'Set a target delivery time to automate persistent posting.',
      href: '/calendar',
      autoDone: false,
      icon: Calendar,
    },
    {
      id: 'team_collab',
      title: 'Invite collaborators or review analytics',
      description: 'Add team members with role-based permissions or monitor engagement.',
      href: '/team',
      autoDone: false,
      icon: Users,
    },
  ];

  const handleToggle = (stepId: string) => {
    const updated = { ...completedSteps, [stepId]: !completedSteps[stepId] };
    setCompletedSteps(updated);
    try {
      localStorage.setItem('autopilot_onboarding_steps', JSON.stringify(updated));
    } catch {}
  };

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem('autopilot_onboarding_dismissed', 'true');
    } catch {}
  };

  const isStepDone = (step: (typeof steps)[0]) => step.autoDone || !!completedSteps[step.id];
  const completedCount = steps.filter(isStepDone).length;
  const progressPct = Math.round((completedCount / steps.length) * 100);

  if (dismissed) return null;

  return (
    <div className="mb-8 rounded-3xl border border-blue-500/20 bg-gradient-to-r from-blue-900/10 via-indigo-900/10 to-slate-900/20 p-6 sm:p-8 backdrop-blur-sm relative overflow-hidden">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Getting Started with LinkedIn Autopilot
              </h2>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                {completedCount}/{steps.length} Completed
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Follow these recommended steps to maximize your professional reach.
            </p>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
          title="Dismiss onboarding"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mb-6">
        <div
          className="bg-blue-600 h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Steps List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {steps.map((step) => {
          const done = isStepDone(step);
          const Icon = step.icon;

          return (
            <div
              key={step.id}
              className={`flex flex-col justify-between p-4 rounded-2xl border transition-all ${
                done
                  ? 'border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/10'
                  : 'border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 hover:border-blue-500/30'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggle(step.id)}
                      className="text-slate-400 hover:text-blue-500 transition-colors"
                      title={done ? 'Mark as incomplete' : 'Mark as completed'}
                    >
                      {done ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                    <span
                      className={`text-xs font-bold ${
                        done
                          ? 'text-slate-500 line-through dark:text-slate-400'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {step.title}
                    </span>
                  </div>
                  <Icon className="w-4 h-4 text-slate-400 opacity-60" />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-6 leading-relaxed">
                  {step.description}
                </p>
              </div>

              <div className="mt-4 pl-6">
                <Link
                  href={step.href}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Configure <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
