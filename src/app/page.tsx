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

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Loading Workspace...</p>
      </div>
    );
  }

  // Derived metrics
  const activeProjectsCount = projects.filter(
    (p) => p.current_stage_index < p.stages.length
  ).length;

  const pendingActions = actionItems.filter((item) => item.status !== 'done');
  const pendingActionsCount = pendingActions.length;
  
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
          <p className={styles.metricSub}>Segera selesaikan target minggu ini</p>
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
