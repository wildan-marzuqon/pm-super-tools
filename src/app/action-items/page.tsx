'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './page.module.css';
import { useModalDialog } from '@/components/ModalProvider';

interface Project {
  id: string;
  name: string;
  categories?: Array<{ id: string; name: string }>;
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
  created_at: string;
}

export default function ActionItemsPage() {
  const { confirm } = useModalDialog();
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
    categoryId: '',
    completed: false
  });

  // Dropdown state for task completion
  const [showCompleteDropdown, setShowCompleteDropdown] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'done'>('pending');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, projectFilter, searchQuery, startDate, endDate]);

  // Form State for creating action item
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAction, setNewAction] = useState({
    title: '',
    description: '',
    deadline: '',
    pic: 'Wildan',
    projectId: '',
    categoryId: ''
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

  const handleDeleteAction = async (id: string) => {
    if (!(await confirm('Apakah Anda yakin ingin menghapus action item ini?'))) return;
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

    const formData = { ...newAction };
    setNewAction({ title: '', description: '', deadline: '', pic: 'Wildan', projectId: '', categoryId: '' });
    setShowAddForm(false);
    setIsCreatingAction(true);

    try {
      const res = await fetch('/api/action-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          deadline: formData.deadline,
          pic: formData.pic,
          project_id: formData.projectId || undefined,
          category_id: formData.categoryId || undefined
        })
      });

      if (res.ok) {
        const created = await res.json();
        // Optimistic: insert into state directly, re-sort
        setActionItems(prev => {
          const updated = [created, ...prev];
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
      categoryId: item.category_id || '',
      completed: item.completed
    });
  };

  // Auto-save fields during modal edit
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
          completed: mergedFields.completed
        })
      });
    } catch (error) {
      console.error('Error auto-saving action item:', error);
    }
  };

  // Complete action item inside modal
  const handleCompleteAction = async (createNew: boolean = false) => {
    if (!editingAction) return;

    const assocProj = projects.find(p => p.id === editingAction.project_id);
    const completedId = editingAction.id;

    // Optimistic: close modal and mark complete immediately
    setEditingAction(null);
    setShowCompleteDropdown(false);
    setActionItems(prev =>
      prev.map(item =>
        item.id === completedId ? { ...item, completed: true } : item
      )
    );

    if (createNew) {
      setNewAction(prev => ({
        ...prev,
        projectId: assocProj ? assocProj.id : ''
      }));
      setShowAddForm(true);
      setTimeout(() => {
        const el = document.getElementById('addActionTrackerForm');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }

    try {
      await fetch(`/api/action-items/${completedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: true })
      });
    } catch (error) {
      console.error('Error completing action item:', error);
      // Rollback on failure
      setActionItems(prev =>
        prev.map(item =>
          item.id === completedId ? { ...item, completed: false } : item
        )
      );
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

  // Filter logic
  const filteredItems = actionItems.filter((item) => {
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'pending' && !item.completed) ||
      (statusFilter === 'done' && item.completed);

    const matchesProject =
      projectFilter === 'all' || item.project_id === projectFilter;

    const matchesSearch =
      searchQuery.trim() === '' ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.pic && item.pic.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesDateRange = (() => {
      if (!item.deadline) {
        return startDate === '' && endDate === '';
      }
      const itemDate = new Date(item.deadline.substring(0, 10));
      if (startDate !== '') {
        const start = new Date(startDate);
        if (itemDate < start) return false;
      }
      if (endDate !== '') {
        const end = new Date(endDate);
        if (itemDate > end) return false;
      }
      return true;
    })();

    return matchesStatus && matchesProject && matchesSearch && matchesDateRange;
  });

  // Pagination logic
  const pageSize = 10;
  const totalItems = filteredItems.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const displayedItems = filteredItems.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  if (loading) {
    return (
      <div className={`${styles.container} animate-fade-in`}>
        <header className={styles.header}>
          <div>
            <div className="skeleton" style={{ height: '28px', width: '250px', marginBottom: '8px' }} />
            <div className="skeleton" style={{ height: '14px', width: '340px' }} />
          </div>
          <div className="skeleton" style={{ height: '40px', width: '160px', borderRadius: '8px' }} />
        </header>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '0 0 24px 0' }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ padding: '16px', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="skeleton" style={{ height: '16px', width: '60%' }} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <div className="skeleton" style={{ height: '12px', width: '80px' }} />
                <div className="skeleton" style={{ height: '12px', width: '100px' }} />
              </div>
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
          <h1 className={styles.title}>📋 Action Items Tracker</h1>
          <p className={styles.subtitle}>Daftar semua tugas dan to-do list yang perlu diselesaikan.</p>
        </div>
        <button className={styles.addBtn} onClick={() => setShowAddForm(true)}>
          + Action Item Baru
        </button>
      </header>

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
                <button type="submit" className={styles.submitBtn} disabled={isCreatingAction}>
                  {isCreatingAction ? 'Menyimpan...' : 'Buat Action Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filters Toolbar */}
      <section className={styles.filterToolbar}>
        <div className={styles.filterRow}>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Status:</span>
            <div className={styles.btnGroup}>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`${styles.filterBtn} ${statusFilter === 'pending' ? styles.activeFilter : ''}`}
              >
                ⏳ Pending
              </button>
              <button
                onClick={() => setStatusFilter('done')}
                className={`${styles.filterBtn} ${statusFilter === 'done' ? styles.activeFilter : ''}`}
              >
                ✓ Selesai
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
        </div>

        <div className={styles.filterRow}>
          <div className={styles.filterGroup} style={{ flexGrow: 1 }}>
            <span className={styles.filterLabel}>Cari:</span>
            <input
              type="text"
              placeholder="Cari tugas atau PIC..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.filterSearchInput}
            />
          </div>

          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Rentang Tanggal:</span>
            <div className={styles.dateRangeGroup}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={styles.filterDateInput}
              />
              <span className={styles.dateSeparator}>s/d</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={styles.filterDateInput}
              />
              {(startDate || endDate) && (
                <button 
                  className={styles.clearDateBtn} 
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  title="Reset Filter Tanggal"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Action Items List */}
      <div className={styles.itemsCard}>
        {displayedItems.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>🎉</span>
            <p>Tidak ada action item yang sesuai filter.</p>
          </div>
        ) : (
          <>
            <div className={styles.itemsList}>
              {displayedItems.map((item) => {
                const assocProject = projects.find((p) => p.id === item.project_id);
                const overdue = isOverdue(item.deadline, item.completed);
                
                return (
                  <div
                    key={item.id}
                    className={`${styles.itemRow} ${item.completed ? styles.itemRowDone : ''}`}
                    onClick={() => handleStartEdit(item)}
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
                        {assocProject && (
                          <Link 
                            href={`/projects/${assocProject.id}`} 
                            className={styles.projectTagLink} 
                            title={assocProject.name}
                            onClick={(e) => e.stopPropagation()}
                          >
                            📁 {assocProject.name}
                          </Link>
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
                          handleDeleteAction(item.id);
                        }}
                      >
                        🗑️ Hapus
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className={styles.pageBtn}
                >
                  ◀ Prev
                </button>
                <span className={styles.pageIndicator}>
                  Halaman <strong className="font-mono">{currentPage}</strong> dari <strong className="font-mono">{totalPages}</strong> ({totalItems} items)
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className={styles.pageBtn}
                >
                  Next ▶
                </button>
              </div>
            )}
          </>
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
    </div>
  );
}
