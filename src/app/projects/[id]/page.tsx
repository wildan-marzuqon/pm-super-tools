'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

interface ProjectStage {
  id: string;
  name: string;
  order: number;
  completed_at?: string;
}

interface ActionItem {
  id: string;
  title: string;
  description: string;
  deadline: string;
  pic: string;
  completed: boolean;
  category_id?: string;
  category_name?: string;
  project_id?: string;
  source_note_id?: string;
  created_at?: string;
}

interface Artifact {
  id: string;
  label: string;
  url: string;
  description: string;
}

interface ProjectDetail {
  id: string;
  name: string;
  description: string;
  deadline: string;
  pic: string;
  current_stage_index: number;
  stages: ProjectStage[];
  actionItems: ActionItem[];
  artifacts: Artifact[];
  categories: Array<{ id: string; name: string }>;
  created_at: string;
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'actions' | 'artifacts' | 'settings'>('overview');

  // Search & Sort states for action items
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('deadline-asc');

  // Loading States
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [isAddingAction, setIsAddingAction] = useState(false);
  const [isAddingArtifact, setIsAddingArtifact] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSavingStages, setIsSavingStages] = useState(false);
  const [isDeletingProject, setIsDeletingProject] = useState(false);

  // Edit Modals / Forms state
  const [editingAction, setEditingAction] = useState<ActionItem | null>(null);
  const [editActionFields, setEditActionFields] = useState({
    title: '',
    description: '',
    deadline: '',
    pic: 'Wildan',
    categoryId: '',
    completed: false
  });

  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  // Dropdown state for task completion
  const [showCompleteDropdown, setShowCompleteDropdown] = useState(false);

  const [editingArtifact, setEditingArtifact] = useState<Artifact | null>(null);
  const [editArtifactFields, setEditArtifactFields] = useState({
    label: '',
    url: '',
    description: ''
  });

  // New Action Item Form State
  const [newAction, setNewAction] = useState({
    title: '',
    description: '',
    deadline: '',
    pic: 'Wildan',
    categoryId: ''
  });
  const [showAddActionForm, setShowAddActionForm] = useState(false);

  // New Artifact Form State
  const [newArtifact, setNewArtifact] = useState({
    label: '',
    url: '',
    description: ''
  });
  const [showAddArtForm, setShowAddArtForm] = useState(false);

  // Project Settings form state
  const [settingsName, setSettingsName] = useState('');
  const [settingsDesc, setSettingsDesc] = useState('');
  const [settingsPic, setSettingsPic] = useState('');
  const [settingsDeadline, setSettingsDeadline] = useState('');
  
  // Custom Stages builder list state
  const [stagesList, setStagesList] = useState<Array<{ id?: string; name: string; completed_at?: string }>>([]);
  const [newStageName, setNewStageName] = useState('');

  const fetchProjectDetail = async () => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data);
        // Initialize settings states
        setSettingsName(data.name);
        setSettingsDesc(data.description);
        setSettingsPic(data.pic);
        setSettingsDeadline(data.deadline ? data.deadline.substring(0, 10) : '');
        setStagesList(data.stages);
      } else {
        router.push('/projects');
      }
    } catch (error) {
      console.error('Error fetching project detail:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectDetail();
  }, [id]);

  // Handle Advance Stage
  const handleAdvanceStage = async () => {
    if (!project || isAdvancing) return;
    setIsAdvancing(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/advance`, {
        method: 'POST'
      });
      if (res.ok) {
        fetchProjectDetail();
      }
    } catch (error) {
      console.error('Error advancing project stage:', error);
    } finally {
      setIsAdvancing(false);
    }
  };

  // Add Action Item
  const handleAddAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAction.title.trim() || !project || isAddingAction) return;

    setIsAddingAction(true);
    try {
      const res = await fetch('/api/action-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newAction.title,
          description: newAction.description,
          deadline: newAction.deadline,
          pic: newAction.pic,
          project_id: project.id,
          category_id: newAction.categoryId || null
        })
      });

      if (res.ok) {
        setNewAction({ title: '', description: '', deadline: '', pic: 'Wildan', categoryId: '' });
        setShowAddActionForm(false);
        fetchProjectDetail();
      }
    } catch (error) {
      console.error('Error adding action item:', error);
    } finally {
      setIsAddingAction(false);
    }
  };

  // Start Action Item Edit
  const handleStartEditAction = (item: ActionItem) => {
    setEditingAction(item);
    setEditActionFields({
      title: item.title,
      description: item.description || '',
      deadline: item.deadline ? item.deadline.substring(0, 10) : '',
      pic: item.pic || '',
      categoryId: item.category_id || '',
      completed: item.completed
    });
  };

  // Auto-Save Action Item Details (Auto-saves on blur or select changes)
  const handleAutoSaveAction = async (fieldsToUpdate: Partial<typeof editActionFields>) => {
    if (!editingAction) return;

    // Update local state instantly so the UI feels responsive
    setEditActionFields(prev => ({
      ...prev,
      ...fieldsToUpdate
    }));

    try {
      const mergedFields = {
        title: editActionFields.title,
        description: editActionFields.description,
        deadline: editActionFields.deadline,
        pic: editActionFields.pic,
        category_id: editActionFields.categoryId || null,
        completed: editActionFields.completed,
        ...fieldsToUpdate
      };

      await fetch(`/api/action-items/${editingAction.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: mergedFields.title,
          description: mergedFields.description,
          deadline: mergedFields.deadline,
          pic: mergedFields.pic,
          category_id: mergedFields.category_id === '' ? null : mergedFields.category_id,
          completed: mergedFields.completed
        })
      });

      // Refresh project to update the title or labels on the card immediately
      fetchProjectDetail();
    } catch (error) {
      console.error('Error auto-saving action item:', error);
    }
  };

  // Complete Action Item inside the modal
  const handleCompleteAction = async (createNew: boolean = false) => {
    if (!editingAction) return;
    try {
      const res = await fetch(`/api/action-items/${editingAction.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completed: true
        })
      });
      if (res.ok) {
        setEditingAction(null);
        setShowCompleteDropdown(false);
        fetchProjectDetail();
        
        if (createNew) {
          setShowAddActionForm(true);
          setTimeout(() => {
            const el = document.getElementById('addActionFormSection');
            if (el) {
              el.scrollIntoView({ behavior: 'smooth' });
            }
          }, 100);
        }
      }
    } catch (error) {
      console.error('Error completing action item:', error);
    }
  };

  // Category Add/Remove handlers
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim() || !project || isAddingCategory) return;
    setIsAddingCategory(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName.trim() })
      });
      if (res.ok) {
        setNewCategoryName('');
        fetchProjectDetail();
      }
    } catch (error) {
      console.error('Error adding category:', error);
    } finally {
      setIsAddingCategory(false);
    }
  };

  const handleRemoveCategory = async (catId: string) => {
    if (!project) return;
    if (!confirm('Hapus kategori ini? Tugas yang terkait akan dikosongkan kategorinya.')) return;
    try {
      const res = await fetch(`/api/projects/${project.id}/categories`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: catId })
      });
      if (res.ok) {
        fetchProjectDetail();
      }
    } catch (error) {
      console.error('Error removing category:', error);
    }
  };

  // Delete Action Item
  const handleDeleteActionItem = async (itemId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus Action Item ini?')) return;
    try {
      const res = await fetch(`/api/action-items/${itemId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchProjectDetail();
      }
    } catch (error) {
      console.error('Error deleting action item:', error);
    }
  };

  // Add Artifact Link
  const handleAddArtifact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newArtifact.label.trim() || !newArtifact.url.trim() || !project || isAddingArtifact) return;

    setIsAddingArtifact(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/artifacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newArtifact)
      });

      if (res.ok) {
        setNewArtifact({ label: '', url: '', description: '' });
        setShowAddArtForm(false);
        fetchProjectDetail();
      }
    } catch (error) {
      console.error('Error creating artifact:', error);
    } finally {
      setIsAddingArtifact(false);
    }
  };

  // Start Artifact Edit
  const handleStartEditArtifact = (art: Artifact) => {
    setEditingArtifact(art);
    setEditArtifactFields({
      label: art.label,
      url: art.url,
      description: art.description || ''
    });
  };

  // Save Artifact Edit
  const handleSaveArtifactEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArtifact || !project) return;
    try {
      const res = await fetch(`/api/projects/${project.id}/artifacts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingArtifact.id,
          label: editArtifactFields.label,
          url: editArtifactFields.url,
          description: editArtifactFields.description
        })
      });
      if (res.ok) {
        setEditingArtifact(null);
        fetchProjectDetail();
      }
    } catch (error) {
      console.error('Error saving artifact edit:', error);
    }
  };

  // Delete Artifact Link
  const handleDeleteArtifact = async (artifactId: string) => {
    if (!confirm('Hapus link artifact ini?')) return;
    try {
      const res = await fetch(`/api/projects/${id}/artifacts`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: artifactId })
      });
      if (res.ok) {
        fetchProjectDetail();
      }
    } catch (error) {
      console.error('Error deleting artifact:', error);
    }
  };

  // Save Settings (General project info)
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || isSavingSettings) return;

    setIsSavingSettings(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: settingsName,
          description: settingsDesc,
          pic: settingsPic,
          deadline: settingsDeadline
        })
      });
      if (res.ok) {
        alert('Settings berhasil disimpan!');
        fetchProjectDetail();
      }
    } catch (error) {
      console.error('Error updating project settings:', error);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Delete Project
  const handleDeleteProject = async () => {
    if (isDeletingProject) return;
    if (!confirm('Apakah Anda yakin ingin menghapus seluruh proyek ini beserta semua stages dan artifacts terkait?')) return;

    setIsDeletingProject(true);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        router.push('/projects');
      }
    } catch (error) {
      console.error('Error deleting project:', error);
    } finally {
      setIsDeletingProject(false);
    }
  };

  // Stage builder operations
  const handleAddStage = () => {
    if (!newStageName.trim()) return;
    setStagesList((prev) => [...prev, { name: newStageName }]);
    setNewStageName('');
  };

  const handleRemoveStage = (index: number) => {
    setStagesList((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleStageNameChange = (index: number, name: string) => {
    setStagesList((prev) =>
      prev.map((s, idx) => (idx === index ? { ...s, name } : s))
    );
  };

  const handleSaveStages = async () => {
    if (!project || isSavingStages) return;
    if (stagesList.length === 0) {
      alert('Project harus memiliki minimal 1 stage.');
      return;
    }
    
    setIsSavingStages(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/stages`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stages: stagesList })
      });

      if (res.ok) {
        alert('Stages berhasil disimpan!');
        fetchProjectDetail();
      }
    } catch (error) {
      console.error('Error saving stages:', error);
    } finally {
      setIsSavingStages(false);
    }
  };

  // Helper formatting date
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Check if date is overdue
  const isOverdue = (dateStr: string, completed: boolean) => {
    if (!dateStr || completed) return false;
    const deadline = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return deadline < today;
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.topNav}>
          <div className="skeleton" style={{ height: '28px', width: '120px', borderRadius: '4px' }}></div>
        </div>

        <header className={styles.header}>
          <div>
            <div className="skeleton" style={{ height: '36px', width: '300px', marginBottom: '8px' }}></div>
            <div className="skeleton" style={{ height: '16px', width: '450px' }}></div>
          </div>
          <div className={styles.headerMeta}>
            <div className={styles.headerMetaBox}>
              <div className="skeleton" style={{ height: '10px', width: '50px', marginBottom: '4px' }}></div>
              <div className="skeleton" style={{ height: '14px', width: '80px' }}></div>
            </div>
            <div className={styles.headerMetaBox}>
              <div className="skeleton" style={{ height: '10px', width: '50px', marginBottom: '4px' }}></div>
              <div className="skeleton" style={{ height: '14px', width: '80px' }}></div>
            </div>
          </div>
        </header>

        <section className={styles.visualizerCard}>
          <div className={styles.visualizerHeader} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div className="skeleton" style={{ height: '18px', width: '180px' }}></div>
            <div className="skeleton" style={{ height: '32px', width: '140px', borderRadius: '6px' }}></div>
          </div>
          <div className={styles.stepPipeline} style={{ marginTop: '16px' }}>
            <div className="skeleton" style={{ height: '40px', width: '100%' }}></div>
          </div>
        </section>

        <div className={styles.tabsMenu}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" style={{ height: '36px', width: '100px', marginRight: '8px', borderRadius: '6px' }}></div>
          ))}
        </div>

        <div className={styles.tabContentArea}>
          <div className={styles.overviewGrid}>
            <div className={styles.contentCard}>
              <div className="skeleton" style={{ height: '16px', width: '120px', marginBottom: '12px' }}></div>
              <div className="skeleton" style={{ height: '100px', width: '100%' }}></div>
            </div>
            <div className={styles.contentCard}>
              <div className="skeleton" style={{ height: '16px', width: '120px', marginBottom: '12px' }}></div>
              <div className="skeleton" style={{ height: '100px', width: '100%' }}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!project) return null;

  const currentStage = project.stages[project.current_stage_index] || null;
  const isCompleted = project.current_stage_index >= project.stages.length;

  return (
    <div className={`${styles.container} animate-fade-in`}>
      {/* Back button & Title */}
      <div className={styles.topNav}>
        <Link href="/projects" className={styles.backBtn}>
          ← Kembali ke Pipeline
        </Link>
      </div>

      <header className={styles.header}>
        <div>
          <span className={styles.categoryBadge}>PROJECT DETAIL</span>
          <h1 className={styles.projTitle}>{project.name}</h1>
          <p className={styles.projDesc}>{project.description || 'Tidak ada deskripsi.'}</p>
        </div>
        <div className={styles.headerMeta}>
          <div className={styles.headerMetaBox}>
            <span className={styles.metaLabel}>PIC UTAMA</span>
            <span className={styles.metaVal}>{project.pic || 'Unassigned'}</span>
          </div>
          <div className={styles.headerMetaBox}>
            <span className={styles.metaLabel}>DEADLINE</span>
            <span className={styles.metaVal}>{formatDate(project.deadline)}</span>
          </div>
        </div>
      </header>

      {/* Step Visualizer Bar (Horizontal Pipeline) */}
      <section className={styles.visualizerCard}>
        <div className={styles.visualizerHeader}>
          <h3>Progress Pipeline Project</h3>
          {!isCompleted && currentStage ? (
            <button className={styles.advanceBtn} onClick={handleAdvanceStage}>
              ⚡ Selesaikan Tahap: <b>{currentStage.name}</b> →
            </button>
          ) : (
            <span className={styles.completeBanner}>🎉 PROYEK TELAH LIVE / SELESAI!</span>
          )}
        </div>

        <div className={styles.stepPipeline}>
          {project.stages.map((stage, idx) => {
            const isStageDone = idx < project.current_stage_index || stage.completed_at;
            const isStageActive = idx === project.current_stage_index;

            return (
              <div key={stage.id} className={styles.stepNodeItem}>
                {idx > 0 && (
                  <div
                    className={`${styles.stepLine} ${
                      idx <= project.current_stage_index ? styles.stepLineDone : ''
                    }`}
                  />
                )}
                <div className={styles.nodeWrapper}>
                  <div
                    className={`${styles.nodeCircle} ${
                      isStageDone ? styles.nodeDone : isStageActive ? styles.nodeActive : styles.nodeFuture
                    }`}
                  >
                    {isStageDone ? '✓' : idx + 1}
                  </div>
                  <span className={`${styles.nodeName} ${isStageActive ? styles.nodeNameActive : ''}`}>
                    {stage.name}
                  </span>
                  {stage.completed_at && (
                    <span className={styles.completedAtDate}>
                      {new Date(stage.completed_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Tabs Menu */}
      <div className={styles.tabsMenu}>
        <button
          onClick={() => setActiveTab('overview')}
          className={`${styles.tabBtn} ${activeTab === 'overview' ? styles.activeTab : ''}`}
        >
          📄 Overview
        </button>
        <button
          onClick={() => setActiveTab('actions')}
          className={`${styles.tabBtn} ${activeTab === 'actions' ? styles.activeTab : ''}`}
        >
          📋 Action Items ({project.actionItems.length})
        </button>
        <button
          onClick={() => setActiveTab('artifacts')}
          className={`${styles.tabBtn} ${activeTab === 'artifacts' ? styles.activeTab : ''}`}
        >
          🔗 Artifacts ({project.artifacts.length})
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`${styles.tabBtn} ${activeTab === 'settings' ? styles.activeTab : ''}`}
        >
          ⚙️ Settings & Stages
        </button>
      </div>

      {/* Tab Contents */}
      <div className={styles.tabContentArea}>
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className={styles.overviewGrid}>
            <div className={styles.contentCard}>
              <h3>Detail Ringkasan Proyek</h3>
              <table className={styles.overviewTable}>
                <tbody>
                  <tr>
                    <th>PIC Proyek</th>
                    <td>{project.pic || '-'}</td>
                  </tr>
                  <tr>
                    <th>Deadline Target</th>
                    <td>{formatDate(project.deadline)}</td>
                  </tr>
                  <tr>
                    <th>Status Sekarang</th>
                    <td>
                      {isCompleted ? (
                        <span className={styles.statusLiveTag}>Live / Selesai</span>
                      ) : (
                        <span className={styles.statusActiveTag}>Sedang dalam tahap: {currentStage?.name}</span>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <th>Dibuat Pada</th>
                    <td>{formatDate(project.created_at)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className={styles.contentCard}>
              <h3>Statistik Aktivitas</h3>
              <div className={styles.statsRow}>
                <div className={styles.statBox}>
                  <p className={styles.statVal}>
                    {project.actionItems.filter((a) => a.completed).length} / {project.actionItems.length}
                  </p>
                  <p className={styles.statLabel}>Action Items Selesai</p>
                </div>
                <div className={styles.statBox}>
                  <p className={styles.statVal}>{project.artifacts.length}</p>
                  <p className={styles.statLabel}>Total Artifact Links</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ACTION ITEMS */}
        {activeTab === 'actions' && (
          <div className={styles.actionsTabContainer}>
            <div className={styles.tabSectionHeader}>
              <h3>Action Items Terkait Project</h3>
              <button
                className={styles.addTabBtn}
                onClick={() => setShowAddActionForm(true)}
              >
                + Action Item Baru
              </button>
            </div>

            {/* Add Action Item Modal */}
            {showAddActionForm && (
              <div className={styles.modalOverlay} onClick={() => setShowAddActionForm(false)}>
                <div className={`${styles.modal} animate-popover`} onClick={(e) => e.stopPropagation()}>
                  <div className={styles.modalHeader}>
                    <h3>Buat Action Item Baru ⚡</h3>
                    <button type="button" className={styles.closeBtn} onClick={() => setShowAddActionForm(false)}>×</button>
                  </div>
                  <form onSubmit={handleAddAction}>
                    <div className={styles.modalBody}>
                      <div className={styles.formGroup}>
                        <label>Judul Tugas *</label>
                        <input
                          type="text"
                          required
                          value={newAction.title}
                          onChange={(e) => setNewAction({ ...newAction, title: e.target.value })}
                          placeholder="Apa yang perlu diselesaikan?"
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
                        <label>Kategori</label>
                        <select
                          value={newAction.categoryId}
                          onChange={(e) => setNewAction({ ...newAction, categoryId: e.target.value })}
                        >
                          <option value="">Tanpa Kategori</option>
                          {project.categories && project.categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </div>
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
                      <button type="button" className={styles.cancelBtn} onClick={() => setShowAddActionForm(false)}>
                        Batal
                      </button>
                      <button type="submit" className={styles.submitBtn} disabled={isAddingAction}>
                        {isAddingAction ? 'Menyimpan...' : 'Buat Action Item'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Search & Sort Toolbar */}
            <div className={styles.toolbarRow}>
              <div className={styles.searchBox}>
                <span className={styles.searchIcon}>🔍</span>
                <input
                  type="text"
                  placeholder="Cari action item..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                />
              </div>
              <div className={styles.sortBox}>
                <span className={styles.sortLabel}>Urutkan:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className={styles.sortSelect}
                >
                  <option value="deadline-asc">Deadline Terdekat</option>
                  <option value="deadline-desc">Deadline Terjauh</option>
                  <option value="title-asc">Nama A-Z</option>
                  <option value="title-desc">Nama Z-A</option>
                  <option value="status-asc">Belum Selesai Dahulu</option>
                  <option value="status-desc">Selesai Dahulu</option>
                </select>
              </div>
            </div>

            {/* Actions List */}
            <div className={styles.itemsCard}>
              {(() => {
                const filteredAndSorted = (project.actionItems || [])
                  .filter((item) => {
                    const query = searchQuery.toLowerCase().trim();
                    if (!query) return true;
                    return (
                      item.title.toLowerCase().includes(query) ||
                      (item.description && item.description.toLowerCase().includes(query)) ||
                      (item.pic && item.pic.toLowerCase().includes(query)) ||
                      (item.category_name && item.category_name.toLowerCase().includes(query))
                    );
                  })
                  .sort((a, b) => {
                    if (sortBy === 'deadline-asc') {
                      if (!a.deadline) return 1;
                      if (!b.deadline) return -1;
                      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
                    }
                    if (sortBy === 'deadline-desc') {
                      if (!a.deadline) return 1;
                      if (!b.deadline) return -1;
                      return new Date(b.deadline).getTime() - new Date(a.deadline).getTime();
                    }
                    if (sortBy === 'title-asc') {
                      return a.title.localeCompare(b.title, 'id');
                    }
                    if (sortBy === 'title-desc') {
                      return b.title.localeCompare(a.title, 'id');
                    }
                    if (sortBy === 'status-asc') {
                      return (a.completed ? 1 : 0) - (b.completed ? 1 : 0);
                    }
                    if (sortBy === 'status-desc') {
                      return (b.completed ? 1 : 0) - (a.completed ? 1 : 0);
                    }
                    return 0;
                  });

                if (filteredAndSorted.length === 0) {
                  return (
                    <div className={styles.emptyState}>
                      <span className={styles.emptyIcon}>🎉</span>
                      <p>{searchQuery ? 'Tidak ada action item yang sesuai pencarian.' : 'Belum ada Action Item untuk proyek ini.'}</p>
                    </div>
                  );
                }

                return (
                  <div className={styles.itemsList}>
                    {filteredAndSorted.map((item) => {
                      const overdue = isOverdue(item.deadline, item.completed);
                      return (
                        <div
                          key={item.id}
                          className={`${styles.itemRow} ${item.completed ? styles.itemRowDone : ''}`}
                          onClick={() => handleStartEditAction(item)}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className={styles.itemContent}>
                            <h3 className={styles.itemTitle}>{item.title}</h3>
                            {item.description && <p className={styles.itemDesc}>{item.description}</p>}
                            <div className={styles.itemMeta}>
                              <span className={styles.picBadge}>PIC: {item.pic}</span>
                              {item.category_name && (
                                <span className={styles.categoryTagBadge} title={item.category_name}>
                                  🏷️ {item.category_name}
                                </span>
                              )}
                              {item.source_note_id && (
                                <Link 
                                  href={`/notes?id=${item.source_note_id}`} 
                                  className={styles.noteLink}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  📝 Lihat Note Asal
                                </Link>
                              )}
                            </div>
                          </div>

                          <div className={styles.itemDateCol}>
                            <span className={`${styles.itemDate} ${overdue ? styles.overdue : ''}`}>
                              {formatDate(item.deadline)}
                            </span>
                            {overdue && <span className={styles.overdueBadge}>OVERDUE</span>}
                          </div>

                          <div className={styles.itemActions}>
                            <button
                              className={styles.deleteBtn}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteActionItem(item.id);
                              }}
                            >
                              🗑️ Hapus
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* TAB 3: ARTIFACTS */}
        {activeTab === 'artifacts' && (
          <div className={styles.artifactsTabContainer}>
            <div className={styles.tabSectionHeader}>
              <h3>Dokumen & Artifacts Proyek</h3>
              <button
                className={styles.addTabBtn}
                onClick={() => setShowAddArtForm(!showAddArtForm)}
              >
                {showAddArtForm ? 'Batal' : 'Tambah Baru'}
              </button>
            </div>

            {/* Inline Add Artifact Link Form */}
            {showAddArtForm && (
              <form onSubmit={handleAddArtifact} className={styles.inlineForm}>
                <h4>Tambah Dokumen / Link</h4>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Label / Judul Dokumen *</label>
                    <input
                      type="text"
                      required
                      value={newArtifact.label}
                      onChange={(e) => setNewArtifact({ ...newArtifact, label: e.target.value })}
                      placeholder="Contoh: Folder Google Drive POC"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>URL Link *</label>
                    <input
                      type="url"
                      required
                      value={newArtifact.url}
                      onChange={(e) => setNewArtifact({ ...newArtifact, url: e.target.value })}
                      placeholder="https://drive.google.com/..."
                    />
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label>Deskripsi Singkat</label>
                  <input
                    type="text"
                    value={newArtifact.description}
                    onChange={(e) => setNewArtifact({ ...newArtifact, description: e.target.value })}
                    placeholder="Dokumen ini berisi tentang..."
                  />
                </div>
                <button type="submit" className={styles.submitBtn} disabled={isAddingArtifact}>
                  {isAddingArtifact ? 'Menyimpan...' : 'Simpan Link Artifact'}
                </button>
              </form>
            )}

            {/* Artifacts List as structured table list */}
            <div className={styles.artifactsList}>
              {project.artifacts.length === 0 ? (
                <p className={styles.emptyTabMsg}>Belum ada link dokumen yang disimpan.</p>
              ) : (
                <div className={styles.artifactsTableContainer}>
                  <table className={styles.artifactsTable}>
                    <thead>
                      <tr>
                        <th>Dokumen / Link</th>
                        <th>Deskripsi</th>
                        <th>URL</th>
                        <th style={{ width: '150px', textAlign: 'center' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {project.artifacts.map((art) => (
                        <tr key={art.id}>
                          <td className={styles.artLabelCell}>
                            <span className={styles.artIconCell}>🔗</span>
                            <a href={art.url} target="_blank" rel="noopener noreferrer" className={styles.artTableLink}>
                              {art.label}
                            </a>
                          </td>
                          <td>{art.description || '-'}</td>
                          <td className={styles.artUrlCell} title={art.url}>
                            <span className={styles.artUrlText}>{art.url}</span>
                          </td>
                          <td>
                            <div className={styles.artTableActions}>
                              <button className={styles.artEditBtn} onClick={() => handleStartEditArtifact(art)}>
                                ✏️ Edit
                              </button>
                              <button className={styles.artDeleteBtn} onClick={() => handleDeleteArtifact(art.id)}>
                                🗑️ Hapus
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: SETTINGS & STAGES CUSTOMIZATION */}
        {activeTab === 'settings' && (
          <div className={styles.settingsGrid}>
            {/* General Info Settings */}
            <div className={styles.contentCard}>
              <h3>Ubah Detail Proyek</h3>
              <form onSubmit={handleSaveSettings} className={styles.settingsForm}>
                <div className={styles.formGroup}>
                  <label>Nama Proyek</label>
                  <input
                    type="text"
                    required
                    value={settingsName}
                    onChange={(e) => setSettingsName(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Deskripsi Proyek</label>
                  <textarea
                    value={settingsDesc}
                    onChange={(e) => setSettingsDesc(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>PIC Utama</label>
                  <input
                    type="text"
                    value={settingsPic}
                    onChange={(e) => setSettingsPic(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Deadline Proyek</label>
                  <input
                    type="date"
                    value={settingsDeadline}
                    onChange={(e) => setSettingsDeadline(e.target.value)}
                  />
                </div>
                <button type="submit" className={styles.saveSettingsBtn} disabled={isSavingSettings}>
                  {isSavingSettings ? 'Menyimpan...' : 'Simpan Perubahan Detail'}
                </button>
              </form>
              <div className={styles.dangerZone}>
                <h4>Danger Zone 🚨</h4>
                <p>Hapus proyek ini secara permanen dari Workspace.</p>
                <button className={styles.deleteProjBtn} onClick={handleDeleteProject} disabled={isDeletingProject}>
                  {isDeletingProject ? 'Menghapus...' : 'Hapus Proyek Ini'}
                </button>
              </div>
            </div>

            {/* Custom Pipeline Stages Builder */}
            <div className={styles.contentCard}>
              <h3>Kustomisasi Pipeline Stages</h3>
              <p className={styles.settingsDescText}>
                Ubah daftar tahapan visual proyek ini. Tahapan akan ditampilkan horizontal sesuai urutannya.
              </p>

              <div className={styles.stagesManager}>
                {stagesList.map((stage, idx) => (
                  <div key={stage.id || idx} className={styles.stageManagerRow}>
                    <span className={styles.stageOrderNumber}>{idx + 1}</span>
                    <input
                      type="text"
                      value={stage.name}
                      onChange={(e) => handleStageNameChange(idx, e.target.value)}
                      placeholder="Nama Tahapan..."
                      className={styles.stageManagerInput}
                    />
                    <button className={styles.removeStageRowBtn} onClick={() => handleRemoveStage(idx)}>
                      ×
                    </button>
                  </div>
                ))}

                {/* Add new stage row */}
                <div className={styles.addStageRow}>
                  <input
                    type="text"
                    placeholder="Tambah tahapan baru (contoh: Demo)..."
                    value={newStageName}
                    onChange={(e) => setNewStageName(e.target.value)}
                    className={styles.addStageInput}
                  />
                  <button className={styles.addStageRowBtn} onClick={handleAddStage}>
                    + Tambah
                  </button>
                </div>

                <button className={styles.saveStagesBtn} onClick={handleSaveStages} disabled={isSavingStages}>
                  {isSavingStages ? 'Menyimpan...' : 'Simpan Pipeline Stages baru'}
                </button>
              </div>
            </div>

            {/* Project Categories Manager */}
            <div className={styles.contentCard}>
              <h3>Kategori Project</h3>
              <p className={styles.settingsDescText}>
                Tambahkan kategori kustom untuk mengelompokkan Action Items pada proyek ini.
              </p>

              <div className={styles.stagesManager}>
                {project.categories && project.categories.map((cat) => (
                  <div key={cat.id} className={styles.stageManagerRow}>
                    <span className={styles.stageOrderNumber}>🏷️</span>
                    <span className={styles.stageManagerInput} style={{ display: 'flex', alignItems: 'center', fontWeight: 600 }}>
                      {cat.name}
                    </span>
                    <button className={styles.removeStageRowBtn} onClick={() => handleRemoveCategory(cat.id)}>
                      ×
                    </button>
                  </div>
                ))}

                {/* Add new category form */}
                <form onSubmit={handleAddCategory} className={styles.addStageRow}>
                  <input
                    type="text"
                    placeholder="Tambah kategori baru (contoh: Design)..."
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className={styles.addStageInput}
                  />
                  <button type="submit" className={styles.addStageRowBtn} disabled={isAddingCategory}>
                    + Tambah
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
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
                <div className={styles.formGroup}>
                  <label>Kategori</label>
                  <select
                    value={editActionFields.categoryId}
                    onChange={(e) => {
                      const catId = e.target.value;
                      setEditActionFields({ ...editActionFields, categoryId: catId });
                      handleAutoSaveAction({ categoryId: catId });
                    }}
                  >
                    <option value="">Tanpa Kategori</option>
                    {project.categories && project.categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
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

      {/* Edit Artifact Modal */}
      {editingArtifact && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} animate-popover`}>
            <div className={styles.modalHeader}>
              <h3>Ubah Dokumen / Artifact 🔗</h3>
              <button className={styles.closeBtn} onClick={() => setEditingArtifact(null)}>×</button>
            </div>
            <form onSubmit={handleSaveArtifactEdit}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label>Label / Judul Dokumen *</label>
                  <input
                    type="text"
                    required
                    value={editArtifactFields.label}
                    onChange={(e) => setEditArtifactFields({ ...editArtifactFields, label: e.target.value })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>URL Link *</label>
                  <input
                    type="url"
                    required
                    value={editArtifactFields.url}
                    onChange={(e) => setEditArtifactFields({ ...editArtifactFields, url: e.target.value })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Deskripsi Singkat</label>
                  <input
                    type="text"
                    value={editArtifactFields.description}
                    onChange={(e) => setEditArtifactFields({ ...editArtifactFields, description: e.target.value })}
                  />
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelBtn} onClick={() => setEditingArtifact(null)}>
                  Batal
                </button>
                <button type="submit" className={styles.submitBtn}>
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
