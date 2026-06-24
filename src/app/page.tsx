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

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'open':
      return { text: '⏳ Open', styles: { backgroundColor: '#FFFBEB', color: '#D97706', borderColor: '#FEF3C7' } };
    case 'in_progress':
      return { text: '⚙️ In Progress', styles: { backgroundColor: '#EFF6FF', color: '#2563EB', borderColor: '#BFDBFE' } };
    case 'done':
      return { text: '✓ Selesai', styles: { backgroundColor: '#ECFDF5', color: '#059669', borderColor: '#A7F3D0' } };
    default:
      return { text: 'Open', styles: { backgroundColor: '#F3F4F6', color: '#4B5563', borderColor: '#E5E7EB' } };
  }
};

export default function Dashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Time & Date State
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState<Date | null>(null);

  // Edit/Detail Action Modal State
  const [editingAction, setEditingAction] = useState<ActionItem | null>(null);
  const [editActionFields, setEditActionFields] = useState({
    title: '',
    description: '',
    deadline: '',
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

  const handleStartEdit = (item: ActionItem) => {
    setEditingAction(item);
    setEditActionFields({
      title: item.title,
      description: item.description || '',
      deadline: item.deadline ? item.deadline.substring(0, 10) : '',
      pic: item.pic || '',
      projectId: item.project_id || '',
      categoryId: item.category_id || '',
      completed: item.completed,
      status: item.completed ? 'done' : (item.status === 'done' ? 'open' : (item.status || 'open'))
    });
  };

  const handleAutoSaveAction = async (fieldsToUpdate: Partial<typeof editActionFields>) => {
    if (!editingAction) return;

    const mergedFields = {
      title: editActionFields.title,
      description: editActionFields.description,
      deadline: editActionFields.deadline,
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
        status: 'open'
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
    setNewAction({ title: '', description: '', deadline: '', pic: 'Wildan', projectId: '', categoryId: '', status: 'open' });
    setShowAddForm(false);

    try {
      const res = await fetch('/api/action-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          deadline: formData.deadline,
          pic: formData.pic,
          completed: formData.status === 'done',
          status: formData.status,
          project_id: formData.projectId || null,
          category_id: formData.categoryId || null
        })
      });
      if (res.ok) {
        const created = await res.json();
        // Optimistic: insert the newly created item into state directly
        setActionItems(prev => {
          const updated = [created, ...prev];
          // Re-sort: items with deadline come first (nearest first), then no-deadline
          return updated.sort((a, b) => {
            if (a.deadline && b.deadline) return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
            if (a.deadline) return -1;
            if (b.deadline) return 1;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
        });
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
      {/* Header */}
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>💡 PM Workspace</h1>
          <p className={styles.subtitle}>Satu tempat terorganisir untuk memantau notes & pipeline proyek startup AI.</p>
        </div>
        <div className={styles.actions}>
          <button className={styles.addBtn} onClick={() => setShowAddForm(true)}>
            + Action Item Baru
          </button>
          <Link href="/notes" className={styles.primaryBtn}>
            <span>+ Note Baru</span>
          </Link>
          <Link href="/projects" className={styles.secondaryBtn}>
            <span>+ Proyek Baru</span>
          </Link>
        </div>
      </header>

      {/* Global Search Bar */}
      <div className={styles.searchBarContainer}>
        <div className={styles.searchBarWrapper}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            className={styles.globalSearchInput}
            placeholder="Cari proyek, action items, atau catatan di workspace..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className={styles.clearSearchBtn} onClick={() => setSearchQuery('')}>
              ×
            </button>
          )}
        </div>
      </div>

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
        {/* Left Column: Urgent Action Items */}
        <section className={styles.cardSection}>
          <div className={styles.sectionHeader}>
            <h2>{searchQuery.trim() !== '' ? 'Hasil Cari Action Items ⚡' : 'Urgent Action Items ⚡'}</h2>
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
              <div className={styles.actionList}>
                {filteredUrgentActions.map((item) => {
                  const associatedProject = projects.find((p) => p.id === item.project_id);
                  const overdue = isOverdue(item.deadline);
                  return (
                    <div 
                      key={item.id} 
                      className={`${styles.actionItemRow} ${item.completed ? styles.actionItemRowDone : ''}`}
                      onClick={() => handleStartEdit(item)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className={styles.actionMain}>
                        <p className={styles.actionTitle}>{item.title}</p>
                        <div className={styles.actionMeta}>
                          {(() => {
                            const badge = getStatusLabel(item.completed ? 'done' : (item.status === 'done' ? 'open' : (item.status || 'open')));
                            return (
                              <span
                                style={{
                                  ...badge.styles,
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  border: '1px solid',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                }}
                              >
                                {badge.text}
                              </span>
                            );
                          })()}
                          <span className={styles.picTag}>PIC: {item.pic || 'Unassigned'}</span>
                          {item.category_name && (
                            <span className={styles.categoryTagBadge} title={item.category_name}>
                              🏷️ {item.category_name}
                            </span>
                          )}
                          {associatedProject && (
                            <span className={styles.projectTagBadge} title={associatedProject.name}>
                              📁 {associatedProject.name}
                            </span>
                          )}
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
            <h2>{searchQuery.trim() !== '' ? 'Hasil Cari Catatan 📝' : 'Notes Terakhir Diedit 📝'}</h2>
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
                      setEditActionFields({ ...editActionFields, status: nextStatus, completed: nextStatus === 'done' });
                      handleAutoSaveAction({ status: nextStatus, completed: nextStatus === 'done' });
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
                    <option value="open">⏳ Open</option>
                    <option value="in_progress">⚙️ In Progress</option>
                    <option value="done">✓ Selesai</option>
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
                    <option value="open">⏳ Open</option>
                    <option value="in_progress">⚙️ In Progress</option>
                    <option value="done">✓ Selesai</option>
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
