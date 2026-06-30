'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

interface ProjectStage {
  id: string;
  name: string;
  completed_at?: string;
  order: number;
}

interface Project {
  id: string;
  name: string;
  description: string;
  deadline: string;
  pic: string;
  visibility: string;
  current_stage_index: number;
  stages: ProjectStage[];
  currentStage: ProjectStage | null;
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'live'>('all');
  
  // Modal / Form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    deadline: '',
    pic: 'Wildan',
    stagesInput: 'Ideation, POC, Kick Off, Implementation, Live',
    visibility: 'public'
  });

  const fetchProjects = async () => {
    try {
      const meRes = await fetch('/api/auth/me');
      if (!meRes.ok) {
        router.push('/login');
        return;
      }
      const meData = await meRes.json();
      const user = meData.user;
      const roles = user?.roles || [];
      const caps = user?.capabilities || [];

      if (!roles.includes('Super Admin') && !caps.includes('view_projects')) {
        router.push('/unauthorized');
        return;
      }

      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name.trim() || isCreatingProject) return;

    setIsCreatingProject(true);
    // Parse stages input
    const parsedStages = newProject.stagesInput
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== '');

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProject.name,
          description: newProject.description,
          deadline: newProject.deadline,
          pic: newProject.pic,
          visibility: newProject.visibility,
          stages: parsedStages
        })
      });

      if (res.ok) {
        setShowAddModal(false);
        setNewProject({
          name: '',
          description: '',
          deadline: '',
          pic: 'Wildan',
          stagesInput: 'Ideation, POC, Kick Off, Implementation, Live',
          visibility: 'public'
        });
        fetchProjects();
      }
    } catch (error) {
      console.error('Error creating project:', error);
    } finally {
      setIsCreatingProject(false);
    }
  };

  // Helper to format date
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Check if project is completed (all stages completed)
  const isProjectLive = (proj: Project) => {
    return proj.current_stage_index >= proj.stages.length;
  };

  // Filter projects dynamically
  const filteredProjects = projects.filter((proj) => {
    const matchesSearch =
      proj.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (proj.description && proj.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (proj.pic && proj.pic.toLowerCase().includes(searchQuery.toLowerCase()));

    const isCompleted = isProjectLive(proj);
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && !isCompleted) ||
      (statusFilter === 'live' && isCompleted);

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <div className="skeleton" style={{ height: '32px', width: '220px', marginBottom: '8px' }}></div>
            <div className="skeleton" style={{ height: '16px', width: '380px' }}></div>
          </div>
        </header>

        <div className={styles.projectsGrid}>
          {[1, 2].map((i) => (
            <div key={i} className={styles.projCard}>
              <div className={styles.cardHeader} style={{ justifyContent: 'space-between', display: 'flex', width: '100%' }}>
                <div className="skeleton" style={{ height: '22px', width: '180px' }}></div>
                <div className="skeleton" style={{ height: '18px', width: '70px', borderRadius: '9999px' }}></div>
              </div>
              <div className="skeleton" style={{ height: '14px', width: '100%', marginTop: '12px' }}></div>
              <div className="skeleton" style={{ height: '14px', width: '80%' }}></div>
              <div className={styles.pipelineContainer} style={{ marginTop: '16px' }}>
                <div className="skeleton" style={{ height: '10px', width: '60px', marginBottom: '6px' }}></div>
                <div className="skeleton" style={{ height: '24px', width: '100%' }}></div>
              </div>
              <div className="skeleton" style={{ height: '40px', width: '100%', borderRadius: '8px', marginTop: '12px' }}></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} animate-fade-in`}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>📁 Project Pipeline Tracker</h1>
          <p className={styles.subtitle}>Kelola status progress dan detail tahapan project startup Anda.</p>
        </div>
        <button className={styles.addBtn} onClick={() => setShowAddModal(true)}>
          + Proyek Baru
        </button>
      </header>

      {/* Search & Status Filters */}
      <section className={styles.filterToolbar}>
        <div className={styles.searchWrapper}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Cari nama proyek, deskripsi, atau PIC..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className={styles.statusFilters}>
          <button
            className={`${styles.statusFilterBtn} ${statusFilter === 'all' ? styles.activeStatusFilter : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            Semua
          </button>
          <button
            className={`${styles.statusFilterBtn} ${statusFilter === 'active' ? styles.activeStatusFilter : ''}`}
            onClick={() => setStatusFilter('active')}
          >
            🚀 Aktif
          </button>
          <button
            className={`${styles.statusFilterBtn} ${statusFilter === 'live' ? styles.activeStatusFilter : ''}`}
            onClick={() => setStatusFilter('live')}
          >
            ✓ Live / Selesai
          </button>
        </div>
      </section>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>📁</span>
          <p>{searchQuery || statusFilter !== 'all' ? 'Tidak ada proyek yang sesuai pencarian.' : 'Belum ada proyek yang dilacak.'}</p>
          <button className={styles.addBtnLarge} onClick={() => setShowAddModal(true)}>
            Mulai Tambah Proyek
          </button>
        </div>
      ) : (
        <div className={styles.projectsGrid}>
          {filteredProjects.map((proj) => {
            const isCompleted = isProjectLive(proj);
            const activeStage = proj.stages[proj.current_stage_index] || null;
            
            return (
              <div key={proj.id} className={styles.projCard}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.projName}>{proj.name}</h3>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className={`${styles.statusBadge} ${isCompleted ? styles.liveBadge : styles.activeBadge}`}>
                      {isCompleted ? '✓ LIVE' : `Tahap: ${activeStage?.name || 'Selesai'}`}
                    </span>
                    <span className={`${styles.visibilityBadge} ${proj.visibility === 'private' ? styles.privateBadge : styles.publicBadge}`}>
                      {proj.visibility === 'private' ? '🔒 Privat' : '🔓 Publik'}
                    </span>
                  </div>
                </div>

                <p className={styles.projDesc}>
                  {proj.description || 'Tidak ada deskripsi proyek.'}
                </p>

                {/* Step Indicator (Pipeline View) */}
                <div className={styles.pipelineContainer}>
                  <p className={styles.pipelineLabel}>Tahapan Proyek:</p>
                  <div className={styles.stepIndicator}>
                    {proj.stages.map((stage, idx) => {
                      const isStageDone = idx < proj.current_stage_index;
                      const isStageActive = idx === proj.current_stage_index;
                      
                      return (
                        <div key={stage.id} className={styles.stepNodeContainer}>
                          {/* Connection line */}
                          {idx > 0 && (
                            <div 
                              className={`${styles.stepLine} ${
                                idx <= proj.current_stage_index ? styles.stepLineDone : ''
                              }`} 
                            />
                          )}
                          <div 
                            className={`${styles.stepNode} ${
                              isStageDone ? styles.nodeDone : isStageActive ? styles.nodeActive : styles.nodeFuture
                            }`}
                            title={stage.name}
                          >
                            {isStageDone ? '✓' : idx + 1}
                            <span className={styles.nodeTooltip}>{stage.name}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Card Meta */}
                <div className={styles.cardMeta}>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>PIC:</span>
                    <span className={styles.metaVal}>{proj.pic || '-'}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Deadline:</span>
                    <span className={styles.metaVal}>{formatDate(proj.deadline)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className={styles.cardActions}>
                  <Link href={`/projects/${proj.id}`} className={styles.detailBtn}>
                    Buka Detail & Dashboard ⚡
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Project Modal */}
      {showAddModal && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} animate-popover`}>
            <div className={styles.modalHeader}>
              <h3>Tambah Proyek Baru 📁</h3>
              <button className={styles.closeBtn} onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <form onSubmit={handleAddProject}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label>Nama Proyek *</label>
                  <input
                    type="text"
                    required
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                    placeholder="Contoh: Chatbot AI Customer Service"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Deskripsi Proyek</label>
                  <textarea
                    value={newProject.description}
                    onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                    placeholder="Penjelasan singkat tujuan proyek..."
                    rows={3}
                  />
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>PIC (freetext)</label>
                    <input
                      type="text"
                      value={newProject.pic}
                      onChange={(e) => setNewProject({ ...newProject, pic: e.target.value })}
                      placeholder="Nama PIC..."
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Deadline Proyek</label>
                    <input
                      type="date"
                      value={newProject.deadline}
                      onChange={(e) => setNewProject({ ...newProject, deadline: e.target.value })}
                    />
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label>Visibilitas Proyek</label>
                  <select
                    value={newProject.visibility}
                    onChange={(e) => setNewProject({ ...newProject, visibility: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid var(--card-border)',
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: 'var(--background)',
                      color: 'var(--foreground)'
                    }}
                  >
                    <option value="public">🔓 Publik (Semua pengguna bisa melihat)</option>
                    <option value="private">🔒 Privat (Hanya Anda & Admin/PM yang bisa melihat)</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Urutan Tahapan / Stages (pisahkan dengan koma)</label>
                  <input
                    type="text"
                    value={newProject.stagesInput}
                    onChange={(e) => setNewProject({ ...newProject, stagesInput: e.target.value })}
                    placeholder="Ideation, POC, Kick Off, Implementation, Live"
                  />
                  <small className={styles.helpText}>
                    Tulis tahapan kustom project kamu dipisah koma. Nanti bisa diubah di Project Settings.
                  </small>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowAddModal(false)}>
                  Batal
                </button>
                <button type="submit" className={styles.submitBtn} disabled={isCreatingProject}>
                  {isCreatingProject ? 'Membuat...' : 'Buat Proyek'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
