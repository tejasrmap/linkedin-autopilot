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
  AlertCircle,
  FileText,
} from 'lucide-react';
import { Post } from '@/types';

export default function CalendarPage() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const res = await fetch('/api/posts');
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
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

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-blue-500" />
            Content Calendar
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Visual planning, scheduling matrix, and scheduled post timelines.
          </p>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-sm p-1">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-bold text-slate-800 dark:text-slate-200 min-w-[130px] text-center">
              {monthNames[month]} {year}
            </span>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden shadow-sm">
        {/* Day Name Headers */}
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-center text-xs font-bold text-slate-500 py-2.5">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Calendar Cells */}
        <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 dark:divide-slate-800/80">
          {paddingArray.map((_, idx) => (
            <div key={`pad-${idx}`} className="min-h-[110px] p-2 bg-slate-50/40 dark:bg-slate-950/20" />
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
                className={`min-h-[110px] p-2 transition-colors cursor-pointer group hover:bg-blue-50/30 dark:hover:bg-blue-950/20 flex flex-col justify-between ${
                  isToday ? 'bg-blue-50/20 dark:bg-blue-950/10' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs font-semibold w-6 h-6 rounded-full flex items-center justify-center ${
                      isToday
                        ? 'bg-blue-600 text-white font-bold'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {day}
                  </span>
                  <button
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-600 transition-opacity"
                    title="Add post for this date"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Scheduled / Published Post Pills on Day */}
                <div className="space-y-1 overflow-hidden">
                  {dayPosts.slice(0, 3).map((p) => (
                    <div
                      key={p.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/composer?content=${encodeURIComponent(p.content)}`);
                      }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium truncate flex items-center gap-1 border ${
                        p.status === 'published'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                          : p.status === 'scheduled'
                          ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                          : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {p.status === 'published' ? (
                        <CheckCircle2 className="w-2.5 h-2.5 flex-shrink-0" />
                      ) : p.status === 'scheduled' ? (
                        <Clock className="w-2.5 h-2.5 flex-shrink-0" />
                      ) : (
                        <FileText className="w-2.5 h-2.5 flex-shrink-0" />
                      )}
                      <span className="truncate">{p.content}</span>
                    </div>
                  ))}
                  {dayPosts.length > 3 && (
                    <div className="text-[9px] text-slate-400 font-medium pl-1">
                      +{dayPosts.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

