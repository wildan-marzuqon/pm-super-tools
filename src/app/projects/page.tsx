'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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
  current_stage_index: number;
  stages: ProjectStage[];
  currentStage: ProjectStage | null;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  
  // Modal / Form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    deadline: '',
    pic: 'Wildan',
    stagesInput: 'Ideation, POC, Kick Off, Implementation, Live'
  });

  const fetchProjects = async () => {
    try {
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
          stagesInput: 'Ideation, POC, Kick Off, Implementation, Live'
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
          <h1 className={styles.title}>
            <span className="material-symbols-outlined" style={{ fontSize: '28px', color: 'var(--primary)', verticalAlign: 'middle', marginRight: '8px' }}>folder_copy</span>
            <span style={{ verticalAlign: 'middle' }}>Project Pipeline Tracker</span>
          </h1>
          <p className={styles.subtitle}>Kelola status progress dan detail tahapan project startup Anda.</p>
        </div>
        <button className={styles.addBtn} onClick={() => setShowAddModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
          <span>Proyek Baru</span>
        </button>
      </header>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className={styles.emptyState}>
          <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--outline-variant)', marginBottom: '8px' }}>folder_off</span>
          <p>Belum ada proyek yang dilacak.</p>
          <button className={styles.addBtnLarge} onClick={() => setShowAddModal(true)}>
            Mulai Tambah Proyek
          </button>
        </div>
      ) : (
        <div className={styles.projectsGrid}>
          {projects.map((proj) => {
            const isCompleted = isProjectLive(proj);
            const activeStage = proj.stages[proj.current_stage_index] || null;
            
            return (
              <div key={proj.id} className={styles.projCard}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.projName}>{proj.name}</h3>
                  <div className={`${styles.statusBadge} ${isCompleted ? styles.liveBadge : styles.activeBadge}`} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {isCompleted ? (
                      <>
                        <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>check_circle</span>
                        <span>LIVE</span>
                      </>
                    ) : (
                      <>
                        <span className="relative flex h-1.5 w-1.5 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
                        </span>
                        <span>{activeStage?.name || 'Selesai'}</span>
                      </>
                    )}
                  </div>
                </div>

                <p className={styles.projDesc}>
                  {proj.description || 'Tidak ada deskripsi proyek.'}
                </p>

                {/* Step Indicator (Pipeline View) */}
                <div className={styles.pipelineContainer}>
                  <div className={styles.stagesTextRow}>
                    {proj.stages.map((stage, idx) => {
                      const isStageActive = idx === proj.current_stage_index;
                      return (
                        <span 
                          key={stage.id} 
                          className={`${styles.stageTextSpan} ${isStageActive ? styles.stageTextActive : ''}`}
                        >
                          {stage.name}
                        </span>
                      );
                    })}
                  </div>
                  
                  <div className={styles.segmentedBar}>
                    {proj.stages.map((stage, idx) => {
                      const isStageDone = idx < proj.current_stage_index;
                      const isStageActive = idx === proj.current_stage_index;
                      
                      return (
                        <div 
                          key={stage.id}
                          className={`${styles.barSegment} ${
                            isStageDone ? styles.segmentDone : isStageActive ? styles.segmentActive : styles.segmentFuture
                          }`}
                          style={{ width: `${100 / proj.stages.length}%` }}
                          title={stage.name}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Card Meta */}
                <div className={styles.cardMeta} style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '8px', padding: '10px', backgroundColor: 'var(--surface-container-low)', borderRadius: '6px', border: '1px solid var(--outline-variant)' }}>
                  <div className={styles.metaItem}>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--outline)', marginRight: '4px' }}>person</span>
                    <span className={styles.metaVal}>{proj.pic || '-'}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--outline)', marginRight: '4px' }}>schedule</span>
                    <span className={styles.metaVal}>{formatDate(proj.deadline)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className={styles.cardActions}>
                  <Link href={`/projects/${proj.id}`} className={styles.detailBtn} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <span>Detail & Dashboard</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>bolt</span>
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
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>folder</span>
                <span>Tambah Proyek Baru</span>
              </h3>
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
