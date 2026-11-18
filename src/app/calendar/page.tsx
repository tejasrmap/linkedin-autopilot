'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader, ActionButton } from '@/components/magicpath/common';
import { Icon } from '@/components/magicpath/icons';
import { Post } from '@/types';
import { Modal } from '@/components/ui/modal';

export default function CalendarPage() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'week'>('month');
  const [posts, setPosts] = useState<Post[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem('autopilot_posts');
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return [];
  });
  const [selectedDayPosts, setSelectedDayPosts] = useState<{ day: number; posts: Post[] } | null>(
    null
  );

  const getWorkspaceHeader = useCallback((): Record<string, string> => {
    if (typeof window === 'undefined') return {};
    try {
      const ws = JSON.parse(sessionStorage.getItem('autopilot_current_ws') || '{}');
      return ws.id ? { 'x-workspace-id': String(ws.id) } : {};
    } catch {
      return {};
    }
  }, []);

  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch('/api/posts', {
        headers: getWorkspaceHeader(),
      });
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
  }, [getWorkspaceHeader]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  const firstDay = new Date(year, month, 1);
  const startingDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const jumpToToday = () => {
    setCurrentDate(new Date());
  };

  const scheduledThisMonth = posts.filter((p) => {
    if (p.status !== 'scheduled' || !p.scheduled_at) return false;
    const d = new Date(p.scheduled_at);
    return d.getFullYear() === year && d.getMonth() === month;
  }).length;

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

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  // Build grid of 35 or 42 calendar day cells
  const calendarCells: {
    day: number;
    isOutside: boolean;
    isToday: boolean;
    posts: Post[];
  }[] = [];
  // Previous month trailing days
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    calendarCells.push({
      day: daysInPrevMonth - i,
      isOutside: true,
      isToday: false,
      posts: [],
    });
  }
  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    calendarCells.push({
      day: i,
      isOutside: false,
      isToday: isCurrentMonth && today.getDate() === i,
      posts: getPostsForDay(i),
    });
  }
  // Next month leading days to complete 35 cells (or 42)
  const remaining = (7 - (calendarCells.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    calendarCells.push({
      day: i,
      isOutside: true,
      isToday: false,
      posts: [],
    });
  }

  const handleCellClick = (cell: (typeof calendarCells)[0]) => {
    if (cell.isOutside) return;
    if (cell.posts.length > 0) {
      setSelectedDayPosts({ day: cell.day, posts: cell.posts });
    } else {
      const formattedMonth = String(month + 1).padStart(2, '0');
      const formattedDay = String(cell.day).padStart(2, '0');
      router.push(`/composer?date=${year}-${formattedMonth}-${formattedDay}`);
    }
  };

  return (
    <>
      <PageHeader
        screen="calendar"
        action="Create post"
        actionHref="/composer"
      />

      <section className="panel calendar-panel">
        <div className="calendar-toolbar">
          <div>
            <h3>
              {monthNames[month]} {year}
            </h3>
            <p>{scheduledThisMonth} posts scheduled this month</p>
          </div>
          <div className="calendar-controls">
            <button
              type="button"
              className="icon-button"
              aria-label="Previous month"
              onClick={prevMonth}
            >
              <span style={{ display: 'inline-block', transform: 'rotate(180deg)' }}>
                <Icon name="chevron" size={16} />
              </span>
            </button>
            <button type="button" className="btn btn-secondary" onClick={jumpToToday}>
              Today
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Next month"
              onClick={nextMonth}
            >
              <Icon name="chevron" size={16} />
            </button>
            <div className="view-switch">
              <button
                type="button"
                className={view === 'month' ? 'active' : ''}
                onClick={() => setView('month')}
              >
                Month
              </button>
              <button
                type="button"
                className={view === 'week' ? 'active' : ''}
                onClick={() => setView('week')}
              >
                Week
              </button>
            </div>
          </div>
        </div>

        <div className="calendar-grid">
          <div className="calendar-day-labels">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>

          <div className="calendar-days">
            {calendarCells.map((cell, idx) => (
              <button
                key={idx}
                type="button"
                className={`calendar-day ${cell.isOutside ? 'outside' : ''} ${
                  cell.isToday ? 'today' : ''
                }`}
                onClick={() => handleCellClick(cell)}
              >
                <span>{cell.day}</span>
                {cell.posts.slice(0, 2).map((p, pIdx) => (
                  <i
                    key={p.id || pIdx}
                    className={`calendar-event ${
                      p.status === 'published'
                        ? 'event-blue'
                        : p.status === 'scheduled'
                        ? 'event-violet'
                        : 'event-blue'
                    }`}
                  >
                    {p.content?.substring(0, 24) || 'Scheduled post'}
                  </i>
                ))}
                {cell.posts.length > 2 && (
                  <small style={{ fontSize: '8px', color: 'var(--muted)', marginTop: '2px' }}>
                    +{cell.posts.length - 2} more
                  </small>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="calendar-legend">
          <span>
            <i className="legend-blue" /> Published
          </span>
          <span>
            <i className="legend-violet" /> Scheduled
          </span>
          <span>
            <i className="legend-gray" /> Draft
          </span>
        </div>
      </section>

      {/* Selected Day Modal */}
      {selectedDayPosts && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedDayPosts(null)}
          title={`Posts on ${monthNames[month]} ${selectedDayPosts.day}, ${year}`}
        >
          <div className="space-y-3">
            {selectedDayPosts.posts.map((post) => (
              <div
                key={post.id}
                onClick={() => {
                  setSelectedDayPosts(null);
                  router.push(`/composer?draftId=${post.id}`);
                }}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--line)',
                  background: 'var(--surface-soft)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span className={`status-pill status-${post.status.toLowerCase()}`}>
                    <i /> {post.status}
                  </span>
                  <small style={{ color: 'var(--muted)', fontSize: '10px' }}>
                    {post.scheduled_at ? new Date(post.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Draft'}
                  </small>
                </div>
                <p style={{ fontSize: '11px', margin: 0, color: 'var(--ink)' }}>
                  {post.content}
                </p>
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '10px' }}>
              <ActionButton
                kind="secondary"
                onClick={() => {
                  const d = selectedDayPosts.day;
                  setSelectedDayPosts(null);
                  const formattedMonth = String(month + 1).padStart(2, '0');
                  const formattedDay = String(d).padStart(2, '0');
                  router.push(`/composer?date=${year}-${formattedMonth}-${formattedDay}`);
                }}
              >
                <Icon name="plus" size={14} /> Schedule new post
              </ActionButton>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
