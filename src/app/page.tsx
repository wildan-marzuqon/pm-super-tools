'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

interface Project {
  id: string;
  name: string;
  description: string;
  deadline: string;
  pic: string;
  current_stage_index: number;
  stages: Array<{ id: string; name: string; completed_at?: string }>;
  categories?: Array<{ id: string; name: string }>;
  currentStage: { name: string } | null;
}

interface ActionItem {
  id: string;
  title: string;
  description: string;
  deadline: string;
  startDate?: string;
  pic: string;
  completed: boolean;
  status: string;
  category_id?: string;
  category_name?: string;
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
}

const getStatusLabelDynamic = (status: string, statusesList: string[]) => {
  const norm = (status || '').toLowerCase();
  const matched = statusesList.find(s => s.toLowerCase() === norm);
  const displayName = matched || status || 'Open';
  
  if (norm.includes('done') || norm.includes('selesai') || norm.includes('complete') || norm.includes('success')) {
    return {
      text: `✓ ${displayName}`,
      styles: { backgroundColor: '#ECFDF5', color: '#059669', borderColor: '#A7F3D0' }
    };
  } else if (norm.includes('progress') || norm.includes('run') || norm.includes('dev') || norm.includes('working')) {
    return {
      text: `⚙️ ${displayName}`,
      styles: { backgroundColor: '#EFF6FF', color: '#2563EB', borderColor: '#BFDBFE' }
    };
  } else if (norm.includes('open') || norm.includes('todo') || norm.includes('to do')) {
    return {
      text: `📂 ${displayName}`,
      styles: { backgroundColor: '#FFFBEB', color: '#D97706', borderColor: '#FEF3C7' }
    };
  } else if (norm.includes('pending') || norm.includes('wait') || norm.includes('hold')) {
    return {
      text: `⏳ ${displayName}`,
      styles: { backgroundColor: '#FFFBEB', color: '#B45309', borderColor: '#FDE68A' }
    };
  } else if (norm.includes('test') || norm.includes('review') || norm.includes('qa')) {
    return {
      text: `🧪 ${displayName}`,
      styles: { backgroundColor: '#F5F3FF', color: '#7C3AED', borderColor: '#DDD6FE' }
    };
  } else if (norm.includes('backlog') || norm.includes('idea')) {
    return {
      text: `📦 ${displayName}`,
      styles: { backgroundColor: '#F3F4F6', color: '#4B5563', borderColor: '#E5E7EB' }
    };
  }
  
  return {
    text: displayName,
    styles: { backgroundColor: '#F3F4F6', color: '#4B5563', borderColor: '#E5E7EB' }
  };
};

const getResolvedStatus = (item: ActionItem, statuses: string[]) => {
  if (item.completed) {
    const foundDone = statuses.find(s => {
      const norm = s.toLowerCase();
      return norm === 'done' || norm === 'selesai';
    });
    if (foundDone) return foundDone;
    return statuses[statuses.length - 1] || 'Selesai';
  }
  return item.status || statuses[0] || 'Open';
};

