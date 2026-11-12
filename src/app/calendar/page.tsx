'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  CheckCircle2,
  FileText,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { Post } from '@/types';
import { Modal } from '@/components/ui/modal';

export default function CalendarPage() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [posts, setPosts] = useState<Post[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem('autopilot_posts');
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return [];
  });

  // Day detail popover modal for days with multiple posts
  const [selectedDayPosts, setSelectedDayPosts] = useState<{ day: number; posts: Post[] } | null>(null);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const res = await fetch('/api/posts');
      if (res.ok) {
        const data = await res.json();
        const p = data.posts || [];
        setPosts(p);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('autopilot_posts', JSON.stringify(p));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const jumpToToday = () => {
    setCurrentDate(new Date());
  };

  const handleDateClick = (day: number) => {
    const formattedMonth = String(month + 1).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    const dateStr = `${year}-${formattedMonth}-${formattedDay}`;
    router.push(`/composer?date=${dateStr}`);
  };

  const getPostsForDay = (day: number) => {
    return posts.filter((p) => {
      const targetDate = p.scheduled_at ? new Date(p.scheduled_at) : new Date(p.created_at);
      return (
        targetDate.getFullYear() === year &&
        targetDate.getMonth() === month &&
        targetDate.getDate() === day
      );
    });
  };

  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const paddingArray = Array.from({ length: firstDayIndex }, (_, i) => i);

  // Total posts this month
  const thisMonthPostsCount = posts.filter((p) => {
    const targetDate = p.scheduled_at ? new Date(p.scheduled_at) : new Date(p.created_at);
    return targetDate.getFullYear() === year && targetDate.getMonth() === month;
  }).length;

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col justify-between overflow-hidden animate-in fade-in duration-200 gap-3 select-none">
      {/* Compact Top Header Bar */}
      <div className="flex items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Content Calendar
              </h1>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                {thisMonthPostsCount} Posts This Month
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Visual planning matrix and scheduled timelines
            </p>
          </div>
        </div>

        {/* Month Navigation & Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={jumpToToday}
            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300 transition-colors shadow-sm"
          >
            Today
          </button>

          <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-sm p-0.5">
            <button
              onClick={prevMonth}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 min-w-[120px] text-center">
              {monthNames[month]} {year}
            </span>
            <button
              onClick={nextMonth}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => router.push('/composer')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Schedule Post</span>
          </button>
        </div>
      </div>

      {/* Single-Screen Fitted Calendar Grid */}
      <div className="flex-1 flex flex-col min-h-0 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl overflow-hidden shadow-xl">
        {/* Day Name Headers */}
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-center text-[11px] font-bold text-slate-500 py-1.5 flex-shrink-0">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Days Grid - Automatically rows to fill exactly 100% of remaining height */}
        <div className="flex-1 grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 dark:divide-slate-800/80 min-h-0 overflow-hidden">
          {paddingArray.map((_, idx) => (
            <div key={`pad-${idx}`} className="p-1.5 bg-slate-50/30 dark:bg-slate-950/20" />
          ))}

          {daysArray.map((day) => {
            const dayPosts = getPostsForDay(day);
            const isToday =
              new Date().getDate() === day &&
              new Date().getMonth() === month &&
              new Date().getFullYear() === year;

            return (
              <div
                key={`day-${day}`}
                onClick={() => handleDateClick(day)}
                className={`p-1.5 transition-colors cursor-pointer group hover:bg-blue-50/30 dark:hover:bg-blue-950/20 flex flex-col justify-between overflow-hidden min-h-0 h-full ${
                  isToday ? 'bg-blue-50/25 dark:bg-blue-950/20 ring-1 ring-inset ring-blue-500/30' : ''
                }`}
              >
                {/* Cell Header */}
                <div className="flex items-center justify-between mb-0.5 flex-shrink-0">
                  <span
                    className={`text-[11px] font-semibold w-5 h-5 rounded-full flex items-center justify-center ${
                      isToday
                        ? 'bg-blue-600 text-white font-bold shadow-sm'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {day}
                  </span>
                  <button
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-blue-600 transition-opacity"
                    title="Add post for this date"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {/* Scheduled / Published Post Pills on Day */}
                <div className="space-y-0.5 overflow-hidden flex-1 flex flex-col justify-start">
                  {dayPosts.slice(0, 2).map((p) => (
                    <div
                      key={p.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/composer?content=${encodeURIComponent(p.content)}`);
                      }}
                      className={`px-1.5 py-0.5 rounded-md text-[9px] font-medium truncate flex items-center gap-1 border transition-all hover:scale-[1.02] ${
                        p.status === 'published'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                          : p.status === 'scheduled'
                          ? 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300'
                          : 'bg-slate-500/10 border-slate-500/20 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {p.status === 'published' ? (
                        <CheckCircle2 className="w-2 h-2 text-emerald-500 flex-shrink-0" />
                      ) : p.status === 'scheduled' ? (
                        <Clock className="w-2 h-2 text-blue-500 flex-shrink-0" />
                      ) : (
                        <FileText className="w-2 h-2 text-slate-400 flex-shrink-0" />
                      )}
                      <span className="truncate">{p.content}</span>
                    </div>
                  ))}

                  {/* "+x more" button that opens day detail modal */}
                  {dayPosts.length > 2 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDayPosts({ day, posts: dayPosts });
                      }}
                      className="text-[9px] text-blue-500 dark:text-blue-400 font-semibold text-left pl-1 hover:underline"
                    >
                      +{dayPosts.length - 2} more posts
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Day Details Modal */}
      {selectedDayPosts && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedDayPosts(null)}
          title={`${monthNames[month]} ${selectedDayPosts.day}, ${year}`}
          description={`${selectedDayPosts.posts.length} posts scheduled or published on this date`}
          maxWidth="lg"
        >
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {selectedDayPosts.posts.map((p) => (
              <div
                key={p.id}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex flex-col justify-between gap-2.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      p.status === 'published'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                        : p.status === 'scheduled'
                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400'
                        : 'bg-slate-500/10 border-slate-500/20 text-slate-500'
                    }`}
                  >
                    {p.status}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {p.scheduled_at ? new Date(p.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Draft'}
                  </span>
                </div>

                <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
                  {p.content}
                </p>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                  <button
                    onClick={() => {
                      router.push(`/composer?content=${encodeURIComponent(p.content)}`);
                    }}
                    className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Open in Composer <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
