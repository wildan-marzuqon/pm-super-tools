'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

interface Project {
  id: string;
  name: string;
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

export default function ActionItemsPage() {
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreatingAction, setIsCreatingAction] = useState(false);

  // Edit action item state
  const [editingAction, setEditingAction] = useState<ActionItem | null>(null);
  const [editActionFields, setEditActionFields] = useState({
    title: '',
    description: '',
    deadline: '',
    pic: 'Wildan',
    projectId: '',
    status: 'open' as 'open' | 'in_progress' | 'done'
  });

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'done'>('pending');
  const [projectFilter, setProjectFilter] = useState<string>('all');

  // Form State for creating action item
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAction, setNewAction] = useState({
    title: '',
    description: '',
    deadline: '',
    pic: 'Wildan',
    projectId: ''
  });

  const fetchData = async () => {
    try {
      const [actionRes, projRes] = await Promise.all([
        fetch('/api/action-items'),
        fetch('/api/projects')
      ]);

      if (actionRes.ok && projRes.ok) {
        setActionItems(await actionRes.json());
        setProjects(await projRes.json());
      }
    } catch (error) {
      console.error('Error fetching action items data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleStatus = async (item: ActionItem) => {
    const nextStatus = item.status === 'done' ? 'open' : 'done';
    try {
      const res = await fetch(`/api/action-items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });

      if (res.ok) {
        // Optimistic UI update
        setActionItems((prev) =>
          prev.map((ai) => (ai.id === item.id ? { ...ai, status: nextStatus } : ai))
        );
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleDeleteAction = async (id: string) => {
    if (!confirm('Hapus action item ini?')) return;
    try {
      const res = await fetch(`/api/action-items/${id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setActionItems((prev) => prev.filter((ai) => ai.id !== id));
      }
    } catch (error) {
      console.error('Error deleting action item:', error);
    }
  };

  const handleCreateAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAction.title.trim() || isCreatingAction) return;

    setIsCreatingAction(true);
    try {
      const res = await fetch('/api/action-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newAction.title,
          description: newAction.description,
          deadline: newAction.deadline,
          pic: newAction.pic,
          project_id: newAction.projectId || undefined
        })
      });

      if (res.ok) {
        setNewAction({ title: '', description: '', deadline: '', pic: 'Wildan', projectId: '' });
        setShowAddForm(false);
        fetchData();
      }
    } catch (error) {
      console.error('Error creating action item:', error);
    } finally {
      setIsCreatingAction(false);
    }
  };

  const handleStartEdit = (item: ActionItem) => {
    setEditingAction(item);
    setEditActionFields({
      title: item.title,
      description: item.description || '',
      deadline: item.deadline ? item.deadline.substring(0, 10) : '',
      pic: item.pic || '',
      projectId: item.project_id || '',
      status: item.status
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
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
          project_id: editActionFields.projectId || null,
          status: editActionFields.status
        })
      });
      if (res.ok) {
        setEditingAction(null);
        fetchData();
      }
    } catch (error) {
      console.error('Error saving action item edit:', error);
    }
  };

  // Helper formatting date
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Check if date is overdue
  const isOverdue = (dateStr: string, status: string) => {
    if (!dateStr || status === 'done') return false;
    const deadline = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return deadline < today;
  };

  // Filter logic
  const filteredItems = actionItems.filter((item) => {
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'pending' && item.status !== 'done') ||
      (statusFilter === 'done' && item.status === 'done');

    const matchesProject =
      projectFilter === 'all' || item.project_id === projectFilter;

    return matchesStatus && matchesProject;
  });

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Memuat Action Items...</p>
      </div>
    );
  }

  return (
    <div className={`${styles.container} animate-fade-in`}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <span className="material-symbols-outlined" style={{ fontSize: '28px', marginRight: '8px', verticalAlign: 'middle', color: 'var(--primary)' }}>checklist</span>
            <span style={{ verticalAlign: 'middle' }}>Action Items Tracker</span>
          </h1>
          <p className={styles.subtitle}>Daftar semua tugas dan to-do list yang perlu diselesaikan.</p>
        </div>
        <button className={styles.addBtn} onClick={() => setShowAddForm(true)}>
          + Action Item Baru
        </button>
      </header>

      {/* Add Action Item Modal */}
      {showAddForm && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} animate-popover`}>
            <div className={styles.modalHeader}>
              <h3>
                <span className="material-symbols-outlined" style={{ marginRight: '8px', verticalAlign: 'middle', color: 'var(--primary)' }}>playlist_add</span>
                <span style={{ verticalAlign: 'middle' }}>Buat Action Item Baru</span>
              </h3>
              <button className={styles.closeBtn} onClick={() => setShowAddForm(false)}>×</button>
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
                  <label>Kaitkan ke Project</label>
                  <select
                    value={newAction.projectId}
                    onChange={(e) => setNewAction({ ...newAction, projectId: e.target.value })}
                  >
                    <option value="">-- Tanpa Project (Standalone) --</option>
                    {projects.map((proj) => (
                      <option key={proj.id} value={proj.id}>
                        {proj.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Keterangan / Keterangan Tambahan</label>
                  <input
                    type="text"
                    value={newAction.description}
                    onChange={(e) => setNewAction({ ...newAction, description: e.target.value })}
                    placeholder="Detail tambahan..."
                  />
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowAddForm(false)}>
                  Batal
                </button>
                <button type="submit" className={styles.submitBtn} disabled={isCreatingAction}>
                  {isCreatingAction ? 'Menyimpan...' : 'Simpan Action Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filters Toolbar */}
      <section className={styles.filterToolbar}>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Status:</span>
          <div className={styles.btnGroup}>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`${styles.filterBtn} ${statusFilter === 'pending' ? styles.activeFilter : ''}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px', marginRight: '4px', verticalAlign: 'middle' }}>hourglass_empty</span>
              <span style={{ verticalAlign: 'middle' }}>Pending</span>
            </button>
            <button
              onClick={() => setStatusFilter('done')}
              className={`${styles.filterBtn} ${statusFilter === 'done' ? styles.activeFilter : ''}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px', marginRight: '4px', verticalAlign: 'middle' }}>task_alt</span>
              <span style={{ verticalAlign: 'middle' }}>Selesai</span>
            </button>
            <button
              onClick={() => setStatusFilter('all')}
              className={`${styles.filterBtn} ${statusFilter === 'all' ? styles.activeFilter : ''}`}
            >
              Semua
            </button>
          </div>
        </div>

        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Project:</span>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">Semua Proyek</option>
            {projects.map((proj) => (
              <option key={proj.id} value={proj.id}>
                {proj.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Action Items List */}
      <div className={styles.itemsCard}>
        {filteredItems.length === 0 ? (
          <div className={styles.emptyState}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--muted-text)' }}>task_alt</span>
            <p>Tidak ada action item yang sesuai filter.</p>
          </div>
        ) : (
          <div className={styles.itemsList}>
            {filteredItems.map((item) => {
              const assocProject = projects.find((p) => p.id === item.project_id);
              const overdue = isOverdue(item.deadline, item.status);
              
              return (
                <div
                  key={item.id}
                  className={`${styles.itemRow} ${item.status === 'done' ? styles.itemRowDone : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={item.status === 'done'}
                    onChange={() => handleToggleStatus(item)}
                    className={styles.checkbox}
                  />

                  <div className={styles.itemContent}>
                    <h3 className={styles.itemTitle}>{item.title}</h3>
                    {item.description && <p className={styles.itemDesc}>{item.description}</p>}
                    <div className={styles.itemMeta}>
                      <span className={styles.picBadge}>PIC: {item.pic}</span>
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
                        <Link href={`/projects/${assocProject.id}`} className={styles.projectTagLink} title={assocProject.name}>
                          <span className="material-symbols-outlined" style={{ fontSize: '12px', marginRight: '4px', verticalAlign: 'middle' }}>folder</span>
                          <span style={{ verticalAlign: 'middle' }}>{assocProject.name}</span>
                        </Link>
                      )}
                      {item.source_note_id && (
                        <Link href={`/notes?id=${item.source_note_id}`} className={styles.noteLink}>
                          <span className="material-symbols-outlined" style={{ fontSize: '12px', marginRight: '4px', verticalAlign: 'middle' }}>description</span>
                          <span style={{ verticalAlign: 'middle' }}>Lihat Note Asal</span>
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
                    <button className={styles.editBtn} onClick={() => handleStartEdit(item)}>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px', marginRight: '4px', verticalAlign: 'middle' }}>edit</span>
                      <span style={{ verticalAlign: 'middle' }}>Edit</span>
                    </button>
                    <button className={styles.deleteBtn} onClick={() => handleDeleteAction(item.id)}>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px', marginRight: '4px', verticalAlign: 'middle' }}>delete</span>
                      <span style={{ verticalAlign: 'middle' }}>Hapus</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Action Item Modal */}
      {editingAction && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} animate-popover`}>
            <div className={styles.modalHeader}>
              <h3>
                <span className="material-symbols-outlined" style={{ marginRight: '8px', verticalAlign: 'middle', color: 'var(--primary)' }}>edit</span>
                <span style={{ verticalAlign: 'middle' }}>Ubah Action Item</span>
              </h3>
              <button className={styles.closeBtn} onClick={() => setEditingAction(null)}>×</button>
            </div>
            <form onSubmit={handleSaveEdit}>
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
                  <label>Kaitkan ke Project</label>
                  <select
                    value={editActionFields.projectId}
                    onChange={(e) => setEditActionFields({ ...editActionFields, projectId: e.target.value })}
                  >
                    <option value="">-- Tanpa Project (Standalone) --</option>
                    {projects.map((proj) => (
                      <option key={proj.id} value={proj.id}>
                        {proj.name}
                      </option>
                    ))}
                  </select>
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
    </div>
  );
}