export default function Dashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [dailyPlanToday, setDailyPlanToday] = useState<DailyPlanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Time & Date State
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState<Date | null>(null);

  // Edit/Detail Action Modal State
  const [editingAction, setEditingAction] = useState<ActionItem | null>(null);
  const [statusesList, setStatusesList] = useState<string[]>(['Pending', 'Open', 'In Progress', 'Selesai']);
  const [editActionFields, setEditActionFields] = useState({
    title: '',
    description: '',
    deadline: '',
    startDate: '',
    pic: 'Wildan',
    projectId: '',
    categoryId: '',
    completed: false,
    status: 'open'
  });

  // Dropdown state for task completion
  const [showCompleteDropdown, setShowCompleteDropdown] = useState(false);

  // Add Action Item Modal State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAction, setNewAction] = useState({
    title: '',
    description: '',
    deadline: '',
    startDate: '',
    pic: 'Wildan',
    projectId: '',
    categoryId: '',
    status: 'open'
  });

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
        const [projRes, actionRes, notesRes, dailyPlanRes, settingsRes] = await Promise.all([
          fetch('/api/projects'),
          fetch('/api/action-items'),
          fetch('/api/notes'),
          fetch('/api/daily-plan?date=today'),
          fetch('/api/wa-copilot/settings')
        ]);

        if (projRes.ok && actionRes.ok && notesRes.ok && dailyPlanRes.ok) {
          const projs = await projRes.json();
          const items = await actionRes.json();
          const nts = await notesRes.json();
          const planToday = await dailyPlanRes.json();
          
          setProjects(projs);
          setActionItems(items);
          setNotes(nts);
          setDailyPlanToday(planToday);
        }

        if (settingsRes && settingsRes.ok) {
          const settingsData = await settingsRes.json();
          if (settingsData.actionItemStatuses && settingsData.actionItemStatuses.length > 0) {
            setStatusesList(settingsData.actionItemStatuses);
            setNewAction(prev => ({ ...prev, status: settingsData.actionItemStatuses[0] }));
          }
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const handleStartEdit = (item: ActionItem) => {
    setEditingAction(item);
    setEditActionFields({
      title: item.title,
      description: item.description || '',
      deadline: item.deadline ? item.deadline.substring(0, 10) : '',
      startDate: item.startDate ? item.startDate.substring(0, 10) : '',
      pic: item.pic || '',
      projectId: item.project_id || '',
      categoryId: item.category_id || '',
      completed: item.completed,
      status: getResolvedStatus(item, statusesList)
    });
  };

  const handleAutoSaveAction = async (fieldsToUpdate: Partial<typeof editActionFields>) => {
    if (!editingAction) return;

    const mergedFields = {
      title: editActionFields.title,
      description: editActionFields.description,
      deadline: editActionFields.deadline,
      startDate: editActionFields.startDate,
      pic: editActionFields.pic,
      projectId: editActionFields.projectId,
      categoryId: editActionFields.categoryId,
      completed: editActionFields.completed,
      status: editActionFields.status,
      ...fieldsToUpdate
    };

    // Optimistic: update local state immediately
    setEditActionFields(mergedFields);
    setActionItems(prev =>
      prev.map(item =>
        item.id === editingAction.id
          ? {
              ...item,
              title: mergedFields.title,
              description: mergedFields.description,
              deadline: mergedFields.deadline,
              startDate: mergedFields.startDate,
              pic: mergedFields.pic,
              project_id: mergedFields.projectId || item.project_id,
              category_id: mergedFields.categoryId || item.category_id,
              completed: mergedFields.completed,
              status: mergedFields.status
            }
          : item
      )
    );

    try {
      await fetch(`/api/action-items/${editingAction.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: mergedFields.title,
          description: mergedFields.description,
          deadline: mergedFields.deadline,
          startDate: mergedFields.startDate,
          pic: mergedFields.pic,
          project_id: mergedFields.projectId === '' ? null : mergedFields.projectId,
          category_id: mergedFields.categoryId === '' ? null : mergedFields.categoryId,
          completed: mergedFields.completed,
          status: mergedFields.status
        })
      });
    } catch (error) {
      console.error('Error auto-saving action item:', error);
    }
  };

  const handleCompleteAction = async (createNew: boolean = false) => {
    if (!editingAction) return;

    const assocProj = projects.find(p => p.id === editingAction.project_id);
    const completedId = editingAction.id;

    // Optimistic: close modal and remove from pending list immediately
    setEditingAction(null);
    setShowCompleteDropdown(false);
    setActionItems(prev =>
      prev.map(item =>
        item.id === completedId ? { ...item, completed: true, status: 'done' } : item
      )
    );

    if (createNew) {
      setNewAction(prev => ({
        ...prev,
        projectId: assocProj ? assocProj.id : '',
        categoryId: '',
        status: statusesList[0] || 'open'
      }));
      setShowAddForm(true);
    }

    try {
      await fetch(`/api/action-items/${completedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: true, status: 'done' })
      });
    } catch (error) {
      console.error('Error completing action item:', error);
      // Rollback on failure
      setActionItems(prev =>
        prev.map(item =>
          item.id === completedId ? { ...item, completed: false, status: 'open' } : item
        )
      );
    }
  };

  const handleCreateAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAction.title) return;

    const formData = { ...newAction };
    setNewAction({ title: '', description: '', deadline: '', startDate: '', pic: 'Wildan', projectId: '', categoryId: '', status: statusesList[0] || 'open' });
    setShowAddForm(false);

    try {
      const res = await fetch('/api/action-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          deadline: formData.deadline,
          startDate: formData.startDate,
          pic: formData.pic,
          completed: formData.status === 'done',
          status: formData.status,
          project_id: formData.projectId || null,
          category_id: formData.categoryId || null
        })
      });
      if (res.ok) {
        const created = await res.json();
        setActionItems(prev => [created, ...prev]);
      }
    } catch (error) {
      console.error('Error creating action item:', error);
    }
  };

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
          {[1, 2, 3, 4, 5].map((i) => (
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
        </div>
      </div>
    );
  }

  // Derived metrics
  const activeProjects = projects.filter(
    (p) => p.current_stage_index < p.stages.length
  );
  const activeProjectsCount = activeProjects.length;

  const pendingActions = actionItems.filter((item) => !item.completed);
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
    if (!item.deadline || item.completed) return false;
    const d = new Date(item.deadline);
    return d >= monday && d <= sunday;
  });
  const dueThisWeekCount = dueThisWeekActions.length;

  const formatShortDate = (d: Date) => {
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  };
  const weekRangeStr = `${formatShortDate(monday)} - ${formatShortDate(sunday)}`;

  // Daily plan stats for today
  const dailyPlanDoneCount = dailyPlanToday.filter(e => e.status === 'done').length;
  const dailyPlanTotalCount = dailyPlanToday.length;

  // Urgent actions (deadline in the next 7 days or overdue, sorted by date)
  const urgentActions = [...pendingActions]
    .filter((item) => item.deadline)
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 5);

  const recentNotes = notes.slice(0, 3);

  // Filter search results dynamically
  const filteredProjects = searchQuery.trim() === '' ? [] : projects.filter(
    p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
         p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
         p.pic.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredUrgentActions = searchQuery.trim() === '' 
    ? urgentActions 
    : actionItems.filter(
        item => item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.pic.toLowerCase().includes(searchQuery.toLowerCase())
      );

  const filteredRecentNotes = searchQuery.trim() === ''
    ? recentNotes
    : notes.filter(
        note => note.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (note.folder && note.folder.toLowerCase().includes(searchQuery.toLowerCase()))
      );

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

      {/* Header + Search inline */}
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>💡 PM Workspace</h1>
          <p className={styles.subtitle}>Satu tempat terorganisir untuk memantau rencana harian, proyek, action items, dan catatan Anda.</p>
        </div>
        {/* Inline compact search */}
        <div className={styles.searchBarInline}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            className={styles.globalSearchInput}
            placeholder="Cari..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className={styles.clearSearchBtn} onClick={() => setSearchQuery('')}>
              ×
            </button>
          )}
        </div>
      </header>

      {/* Metrics Row (5 Cards) */}
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
          <p className={styles.metricSub}>Selesaikan segera secepatnya</p>
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
            <span className={styles.metricLabel}>Rencana Hari Ini</span>
            <span className={styles.metricIcon}>🎯</span>
          </div>
          <p className={styles.metricVal}>{dailyPlanDoneCount}/{dailyPlanTotalCount}</p>
          <p className={styles.metricSub}>{dailyPlanTotalCount > 0 ? `${Math.round((dailyPlanDoneCount / dailyPlanTotalCount) * 100)}% selesai` : 'Belum ada rencana'}</p>
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

      {/* Matching Projects Row (only when searching and projects match) */}
      {searchQuery.trim() !== '' && filteredProjects.length > 0 && (
        <section className={styles.searchResultsSection}>
          <h2 className={styles.sectionTitle}>📁 Proyek yang Cocok ({filteredProjects.length})</h2>
          <div className={styles.projectsRow}>
            {filteredProjects.map((proj) => (
              <Link href={`/projects/${proj.id}`} key={proj.id} className={styles.projectCard}>
                <div className={styles.projectCardHeader}>
                  <h3>{proj.name}</h3>
                  <span className={styles.projectPic}>PIC: {proj.pic}</span>
                </div>
                <p>{proj.description || 'Tidak ada deskripsi.'}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Content Grid */}
      <div className={styles.mainGrid}>
        {/* Left Column: Today's Plan & Active Projects */}
        <div className={styles.columnGroup}>
          {/* Today's Plan (Mini) */}
          <section className={styles.cardSection}>
            <div className={styles.sectionHeader}>
              <h2>📅 Rencana Hari Ini</h2>
              <Link href="/daily-plan" className={styles.viewAll}>Kelola Rencana</Link>
            </div>
            <div className={styles.sectionCard}>
              {dailyPlanToday.length === 0 ? (
                <div className={styles.emptyState}>
                  <span className={styles.emptyIcon}>📅</span>
                  <p>Belum ada rencana kegiatan untuk hari ini.</p>
                  <Link href="/daily-plan" className={styles.createLink}>Buat Rencana Harian</Link>
                </div>
              ) : (
                <div className={styles.compactRowList}>
                  {dailyPlanToday.slice(0, 5).map((entry) => (
                    <div key={entry.id} className={styles.compactItemRow}>
                      <span className={styles.compactTime}>{entry.startTime}–{entry.endTime}</span>
                      <span className={`${styles.compactTypeDot} ${styles[entry.type]}`}>
                        {entry.type === 'task' ? '🎯' : entry.type === 'meeting' ? '🤝' : '🧘'}
                      </span>
                      <span className={styles.compactTitle}>{entry.title}</span>
                      <span className={`${styles.compactStatus} ${styles[`status_${entry.status}`]}`}>
                        {entry.status === 'open' ? 'Open' : entry.status === 'in_progress' ? 'On' : entry.status === 'done' ? '✓' : entry.status}
                      </span>
                    </div>
                  ))}
                  {dailyPlanToday.length > 5 && (
                    <Link href="/daily-plan" className={styles.compactMoreLink}>
                      +{dailyPlanTotalCount - 5} rencana lainnya →
                    </Link>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Active Projects */}
          <section className={styles.cardSection}>
            <div className={styles.sectionHeader}>
              <h2>📁 Proyek Aktif</h2>
              <Link href="/projects" className={styles.viewAll}>Semua Proyek</Link>
            </div>
            <div className={styles.projectsContainer}>
              {activeProjects.length === 0 ? (
                <div className={styles.emptyState}>
                  <span className={styles.emptyIcon}>📁</span>
                  <p>Tidak ada proyek aktif saat ini.</p>
                  <Link href="/projects" className={styles.createLink}>Buat proyek baru</Link>
                </div>
              ) : (
                activeProjects.map((proj) => {
                  const totalStages = proj.stages.length;
                  const progressPct = totalStages > 0 
                    ? Math.round((proj.current_stage_index / totalStages) * 100)
                    : 0;
                  const currentStageName = proj.stages[proj.current_stage_index]?.name || 'Selesai';
                  
                  return (
                    <Link href={`/projects/${proj.id}`} key={proj.id} className={styles.projectProgressCard}>
                      <div className={styles.projectProgressHeader}>
                        <h3>{proj.name}</h3>
                        <span className={styles.progressValue}>{progressPct}%</span>
                      </div>
                      <span className={styles.currentStageLabel}>Tahap: <strong>{currentStageName}</strong></span>
                      <div className={styles.progressBarWrapper}>
                        <div 
                          className={styles.progressBarFill} 
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <p className={styles.projectProgressDesc}>
                        {proj.description ? proj.description.substring(0, 60) + '...' : 'Tidak ada deskripsi.'}
                      </p>
                    </Link>
                  );
                })
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Urgent Action Items & Recent Notes */}
        <div className={styles.columnGroup}>
          {/* Urgent Action Items */}
          <section className={styles.cardSection}>
            <div className={styles.sectionHeader}>
              <h2>{searchQuery.trim() !== '' ? 'Hasil Cari Action Items ⚡' : 'Action Items Mendesak ⚡'}</h2>
              <Link href="/action-items" className={styles.viewAll}>Lihat semua</Link>
            </div>
            <div className={styles.sectionCard}>
              {filteredUrgentActions.length === 0 ? (
                <div className={styles.emptyState}>
                  <span className={styles.emptyIcon}>🎉</span>
                  <p>{searchQuery.trim() !== '' ? 'Tidak ada hasil pencarian.' : 'Tidak ada action item mendesak.'}</p>
                  <Link href="/action-items" className={styles.createLink}>Buat Action Item baru</Link>
                </div>
              ) : (
                <div className={styles.compactRowList}>
                  {filteredUrgentActions.map((item) => {
                    const overdue = isOverdue(item.deadline);
                    const resolvedStatus = getResolvedStatus(item, statusesList);
                    const badge = getStatusLabelDynamic(resolvedStatus, statusesList);
                    return (
                      <div
                        key={item.id}
                        className={`${styles.compactItemRow} ${overdue ? styles.compactItemOverdue : ''} ${item.completed ? styles.compactItemDone : ''}`}
                        onClick={() => handleStartEdit(item)}
                      >
                        <span
                          className={styles.compactStatus}
                          style={{
                            backgroundColor: badge.styles.backgroundColor,
                            color: badge.styles.color,
                            borderColor: badge.styles.borderColor,
                            borderWidth: '1px',
                            borderStyle: 'solid'
                          }}
                        >
                          {badge.text}
                        </span>
                        <span className={styles.compactTitle}>{item.title}</span>
                        {overdue && <span className={styles.compactOverdueDot} title="Overdue">!</span>}
                        <span className={styles.compactDate}>{formatDate(item.deadline)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Recent Notes */}
          <section className={styles.cardSection}>
            <div className={styles.sectionHeader}>
              <h2>{searchQuery.trim() !== '' ? 'Hasil Cari Catatan 📝' : 'Catatan Terakhir Diedit 📝'}</h2>
              <Link href="/notes" className={styles.viewAll}>Buka Notes</Link>
            </div>
            <div className={styles.notesGrid}>
              {filteredRecentNotes.length === 0 ? (
                <div className={styles.emptyNotesState}>
                  <span className={styles.emptyIcon}>✍️</span>
                  <p>{searchQuery.trim() !== '' ? 'Tidak ada hasil pencarian.' : 'Belum ada notes dibuat.'}</p>
                  <Link href="/notes" className={styles.createLink}>Buat note pertama</Link>
                </div>
              ) : (
                filteredRecentNotes.map((note) => (
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

      {/* Edit Action Item Modal */}
      {editingAction && (
        <div className={styles.modalOverlay} onClick={() => setEditingAction(null)}>
          <div className={`${styles.modal} animate-popover`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Detail Action Item 📋</h3>
              <button className={styles.closeBtn} onClick={() => setEditingAction(null)}>×</button>
            </div>
            <form onSubmit={(e) => e.preventDefault()}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label>Judul Tugas *</label>
                  <input
                    type="text"
                    required
                    value={editActionFields.title}
                    onChange={(e) => setEditActionFields({ ...editActionFields, title: e.target.value })}
                    onBlur={() => handleAutoSaveAction({ title: editActionFields.title })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Deskripsi / Keterangan</label>
                  <textarea
                    value={editActionFields.description}
                    onChange={(e) => setEditActionFields({ ...editActionFields, description: e.target.value })}
                    onBlur={() => handleAutoSaveAction({ description: editActionFields.description })}
                    rows={3}
                  />
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>PIC (freetext)</label>
                    <input
                      type="text"
                      value={editActionFields.pic}
                      onChange={(e) => setEditActionFields({ ...editActionFields, pic: e.target.value })}
                      onBlur={() => handleAutoSaveAction({ pic: editActionFields.pic })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Start Date</label>
                    <input
                      type="date"
                      value={editActionFields.startDate}
                      onChange={(e) => {
                        const nextSD = e.target.value;
                        setEditActionFields({ ...editActionFields, startDate: nextSD });
                        handleAutoSaveAction({ startDate: nextSD });
                      }}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Deadline</label>
                    <input
                      type="date"
                      value={editActionFields.deadline}
                      onChange={(e) => {
                        const nextD = e.target.value;
                        setEditActionFields({ ...editActionFields, deadline: nextD });
                        handleAutoSaveAction({ deadline: nextD });
                      }}
                    />
                  </div>
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Kaitkan ke Project</label>
                    <select
                      value={editActionFields.projectId}
                      onChange={(e) => {
                        const nextProj = e.target.value;
                        setEditActionFields({ ...editActionFields, projectId: nextProj, categoryId: '' });
                        handleAutoSaveAction({ projectId: nextProj, categoryId: '' });
                      }}
                    >
                      <option value="">-- Tanpa Project (Standalone) --</option>
                      {projects.map((proj) => (
                        <option key={proj.id} value={proj.id}>
                          {proj.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {editActionFields.projectId && (
                    <div className={styles.formGroup}>
                      <label>Kategori</label>
                      <select
                        value={editActionFields.categoryId}
                        onChange={(e) => {
                          const nextCat = e.target.value;
                          setEditActionFields({ ...editActionFields, categoryId: nextCat });
                          handleAutoSaveAction({ categoryId: nextCat });
                        }}
                      >
                        <option value="">Tanpa Kategori</option>
                        {projects.find(p => p.id === editActionFields.projectId)?.categories?.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className={styles.formGroup} style={{ marginTop: '12px' }}>
                  <label>Status</label>
                  <select
                    value={editActionFields.status}
                    onChange={(e) => {
                      const nextStatus = e.target.value;
                      const norm = nextStatus.toLowerCase();
                      const isDone = norm === 'done' || norm === 'selesai' || norm === 'complete' || norm === 'success';
                      setEditActionFields({ ...editActionFields, status: nextStatus, completed: isDone });
                      handleAutoSaveAction({ status: nextStatus, completed: isDone });
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      fontSize: '14px',
                      outline: 'none',
                      backgroundColor: 'white'
                    }}
                  >
                    {statusesList.map((st) => {
                      const badge = getStatusLabelDynamic(st, statusesList);
                      return (
                        <option key={st} value={st}>
                          {badge.text}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelBtn} onClick={() => { setEditingAction(null); setShowCompleteDropdown(false); }}>
                  Tutup
                </button>
                {!editActionFields.completed && (
                  <div className={styles.splitBtnContainer}>
                    <button 
                      type="button" 
                      className={styles.splitMainBtn} 
                      onClick={() => handleCompleteAction(false)}
                    >
                      Selesaikan Task
                    </button>
                    <button 
                      type="button" 
                      className={styles.splitArrowBtn} 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowCompleteDropdown(!showCompleteDropdown);
                      }}
                    >
                      ▼
                    </button>
                    {showCompleteDropdown && (
                      <>
                        <div 
                          className={styles.dropdownOverlay} 
                          onClick={() => setShowCompleteDropdown(false)} 
                        />
                        <div className={styles.splitDropdownMenu}>
                          <button 
                            type="button" 
                            onClick={() => handleCompleteAction(true)}
                          >
                            ⚡ Selesaikan & Buat Baru
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Action Item Modal */}
      {showAddForm && (
        <div className={styles.modalOverlay} onClick={() => setShowAddForm(false)}>
          <div className={`${styles.modal} animate-popover`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Buat Action Item Baru ⚡</h3>
              <button type="button" className={styles.closeBtn} onClick={() => setShowAddForm(false)}>×</button>
            </div>
            <form onSubmit={handleCreateAction}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label>Judul Tugas *</label>
                  <input
                    type="text"
                    required
                    value={newAction.title}
                    onChange={(e) => setNewAction({ ...newAction, title: e.target.value })}
                    placeholder="Tulis nama tugas..."
                  />
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>PIC (freetext)</label>
                    <input
                      type="text"
                      value={newAction.pic}
                      onChange={(e) => setNewAction({ ...newAction, pic: e.target.value })}
                      placeholder="Nama PIC..."
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Start Date</label>
                    <input
                      type="date"
                      value={newAction.startDate}
                      onChange={(e) => setNewAction({ ...newAction, startDate: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Deadline</label>
                    <input
                      type="date"
                      value={newAction.deadline}
                      onChange={(e) => setNewAction({ ...newAction, deadline: e.target.value })}
                    />
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label>Status</label>
                  <select
                    value={newAction.status}
                    onChange={(e) => setNewAction({ ...newAction, status: e.target.value })}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      fontSize: '14px',
                      outline: 'none',
                      backgroundColor: 'white'
                    }}
                  >
                    {statusesList.map((st) => {
                      const badge = getStatusLabelDynamic(st, statusesList);
                      return (
                        <option key={st} value={st}>
                          {badge.text}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Kaitkan ke Project</label>
                  <select
                    value={newAction.projectId}
                    onChange={(e) => setNewAction({ ...newAction, projectId: e.target.value, categoryId: '' })}
                  >
                    <option value="">-- Tanpa Project (Standalone) --</option>
                    {projects.map((proj) => (
                      <option key={proj.id} value={proj.id}>
                        {proj.name}
                      </option>
                    ))}
                  </select>
                </div>
                {newAction.projectId && (
                  <div className={styles.formGroup}>
                    <label>Kategori</label>
                    <select
                      value={newAction.categoryId}
                      onChange={(e) => setNewAction({ ...newAction, categoryId: e.target.value })}
                    >
                      <option value="">Tanpa Kategori</option>
                      {projects.find(p => p.id === newAction.projectId)?.categories?.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className={styles.formGroup}>
                  <label>Deskripsi / Keterangan</label>
                  <textarea
                    value={newAction.description}
                    onChange={(e) => setNewAction({ ...newAction, description: e.target.value })}
                    placeholder="Keterangan tambahan..."
                    rows={3}
                  />
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowAddForm(false)}>
                  Batal
                </button>
                <button type="submit" className={styles.submitBtn}>
                  Buat Action Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

