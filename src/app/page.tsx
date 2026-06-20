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

  const formatRelativeTime = (dateStr: string) => {
    if (!dateStr) return 'Baru saja';
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins} menit yang lalu`;
    if (diffHours < 24) return `${diffHours} jam yang lalu`;
    
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  };

  const getRecentActivities = () => {
    const activities = [];
    
    const sortedNotes = [...notes]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 2);
      
    sortedNotes.forEach((n, idx) => {
      activities.push({
        id: `note-${n.id}-${idx}`,
        time: formatRelativeTime(n.updated_at),
        text: `Anda memperbarui catatan <strong>${n.title || 'Untitled Note'}</strong>`,
        dotClass: styles.dotSecondary,
      });
    });

    const sortedActions = [...actionItems]
      .sort((a, b) => new Date(b.created_at || b.deadline || '').getTime() - new Date(a.created_at || a.deadline || '').getTime())
      .slice(0, 2);
      
    sortedActions.forEach((ai, idx) => {
      activities.push({
        id: `action-${ai.id}-${idx}`,
        time: formatRelativeTime(ai.created_at),
        text: `${ai.pic || 'Wildan'} membuat/mengubah action item <strong>${ai.title}</strong> menjadi ${ai.status === 'done' ? 'Selesai' : ai.status === 'in_progress' ? 'In Progress' : 'Open'}`,
        dotClass: styles.dotPrimary,
      });
    });

    if (activities.length === 0) {
      activities.push({
        id: 'fallback',
        time: 'Baru saja',
        text: 'Selamat datang di workspace PM Super Tools Anda!',
        dotClass: styles.dotPrimary,
      });
    }

    return activities.slice(0, 4);
  };

  return (
    <div className={`${styles.container} animate-fade-in`}>
      {/* Top Banner */}
      <section className={styles.greetingBanner}>
        <div className={styles.greetingText}>
          <h2>Selamat {mounted && time ? (time.getHours() < 11 ? 'Pagi' : time.getHours() < 15 ? 'Siang' : time.getHours() < 18 ? 'Sore' : 'Malam') : '...'}, Wildan 👋</h2>
          <p>
            <span className="material-symbols-outlined" style={{ fontSize: '16px', display: 'inline-block', verticalAlign: 'middle' }}>calendar_today</span>
            <span style={{ marginLeft: '6px', verticalAlign: 'middle' }}>
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
            <div className={`${styles.metricIconContainer} ${styles.iconPrimary}`}>
              <span className="material-symbols-outlined">folder_copy</span>
            </div>
          </div>
          <h3 className={styles.metricVal}>{activeProjectsCount}</h3>
          <p className={styles.metricSub}>Dari total {projects.length} proyek</p>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <p className={styles.metricLabel}>Action Item Pending</p>
            <div className={`${styles.metricIconContainer} ${styles.iconWarning}`}>
              <span className="material-symbols-outlined">hourglass_empty</span>
            </div>
          </div>
          <h3 className={styles.metricVal}>{pendingActionsCount}</h3>
          <p className={`${styles.metricSub} ${styles.metricSubWarning}`}>Segera selesaikan task secepatnya</p>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <p className={styles.metricLabel}>Due This Week</p>
            <div className={`${styles.metricIconContainer} ${styles.iconError}`}>
              <span className="material-symbols-outlined">event_busy</span>
            </div>
          </div>
          <h3 className={styles.metricVal}>{dueThisWeekCount}</h3>
          <p className={styles.metricSub}>Rentang: {weekRangeStr}</p>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <p className={styles.metricLabel}>Total Notes</p>
            <div className={`${styles.metricIconContainer} ${styles.iconSecondary}`}>
              <span className="material-symbols-outlined">edit_note</span>
            </div>
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
            <h2>
              <span className="material-symbols-outlined" style={{ color: 'var(--error)', marginRight: '8px', verticalAlign: 'middle' }}>warning_amber</span>
              <span style={{ verticalAlign: 'middle' }}>Action Items Mendesak</span>
            </h2>
            <Link href="/action-items" className={styles.viewAll}>Lihat Semua</Link>
          </div>
          
          {urgentActions.length === 0 ? (
            <div className={styles.emptyState}>
              <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--outline-variant)', marginBottom: '8px' }}>check_circle</span>
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
                            <span className="material-symbols-outlined" style={{ fontSize: '12px', marginRight: '4px', verticalAlign: 'middle' }}>schedule</span>
                            <span style={{ verticalAlign: 'middle' }}>{formatDate(item.deadline)}</span>
                          </span>
                          {overdue && <span className={styles.overdueBadge}>OVERDUE</span>}
                        </div>
                      </div>
                      
                      {item.description && <p className={styles.actionDesc}>{item.description}</p>}
                      
                      <div className={styles.actionMeta}>
                        <span className={styles.picTag}>
                          <span className="material-symbols-outlined" style={{ fontSize: '12px', marginRight: '4px', verticalAlign: 'middle' }}>person</span>
                          <span style={{ verticalAlign: 'middle' }}>{item.pic || 'Unassigned'}</span>
                        </span>
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
                            <span className="material-symbols-outlined" style={{ fontSize: '12px', marginRight: '4px', verticalAlign: 'middle' }}>folder</span>
                            <span style={{ verticalAlign: 'middle' }}>{assocProject.name}</span>
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

        {/* Recent Activity Timeline */}
        <section className={styles.cardSection} style={{ padding: '16px' }}>
          <div className={styles.sectionHeader} style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '600' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--secondary)', marginRight: '8px', verticalAlign: 'middle' }}>history</span>
              <span style={{ verticalAlign: 'middle' }}>Aktivitas Terbaru</span>
            </h2>
          </div>
          <div className={styles.timelineContainer}>
            {getRecentActivities().map((act) => (
              <div key={act.id} className={styles.timelineItem}>
                <div className={`${styles.timelineDot} ${act.dotClass}`} />
                <span className={styles.activityTime}>{act.time}</span>
                <p 
                  className={styles.activityText}
                  dangerouslySetInnerHTML={{ __html: act.text }}
                />
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Catatan Terbaru (Full Width Scrollable Row) */}
      <section className={styles.notesSection} style={{ marginTop: '24px' }}>
        <div className={styles.notesSectionHeader}>
          <h3>
            <span className="material-symbols-outlined" style={{ color: 'var(--secondary)', verticalAlign: 'middle' }}>sticky_note_2</span>
            <span style={{ verticalAlign: 'middle' }}>Catatan Terbaru</span>
          </h3>
          <Link href="/notes" className={styles.viewAll}>Lihat Semua</Link>
        </div>
        
        <div className={styles.notesScrollRow}>
          {recentNotes.length === 0 ? (
            <div className={styles.emptyState} style={{ minWidth: '100%' }}>
              <p>Belum ada catatan.</p>
            </div>
          ) : (
            recentNotes.map((note) => (
              <Link href={`/notes?id=${note.id}`} key={note.id} className={styles.noteCard}>
                <div className={styles.noteCardHeader}>
                  <span className={styles.noteCardFolder}>{note.folder || 'Work'}</span>
                </div>
                <h4 className={styles.noteCardTitle}>{note.title || 'Untitled Note'}</h4>
                <p 
                  className={styles.noteCardSnippet}
                  dangerouslySetInnerHTML={{ 
                    __html: note.content 
                      ? note.content.replace(/<[^>]*>/g, ' ').substring(0, 100) + (note.content.length > 100 ? '...' : '')
                      : 'Mulai menulis catatan...'
                  }}
                />
                <div className={styles.noteCardFooter}>
                  <span className={styles.noteCardDate}>{formatDate(note.updated_at)}</span>
                </div>
              </Link>
            ))
          )}
          
          <Link href="/notes" className={styles.addNoteCard}>
            <span className="material-symbols-outlined" style={{ fontSize: '32px', marginBottom: '8px' }}>add_circle</span>
            <span className={styles.addNoteText}>Buat Catatan Baru</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
