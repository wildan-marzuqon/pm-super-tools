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
    if (!project) return;
    try {
      const res = await fetch(`/api/projects/${project.id}/advance`, {
        method: 'POST'
      });
      if (res.ok) {
        fetchProjectDetail();
      }
    } catch (error) {
      console.error('Error advancing project stage:', error);
    }
  };

  // Add Action Item
  const handleAddAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAction.title.trim() || !project) return;

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

  // Add Artifact Link
  const handleAddArtifact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newArtifact.label.trim() || !newArtifact.url.trim() || !project) return;

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
    if (!project) return;

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
    }
  };

  // Delete Project
  const handleDeleteProject = async () => {
    if (!confirm('Apakah Anda yakin ingin menghapus seluruh proyek ini beserta semua stages dan artifacts terkait?')) return;
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        router.push('/projects');
      }
    } catch (error) {
      console.error('Error deleting project:', error);
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
    if (!project) return;
    if (stagesList.length === 0) {
      alert('Project harus memiliki minimal 1 stage.');
      return;
    }
    
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
                onClick={() => setShowAddActionForm(!showAddActionForm)}
              >
                {showAddActionForm ? 'Batal' : '+ Action Item Baru'}
              </button>
            </div>

            {/* Inline Add Action Item Form */}
            {showAddActionForm && (
              <form onSubmit={handleAddAction} className={styles.inlineForm}>
                <h4>Tambah Action Item</h4>
                <div className={styles.formRow}>
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
                    rows={2}
                  />
                </div>
                <button type="submit" className={styles.submitBtn}>
                  Simpan Action Item
                </button>
              </form>
            )}

            {/* Actions List */}
            <div className={styles.actionsList}>
              {project.actionItems.length === 0 ? (
                <p className={styles.emptyTabMsg}>Belum ada Action Item untuk proyek ini.</p>
              ) : (
                project.actionItems.map((item) => (
                  <div key={item.id} className={`${styles.actionCard} ${item.status === 'done' ? styles.actionDoneCard : ''}`}>
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
                        <span className={styles.actionPic}>PIC: {item.pic}</span>
                        {item.deadline && (
                          <span className={styles.actionDeadline}>Deadline: {formatDate(item.deadline)}</span>
                        )}
                      </div>
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
                onClick={() => setShowAddArtForm(!showAddArtForm)}
              >
                {showAddArtForm ? 'Batal' : '+ Tambah Link GDrive / Notion'}
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
                <button type="submit" className={styles.submitBtn}>
                  Simpan Link Artifact
                </button>
              </form>
            )}

            {/* Artifacts List */}
            <div className={styles.artifactsGrid}>
              {project.artifacts.length === 0 ? (
                <p className={styles.emptyTabMsg}>Belum ada link dokumen yang disimpan.</p>
              ) : (
                project.artifacts.map((art) => (
                  <div key={art.id} className={styles.artifactCard}>
                    <div className={styles.artIcon}>🔗</div>
                    <div className={styles.artContent}>
                      <h4>
                        <a href={art.url} target="_blank" rel="noopener noreferrer" className={styles.artLink}>
                          {art.label}
                        </a>
                      </h4>
                      {art.description && <p className={styles.artDesc}>{art.description}</p>}
                      <span className={styles.artUrl}>{art.url}</span>
                    </div>
                    <button className={styles.artDeleteBtn} onClick={() => handleDeleteArtifact(art.id)}>
                      🗑️ Hapus
                    </button>
                  </div>
                ))
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
                <button type="submit" className={styles.saveSettingsBtn}>
                  Simpan Perubahan Detail
                </button>
              </form>
              <div className={styles.dangerZone}>
                <h4>Danger Zone 🚨</h4>
                <p>Hapus proyek ini secara permanen dari Workspace.</p>
                <button className={styles.deleteProjBtn} onClick={handleDeleteProject}>
                  Hapus Proyek Ini
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

                <button className={styles.saveStagesBtn} onClick={handleSaveStages}>
                  Simpan Pipeline Stages baru
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
