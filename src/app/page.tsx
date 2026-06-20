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
      dateString: `${dayName}, ${dateNum} ${monthName} ${year}`,
      timeString: `${hours}:${minutes}:${seconds}`
    };
  };

  const handleToggleStatus = async (item: ActionItem) => {
    const nextStatus = item.status === 'done' ? 'open' : 'done';
    try {
      const res = await fetch(`/api/action-items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });

      if (res.ok) {
        setActionItems((prev) =>
          prev.map((ai) => (ai.id === item.id ? { ...ai, status: nextStatus } : ai))
        );
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.greetingBanner}>
          <div className={styles.greetingText}>
            <div className="skeleton" style={{ height: '28px', width: '220px', marginBottom: '8px' }}></div>
            <div className="skeleton" style={{ height: '16px', width: '180px' }}></div>
          </div>
          <div className="skeleton" style={{ height: '36px', width: '120px' }}></div>
        </div>

        <section className={styles.metricsGrid}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={styles.metricCard}>
              <div className="skeleton" style={{ height: '14px', width: '80px', marginBottom: '12px' }}></div>
              <div className="skeleton" style={{ height: '36px', width: '55px', marginBottom: '8px' }}></div>
              <div className="skeleton" style={{ height: '12px', width: '120px' }}></div>
            </div>
          ))}
        </section>

        <div className={styles.mainGrid}>
          <section className={styles.cardSection}>
            <div className={styles.sectionHeader}>
              <div className="skeleton" style={{ height: '20px', width: '180px' }}></div>
            </div>
            <div className={styles.actionList}>
              {[1, 2, 3].map((i) => (
                <div key={i} className={styles.actionItemRow} style={{ padding: '16px 12px' }}>
                  <div className="skeleton" style={{ height: '20px', width: '20px', borderRadius: '50%', marginRight: '12px' }}></div>
                  <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div className="skeleton" style={{ height: '14px', width: '60%' }}></div>
                    <div className="skeleton" style={{ height: '10px', width: '100px' }}></div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.cardSection}>
            <div className={styles.sectionHeader}>
              <div className="skeleton" style={{ height: '20px', width: '150px' }}></div>
            </div>
            <div className={styles.notesGrid}>
              {[1, 2].map((i) => (
                <div key={i} className={styles.noteCard} style={{ minHeight: '110px' }}>
                  <div className="skeleton" style={{ height: '14px', width: '60px', marginBottom: '6px' }}></div>
                  <div className="skeleton" style={{ height: '16px', width: '80%', marginBottom: '8px' }}></div>
                  <div className="skeleton" style={{ height: '12px', width: '100%' }}></div>
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

  // Urgent actions (sorted by deadline ascending)
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
      {/* Top Banner */}
      <section className={styles.greetingBanner}>
        <div className={styles.greetingText}>
          <h2>Selamat {mounted && time ? (time.getHours() < 11 ? 'Pagi' : time.getHours() < 15 ? 'Siang' : time.getHours() < 18 ? 'Sore' : 'Malam') : '...'}, Wildan 👋</h2>
          <p>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span style={{ marginLeft: '4px' }}>
              {mounted && time ? formatDateTime(time).dateString : '...'}
            </span>
          </p>
        </div>
        <div className={styles.dateTimeContainer}>
          <div className={styles.liveClock}>{mounted && time ? formatDateTime(time).timeString : '00:00:00'}</div>
        </div>
      </section>

      {/* KPI Cards Row */}
      <section className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <p className={styles.metricLabel}>Total Proyek Aktif</p>
            <div className={`${styles.metricIconContainer} ${styles.iconPrimary}`}>📁</div>
          </div>
          <h3 className={styles.metricVal}>{activeProjectsCount}</h3>
          <p className={styles.metricSub}>Dari total {projects.length} proyek</p>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <p className={styles.metricLabel}>Action Item Pending</p>
            <div className={`${styles.metricIconContainer} ${styles.iconWarning}`}>⏳</div>
          </div>
          <h3 className={styles.metricVal}>{pendingActionsCount}</h3>
          <p className={`${styles.metricSub} ${styles.metricSubWarning}`}>Segera selesaikan task secepatnya</p>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <p className={styles.metricLabel}>Due This Week</p>
            <div className={`${styles.metricIconContainer} ${styles.iconError}`}>📅</div>
          </div>
          <h3 className={styles.metricVal}>{dueThisWeekCount}</h3>
          <p className={styles.metricSub}>Rentang: {weekRangeStr}</p>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <p className={styles.metricLabel}>Total Notes</p>
            <div className={`${styles.metricIconContainer} ${styles.iconSecondary}`}>📝</div>
          </div>
          <h3 className={styles.metricVal}>{notes.length}</h3>
          <p className={styles.metricSub}>Di dalam {Array.from(new Set(notes.map(n => n.folder))).length} folder</p>
        </div>
      </section>

      {/* Main Split Layout */}
      <div className={styles.mainGrid}>
        {/* Urgent Action Items */}
        <section className={styles.cardSection}>
          <div className={styles.sectionHeader}>
            <h2>⚠️ Action Items Mendesk</h2>
            <Link href="/action-items" className={styles.viewAll}>Lihat Semua</Link>
          </div>
          
          {urgentActions.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>🎉</span>
              <p>Tidak ada action item mendesak.</p>
            </div>
          ) : (
            <div className={styles.actionList}>
              {urgentActions.map((item) => {
                const assocProject = projects.find((p) => p.id === item.project_id);
                const overdue = isOverdue(item.deadline);
                
                return (
                  <div key={item.id} className={styles.actionItemRow}>
                    <div className={styles.checkboxContainer}>
                      <input
                        type="checkbox"
                        checked={item.status === 'done'}
                        onChange={() => handleToggleStatus(item)}
                      />
                    </div>
                    
                    <div className={styles.actionMain}>
                      <div className={styles.actionHeaderRow}>
                        <h4 className={styles.actionTitle}>{item.title}</h4>
                        <div className={styles.actionDateContainer}>
                          <span className={`${styles.itemDate} ${overdue ? styles.overdue : ''}`}>
                            {formatDate(item.deadline)}
                          </span>
                          {overdue && <span className={styles.overdueBadge}>OVERDUE</span>}
                        </div>
                      </div>
                      
                      {item.description && <p className={styles.actionDesc}>{item.description}</p>}
                      
                      <div className={styles.actionMeta}>
                        <span className={styles.picTag}>👤 {item.pic || 'Unassigned'}</span>
                        <span className={`${styles.statusBadge} ${
                          item.status === 'done' ? styles.statusDone : 
                          item.status === 'in_progress' ? styles.statusInProgress : 
                          styles.statusOpen
                        }`}>
                          {item.status === 'done' ? 'Selesai' : 
                           item.status === 'in_progress' ? 'In Progress' : 
                           'Open'}
                        </span>
                        {assocProject && (
                          <Link href={`/projects/${assocProject.id}`} className={styles.projectTagBadge} title={assocProject.name}>
                            📁 {assocProject.name}
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent Notes */}
        <section className={styles.cardSection}>
          <div className={styles.sectionHeader}>
            <h2>📝 Catatan Terbaru</h2>
            <Link href="/notes" className={styles.viewAll}>Lihat Semua</Link>
          </div>
          
          <div className={styles.notesGrid}>
            {recentNotes.length === 0 ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>📝</span>
                <p>Belum ada catatan.</p>
              </div>
            ) : (
              recentNotes.map((note) => (
                <Link href={`/notes?id=${note.id}`} key={note.id} className={styles.noteCard}>
                  <div className={styles.noteHeader}>
                    <span className={styles.noteFolder}>{note.folder || 'Work'}</span>
                  </div>
                  <h4 className={styles.noteTitle}>{note.title || 'Untitled Note'}</h4>
                  <p 
                    className={styles.noteSnippet}
                    dangerouslySetInnerHTML={{ 
                      __html: note.content 
                        ? note.content.replace(/<[^>]*>/g, ' ').substring(0, 100) + (note.content.length > 100 ? '...' : '')
                        : 'Mulai menulis catatan...'
                    }}
                  />
                  <div className={styles.noteFooter}>
                    <span className={styles.noteDate}>{formatDate(note.updated_at)}</span>
                  </div>
                </Link>
              ))
            )}
            
            <Link href="/notes" className={styles.addNoteCard}>
              <span className={styles.addNoteIcon}>➕</span>
              <span className={styles.addNoteText}>Buat Catatan Baru</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
