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
  status: 'open' | 'in_progress' | 'done';
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
  created_at: string;
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'actions' | 'artifacts' | 'settings'>('overview');

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
    status: 'open' as 'open' | 'in_progress' | 'done'
  });

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
    pic: 'Wildan'
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
          project_id: project.id
        })
      });

      if (res.ok) {
        setNewAction({ title: '', description: '', deadline: '', pic: 'Wildan' });
        setShowAddActionForm(false);
        fetchProjectDetail();
      }
    } catch (error) {
      console.error('Error adding action item:', error);
    } finally {
      setIsAddingAction(false);
    }
  };

  // Toggle Action Item status
  const handleToggleActionStatus = async (item: ActionItem) => {
    const nextStatus = item.status === 'done' ? 'open' : 'done';
    try {
      const res = await fetch(`/api/action-items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        fetchProjectDetail();
      }
    } catch (error) {
      console.error('Error toggling action item status:', error);
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
      status: item.status
    });
  };

  // Save Action Item Edit
  const handleSaveActionEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAction) return;
    try {
      const res = await fetch(`/api/action-items/${editingAction.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editActionFields.title,
          description: editActionFields.description,
          deadline: editActionFields.deadline,
          pic: editActionFields.pic,
          status: editActionFields.status
        })
      });
      if (res.ok) {
        setEditingAction(null);
        fetchProjectDetail();
      }
    } catch (error) {
      console.error('Error saving action item edit:', error);
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
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>history</span>
            <span>Progress Pipeline Project</span>
          </h3>
          {!isCompleted && currentStage ? (
            <button className={styles.advanceBtn} onClick={handleAdvanceStage} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>bolt</span>
              <span>Selesaikan Tahap: <b>{currentStage.name}</b></span>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>chevron_right</span>
            </button>
          ) : (
            <span className={styles.completeBanner} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--success)' }}>check_circle</span>
              <span>PROYEK TELAH LIVE / SELESAI!</span>
            </span>
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
          <span className="material-symbols-outlined" style={{ fontSize: '16px', marginRight: '6px', verticalAlign: 'middle' }}>description</span>
          <span style={{ verticalAlign: 'middle' }}>Ringkasan</span>
        </button>
        <button
          onClick={() => setActiveTab('actions')}
          className={`${styles.tabBtn} ${activeTab === 'actions' ? styles.activeTab : ''}`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px', marginRight: '6px', verticalAlign: 'middle' }}>checklist</span>
          <span style={{ verticalAlign: 'middle' }}>Action Items ({project.actionItems.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('artifacts')}
          className={`${styles.tabBtn} ${activeTab === 'artifacts' ? styles.activeTab : ''}`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px', marginRight: '6px', verticalAlign: 'middle' }}>link</span>
          <span style={{ verticalAlign: 'middle' }}>Dokumen & File ({project.artifacts.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`${styles.tabBtn} ${activeTab === 'settings' ? styles.activeTab : ''}`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px', marginRight: '6px', verticalAlign: 'middle' }}>settings</span>
          <span style={{ verticalAlign: 'middle' }}>Pengaturan & Tahapan</span>
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
                    {project.actionItems.filter((a) => a.status === 'done').length} / {project.actionItems.length}
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

            {/* Modal Add Action Item Form */}
            {showAddActionForm && (
              <div className={styles.modalOverlay}>
                <div className={`${styles.modal} animate-popover`}>
                  <div className={styles.modalHeader}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>playlist_add</span>
                      <span>Tambah Action Item</span>
                    </h3>
                    <button className={styles.closeBtn} onClick={() => setShowAddActionForm(false)}>×</button>
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
                        <label>Keterangan / Detail</label>
                        <textarea
                          value={newAction.description}
                          onChange={(e) => setNewAction({ ...newAction, description: e.target.value })}
                          placeholder="Instruksi detail..."
                          rows={3}
                        />
                      </div>
                    </div>
                    <div className={styles.modalFooter}>
                      <button type="button" className={styles.cancelBtn} onClick={() => setShowAddActionForm(false)}>
                        Batal
                      </button>
                      <button type="submit" className={styles.submitBtn} disabled={isAddingAction}>
                        {isAddingAction ? 'Menyimpan...' : 'Simpan Action Item'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Actions List */}
            <div className={styles.actionsList}>
              {project.actionItems.length === 0 ? (
                <p className={styles.emptyTabMsg}>Belum ada Action Item untuk proyek ini.</p>
              ) : (
                project.actionItems.map((item) => (
                  <div key={item.id} className={`${styles.actionCard} ${item.status === 'done' ? styles.actionDoneCard : ''}`}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flexGrow: 1 }}>
                      <input
                        type="checkbox"
                        checked={item.status === 'done'}
                        onChange={() => handleToggleActionStatus(item)}
                        className={styles.actionCheckbox}
                      />
                      <div className={styles.actionDetails}>
                        <h4 className={styles.actionTitle}>{item.title}</h4>
                        {item.description && <p className={styles.actionDesc}>{item.description}</p>}
                        <div className={styles.actionMetaTags}>
                          <span className={styles.actionPic}>
                            <span className="material-symbols-outlined" style={{ fontSize: '12px', marginRight: '4px', verticalAlign: 'middle' }}>person</span>
                            <span style={{ verticalAlign: 'middle' }}>{item.pic}</span>
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
                          {project && (
                            <span className={styles.projectTagBadge} title={project.name}>
                              <span className="material-symbols-outlined" style={{ fontSize: '12px', marginRight: '4px', verticalAlign: 'middle' }}>folder</span>
                              <span style={{ verticalAlign: 'middle' }}>{project.name}</span>
                            </span>
                          )}
                          {item.deadline && (
                            <span className={styles.actionDeadline}>
                              <span className="material-symbols-outlined" style={{ fontSize: '12px', marginRight: '4px', verticalAlign: 'middle' }}>schedule</span>
                              <span style={{ verticalAlign: 'middle' }}>{formatDate(item.deadline)}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={styles.actionItemRight}>
                      <button className={styles.editActionBtn} onClick={() => handleStartEditAction(item)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>edit</span>
                        <span>Edit</span>
                      </button>
                      <button className={styles.deleteActionBtn} onClick={() => handleDeleteActionItem(item.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>delete</span>
                        <span>Hapus</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
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
                onClick={() => setShowAddArtForm(true)}
              >
                Tambah Baru
              </button>
            </div>

            {/* Modal Add Artifact Link Form */}
            {showAddArtForm && (
              <div className={styles.modalOverlay}>
                <div className={`${styles.modal} animate-popover`}>
                  <div className={styles.modalHeader}>
                    <h3>Tambah Dokumen / Link 🔗</h3>
                    <button className={styles.closeBtn} onClick={() => setShowAddArtForm(false)}>×</button>
                  </div>
                  <form onSubmit={handleAddArtifact}>
                    <div className={styles.modalBody}>
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
                      <div className={styles.formGroup}>
                        <label>Deskripsi Singkat</label>
                        <input
                          type="text"
                          value={newArtifact.description}
                          onChange={(e) => setNewArtifact({ ...newArtifact, description: e.target.value })}
                          placeholder="Dokumen ini berisi tentang..."
                        />
                      </div>
                    </div>
                    <div className={styles.modalFooter}>
                      <button type="button" className={styles.cancelBtn} onClick={() => setShowAddArtForm(false)}>
                        Batal
                      </button>
                      <button type="submit" className={styles.submitBtn} disabled={isAddingArtifact}>
                        {isAddingArtifact ? 'Menyimpan...' : 'Simpan Link Artifact'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
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
                            <span className={`material-symbols-outlined ${styles.artIconCell}`} style={{ fontSize: '18px' }}>link</span>
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
                                <span className="material-symbols-outlined" style={{ fontSize: '14px', marginRight: '4px', verticalAlign: 'middle' }}>edit</span>
                                <span style={{ verticalAlign: 'middle' }}>Edit</span>
                              </button>
                              <button className={styles.artDeleteBtn} onClick={() => handleDeleteArtifact(art.id)}>
                                <span className="material-symbols-outlined" style={{ fontSize: '14px', marginRight: '4px', verticalAlign: 'middle' }}>delete</span>
                                <span style={{ verticalAlign: 'middle' }}>Hapus</span>
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
                <h4>Danger Zone <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '18px', color: 'var(--error)' }}>warning</span></h4>
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
                    <span className="material-symbols-outlined" style={{ color: 'var(--muted-text)', cursor: 'grab', fontSize: '18px' }}>drag_indicator</span>
                    <span className={styles.stageOrderNumber}>{idx + 1}</span>
                    <input
                      type="text"
                      value={stage.name}
                      onChange={(e) => handleStageNameChange(idx, e.target.value)}
                      placeholder="Nama Tahapan..."
                      className={styles.stageManagerInput}
                    />
                    <button className={styles.removeStageRowBtn} onClick={() => handleRemoveStage(idx)} title="Hapus Tahapan">
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
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
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', marginRight: '4px', verticalAlign: 'middle' }}>add</span>
                    <span style={{ verticalAlign: 'middle' }}>Tambah</span>
                  </button>
                </div>

                <button className={styles.saveStagesBtn} onClick={handleSaveStages} disabled={isSavingStages}>
                  {isSavingStages ? 'Menyimpan...' : 'Simpan Pipeline Stages baru'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Action Item Modal */}
      {editingAction && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} animate-popover`}>
            <div className={styles.modalHeader}>
              <h3>
                <span className="material-symbols-outlined" style={{ marginRight: '8px', verticalAlign: 'middle', color: 'var(--primary)' }}>checklist</span>
                <span style={{ verticalAlign: 'middle' }}>Ubah Action Item</span>
              </h3>
              <button className={styles.closeBtn} onClick={() => setEditingAction(null)}>×</button>
            </div>
            <form onSubmit={handleSaveActionEdit}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label>Judul Tugas *</label>
                  <input
                    type="text"
                    required
                    value={editActionFields.title}
                    onChange={(e) => setEditActionFields({ ...editActionFields, title: e.target.value })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Deskripsi / Keterangan</label>
                  <textarea
                    value={editActionFields.description}
                    onChange={(e) => setEditActionFields({ ...editActionFields, description: e.target.value })}
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
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Deadline</label>
                    <input
                      type="date"
                      value={editActionFields.deadline}
                      onChange={(e) => setEditActionFields({ ...editActionFields, deadline: e.target.value })}
                    />
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label>Status</label>
                  <select
                    value={editActionFields.status}
                    onChange={(e) => setEditActionFields({ ...editActionFields, status: e.target.value as 'open' | 'in_progress' | 'done' })}
                  >
                    <option value="open">Open / Belum Mulai</option>
                    <option value="in_progress">In Progress / Sedang Dikerjakan</option>
                    <option value="done">Done / Selesai</option>
                  </select>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelBtn} onClick={() => setEditingAction(null)}>
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

      {/* Edit Artifact Modal */}
      {editingArtifact && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} animate-popover`}>
            <div className={styles.modalHeader}>
              <h3>
                <span className="material-symbols-outlined" style={{ marginRight: '8px', verticalAlign: 'middle', color: 'var(--primary)' }}>link</span>
                <span style={{ verticalAlign: 'middle' }}>Ubah Dokumen / Artifact</span>
              </h3>
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
