'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import { useModalDialog } from '@/components/ModalProvider';

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
  status?: string;
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
  is_synced?: boolean;
  type?: string;
  content?: string;
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
  google_drive_folder_url?: string;
  google_api_key?: string;
  created_at: string;
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

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { confirm, alert } = useModalDialog();
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
    completed: false,
    status: 'open'
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
    categoryId: '',
    status: 'open'
  });
  const [showAddActionForm, setShowAddActionForm] = useState(false);

  // New Artifact Form State
  const [newArtifact, setNewArtifact] = useState({
    label: '',
    url: '',
    description: ''
  });
  const [showAddArtForm, setShowAddArtForm] = useState(false);

  // Google Drive Settings states
  const [settingsGDriveUrl, setSettingsGDriveUrl] = useState('');
  const [settingsGDriveApiKey, setSettingsGDriveApiKey] = useState('');

  // Sync state
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);

  // Artifact Filter
  const [artFilter, setArtFilter] = useState<'all' | 'link' | 'synced' | 'document'>('all');

  // Local Document creation states
  const [showAddDocForm, setShowAddDocForm] = useState(false);
  const [newDocLabel, setNewDocLabel] = useState('');
  const [newDocContent, setNewDocContent] = useState('');

  // Local Document viewing & editing states
  const [viewingDoc, setViewingDoc] = useState<Artifact | null>(null);
  const [isEditingDoc, setIsEditingDoc] = useState(false);
  const [editDocLabel, setEditDocLabel] = useState('');
  const [editDocContent, setEditDocContent] = useState('');

  // Project Settings form state
  const [settingsName, setSettingsName] = useState('');
  const [settingsDesc, setSettingsDesc] = useState('');
  const [settingsPic, setSettingsPic] = useState('');
  const [settingsDeadline, setSettingsDeadline] = useState('');
  const [settingsJiraProjectKey, setSettingsJiraProjectKey] = useState('');
  
  // Custom Stages builder list state
  const [stagesList, setStagesList] = useState<Array<{ id?: string; name: string; completed_at?: string }>>([]);
  const [newStageName, setNewStageName] = useState('');
  const [newStageDate, setNewStageDate] = useState('');

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
        setSettingsGDriveUrl(data.google_drive_folder_url || '');
        setSettingsGDriveApiKey(data.google_api_key || '');
        setSettingsJiraProjectKey(data.jira_project_key || '');
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
          category_id: newAction.categoryId || null,
          status: newAction.status
        })
      });

      if (res.ok) {
        setNewAction({ title: '', description: '', deadline: '', pic: 'Wildan', categoryId: '', status: 'open' });
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
      completed: item.completed,
      status: item.completed ? 'done' : (item.status === 'done' ? 'open' : (item.status || 'open'))
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
        status: editActionFields.status,
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
          completed: mergedFields.completed,
          status: mergedFields.status
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
          completed: true,
          status: 'done'
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
    if (!(await confirm('Hapus kategori ini? Tugas yang terkait akan dikosongkan kategorinya.'))) return;
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
    if (!(await confirm('Apakah Anda yakin ingin menghapus Action Item ini?'))) return;
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
    if (!(await confirm('Hapus link artifact ini?'))) return;
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

  // Auto-detect link preset
  const handleUrlChange = (val: string) => {
    setNewArtifact({ ...newArtifact, url: val });
    
    // Guess label and description if label is empty
    if (!newArtifact.label.trim()) {
      if (val.includes('docs.google.com/document')) {
        setNewArtifact((prev) => ({ ...prev, label: 'Google Docs - [Ganti Nama]', url: val, description: 'Dokumen Google Docs' }));
      } else if (val.includes('docs.google.com/spreadsheets')) {
        setNewArtifact((prev) => ({ ...prev, label: 'Google Sheets - [Ganti Nama]', url: val, description: 'Spreadsheet Google Sheets' }));
      } else if (val.includes('docs.google.com/presentation')) {
        setNewArtifact((prev) => ({ ...prev, label: 'Google Slides - [Ganti Nama]', url: val, description: 'Presentasi Google Slides' }));
      } else if (val.includes('figma.com/file')) {
        setNewArtifact((prev) => ({ ...prev, label: 'Figma Design - [Ganti Nama]', url: val, description: 'Desain Proyek Figma' }));
      }
    }
  };

  // Google Drive Sync
  const handleSyncGDrive = async (useDemo = false) => {
    if (!project || isSyncingDrive) return;
    
    setIsSyncingDrive(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/artifacts/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demo: useDemo })
      });
      
      const data = await res.json();
      if (res.ok) {
        await alert(`Sinkronisasi berhasil! ${data.count} file disinkronkan dari Google Drive.`, 'Sukses', 'success');
        fetchProjectDetail();
      } else {
        if (data.code === 'MISSING_API_KEY') {
          const wantDemo = await confirm(
            'Google API Key belum dikonfigurasi di Settings proyek. Apakah Anda ingin mencoba sinkronisasi menggunakan Demo Mode (dengan file simulasi)?',
            'Google API Key Kosong'
          );
          if (wantDemo) {
            setIsSyncingDrive(false);
            await handleSyncGDrive(true);
            return;
          }
        } else {
          await alert(data.error || 'Gagal melakukan sinkronisasi.', 'Error', 'error');
        }
      }
    } catch (error) {
      console.error('Error syncing Google Drive:', error);
      await alert('Terjadi kesalahan koneksi saat sinkronisasi.', 'Error', 'error');
    } finally {
      setIsSyncingDrive(false);
    }
  };

  // Local document save
  const handleSaveLocalDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocLabel.trim() || !newDocContent.trim() || !project || isAddingArtifact) return;

    setIsAddingArtifact(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/artifacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: newDocLabel.trim(),
          url: `local:${Date.now()}`,
          description: 'Catatan Internal',
          type: 'document',
          content: newDocContent
        })
      });

      if (res.ok) {
        setNewDocLabel('');
        setNewDocContent('');
        setShowAddDocForm(false);
        fetchProjectDetail();
        await alert('Catatan internal berhasil disimpan!', 'Sukses', 'success');
      }
    } catch (error) {
      console.error('Error saving local doc:', error);
    } finally {
      setIsAddingArtifact(false);
    }
  };

  // Open local doc for viewing
  const handleOpenDocView = (art: Artifact) => {
    setViewingDoc(art);
    setEditDocLabel(art.label);
    setEditDocContent(art.content || '');
    setIsEditingDoc(false);
  };

  // Save doc edits
  const handleSaveDocEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingDoc || !project) return;
    try {
      const res = await fetch(`/api/projects/${project.id}/artifacts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: viewingDoc.id,
          label: editDocLabel,
          content: editDocContent
        })
      });

      if (res.ok) {
        const updated = { ...viewingDoc, label: editDocLabel, content: editDocContent };
        setViewingDoc(updated);
        setIsEditingDoc(false);
        fetchProjectDetail();
        await alert('Perubahan dokumen berhasil disimpan!', 'Sukses', 'success');
      }
    } catch (error) {
      console.error('Error updating local doc:', error);
    }
  };

  // Get visual icon for artifact type
  const getArtifactIcon = (art: Artifact) => {
    if (art.type === 'document') return '📝';
    if (art.is_synced) return '🌐';
    const url = art.url.toLowerCase();
    if (url.includes('docs.google.com/document')) return '📘';
    if (url.includes('docs.google.com/spreadsheets')) return '📗';
    if (url.includes('docs.google.com/presentation')) return '📙';
    if (url.includes('figma.com')) return '🎨';
    return '🔗';
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
          deadline: settingsDeadline,
          google_drive_folder_url: settingsGDriveUrl,
          google_api_key: settingsGDriveApiKey,
          jira_project_key: settingsJiraProjectKey
        })
      });
      if (res.ok) {
        await alert('Settings berhasil disimpan!', 'Sukses', 'success');
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
    if (!(await confirm('Apakah Anda yakin ingin menghapus seluruh proyek ini beserta semua stages dan artifacts terkait?'))) return;

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
    setStagesList((prev) => [
      ...prev,
      {
        name: newStageName.trim(),
        completed_at: newStageDate ? new Date(newStageDate).toISOString() : undefined
      }
    ]);
    setNewStageName('');
    setNewStageDate('');
  };

  const handleRemoveStage = (index: number) => {
    setStagesList((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleStageNameChange = (index: number, name: string) => {
    setStagesList((prev) =>
      prev.map((s, idx) => (idx === index ? { ...s, name } : s))
    );
  };

  const handleStageDateChange = (index: number, dateStr: string) => {
    setStagesList((prev) =>
      prev.map((s, idx) => (idx === index ? { ...s, completed_at: dateStr ? new Date(dateStr).toISOString() : undefined } : s))
    );
  };

  const handleSaveStages = async () => {
    if (!project || isSavingStages) return;
    if (stagesList.length === 0) {
      await alert('Project harus memiliki minimal 1 stage.', 'Peringatan', 'error');
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
        await alert('Stages berhasil disimpan!', 'Sukses', 'success');
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
        <header className={styles.pageHeader}>
          <div className={styles.pageHeaderLeft}>
            <div className="skeleton" style={{ height: '28px', width: '80px', borderRadius: '4px' }}></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div className="skeleton" style={{ height: '10px', width: '80px' }}></div>
              <div className="skeleton" style={{ height: '22px', width: '260px' }}></div>
              <div className="skeleton" style={{ height: '14px', width: '340px' }}></div>
            </div>
          </div>
          <div className={styles.pageHeaderMeta}>
            {[1, 2, 3].map((i) => (
              <div key={i} className={styles.sidebarMetaItem}>
                <div className="skeleton" style={{ height: '10px', width: '60px', marginBottom: '4px' }}></div>
                <div className="skeleton" style={{ height: '14px', width: '80px' }}></div>
              </div>
            ))}
          </div>
        </header>
        <div className={styles.pageLayout}>
          <aside className={styles.projectSidebar}>
            <div className="skeleton" style={{ height: '180px', width: '100%', borderRadius: '10px' }}></div>
          </aside>
          <main className={styles.projectMain}>
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
          </main>
        </div>
      </div>
    );
  }



  if (!project) return null;

  const currentStage = project.stages[project.current_stage_index] || null;
  const isCompleted = project.current_stage_index >= project.stages.length;

  return (
    <div className={`${styles.container} animate-fade-in`}>

      {/* TOP HEADER: back button + title + meta (full width) */}
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <Link href="/projects" className={styles.backBtn}>← Pipeline</Link>
          <div className={styles.pageHeaderTitle}>
            <span className={styles.categoryBadge}>PROJECT DETAIL</span>
            <h1 className={styles.projTitle}>{project.name}</h1>
            {project.description && (
              <p className={styles.projDesc}>{project.description}</p>
            )}
          </div>
        </div>
        <div className={styles.pageHeaderMeta}>
          <div className={styles.sidebarMetaItem}>
            <span className={styles.metaLabel}>PIC</span>
            <span className={styles.metaVal}>{project.pic || '—'}</span>
          </div>
          <div className={styles.sidebarMetaItem}>
            <span className={styles.metaLabel}>DEADLINE</span>
            <span className={styles.metaVal}>{formatDate(project.deadline)}</span>
          </div>
          <div className={styles.sidebarMetaItem}>
            <span className={styles.metaLabel}>ACTION ITEMS</span>
            <span className={styles.metaVal}>
              {project.actionItems.filter((a) => a.completed).length}/{project.actionItems.length} selesai
            </span>
          </div>
        </div>
      </header>

      {/* Two-column layout: sidebar + main */}
      <div className={styles.pageLayout}>

        {/* LEFT SIDEBAR: pipeline only */}
        <aside className={styles.projectSidebar}>

          {/* Vertical pipeline */}
          <div className={styles.sidebarPipeline}>
            <div className={styles.sidebarPipelineHeader}>
              <span className={styles.sidebarPipelineTitle}>Pipeline</span>
              {isCompleted ? (
                <span className={styles.completeBanner}>🎉 Selesai!</span>
              ) : (
                <button className={styles.advanceBtnSm} onClick={handleAdvanceStage}>
                  ⚡ Advance
                </button>
              )}
            </div>
            <div className={styles.verticalPipeline}>
              {project.stages.map((stage, idx) => {
                const isStageDone = idx < project.current_stage_index;
                const isStageActive = idx === project.current_stage_index;
                return (
                  <div key={stage.id} className={styles.verticalStageRow}>
                    <div className={styles.verticalStageTrack}>
                      <div className={`${styles.vNodeCircle} ${isStageDone ? styles.nodeDone : isStageActive ? styles.nodeActive : styles.nodeFuture}`}>
                        {isStageDone ? '✓' : idx + 1}
                      </div>
                      {idx < project.stages.length - 1 && (
                        <div className={`${styles.vNodeLine} ${idx < project.current_stage_index ? styles.stepLineDone : ''}`} />
                      )}
                    </div>
                    <div className={styles.verticalStageInfo}>
                      <span className={`${styles.vNodeName} ${isStageActive ? styles.nodeNameActive : ''}`}>
                        {stage.name}
                      </span>
                      {stage.completed_at && (
                        <span className={styles.completedAtDate}>{formatDate(stage.completed_at)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick stats */}
          <div className={styles.sidebarStats}>
            <div className={styles.sidebarStatItem}>
              <span className={styles.sidebarStatVal}>{project.artifacts.length}</span>
              <span className={styles.sidebarStatLabel}>Artifacts</span>
            </div>
          </div>
        </aside>


        {/* RIGHT MAIN: tabs + content */}
        <main className={styles.projectMain}>
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
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className={styles.addTabBtn}
                  onClick={() => {
                    setShowAddArtForm(!showAddArtForm);
                    setShowAddDocForm(false);
                  }}
                >
                  {showAddArtForm ? 'Batal' : '➕ Tambah Link'}
                </button>
                <button
                  className={styles.addTabBtn}
                  style={{ backgroundColor: '#10B981', color: 'white', borderColor: '#10B981' }}
                  onClick={() => {
                    setShowAddDocForm(!showAddDocForm);
                    setShowAddArtForm(false);
                  }}
                >
                  {showAddDocForm ? 'Batal' : '📝 Buat Catatan/Dokumen'}
                </button>
              </div>
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
                      onChange={(e) => handleUrlChange(e.target.value)}
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

            {/* Inline Add Local Document Form */}
            {showAddDocForm && (
              <form onSubmit={handleSaveLocalDoc} className={styles.inlineForm}>
                <h4>Buat Catatan / Dokumen Internal</h4>
                <p style={{ fontSize: '12px', color: 'var(--muted-text)', marginBottom: '12px' }}>
                  Tulis atau tempel informasi penting (materi brief dari WA, dll.) langsung di sini.
                </p>
                <div className={styles.formGroup}>
                  <label>Judul Catatan / Dokumen *</label>
                  <input
                    type="text"
                    required
                    value={newDocLabel}
                    onChange={(e) => setNewDocLabel(e.target.value)}
                    placeholder="Contoh: Brief Materi dari WA Client (23 Juni)"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Isi Dokumen *</label>
                  <textarea
                    required
                    rows={8}
                    value={newDocContent}
                    onChange={(e) => setNewDocContent(e.target.value)}
                    placeholder="Tulis konten dokumen di sini..."
                    style={{ fontFamily: 'inherit', padding: '10px' }}
                  />
                </div>
                <button type="submit" className={styles.submitBtn} style={{ backgroundColor: '#10B981', borderColor: '#10B981' }} disabled={isAddingArtifact}>
                  {isAddingArtifact ? 'Menyimpan...' : 'Simpan Catatan'}
                </button>
              </form>
            )}

            {/* Google Drive Folder Sync Panel */}
            {project.google_drive_folder_url && (
              <div className={styles.gdriveSyncPanel}>
                <div className={styles.gdriveSyncInfo}>
                  <span className={styles.gdriveIcon}>📁</span>
                  <div>
                    <h4>Folder Google Drive Terhubung</h4>
                    <a href={project.google_drive_folder_url} target="_blank" rel="noopener noreferrer" className={styles.gdriveLink}>
                      {project.google_drive_folder_url}
                    </a>
                  </div>
                </div>
                <div className={styles.gdriveSyncActions}>
                  <button 
                    className={`${styles.syncDriveBtn} ${isSyncingDrive ? styles.syncing : ''}`} 
                    onClick={() => handleSyncGDrive(false)}
                    disabled={isSyncingDrive || !project.google_api_key}
                    title={project.google_api_key ? "Sinkronisasi isi folder sekarang" : "Masukkan Google API Key di settings untuk mengaktifkan sync"}
                  >
                    {isSyncingDrive ? '🔄 Menyinkronkan...' : '🔄 Sinkronisasi Folder'}
                  </button>
                  {!project.google_api_key && (
                    <span className={styles.syncWarningText}>
                      ⚠️ Masukkan Google API Key di settings untuk melakukan sinkronisasi.
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Artifacts Filter Bar */}
            {project.artifacts.length > 0 && (
              <div className={styles.artFilterBar}>
                <button onClick={() => setArtFilter('all')} className={`${styles.filterBtn} ${artFilter === 'all' ? styles.activeFilter : ''}`}>Semua ({project.artifacts.length})</button>
                <button onClick={() => setArtFilter('link')} className={`${styles.filterBtn} ${artFilter === 'link' ? styles.activeFilter : ''}`}>Tautan Manual ({project.artifacts.filter(a => !a.is_synced && a.type !== 'document').length})</button>
                <button onClick={() => setArtFilter('synced')} className={`${styles.filterBtn} ${artFilter === 'synced' ? styles.activeFilter : ''}`}>Google Drive Synced ({project.artifacts.filter(a => a.is_synced).length})</button>
                <button onClick={() => setArtFilter('document')} className={`${styles.filterBtn} ${artFilter === 'document' ? styles.activeFilter : ''}`}>Catatan Internal ({project.artifacts.filter(a => a.type === 'document').length})</button>
              </div>
            )}

            {/* Artifacts List as structured table list */}
            <div className={styles.artifactsList}>
              {project.artifacts.length === 0 ? (
                <p className={styles.emptyTabMsg}>Belum ada dokumen yang disimpan.</p>
              ) : (() => {
                const filteredArtifacts = project.artifacts.filter((art) => {
                  if (artFilter === 'all') return true;
                  if (artFilter === 'link') return !art.is_synced && art.type !== 'document';
                  if (artFilter === 'synced') return art.is_synced;
                  if (artFilter === 'document') return art.type === 'document';
                  return true;
                });

                if (filteredArtifacts.length === 0) {
                  return <p className={styles.emptyTabMsg}>Tidak ada dokumen yang cocok dengan filter terpilih.</p>;
                }

                return (
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
                        {filteredArtifacts.map((art) => (
                          <tr key={art.id}>
                            <td className={styles.artLabelCell}>
                              <span className={styles.artIconCell}>{getArtifactIcon(art)}</span>
                              {art.type === 'document' ? (
                                <button onClick={() => handleOpenDocView(art)} className={styles.artTableDocLink}>
                                  {art.label}
                                </button>
                              ) : (
                                <a href={art.url} target="_blank" rel="noopener noreferrer" className={styles.artTableLink}>
                                  {art.label}
                                </a>
                              )}
                            </td>
                            <td>{art.description || '-'}</td>
                            <td className={styles.artUrlCell} title={art.type === 'document' ? 'Catatan Internal' : art.url}>
                              <span className={styles.artUrlText}>
                                {art.type === 'document' ? '📝 Catatan Internal' : art.url}
                              </span>
                            </td>
                            <td>
                              <div className={styles.artTableActions}>
                                {art.type === 'document' ? (
                                  <button className={styles.artEditBtn} onClick={() => handleOpenDocView(art)}>
                                    👁️ Lihat/Edit
                                  </button>
                                ) : (
                                  <button className={styles.artEditBtn} onClick={() => handleStartEditArtifact(art)}>
                                    ✏️ Edit
                                  </button>
                                )}
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
                );
              })()}
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
                <div className={styles.formGroup}>
                  <label>Link Folder Google Drive (Auto-Sync)</label>
                  <input
                    type="url"
                    value={settingsGDriveUrl}
                    onChange={(e) => setSettingsGDriveUrl(e.target.value)}
                    placeholder="https://drive.google.com/drive/folders/..."
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Google API Key</label>
                  <input
                    type="password"
                    value={settingsGDriveApiKey}
                    onChange={(e) => setSettingsGDriveApiKey(e.target.value)}
                    placeholder="Masukkan Google API Key untuk sinkronisasi..."
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Jira Project Key (e.g. PROJ)</label>
                  <input
                    type="text"
                    value={settingsJiraProjectKey}
                    onChange={(e) => setSettingsJiraProjectKey(e.target.value.toUpperCase())}
                    placeholder="Contoh: PROJ"
                  />
                  <span style={{ fontSize: '11px', color: 'var(--muted-text)', marginTop: '4px', display: 'block' }}>
                    Key proyek Jira Cloud Anda. Digunakan untuk sinkronisasi dua arah Action Items dan Team Load.
                  </span>
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
                    <input
                      type="date"
                      value={stage.completed_at ? stage.completed_at.substring(0, 10) : ''}
                      onChange={(e) => handleStageDateChange(idx, e.target.value)}
                      className={styles.stageManagerDateInput}
                      title="Atur Tanggal Tahapan"
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
                  <input
                    type="date"
                    value={newStageDate}
                    onChange={(e) => setNewStageDate(e.target.value)}
                    className={styles.addStageDateInput}
                    title="Atur Tanggal Tahapan Baru"
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

      {/* Viewing & Editing Local Document Modal */}
      {viewingDoc && (
        <div className={styles.modalOverlay} onClick={() => setViewingDoc(null)}>
          <div className={`${styles.modal} ${styles.largeModal} animate-popover`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{isEditingDoc ? '✏️ Edit Dokumen' : '📄 Detail Dokumen'}</h3>
              <button className={styles.closeBtn} onClick={() => setViewingDoc(null)}>×</button>
            </div>
            
            {isEditingDoc ? (
              <form onSubmit={handleSaveDocEdit}>
                <div className={styles.modalBody}>
                  <div className={styles.formGroup}>
                    <label>Judul Dokumen *</label>
                    <input
                      type="text"
                      required
                      value={editDocLabel}
                      onChange={(e) => setEditDocLabel(e.target.value)}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Konten Dokumen *</label>
                    <textarea
                      required
                      rows={15}
                      value={editDocContent}
                      onChange={(e) => setEditDocContent(e.target.value)}
                      style={{ fontFamily: 'inherit', padding: '10px' }}
                    />
                  </div>
                </div>
                <div className={styles.modalFooter}>
                  <button type="button" className={styles.cancelBtn} onClick={() => setIsEditingDoc(false)}>
                    Batal
                  </button>
                  <button type="submit" className={styles.submitBtn} style={{ backgroundColor: '#10B981', borderColor: '#10B981' }}>
                    Simpan Perubahan
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <div className={styles.modalBody}>
                  <h4 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px', color: 'var(--foreground)' }}>
                    {viewingDoc.label}
                  </h4>
                  <div style={{ fontSize: '11px', color: 'var(--muted-text)', marginBottom: '16px' }}>
                    Tipe: Catatan Internal • Disimpan lokal
                  </div>
                  <div className={styles.docContentDisplay}>
                    {viewingDoc.content ? (
                      viewingDoc.content.split('\n').map((para, i) => (
                        <p key={i} style={{ marginBottom: '8px', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                          {para}
                        </p>
                      ))
                    ) : (
                      <em style={{ color: 'var(--muted-text)' }}>Tidak ada konten.</em>
                    )}
                  </div>
                </div>
                <div className={styles.modalFooter}>
                  <button type="button" className={styles.cancelBtn} onClick={() => setViewingDoc(null)}>
                    Tutup
                  </button>
                  <button type="button" className={styles.submitBtn} style={{ backgroundColor: '#B45309', borderColor: '#B45309' }} onClick={() => setIsEditingDoc(true)}>
                    ✏️ Edit Dokumen
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
        </main>
      </div>
    </div>
  );
}
