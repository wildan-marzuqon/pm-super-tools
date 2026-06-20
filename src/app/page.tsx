'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

interface Project {
  id: string;
  name: string;
  description: string;
  deadline: string;
  pic: string;
  current_stage_index: number;
  stages: Array<{ id: string; name: string; completed_at?: string }>;
  currentStage: { name: string } | null;
}

interface ActionItem {
  id: string;
  title: string;
  description: string;
  deadline: string;
  pic: string;
  status: 'open' | 'in_progress' | 'done';
  project_id?: string;
  source_note_id?: string;
  created_at: string;
}

interface Note {
  id: string;
  title: string;
  content: string;
  folder: string;
  tags: string[];
  updated_at: string;
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  // Time & Date State
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setMounted(true);
    setTime(new Date());
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        const [projRes, actionRes, notesRes] = await Promise.all([
          fetch('/api/projects'),
          fetch('/api/action-items'),
          fetch('/api/notes'),
        ]);

        if (projRes.ok && actionRes.ok && notesRes.ok) {
          const projs = await projRes.json();
          const items = await actionRes.json();
          const nts = await notesRes.json();
          
          setProjects(projs);
          setActionItems(items);
          setNotes(nts);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const formatDateTime = (date: Date) => {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    
    const dayName = days[date.getDay()];
    const dateNum = date.getDate();
    const monthName = months[date.getMonth()];
    const year = date.getFullYear();
    
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return {
      dayName,
      dateString: `${dateNum} ${monthName} ${year}`,
      timeString: `${hours}:${minutes}:${seconds}`
    };
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <div className="skeleton" style={{ height: '32px', width: '200px', marginBottom: '8px' }}></div>
            <div className="skeleton" style={{ height: '16px', width: '380px' }}></div>
          </div>
        </header>

        <section className={styles.metricsGrid}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={styles.metricCard}>
              <div className="skeleton" style={{ height: '14px', width: '80px', marginBottom: '12px' }}></div>
              <div className="skeleton" style={{ height: '36px', width: '50px', marginBottom: '8px' }}></div>
              <div className="skeleton" style={{ height: '12px', width: '120px' }}></div>
            </div>
          ))}
        </section>

        <div className={styles.mainGrid}>
          <section className={styles.cardSection}>
            <div className="skeleton" style={{ height: '20px', width: '150px', marginBottom: '16px' }}></div>
            <div className={styles.sectionCard} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div className="skeleton" style={{ height: '14px', width: '60%' }}></div>
                    <div className="skeleton" style={{ height: '10px', width: '100px' }}></div>
                  </div>
                  <div className="skeleton" style={{ height: '14px', width: '60px' }}></div>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.cardSection}>
            <div className="skeleton" style={{ height: '20px', width: '150px', marginBottom: '16px' }}></div>
            <div className={styles.notesGrid}>
              {[1, 2].map((i) => (
                <div key={i} className={styles.noteCard}>
                  <div className="skeleton" style={{ height: '16px', width: '40px', marginBottom: '8px' }}></div>
                  <div className="skeleton" style={{ height: '18px', width: '80%', marginBottom: '8px' }}></div>
                  <div className="skeleton" style={{ height: '12px', width: '100%', marginBottom: '4px' }}></div>
                  <div className="skeleton" style={{ height: '12px', width: '90%' }}></div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  // Derived metrics
  const activeProjectsCount = projects.filter(
    (p) => p.current_stage_index < p.stages.length
  ).length;

  const pendingActions = actionItems.filter((item) => item.status !== 'done');
  const pendingActionsCount = pendingActions.length;
  
  // Calculate action items due this week (Monday to Sunday)
  const getWeekRange = () => {
    const today = new Date();
    const currentDay = today.getDay();
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(today);
    monday.setDate(today.getDate() + distanceToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return { monday, sunday };
  };

  const { monday, sunday } = getWeekRange();

  const dueThisWeekActions = actionItems.filter((item) => {
    if (!item.deadline || item.status === 'done') return false;
    const d = new Date(item.deadline);
    return d >= monday && d <= sunday;
  });
  const dueThisWeekCount = dueThisWeekActions.length;

  const formatShortDate = (d: Date) => {
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  };
  const weekRangeStr = `${formatShortDate(monday)} - ${formatShortDate(sunday)}`;

  // Urgent actions (deadline in the next 7 days or overdue, sorted by date)
  const urgentActions = [...pendingActions]
    .filter((item) => item.deadline)
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 5);

  const recentNotes = notes.slice(0, 3);

  // Helper to format date
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Helper to check if date is overdue
  const isOverdue = (dateStr: string) => {
    if (!dateStr) return false;
    const deadline = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return deadline < today;
  };

  return (
    <div className={`${styles.container} animate-fade-in`}>
      {/* Dynamic Clock & Greeting Banner */}
      <div className={styles.greetingBanner}>
        <div className={styles.greetingText}>
          <h2>Selamat {mounted && time ? (time.getHours() < 11 ? 'Pagi' : time.getHours() < 15 ? 'Siang' : time.getHours() < 18 ? 'Sore' : 'Malam') : '...'}, Wildan Marzuqon! 👋</h2>
          <p>Berikut ringkasan workspace Anda hari ini.</p>
        </div>
        <div className={styles.dateTimeContainer}>
          <div className={styles.liveClock}>{mounted && time ? formatDateTime(time).timeString : '--:--:--'}</div>
          <div className={styles.liveDate}>
            {mounted && time ? (
              <><strong>{formatDateTime(time).dayName}</strong>, {formatDateTime(time).dateString}</>
            ) : (
              '...'
            )}
          </div>
        </div>
      </div>

      {/* Header */}
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>💡 PM Workspace</h1>
          <p className={styles.subtitle}>Satu tempat terorganisir untuk memantau notes & pipeline proyek startup AI.</p>
        </div>
        <div className={styles.actions}>
          <Link href="/notes" className={styles.primaryBtn}>
            <span>+ Note Baru</span>
          </Link>
          <Link href="/projects" className={styles.secondaryBtn}>
            <span>+ Proyek Baru</span>
          </Link>
        </div>
      </header>

      {/* Metrics Row */}
      <section className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <span className={styles.metricLabel}>Proyek Aktif</span>
            <span className={styles.metricIcon}>🚀</span>
          </div>
          <p className={styles.metricVal}>{activeProjectsCount}</p>
          <p className={styles.metricSub}>Dari total {projects.length} proyek terdaftar</p>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <span className={styles.metricLabel}>Action Items Pending</span>
            <span className={styles.metricIcon}>⏳</span>
          </div>
          <p className={styles.metricVal}>{pendingActionsCount}</p>
          <p className={styles.metricSub}>segera selesaikan task secepatnya</p>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <span className={styles.metricLabel}>Due This Week</span>
            <span className={styles.metricIcon}>📅</span>
          </div>
          <p className={styles.metricVal}>{dueThisWeekCount}</p>
          <p className={styles.metricSub}>Rentang: {weekRangeStr}</p>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <span className={styles.metricLabel}>Total Notes</span>
            <span className={styles.metricIcon}>📝</span>
          </div>
          <p className={styles.metricVal}>{notes.length}</p>
          <p className={styles.metricSub}>Terbagi dalam {Array.from(new Set(notes.map(n => n.folder))).length} folder</p>
        </div>
      </section>

      {/* Content Grid */}
      <div className={styles.mainGrid}>
        {/* Left Column: Urgent Action Items */}
        <section className={styles.cardSection}>
          <div className={styles.sectionHeader}>
            <h2>Urgent Action Items ⚡</h2>
            <Link href="/action-items" className={styles.viewAll}>Lihat semua</Link>
          </div>
          <div className={styles.sectionCard}>
            {urgentActions.length === 0 ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>🎉</span>
                <p>Tidak ada action item mendesak.</p>
                <Link href="/action-items" className={styles.createLink}>Buat Action Item baru</Link>
              </div>
            ) : (
              <div className={styles.actionList}>
                {urgentActions.map((item) => {
                  const associatedProject = projects.find((p) => p.id === item.project_id);
                  const overdue = isOverdue(item.deadline);
                  return (
                    <div key={item.id} className={styles.actionItemRow}>
                      <div className={styles.actionMain}>
                        <p className={styles.actionTitle}>{item.title}</p>
                        <div className={styles.actionMeta}>
                          {associatedProject && (
                            <span className={styles.projectTag}>{associatedProject.name}</span>
                          )}
                          <span className={styles.picTag}>PIC: {item.pic || 'Unassigned'}</span>
                          <span className={`${styles.statusBadge} ${
                            item.status === 'done' ? styles.statusDone : 
                            item.status === 'in_progress' ? styles.statusInProgress : 
                            styles.statusOpen
                          }`}>
                            {item.status === 'done' ? 'Selesai' : 
                             item.status === 'in_progress' ? 'In Progress' : 
                             'Open'}
                          </span>
                        </div>
                      </div>
                      <div className={styles.actionDateContainer}>
                        <span className={`${styles.actionDate} ${overdue ? styles.overdue : ''}`}>
                          {formatDate(item.deadline)}
                        </span>
                        {overdue && <span className={styles.overdueBadge}>OVERDUE</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Recent Notes */}
        <section className={styles.cardSection}>
          <div className={styles.sectionHeader}>
            <h2>Notes Terakhir Diedit 📝</h2>
            <Link href="/notes" className={styles.viewAll}>Buka Notes</Link>
          </div>
          <div className={styles.notesGrid}>
            {recentNotes.length === 0 ? (
              <div className={styles.emptyNotesState}>
                <span className={styles.emptyIcon}>✍️</span>
                <p>Belum ada notes dibuat.</p>
                <Link href="/notes" className={styles.createLink}>Buat note pertama</Link>
              </div>
            ) : (
              recentNotes.map((note) => (
                <Link href={`/notes?id=${note.id}`} key={note.id} className={styles.noteCard}>
                  <div className={styles.noteFolderTag}>{note.folder}</div>
                  <h3 className={styles.noteTitle}>{note.title || 'Untitled Note'}</h3>
                  <div 
                    className={styles.noteSnippet}
                    dangerouslySetInnerHTML={{ 
                      __html: note.content 
                        ? note.content.replace(/<[^>]*>/g, ' ').substring(0, 100) + '...'
                        : 'No content yet...'
                    }}
                  />
                  <div className={styles.noteFooter}>
                    <span className={styles.noteDate}>Update: {formatDate(note.updated_at)}</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
