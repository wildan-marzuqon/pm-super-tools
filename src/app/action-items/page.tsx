'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import { useModalDialog } from '@/components/ModalProvider';
import * as XLSX from 'xlsx';

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
  startDate?: string;
  pic: string;
  completed: boolean;
  status: string;
  category_id?: string;
  category_name?: string;
  project_id?: string;
  source_note_id?: string;
  jiraKey?: string | null;
  jiraSyncedAt?: string | null;
  originalEstimate?: number;
  created_at: string;
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

export default function ActionItemsPage() {
  const router = useRouter();
  const { confirm, alert } = useModalDialog();
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreatingAction, setIsCreatingAction] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [jiraUrl, setJiraUrl] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Daily Plan import modal state
  const [showDailyPlanModal, setShowDailyPlanModal] = useState(false);
  const [dailyPlanDate, setDailyPlanDate] = useState(() => {
    const d = new Date();
    const fmt = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' });
    return fmt.format(d);
  });
  const [isImporting, setIsImporting] = useState(false);
  const [importToast, setImportToast] = useState<string | null>(null);

  const [statusesList, setStatusesList] = useState<string[]>(['Pending', 'Open', 'In Progress', 'Selesai']);

  // Edit action item state
  const [editingAction, setEditingAction] = useState<ActionItem | null>(null);
  const [editActionFields, setEditActionFields] = useState({
    title: '',
    description: '',
    deadline: '',
    startDate: '',
    pic: 'Wildan',
    projectId: '',
    categoryId: '',
    completed: false,
    status: 'open',
    originalEstimate: 0
  });

  // Dropdown state for task completion
  const [showCompleteDropdown, setShowCompleteDropdown] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [selectedPicFilter, setSelectedPicFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Reset page and selection on filter change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds([]);
  }, [statusFilter, projectFilter, selectedPicFilter, searchQuery, startDate, endDate]);

  // Form State for creating action item
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAction, setNewAction] = useState({
    title: '',
    description: '',
    deadline: '',
    startDate: '',
    pic: 'Wildan',
    projectId: '',
    categoryId: '',
    status: statusesList[0]?.toLowerCase() || 'open',
    originalEstimate: 0
  });

  const fetchData = async () => {
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

      if (!roles.includes('Super Admin') && !caps.includes('view_action_items')) {
        router.push('/unauthorized');
        return;
      }

      const [actionRes, projRes, settingsRes] = await Promise.all([
        fetch('/api/action-items'),
        fetch('/api/projects'),
        fetch('/api/wa-copilot/settings')
      ]);

      if (actionRes.ok && projRes.ok) {
        setActionItems(await actionRes.json());
        setProjects(await projRes.json());
      }

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setJiraUrl(settingsData.jiraUrl || '');
        if (settingsData.actionItemStatuses && settingsData.actionItemStatuses.length > 0) {
          setStatusesList(settingsData.actionItemStatuses);
          setNewAction(prev => ({
            ...prev,
            status: settingsData.actionItemStatuses[0].toLowerCase()
          }));
          const hasPending = settingsData.actionItemStatuses.some((s: string) => s.toLowerCase() === 'pending');
          if (!hasPending) {
            setStatusFilter(settingsData.actionItemStatuses[0].toLowerCase());
          }
        }
      }
    } catch (error) {
      console.error('Error fetching action items data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImportToDailyPlan = async () => {
    if (selectedIds.length === 0) return;
    setIsImporting(true);
    try {
      const res = await fetch('/api/daily-plan/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionItemIds: selectedIds, date: dailyPlanDate })
      });
      if (!res.ok) throw new Error('Failed to import');
      const data = await res.json();
      setShowDailyPlanModal(false);
      setSelectedIds([]);
      const [y, m, day] = dailyPlanDate.split('-');
      const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
      const label = `${day} ${months[parseInt(m) - 1]} ${y}`;
      setImportToast(`\u2713 ${data.created} item berhasil dimasukkan ke Daily Plan ${label}`);
      setTimeout(() => setImportToast(null), 4000);
    } catch {
      window.alert('Gagal memasukkan ke Daily Plan. Coba lagi.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleSyncJira = async (direction: 'pull' | 'push') => {
    setIsSyncing(true);
    try {
      let url = projectFilter !== 'all' 
        ? `/api/jira/sync?projectId=${projectFilter}&direction=${direction}` 
        : `/api/jira/sync?direction=${direction}`;
      
      if (direction === 'push' && selectedIds.length > 0) {
        url += `&actionItemIds=${selectedIds.join(',')}`;
      }

      const res = await fetch(url, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        const actionLabel = direction === 'pull' ? 'Pull dari Jira' : 'Push ke Jira';
        await alert(
          `${actionLabel} sukses!\n- Pushed: ${data.pushed} task(s)\n- Pulled: ${data.pulled} task(s)\n- Cached: ${data.cached} issues`, 
          'Sukses', 
          'success'
        );
        if (direction === 'push') {
          setSelectedIds([]);
        }
        fetchData();
      } else {
        await alert(data.error || 'Terjadi kesalahan saat sinkronisasi Jira.', 'Gagal', 'error');
      }
    } catch (err: any) {
      console.error('Error syncing Jira:', err);
      await alert(`Gagal terhubung ke server: ${err.message || 'Error'}`, 'Error Jaringan', 'error');
    } finally {
      setIsSyncing(false);
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
    setNewAction({ title: '', description: '', deadline: '', startDate: '', pic: 'Wildan', projectId: '', categoryId: '', status: statusesList[0]?.toLowerCase() || 'open', originalEstimate: 0 });
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
          startDate: formData.startDate,
          pic: formData.pic,
          project_id: formData.projectId || undefined,
          category_id: formData.categoryId || undefined,
          status: formData.status,
          originalEstimate: formData.originalEstimate
        })
      });

      if (res.ok) {
        const created = await res.json();
        setActionItems(prev => [created, ...prev]);
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
      startDate: item.startDate ? item.startDate.substring(0, 10) : '',
      pic: item.pic || '',
      projectId: item.project_id || '',
      categoryId: item.category_id || '',
      completed: item.completed,
      status: getResolvedStatus(item, statusesList),
      originalEstimate: item.originalEstimate || 0
    });
  };

  // Auto-save fields during modal edit
  const handleAutoSaveAction = async (fieldsToUpdate: Partial<typeof editActionFields>) => {
    if (!editingAction) return;

    const mergedFields = {
      title: fieldsToUpdate.title !== undefined ? fieldsToUpdate.title : editActionFields.title,
      description: fieldsToUpdate.description !== undefined ? fieldsToUpdate.description : editActionFields.description,
      deadline: fieldsToUpdate.deadline !== undefined ? fieldsToUpdate.deadline : editActionFields.deadline,
      startDate: fieldsToUpdate.startDate !== undefined ? fieldsToUpdate.startDate : editActionFields.startDate,
      pic: fieldsToUpdate.pic !== undefined ? fieldsToUpdate.pic : editActionFields.pic,
      projectId: fieldsToUpdate.projectId !== undefined ? fieldsToUpdate.projectId : editActionFields.projectId,
      categoryId: fieldsToUpdate.categoryId !== undefined ? fieldsToUpdate.categoryId : editActionFields.categoryId,
      completed: fieldsToUpdate.completed !== undefined ? fieldsToUpdate.completed : editActionFields.completed,
      status: fieldsToUpdate.status !== undefined ? fieldsToUpdate.status : editActionFields.status,
      originalEstimate: fieldsToUpdate.originalEstimate !== undefined ? fieldsToUpdate.originalEstimate : editActionFields.originalEstimate
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
              status: mergedFields.status,
              originalEstimate: mergedFields.originalEstimate
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
          status: mergedFields.status,
          originalEstimate: mergedFields.originalEstimate
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
        item.id === completedId ? { ...item, completed: true, status: 'done' } : item
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

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    // Optimistic local update
    setActionItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, status: newStatus, completed: newStatus === 'done' } : item
      )
    );

    try {
      await fetch(`/api/action-items/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
    } catch (error) {
      console.error('Error updating action item status:', error);
    }
  };

  const handleExportXLSX = () => {
    if (sortedItems.length === 0) {
      alert('Tidak ada data untuk diexport!', 'Gagal Export', 'error');
      return;
    }

    try {
      // 1. Prepare data mapping
      const dataToExport = sortedItems.map((item, idx) => ({
        'No': idx + 1,
        'Judul Tugas': item.title,
        'Deskripsi': item.description || '',
        'PIC': item.pic || '-',
        'Start Date': item.startDate ? formatDate(item.startDate) : '-',
        'Deadline': item.deadline ? formatDate(item.deadline) : '-',
        'Estimasi (Jam)': item.originalEstimate ? item.originalEstimate / 3600 : 0,
        'Status': item.status.toUpperCase(),
        'Jira Key': item.jiraKey || '-',
        'Kategori': item.category_name || '-',
        'Selesai': item.completed ? 'Ya' : 'Tidak'
      }));

      // 2. Create worksheet and workbook
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);

      // Autofit columns helper
      const maxLens = Object.keys(dataToExport[0]).map(key => {
        let maxLen = key.length;
        dataToExport.forEach(row => {
          const val = String(row[key as keyof typeof row] || '');
          if (val.length > maxLen) maxLen = val.length;
        });
        return { wch: Math.min(maxLen + 2, 50) }; // cap column width at 50 chars
      });
      worksheet['!cols'] = maxLens;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Action Items Report');

      // 3. Trigger download
      XLSX.writeFile(workbook, `Action_Items_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err: any) {
      console.error('Error exporting XLSX:', err);
      alert(`Gagal mengeksport data: ${err.message || 'Error'}`, 'Error Export', 'error');
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

  // Dynamic unique PICs list
  const picList = Array.from(
    new Set(actionItems.map(item => item.pic).filter(Boolean))
  ).sort();

  // Filter logic
  const filteredItems = actionItems.filter((item) => {
    const isDoneStatus = (statusName: string) => {
      const norm = (statusName || '').toLowerCase();
      if (norm === 'done' || norm === 'selesai') return true;
      if (statusesList.length > 0 && statusesList[statusesList.length - 1].toLowerCase() === norm) return true;
      return false;
    };

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'pending' && !isDoneStatus(item.status)) ||
      item.status.toLowerCase() === statusFilter.toLowerCase();

    const matchesProject =
      projectFilter === 'all' || item.project_id === projectFilter;

    const matchesPic =
      selectedPicFilter === 'all' ||
      (item.pic && item.pic.toLowerCase() === selectedPicFilter.toLowerCase());

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

    return matchesStatus && matchesProject && matchesPic && matchesSearch && matchesDateRange;
  });

  const getStatusRank = (statusName: string) => {
    const norm = (statusName || '').toLowerCase();
    const idx = statusesList.findIndex(s => s.toLowerCase() === norm);
    return idx === -1 ? 999 : idx;
  };

  const sortedItems = [...filteredItems].sort((a, b) => {
    // 1. Deadline presence
    const hasDeadlineA = !!a.deadline && a.deadline.trim() !== '';
    const hasDeadlineB = !!b.deadline && b.deadline.trim() !== '';
    if (hasDeadlineA !== hasDeadlineB) {
      return hasDeadlineA ? -1 : 1;
    }

    // 2. Status rank
    const rankA = getStatusRank(a.status);
    const rankB = getStatusRank(b.status);
    if (rankA !== rankB) {
      return rankA - rankB;
    }

    // 3. Deadline value or created date
    if (hasDeadlineA && hasDeadlineB) {
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Pagination logic
  const pageSize = 10;
  const totalItems = sortedItems.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const displayedItems = sortedItems.slice(
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
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => handleSyncJira('pull')}
            disabled={isSyncing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#1E293B',
              color: '#F8FAFC',
              border: '1px solid #334155',
              padding: '10px 14px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              opacity: isSyncing ? 0.7 : 1
            }}
            title="Tarik data dari Jira untuk memperbarui data lokal"
          >
            {isSyncing ? '🔄 Menyinkronkan...' : '📥 Pull dari Jira'}
          </button>
          <button 
            onClick={() => handleSyncJira('push')}
            disabled={isSyncing || selectedIds.length === 0}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: selectedIds.length === 0 ? '#E2E8F0' : '#B45309',
              color: selectedIds.length === 0 ? '#94A3B8' : '#F8FAFC',
              border: selectedIds.length === 0 ? '1px solid #CBD5E1' : '1px solid #9A3412',
              padding: '10px 14px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: selectedIds.length === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              opacity: isSyncing ? 0.7 : 1
            }}
            title={selectedIds.length === 0 ? "Pilih tugas terlebih dahulu menggunakan checkbox untuk melakukan push ke Jira" : "Kirim tugas terpilih ke Jira"}
          >
            {isSyncing ? '🔄 Menyinkronkan...' : `📤 Push ke Jira ${selectedIds.length > 0 ? `(${selectedIds.length})` : ''}`}
          </button>
          {/* Import to Daily Plan button — shows count when selected */}
          <button
            onClick={() => setShowDailyPlanModal(true)}
            disabled={selectedIds.length === 0}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: selectedIds.length === 0 ? '#E2E8F0' : '#065F46',
              color: selectedIds.length === 0 ? '#94A3B8' : '#ECFDF5',
              border: selectedIds.length === 0 ? '1px solid #CBD5E1' : '1px solid #047857',
              padding: '10px 14px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: selectedIds.length === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
            title={selectedIds.length === 0 ? 'Pilih action item terlebih dahulu' : 'Masukkan item terpilih ke Daily Plan'}
          >
            {`📅 Masukkan ke Daily Plan${selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}`}
          </button>
          <button
            onClick={handleExportXLSX}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#10B981',
              color: '#F8FAFC',
              border: '1px solid #059669',
              padding: '10px 14px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            title="Export list action item terfilter ke Excel (.xlsx)"
          >
            📊 Export XLSX
          </button>
          <button className={styles.addBtn} onClick={() => setShowAddForm(true)}>
            + Action Item Baru
          </button>
        </div>
      </header>

      {/* Toast notification */}
      {importToast && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
          backgroundColor: '#065F46', color: '#ECFDF5',
          padding: '12px 20px', borderRadius: '8px',
          fontSize: '14px', fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          {importToast}
        </div>
      )}

      {/* Daily Plan import modal */}
      {showDailyPlanModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9000,
          backgroundColor: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={() => setShowDailyPlanModal(false)}>
          <div style={{
            backgroundColor: 'white', borderRadius: '12px',
            padding: '28px 32px', width: '360px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: 700 }}>
              📅 Masukkan ke Daily Plan
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#6B7280' }}>
              {selectedIds.length} action item akan ditambahkan sebagai rencana tanpa jam (bisa diatur nanti).
            </p>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#374151' }}>
              Tanggal
            </label>
            <input
              type="date"
              value={dailyPlanDate}
              onChange={e => setDailyPlanDate(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px',
                border: '1px solid #D1D5DB', borderRadius: '8px',
                fontSize: '14px', fontFamily: 'inherit',
                marginBottom: '20px', boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDailyPlanModal(false)}
                style={{
                  padding: '9px 18px', borderRadius: '8px',
                  border: '1px solid #D1D5DB', backgroundColor: 'white',
                  fontSize: '13px', fontWeight: 600, cursor: 'pointer'
                }}
              >
                Batal
              </button>
              <button
                onClick={handleImportToDailyPlan}
                disabled={isImporting}
                style={{
                  padding: '9px 18px', borderRadius: '8px',
                  border: 'none', backgroundColor: '#065F46', color: 'white',
                  fontSize: '13px', fontWeight: 600,
                  cursor: isImporting ? 'not-allowed' : 'pointer',
                  opacity: isImporting ? 0.7 : 1
                }}
              >
                {isImporting ? '⏳ Memproses...' : 'Konfirmasi'}
              </button>
            </div>
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
                <div className={styles.formRow}>
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
                        backgroundColor: 'white',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}
                    >
                      {statusesList.map(st => {
                        const isDone = st.toLowerCase() === 'done' || st.toLowerCase() === 'selesai';
                        const prefix = isDone ? '✓ ' : st.toLowerCase().includes('progress') ? '⚙️ ' : st.toLowerCase().includes('pending') ? '⏳ ' : '📂 ';
                        return (
                          <option key={st} value={st.toLowerCase()}>
                            {prefix}{st}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Estimasi Waktu (Jam)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={newAction.originalEstimate ? newAction.originalEstimate / 3600 : ''}
                      onChange={(e) => {
                        const hours = parseFloat(e.target.value) || 0;
                        setNewAction({ ...newAction, originalEstimate: hours * 3600 });
                      }}
                      placeholder="misal: 8 atau 12.5"
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
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Status:</span>
          <div className={styles.btnGroup} style={{ flexWrap: 'wrap' }}>
            {statusesList.map((st) => {
              const isDone = st.toLowerCase() === 'done' || st.toLowerCase() === 'selesai';
              const emoji = isDone ? '✓' : st.toLowerCase().includes('progress') ? '⚙️' : st.toLowerCase().includes('pending') ? '⏳' : '📂';
              return (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st.toLowerCase())}
                  className={`${styles.filterBtn} ${statusFilter === st.toLowerCase() ? styles.activeFilter : ''}`}
                >
                  {emoji} {st}
                </button>
              );
            })}
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

        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>PIC:</span>
          <select
            value={selectedPicFilter}
            onChange={(e) => setSelectedPicFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">Semua PIC</option>
            {picList.map((pic) => (
              <option key={pic} value={pic}>
                {pic}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterGroup} style={{ flexGrow: 1, minWidth: '150px' }}>
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
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              backgroundColor: 'var(--card-bg, #ffffff)',
              borderRadius: '8px',
              border: '1px solid var(--border-color, #e5e7eb)',
              marginBottom: '12px',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-color, #1f2937)'
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={displayedItems.length > 0 && displayedItems.every(item => selectedIds.includes(item.id))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds(prev => {
                        const newIds = [...prev];
                        displayedItems.forEach(item => {
                          if (!newIds.includes(item.id)) {
                            newIds.push(item.id);
                          }
                        });
                        return newIds;
                      });
                    } else {
                      setSelectedIds(prev => prev.filter(id => !displayedItems.map(di => di.id).includes(id)));
                    }
                  }}
                  style={{ width: '16px', height: '16px', accentColor: '#B45309', cursor: 'pointer' }}
                />
                Pilih Semua di Halaman Ini
              </label>
              <span>Terpilih: <strong>{selectedIds.length}</strong> tugas</span>
            </div>

            <div className={styles.itemsList}>
              {displayedItems.map((item) => {
                const assocProject = projects.find((p) => p.id === item.project_id);
                    const resolvedStatus = getResolvedStatus(item, statusesList);
                
                return (
                  <div
                    key={item.id}
                    className={`${styles.itemRow} ${item.completed ? styles.itemRowDone : ''}`}
                    onClick={() => handleStartEdit(item)}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        setSelectedIds(prev =>
                          prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]
                        );
                      }}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer',
                        accentColor: '#B45309',
                        flexShrink: 0
                      }}
                    />
                    <div className={styles.itemContent} style={{ flexGrow: 1 }}>
                      <h3 className={styles.itemTitle}>{item.title}</h3>
                      {item.description && <p className={styles.itemDesc}>{item.description}</p>}
                      <div className={styles.itemMeta}>
                        <span className={styles.picBadge}>PIC: {item.pic}</span>
                        {item.originalEstimate ? (
                          <span style={{
                            backgroundColor: 'var(--primary-light, #FEF3C7)',
                            color: '#B45309',
                            border: '1px solid rgba(245, 158, 11, 0.2)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            ⏱️ {(item.originalEstimate / 3600).toFixed(1)}h
                          </span>
                        ) : null}
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
                        {item.jiraKey && (
                          <a
                            href={jiraUrl ? `${jiraUrl.replace(/\/+$/, '')}/browse/${item.jiraKey}` : '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.jiraBadge}
                            onClick={(e) => e.stopPropagation()}
                            title="Buka isu di Jira"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              backgroundColor: '#E0F2FE',
                              color: '#0369A1',
                              border: '1px solid #BAE6FD',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              textDecoration: 'none',
                              transition: 'all 0.2s',
                            }}
                          >
                            🔵 Jira: {item.jiraKey}
                          </a>
                        )}
                      </div>
                    </div>

                    <div 
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', alignSelf: 'center' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <select
                        value={resolvedStatus.toLowerCase()}
                        onChange={(e) => handleUpdateStatus(item.id, e.target.value)}
                        style={{
                          ...getStatusLabelDynamic(resolvedStatus, statusesList).styles,
                          padding: '6px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 600,
                          border: '1px solid',
                          cursor: 'pointer',
                          outline: 'none',
                          transition: 'all 0.2s',
                        }}
                      >
                        {statusesList.map(st => {
                          const isDone = st.toLowerCase() === 'done' || st.toLowerCase() === 'selesai';
                          const prefix = isDone ? '✓ ' : st.toLowerCase().includes('progress') ? '⚙️ ' : st.toLowerCase().includes('pending') ? '⏳ ' : '📂 ';
                          return (
                            <option key={st} value={st.toLowerCase()}>
                              {prefix}{st}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {(() => {
                      const overdue = isOverdue(item.deadline, item.completed);
                      return (
                        <div className={styles.itemDateCol}>
                          <span className={`${styles.itemDate} ${overdue ? styles.overdue : ''}`}>
                            {formatDate(item.deadline)}
                          </span>
                          {overdue && <span className={styles.overdueBadge}>OVERDUE</span>}
                        </div>
                      );
                    })()}

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
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Status</label>
                    <select
                      value={editActionFields.status.toLowerCase()}
                      onChange={(e) => {
                        const nextStatus = e.target.value;
                        const isDone = nextStatus.toLowerCase() === 'done' || nextStatus.toLowerCase() === 'selesai' ||
                                       (statusesList.length > 0 && statusesList[statusesList.length - 1].toLowerCase() === nextStatus.toLowerCase());
                        setEditActionFields({ ...editActionFields, status: nextStatus, completed: isDone });
                        handleAutoSaveAction({ status: nextStatus, completed: isDone });
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        fontSize: '14px',
                        outline: 'none',
                        backgroundColor: 'white',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}
                    >
                      {statusesList.map(st => {
                        const isDone = st.toLowerCase() === 'done' || st.toLowerCase() === 'selesai';
                        const prefix = isDone ? '✓ ' : st.toLowerCase().includes('progress') ? '⚙️ ' : st.toLowerCase().includes('pending') ? '⏳ ' : '📂 ';
                        return (
                          <option key={st} value={st.toLowerCase()}>
                            {prefix}{st}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Estimasi Waktu (Jam)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={editActionFields.originalEstimate ? editActionFields.originalEstimate / 3600 : ''}
                      onChange={(e) => {
                        const hours = parseFloat(e.target.value) || 0;
                        setEditActionFields({ ...editActionFields, originalEstimate: hours * 3600 });
                      }}
                      onBlur={() => handleAutoSaveAction({ originalEstimate: editActionFields.originalEstimate })}
                      placeholder="misal: 8 atau 12.5"
                    />
                  </div>
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
