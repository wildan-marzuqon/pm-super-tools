'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

interface ActionItem {
  id: string;
  title: string;
  status: string;
  completed: boolean;
  project?: {
    name: string;
  };
}

interface DailyPlanEntry {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  type: 'task' | 'meeting' | 'focus';
  title: string;
  notes: string | null;
  status: string;
  actionItemId: string | null;
  actionItem?: ActionItem | null;
}

// Helper to convert time "HH:MM" to minutes
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// Helper to get Jakarta (UTC+7) Date String (YYYY-MM-DD)
function getJakartaTodayStr(): string {
  const d = new Date();
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(d);
}

// Helper to get Jakarta (UTC+7) Current Time (HH:MM)
function getJakartaCurrentTimeStr(): string {
  const d = new Date();
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  return formatter.format(d);
}

// Get Monday of the current week (Jakarta)
function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

// Get Sunday of the current week
function getWeekEnd(dateStr: string): string {
  const start = getWeekStart(dateStr);
  const d = new Date(start + 'T00:00:00');
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

// Generate all dates between start and end inclusive
function getDatesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const d = new Date(start + 'T00:00:00');
  const endD = new Date(end + 'T00:00:00');
  while (d <= endD) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

type DateFilterMode = 'today' | 'week' | 'custom';

export default function DailyPlanPage() {
  const [filterMode, setFilterMode] = useState<DateFilterMode>('today');
  const [customDate, setCustomDate] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [sidebarDates, setSidebarDates] = useState<string[]>([]);
  const [rangeEntries, setRangeEntries] = useState<DailyPlanEntry[]>([]);
  const [todayEntries, setTodayEntries] = useState<DailyPlanEntry[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [isRangeLoading, setIsRangeLoading] = useState(true);

  // Time tracking for timeline line
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');
  const [currentMinutes, setCurrentMinutes] = useState<number>(0);

  // Banner states
  const [bannerInfo, setBannerInfo] = useState<{
    type: 'upcoming' | 'ongoing' | 'overdue';
    text: string;
    id: string;
  } | null>(null);
  const [dismissedBannerId, setDismissedBannerId] = useState<string | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formType, setFormType] = useState<'task' | 'meeting' | 'focus'>('task');
  const [formStartTime, setFormStartTime] = useState('09:00');
  const [formEndTime, setFormEndTime] = useState('10:00');
  const [formActionItemId, setFormActionItemId] = useState('');
  const [formCreateActionItem, setFormCreateActionItem] = useState(false);
  const [isFormSaving, setIsFormSaving] = useState(false);

  // Quick Add Form states
  const [quickTitle, setQuickTitle] = useState('');
  const [quickType, setQuickType] = useState<'task' | 'meeting' | 'focus'>('task');
  const [quickStartTime, setQuickStartTime] = useState('09:00');
  const [quickEndTime, setQuickEndTime] = useState('10:00');
  const [quickActionItemId, setQuickActionItemId] = useState('');
  const [quickCreateActionItem, setQuickCreateActionItem] = useState(false);
  const [isQuickAdding, setIsQuickAdding] = useState(false);

  // Loading state for inline actions
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Initialize selectedDate on mount
  useEffect(() => {
    const today = getJakartaTodayStr();
    setSelectedDate(today);
    setCustomDate(today);

    const time = getJakartaCurrentTimeStr();
    setCurrentTimeStr(time);
    setCurrentMinutes(timeToMinutes(time));

    const interval = setInterval(() => {
      const t = getJakartaCurrentTimeStr();
      setCurrentTimeStr(t);
      setCurrentMinutes(timeToMinutes(t));
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Set default Quick Add start time
  useEffect(() => {
    const now = new Date();
    const currentHStr = String(now.getHours()).padStart(2, '0');
    setQuickStartTime(`${currentHStr}:00`);
    const nextHStr = String((now.getHours() + 1) % 24).padStart(2, '0');
    setQuickEndTime(`${nextHStr}:00`);
  }, []);

  // Generate sidebar dates based on filterMode
  useEffect(() => {
    const today = getJakartaTodayStr();
    if (filterMode === 'today') {
      setSidebarDates([today]);
      setSelectedDate(today);
    } else if (filterMode === 'week') {
      const start = getWeekStart(today);
      const end = getWeekEnd(today);
      const dates = getDatesInRange(start, end);
      setSidebarDates(dates);
      // Select today or first of week
      setSelectedDate(dates.includes(today) ? today : dates[0]);
    } else if (filterMode === 'custom') {
      const target = customDate || today;
      setSidebarDates([target]);
      setSelectedDate(target);
    }
  }, [filterMode, customDate]);

  // Fetch entries whenever sidebar dates change
  useEffect(() => {
    if (sidebarDates.length > 0) {
      fetchRangeEntries();
    }
  }, [sidebarDates]);

  // Fetch initial action items and today's entries for banner reminder
  useEffect(() => {
    fetchActionItems();
    fetchTodayEntries();

    const interval = setInterval(fetchTodayEntries, 60000);
    return () => clearInterval(interval);
  }, []);

  // Re-evaluate banner
  useEffect(() => {
    evaluateBanner();
  }, [todayEntries, currentMinutes, dismissedBannerId]);

  const fetchRangeEntries = async () => {
    if (sidebarDates.length === 0) return;
    const start = sidebarDates[0];
    const end = sidebarDates[sidebarDates.length - 1];
    setIsRangeLoading(true);
    try {
      const res = await fetch(`/api/daily-plan?startDate=${start}&endDate=${end}`);
      if (res.ok) {
        const data = await res.json();
        setRangeEntries(data);
      }
    } catch (error) {
      console.error('Error fetching range entries:', error);
    } finally {
      setIsRangeLoading(false);
    }
  };

  const fetchTodayEntries = async () => {
    try {
      const res = await fetch('/api/daily-plan?date=today');
      if (res.ok) {
        const data = await res.json();
        setTodayEntries(data);
      }
    } catch (error) {
      console.error('Error fetching today entries:', error);
    }
  };

  const fetchActionItems = async () => {
    try {
      const res = await fetch('/api/action-items?completed=false');
      if (res.ok) {
        const data = await res.json();
        setActionItems(data);
      }
    } catch (error) {
      console.error('Error fetching action items:', error);
    }
  };

  const evaluateBanner = () => {
    if (todayEntries.length === 0) {
      setBannerInfo(null);
      return;
    }

    let activeBanner: typeof bannerInfo = null;
    const activeToday = todayEntries.filter(e => e.status !== 'done' && e.status !== 'skipped');

    // 1. Overdue
    const overdueItems = activeToday.filter(e => timeToMinutes(e.endTime) < currentMinutes);
    if (overdueItems.length > 0) {
      overdueItems.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
      const target = overdueItems[0];
      const bannerId = `overdue-${target.id}-${target.status}`;
      if (dismissedBannerId !== bannerId) {
        activeBanner = {
          id: bannerId,
          type: 'overdue',
          text: `⚠️ Terlewat: "${target.title}" belum diselesaikan!`
        };
      }
    }

    // 2. Ongoing
    if (!activeBanner) {
      const ongoingItems = activeToday.filter(e => {
        const start = timeToMinutes(e.startTime);
        const end = timeToMinutes(e.endTime);
        return currentMinutes >= start && currentMinutes < end;
      });
      if (ongoingItems.length > 0) {
        const target = ongoingItems[0];
        const bannerId = `ongoing-${target.id}-${target.status}`;
        if (dismissedBannerId !== bannerId) {
          activeBanner = {
            id: bannerId,
            type: 'ongoing',
            text: `🔥 Sedang Berjalan: "${target.title}" (${target.startTime} – ${target.endTime})`
          };
        }
      }
    }

    // 3. Upcoming
    if (!activeBanner) {
      const upcomingItems = activeToday.filter(e => {
        const start = timeToMinutes(e.startTime);
        return start > currentMinutes && (start - currentMinutes) <= 15;
      });
      if (upcomingItems.length > 0) {
        upcomingItems.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
        const target = upcomingItems[0];
        const bannerId = `upcoming-${target.id}`;
        if (dismissedBannerId !== bannerId) {
          activeBanner = {
            id: bannerId,
            type: 'upcoming',
            text: `⏰ Mendatang: "${target.title}" mulai pukul ${target.startTime} (dalam ${timeToMinutes(target.startTime) - currentMinutes} menit)`
          };
        }
      }
    }

    setBannerInfo(activeBanner);
  };

  const handleQuickStartTimeChange = (start: string) => {
    setQuickStartTime(start);
    const [h, m] = start.split(':').map(Number);
    const endH = (h + 1) % 24;
    setQuickEndTime(`${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  };

  const handleStartTimeChange = (start: string) => {
    setFormStartTime(start);
    const [h, m] = start.split(':').map(Number);
    const endH = (h + 1) % 24;
    setFormEndTime(`${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  };

  const isPastDate = (dateStr?: string) => {
    const target = dateStr || selectedDate;
    const today = getJakartaTodayStr();
    return target < today;
  };

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    setIsQuickAdding(true);

    const payload = {
      date: selectedDate,
      startTime: quickStartTime,
      endTime: quickEndTime,
      type: quickType,
      title: quickTitle,
      actionItemId: quickType === 'task' ? quickActionItemId || null : null,
      createActionItem: quickType === 'task' ? quickCreateActionItem : false
    };

    try {
      const res = await fetch('/api/daily-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setQuickTitle('');
        setQuickActionItemId('');
        setQuickCreateActionItem(false);
        await fetchRangeEntries();
        fetchTodayEntries();
        fetchActionItems();
      }
    } catch (error) {
      console.error('Error in quick add:', error);
    } finally {
      setIsQuickAdding(false);
    }
  };

  const openAddModal = () => {
    setModalMode('add');
    setFormTitle('');
    setFormNotes('');
    setFormType('task');
    const now = new Date();
    const currentHStr = String(now.getHours()).padStart(2, '0');
    setFormStartTime(`${currentHStr}:00`);
    const nextHStr = String((now.getHours() + 1) % 24).padStart(2, '0');
    setFormEndTime(`${nextHStr}:00`);
    setFormActionItemId('');
    setFormCreateActionItem(false);
    setIsModalOpen(true);
  };

  const openEditModal = (entry: DailyPlanEntry) => {
    setModalMode('edit');
    setEditingId(entry.id);
    setFormTitle(entry.title);
    setFormNotes(entry.notes || '');
    setFormType(entry.type);
    setFormStartTime(entry.startTime);
    setFormEndTime(entry.endTime);
    setFormActionItemId(entry.actionItemId || '');
    setFormCreateActionItem(false);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsFormSaving(true);

    const payload = {
      date: selectedDate,
      startTime: formStartTime,
      endTime: formEndTime,
      type: formType,
      title: formTitle,
      notes: formNotes,
      actionItemId: formType === 'task' ? formActionItemId || null : null,
      createActionItem: formType === 'task' ? formCreateActionItem : false
    };

    try {
      let res;
      if (modalMode === 'add') {
        res = await fetch('/api/daily-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`/api/daily-plan/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        setIsModalOpen(false);
        await fetchRangeEntries();
        fetchTodayEntries();
        fetchActionItems();
      }
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsFormSaving(false);
    }
  };

  const updateEntryStatus = async (id: string, newStatus: string) => {
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/daily-plan/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        await fetchRangeEntries();
        fetchTodayEntries();
        fetchActionItems();
      }
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus rencana ini?')) return;
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/daily-plan/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await fetchRangeEntries();
        fetchTodayEntries();
      }
    } catch (error) {
      console.error('Error deleting entry:', error);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filter entries for the currently selected date
  const filteredEntries = rangeEntries.filter(e => e.date === selectedDate);

  const getDayInfo = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const dayNum = d.getDate();
    const dayName = d.toLocaleDateString('id-ID', { weekday: 'short' });
    const monthName = d.toLocaleDateString('id-ID', { month: 'short' });

    const hasPlans = rangeEntries.some(e => e.date === dateStr);
    const dayPlans = rangeEntries.filter(e => e.date === dateStr);
    const allDone = hasPlans && dayPlans.every(e => e.status === 'done');

    return { dayNum, dayName, monthName, hasPlans, allDone };
  };

  const getFormattedSelectedDate = () => {
    if (!selectedDate) return '';
    const d = new Date(selectedDate + 'T00:00:00');
    return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const getFilterLabel = () => {
    const today = getJakartaTodayStr();
    if (filterMode === 'today') return 'Hari Ini';
    if (filterMode === 'week') {
      const start = getWeekStart(today);
      const end = getWeekEnd(today);
      return `Minggu: ${new Date(start + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} – ${new Date(end + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`;
    }
    if (filterMode === 'custom' && customDate) {
      return new Date(customDate + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return 'Custom';
  };

  return (
    <div className={styles.splitPageContainer}>
      {/* LEFT SIDEBAR: Filter + Date Selector */}
      <aside className={styles.dateSidebar}>
        <div className={styles.sidebarHeader}>
          <h3>📅 Jadwal</h3>
          {/* Filter Mode Tabs */}
          <div className={styles.filterTabs}>
            <button
              className={`${styles.filterTab} ${filterMode === 'today' ? styles.filterTabActive : ''}`}
              onClick={() => setFilterMode('today')}
            >
              Hari Ini
            </button>
            <button
              className={`${styles.filterTab} ${filterMode === 'week' ? styles.filterTabActive : ''}`}
              onClick={() => setFilterMode('week')}
            >
              Minggu Ini
            </button>
            <button
              className={`${styles.filterTab} ${filterMode === 'custom' ? styles.filterTabActive : ''}`}
              onClick={() => setFilterMode('custom')}
            >
              Custom
            </button>
          </div>

          {/* Custom date picker — only visible when custom mode */}
          {filterMode === 'custom' && (
            <input
              type="date"
              className={styles.sidebarDatePicker}
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
            />
          )}
        </div>

        {/* Date list */}
        <div className={styles.dateList}>
          {sidebarDates.map((dStr) => {
            const isSelected = selectedDate === dStr;
            const isToday = getJakartaTodayStr() === dStr;
            const { dayNum, dayName, monthName, hasPlans, allDone } = getDayInfo(dStr);
            const isPast = isPastDate(dStr);

            return (
              <button
                key={dStr}
                className={`${styles.dateCard} ${isSelected ? styles.selected : ''} ${isToday ? styles.today : ''}`}
                onClick={() => setSelectedDate(dStr)}
              >
                <div className={styles.dateCardLeft}>
                  <span className={styles.dayName}>{dayName}</span>
                  <span className={styles.dayNum}>{dayNum}</span>
                  <span className={styles.monthName}>{monthName}</span>
                </div>
                <div className={styles.dateCardRight}>
                  {isToday && <span className={styles.todayIndicator}>HARI INI</span>}
                  {isPast && !isToday && <span className={styles.pastLabel}>RIWAYAT</span>}
                  {hasPlans && (
                    <span
                      className={`${styles.statusDot} ${allDone ? styles.done : styles.active}`}
                      title={allDone ? 'Semua rencana selesai' : 'Ada rencana aktif'}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* RIGHT PANEL: Timeline for selected day */}
      <main className={styles.mainContent}>
        {/* Banner Reminder */}
        {bannerInfo && (
          <div className={`${styles.banner} ${styles[bannerInfo.type]}`}>
            <span>{bannerInfo.text}</span>
            <button
              className={styles.bannerClose}
              onClick={() => setDismissedBannerId(bannerInfo.id)}
            >
              &times;
            </button>
          </div>
        )}

        {/* Header */}
        <div className={styles.contentHeader}>
          <div className={styles.headerTitleArea}>
            <h2>{getFormattedSelectedDate()}</h2>
            <div className={styles.headerSubtitleArea}>
              <p>{getFilterLabel()}</p>
              {isPastDate() && (
                <span className={styles.readOnlyBadge}>Arsip / Read-Only</span>
              )}
            </div>
          </div>

          {!isPastDate() && (
            <button className={styles.addButton} onClick={openAddModal}>
              + Tambah Detail Rencana
            </button>
          )}
        </div>

        {/* QUICK ADD INLINE ROW (Only if selected day is NOT past) */}
        {!isPastDate() && (
          <form onSubmit={handleQuickAddSubmit} className={styles.quickAddRow}>
            {/* Time inputs */}
            <div className={styles.quickTimeGroup}>
              <input
                type="time"
                required
                className={styles.quickTimeInput}
                value={quickStartTime}
                onChange={(e) => handleQuickStartTimeChange(e.target.value)}
                title="Waktu mulai"
              />
              <span className={styles.timeDash}>→</span>
              <input
                type="time"
                required
                className={styles.quickTimeInput}
                value={quickEndTime}
                onChange={(e) => setQuickEndTime(e.target.value)}
                title="Waktu selesai"
              />
            </div>

            <div className={styles.dividerVertical} />

            {/* Type selector */}
            <div className={styles.quickTypeGroup}>
              {(['task', 'meeting', 'focus'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`${styles.quickTypeBtn} ${quickType === t ? styles.quickTypeActive : ''} ${styles[`quickType_${t}`]}`}
                  onClick={() => setQuickType(t)}
                >
                  {t === 'task' && '🎯'}
                  {t === 'meeting' && '🤝'}
                  {t === 'focus' && '🧘'}
                  <span>{t === 'task' ? 'Task' : t === 'meeting' ? 'Rapat' : 'Fokus'}</span>
                </button>
              ))}
            </div>

            <div className={styles.dividerVertical} />

            {/* Title input */}
            <input
              type="text"
              required
              placeholder="Judul rencana... (Enter untuk simpan)"
              className={styles.quickTitleInput}
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
            />

            {/* Action Item dropdown (for task type) */}
            {quickType === 'task' && (
              <>
                <div className={styles.dividerVertical} />
                <select
                  className={styles.quickActionItemSelect}
                  value={quickActionItemId}
                  onChange={(e) => {
                    setQuickActionItemId(e.target.value);
                    if (e.target.value) setQuickCreateActionItem(false);
                  }}
                  disabled={quickCreateActionItem}
                  title="Hubungkan ke Action Item"
                >
                  <option value="">🔗 Pilih AI (opsional)</option>
                  {actionItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.title}{item.project ? ` (${item.project.name})` : ''}
                    </option>
                  ))}
                </select>
              </>
            )}

            <button
              type="submit"
              className={styles.quickSubmitBtn}
              disabled={isQuickAdding || !quickTitle.trim()}
            >
              {isQuickAdding ? (
                <span className={styles.quickSpinner} />
              ) : (
                '+ Tambah'
              )}
            </button>
          </form>
        )}

        {/* Timeline Area */}
        <div className={styles.timelineArea}>
          {isRangeLoading && filteredEntries.length === 0 ? (
            <div className={styles.loadingText}>Memuat agenda harian...</div>
          ) : filteredEntries.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📅</div>
              <h3>Belum ada agenda harian</h3>
              <p>Tambahkan agenda rapat, sesi fokus, atau tugas harian menggunakan baris Quick Add di atas.</p>
            </div>
          ) : (
            <div className={styles.timelineList}>
              <div className={styles.timelineVisualLine} />

              {(() => {
                const renderedRows: React.JSX.Element[] = [];
                let timeIndicatorRendered = false;
                const isViewingToday = selectedDate === getJakartaTodayStr();
                const sorted = [...filteredEntries].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

                const renderTimeIndicator = () => {
                  timeIndicatorRendered = true;
                  return (
                    <div key="time-indicator" className={styles.timeIndicatorLine}>
                      <div className={styles.indicatorLabel}>jam sekarang ({currentTimeStr})</div>
                      <div className={styles.indicatorLine} />
                    </div>
                  );
                };

                sorted.forEach((entry) => {
                  const entryStartMinutes = timeToMinutes(entry.startTime);
                  const isProcessing = actionLoadingId === entry.id;

                  if (isViewingToday && !timeIndicatorRendered && entryStartMinutes > currentMinutes) {
                    renderedRows.push(renderTimeIndicator());
                  }

                  renderedRows.push(
                    <div
                      key={entry.id}
                      className={`${styles.compactRow} ${isProcessing ? styles.processingRow : ''}`}
                    >
                      {/* 1. Time range col — single line */}
                      <div className={styles.timeCol}>
                        <span className={styles.timeLabel}>{entry.startTime}</span>
                        <span className={styles.timeSeparator}>–</span>
                        <span className={styles.timeLabel}>{entry.endTime}</span>
                      </div>

                      {/* 2. Type badge */}
                      <div className={styles.typeCol}>
                        <span className={`${styles.typeBadge} ${styles[entry.type]}`}>
                          {entry.type === 'task' && '🎯 Task'}
                          {entry.type === 'meeting' && '🤝 Rapat'}
                          {entry.type === 'focus' && '🧘 Fokus'}
                        </span>
                      </div>

                      {/* 3. Title, notes snippet & links */}
                      <div className={styles.titleCol}>
                        <div className={styles.titleWrapper}>
                          <span className={styles.entryTitle}>{entry.title}</span>
                          {entry.notes && (
                            <span className={styles.entryNotesSnippet} title={entry.notes}>
                              — {entry.notes.length > 60 ? entry.notes.substring(0, 60) + '...' : entry.notes}
                            </span>
                          )}
                        </div>

                        {entry.type === 'task' && entry.actionItem && (
                          <Link
                            href="/action-items"
                            target="_blank"
                            className={styles.linkedActionLink}
                          >
                            🔗 AI: {entry.actionItem.title}
                            {entry.actionItem.project && ` (${entry.actionItem.project.name})`}
                          </Link>
                        )}
                      </div>

                      {/* 4. Inline Status dropdown select */}
                      <div className={styles.statusCol}>
                        <select
                          className={`${styles.statusSelect} ${styles[entry.status]}`}
                          value={entry.status}
                          disabled={isPastDate() || isProcessing}
                          onChange={(e) => updateEntryStatus(entry.id, e.target.value)}
                        >
                          {entry.type === 'task' ? (
                            <>
                              <option value="open">⏳ Open</option>
                              <option value="in_progress">⚙️ In Progress</option>
                              <option value="done">✓ Selesai</option>
                            </>
                          ) : (
                            <>
                              <option value="pending">⏳ Pending</option>
                              <option value="done">✓ Done</option>
                              <option value="skipped">❌ Skipped</option>
                            </>
                          )}
                        </select>
                      </div>

                      {/* 5. Quick action buttons (Only if not past date) */}
                      {!isPastDate() && (
                        <div className={styles.actionsCol}>
                          <button
                            className={styles.rowIconBtn}
                            disabled={isProcessing}
                            onClick={() => openEditModal(entry)}
                            title="Edit agenda"
                          >
                            ✏️
                          </button>
                          <button
                            className={`${styles.rowIconBtn} ${styles.delete}`}
                            disabled={isProcessing}
                            onClick={() => handleDeleteEntry(entry.id)}
                            title="Hapus agenda"
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>
                  );
                });

                if (isViewingToday && !timeIndicatorRendered) {
                  renderedRows.push(renderTimeIndicator());
                }

                return renderedRows;
              })()}
            </div>
          )}
        </div>
      </main>

      {/* Edit Modal (Dialog) */}
      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>{modalMode === 'add' ? 'Tambah Rencana Baru' : 'Edit Rencana'}</h2>
              <span className={styles.closeBtn} onClick={() => setIsModalOpen(false)}>
                &times;
              </span>
            </div>

            <form onSubmit={handleFormSubmit} className={styles.modalForm}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Tipe</label>
                  <select
                    className={styles.select}
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                  >
                    <option value="task">🎯 Task (Tugas)</option>
                    <option value="meeting">🤝 Meeting (Rapat)</option>
                    <option value="focus">🧘 Focus Block</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Judul Rencana</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Sprint Review, Deep Work"
                    className={styles.input}
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Waktu Mulai</label>
                  <input
                    type="time"
                    required
                    className={styles.input}
                    value={formStartTime}
                    onChange={(e) => handleStartTimeChange(e.target.value)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Waktu Selesai</label>
                  <input
                    type="time"
                    required
                    className={styles.input}
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Catatan Tambahan (Opsional)</label>
                <textarea
                  className={styles.textarea}
                  placeholder="Detail agenda..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                />
              </div>

              {formType === 'task' && modalMode === 'add' && (
                <div className={styles.formGroup} style={{ borderTop: '1px solid var(--card-border)', paddingTop: '0.75rem' }}>
                  <label className={styles.label}>Hubungkan ke Action Item</label>
                  <select
                    className={styles.select}
                    value={formActionItemId}
                    onChange={(e) => {
                      setFormActionItemId(e.target.value);
                      if (e.target.value !== '') {
                        setFormCreateActionItem(false);
                      }
                    }}
                    disabled={formCreateActionItem}
                  >
                    <option value="">-- Pilih Action Item (Opsional) --</option>
                    {actionItems.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.title} {item.project ? `(${item.project.name})` : ''}
                      </option>
                    ))}
                  </select>

                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={formCreateActionItem}
                      onChange={(e) => {
                        setFormCreateActionItem(e.target.checked);
                        if (e.target.checked) {
                          setFormActionItemId('');
                        }
                      }}
                    />
                    Buat Action Item baru otomatis dari rencana ini
                  </label>
                </div>
              )}

              {formType === 'task' && modalMode === 'edit' && (
                <div className={styles.formGroup} style={{ borderTop: '1px solid var(--card-border)', paddingTop: '0.75rem' }}>
                  <label className={styles.label}>Hubungkan ke Action Item</label>
                  <select
                    className={styles.select}
                    value={formActionItemId}
                    onChange={(e) => setFormActionItemId(e.target.value)}
                  >
                    <option value="">-- Pilih Action Item (Opsional) --</option>
                    {actionItems.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.title} {item.project ? `(${item.project.name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.secondary}`}
                  onClick={() => setIsModalOpen(false)}
                  disabled={isFormSaving}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={`${styles.btn} ${styles.primary}`}
                  disabled={isFormSaving}
                >
                  {isFormSaving ? (
                    <><span className={styles.btnSpinner} /> Menyimpan...</>
                  ) : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
