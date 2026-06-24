'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useModalDialog } from '@/components/ModalProvider';
import styles from './page.module.css';

interface Project {
  id: string;
  name: string;
}

interface WACopilotDraft {
  id: string;
  type: 'action_item' | 'decision' | 'blocker';
  title: string;
  description: string;
  pic: string;
  deadline: string;
  projectId?: string | null;
  createdAt: string;
}

interface SystemSetting {
  tgBotName: string;
  tgBotToken: string;
  tgBotPin: string;
  geminiApiKey: string;
  appUrl: string;
}

function WaCopilotContent() {
  const searchParams = useSearchParams();
  const highlightIds = searchParams.get('drafts') || '';
  const { alert: showAlertDialog } = useModalDialog();

  const [activeTab, setActiveTab] = useState<'drafts' | 'settings'>('drafts');
  const [drafts, setDrafts] = useState<WACopilotDraft[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [processingDraftId, setProcessingDraftId] = useState<string | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'action_item' | 'decision' | 'blocker'>('all');

  // Settings State
  const [settings, setSettings] = useState<SystemSetting>({
    tgBotName: '',
    tgBotToken: '',
    tgBotPin: '1234',
    geminiApiKey: '',
    appUrl: ''
  });

  const [settingsFeedback, setSettingsFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<{
    title: string;
    description: string;
    pic: string;
    deadline: string;
    projectId: string;
    severity?: 'low' | 'medium' | 'high';
  }>({
    title: '',
    description: '',
    pic: '',
    deadline: '',
    projectId: '',
    severity: 'medium'
  });

  // Load all data
  const loadData = async () => {
    setLoading(true);
    try {
      const draftsUrl = highlightIds ? `/api/wa-copilot?ids=${highlightIds}` : '/api/wa-copilot';
      const [draftsRes, projectsRes, settingsRes] = await Promise.all([
        fetch(draftsUrl),
        fetch('/api/projects'),
        fetch('/api/wa-copilot/settings')
      ]);

      if (draftsRes.ok) setDrafts(await draftsRes.json());
      if (projectsRes.ok) setProjects(await projectsRes.json());
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setSettings({
          tgBotName: settingsData.tgBotName || '',
          tgBotToken: settingsData.tgBotToken || '',
          tgBotPin: settingsData.tgBotPin || '1234',
          geminiApiKey: settingsData.geminiApiKey || '',
          appUrl: settingsData.appUrl || ''
        });
      }
    } catch (error) {
      console.error('Failed to load WA Copilot data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [highlightIds]);

  // Handle saving settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsFeedback(null);

    try {
      const res = await fetch('/api/wa-copilot/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (data.webhookRegistered) {
          setSettingsFeedback({
            type: 'success',
            message: 'Pengaturan berhasil disimpan dan Webhook Telegram sukses didaftarkan!'
          });
        } else {
          setSettingsFeedback({
            type: 'error',
            message: `Pengaturan disimpan, namun GAGAL mendaftarkan Webhook Telegram: ${data.webhookError || 'Unknown Error'}. Harap periksa Token Bot Anda.`
          });
        }
      } else {
        setSettingsFeedback({
          type: 'error',
          message: data.error || 'Gagal menyimpan pengaturan.'
        });
      }
    } catch (error: any) {
      setSettingsFeedback({
        type: 'error',
        message: `Terjadi kesalahan jaringan: ${error.message || 'Error'}`
      });
    } finally {
      setSavingSettings(false);
    }
  };

  // Start editing a draft inline
  const startEdit = (draft: WACopilotDraft) => {
    setEditingId(draft.id);
    
    let severity: 'low' | 'medium' | 'high' = 'medium';
    let cleanDesc = draft.description;
    
    if (draft.type === 'blocker') {
      const severityMatch = draft.description.match(/Keparahan: (low|medium|high)/i);
      if (severityMatch && severityMatch[1]) {
        severity = severityMatch[1].toLowerCase() as 'low' | 'medium' | 'high';
      }
      cleanDesc = draft.description.replace(/Dampak: /g, '').replace(/Keparahan: (low|medium|high)/gi, '').trim();
    }

    setEditFields({
      title: draft.title,
      description: cleanDesc,
      pic: draft.pic,
      deadline: draft.deadline,
      projectId: draft.projectId || '',
      severity
    });
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingId(null);
  };

  // Save draft changes locally in state
  const saveLocalDraft = (id: string) => {
    let desc = editFields.description;
    if (editingId && drafts.find(d => d.id === id)?.type === 'blocker') {
      desc = `Dampak: ${editFields.description}\nKeparahan: ${editFields.severity || 'medium'}`;
    }

    setDrafts(prev =>
      prev.map(d =>
        d.id === id
          ? {
              ...d,
              title: editFields.title,
              description: desc,
              pic: editFields.pic,
              deadline: editFields.deadline,
              projectId: editFields.projectId || null
            }
          : d
      )
    );
    setEditingId(null);
  };

  // Quick update project on the card
  const handleUpdateProject = (id: string, projectId: string) => {
    setDrafts(prev =>
      prev.map(d => (d.id === id ? { ...d, projectId: projectId || null } : d))
    );
  };

  // Ignore draft
  const handleIgnore = async (id: string) => {
    setProcessingDraftId(id);
    try {
      const res = await fetch('/api/wa-copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ignore', draftId: id })
      });

      if (res.ok) {
        setDrafts(prev => prev.filter(d => d.id !== id));
      }
    } catch (err) {
      console.error('Error ignoring draft:', err);
    } finally {
      setProcessingDraftId(null);
    }
  };

  // Approve and sync draft
  const handleApprove = async (id: string) => {
    const draft = drafts.find(d => d.id === id);
    if (!draft) return;

    // Check project validation
    if (!draft.projectId) {
      showAlertDialog('Pilih Proyek Terlebih Dahulu sebelum menyetujui draf!', 'error');
      return;
    }

    setProcessingDraftId(id);

    let finalDesc = draft.description;
    let severity = 'medium';

    if (draft.type === 'blocker') {
      const severityMatch = draft.description.match(/Keparahan: (low|medium|high)/i);
      if (severityMatch && severityMatch[1]) {
        severity = severityMatch[1].toLowerCase();
      }
      finalDesc = draft.description.replace(/Dampak: /i, '').replace(/Keparahan: (low|medium|high)/gi, '').trim();
    }

    const payload = {
      action: 'approve',
      draftId: id,
      updatedData: {
        title: draft.title,
        description: finalDesc,
        pic: draft.pic,
        deadline: draft.deadline,
        projectId: draft.projectId,
        severity
      }
    };

    try {
      const res = await fetch('/api/wa-copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setDrafts(prev => prev.filter(d => d.id !== id));
      } else {
        const errorData = await res.json();
        showAlertDialog(`Gagal menyetujui draf: ${errorData.error || 'Server error'}`, 'error');
      }
    } catch (err: any) {
      console.error('Error approving draft:', err);
      showAlertDialog(`Terjadi kesalahan: ${err.message || 'Error'}`, 'error');
    } finally {
      setProcessingDraftId(null);
    }
  };

  // Filter drafts based on search query and category tab
  const filteredDrafts = drafts.filter(draft => {
    const matchesSearch =
      searchQuery.trim() === '' ||
      draft.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      draft.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      draft.pic.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = filterType === 'all' || draft.type === filterType;

    return matchesSearch && matchesType;
  });

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>WA Copilot</h1>
        <p className={styles.subtitle}>
          Tinjau draf action items, keputusan, dan blocker proyek dari WhatsApp yang diproses oleh AI.
        </p>
      </header>

      <div className={styles.tabs}>
        <button
          onClick={() => setActiveTab('drafts')}
          className={`${styles.tab} ${activeTab === 'drafts' ? styles.activeTab : ''}`}
        >
          Tinjau Draf ({drafts.length})
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`${styles.tab} ${activeTab === 'settings' ? styles.activeTab : ''}`}
        >
          Pengaturan Bot
        </button>
      </div>

      {loading ? (
        <div className={styles.loadingContainer}>Memuat data...</div>
      ) : activeTab === 'drafts' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* SEARCH AND FILTER TOOLBAR */}
          <div className={styles.toolbar}>
            <div className={styles.searchGroup}>
              <svg
                className={styles.searchIcon}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Cari draf..."
                className={styles.searchInput}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <div className={styles.filterGroup}>
              <button
                onClick={() => setFilterType('all')}
                className={`${styles.filterTab} ${filterType === 'all' ? styles.activeFilterTab : ''}`}
              >
                Semua ({drafts.length})
              </button>
              <button
                onClick={() => setFilterType('action_item')}
                className={`${styles.filterTab} ${filterType === 'action_item' ? styles.activeFilterTab : ''}`}
              >
                📋 Action Item ({drafts.filter(d => d.type === 'action_item').length})
              </button>
              <button
                onClick={() => setFilterType('decision')}
                className={`${styles.filterTab} ${filterType === 'decision' ? styles.activeFilterTab : ''}`}
              >
                🎯 Keputusan ({drafts.filter(d => d.type === 'decision').length})
              </button>
              <button
                onClick={() => setFilterType('blocker')}
                className={`${styles.filterTab} ${filterType === 'blocker' ? styles.activeFilterTab : ''}`}
              >
                ⚠️ Blocker ({drafts.filter(d => d.type === 'blocker').length})
              </button>
            </div>
          </div>

          {/* DRAFTS COMPACT LIST */}
          <div className={styles.draftList}>
            {filteredDrafts.length === 0 ? (
              <div className={styles.emptyState}>
                <h3 className={styles.emptyTitle}>Tidak Ada Draf Cocok</h3>
                <p className={styles.emptyText}>
                  {drafts.length === 0
                    ? 'Belum ada draf hasil ekstraksi WhatsApp di database. Kirimkan berkas ZIP chat WhatsApp Anda ke bot Telegram untuk mulai mendeteksi!'
                    : 'Tidak ada draf yang sesuai dengan filter pencarian atau kategori Anda.'}
                </p>
              </div>
            ) : (
              filteredDrafts.map(draft => {
                const isEditing = editingId === draft.id;
                const isProcessing = processingDraftId === draft.id;

                if (isEditing) {
                  return (
                    <div key={draft.id} className={styles.draftCard}>
                      <div className={styles.draftHeader}>
                        <span className={`${styles.typeBadge} ${styles[`badge_${draft.type}`]}`}>
                          {draft.type === 'action_item' && '📋 Action Item'}
                          {draft.type === 'decision' && '🎯 Keputusan'}
                          {draft.type === 'blocker' && '⚠️ Blocker'}
                        </span>
                        <span className={styles.draftDate}>Edit Mode</span>
                      </div>
                      <div className={styles.editorForm}>
                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>Judul / Ringkasan</label>
                          <input
                            type="text"
                            className={styles.formInput}
                            value={editFields.title}
                            onChange={e => setEditFields({ ...editFields, title: e.target.value })}
                          />
                        </div>

                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>
                            {draft.type === 'blocker' ? 'Dampak Risiko' : 'Deskripsi Detail'}
                          </label>
                          <textarea
                            className={`${styles.formInput} ${styles.textarea}`}
                            value={editFields.description}
                            onChange={e => setEditFields({ ...editFields, description: e.target.value })}
                          />
                        </div>

                        <div className={styles.editorRow}>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>PIC / Pelaksana</label>
                            <input
                              type="text"
                              className={styles.formInput}
                              value={editFields.pic}
                              onChange={e => setEditFields({ ...editFields, pic: e.target.value })}
                            />
                          </div>

                          {draft.type === 'action_item' && (
                            <div className={styles.formGroup}>
                              <label className={styles.formLabel}>Tenggat Waktu (Deadline)</label>
                              <input
                                type="text"
                                className={styles.formInput}
                                placeholder="YYYY-MM-DD"
                                value={editFields.deadline}
                                onChange={e => setEditFields({ ...editFields, deadline: e.target.value })}
                              />
                            </div>
                          )}

                          {draft.type === 'blocker' && (
                            <div className={styles.formGroup}>
                              <label className={styles.formLabel}>Tingkat Keparahan</label>
                              <select
                                className={styles.formInput}
                                value={editFields.severity || 'medium'}
                                onChange={e =>
                                  setEditFields({
                                    ...editFields,
                                    severity: e.target.value as 'low' | 'medium' | 'high'
                                  })
                                }
                              >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                              </select>
                            </div>
                          )}
                        </div>

                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>Hubungkan ke Project (Wajib)</label>
                          <select
                            className={styles.formInput}
                            value={editFields.projectId}
                            onChange={e => setEditFields({ ...editFields, projectId: e.target.value })}
                          >
                            <option value="">-- Pilih Project --</option>
                            {projects.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className={styles.cardActions}>
                          <button onClick={cancelEdit} className={`${styles.btn} ${styles.btnSecondary}`}>
                            Batal
                          </button>
                          <button
                            onClick={() => saveLocalDraft(draft.id)}
                            className={`${styles.btn} ${styles.btnPrimary}`}
                          >
                            Simpan Perubahan
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={draft.id} className={styles.draftRow}>
                    {/* TYPE ICON BADGE */}
                    <span
                      className={`${styles.typeBadge} ${styles[`badge_${draft.type}`]}`}
                      title={
                        draft.type === 'action_item'
                          ? 'Action Item'
                          : draft.type === 'decision'
                          ? 'Keputusan'
                          : 'Blocker'
                      }
                      style={{ padding: '6px 10px' }}
                    >
                      {draft.type === 'action_item' && '📋 Action Item'}
                      {draft.type === 'decision' && '🎯 Keputusan'}
                      {draft.type === 'blocker' && '⚠️ Blocker'}
                    </span>

                    {/* MAIN CONTENT (Title & Description truncated) */}
                    <div className={styles.draftContent}>
                      <div className={styles.draftTitleText} title={draft.title}>
                        {draft.title}
                      </div>
                      {draft.description && (
                        <div className={styles.draftDescText} title={draft.description}>
                          {draft.description.replace(/^Dampak: /i, '').replace(/\nKeparahan:.*/gi, '')}
                        </div>
                      )}
                    </div>

                    {/* PIC & DEADLINE METADATA */}
                    <div className={styles.draftMetaCol}>
                      {draft.pic && (
                        <span className={styles.metaBadge} title={`PIC: ${draft.pic}`}>
                          👤 {draft.pic.split(' ')[0]}
                        </span>
                      )}
                      {draft.deadline && (
                        <span className={styles.metaBadge} title={`Tenggat: ${draft.deadline}`}>
                          📅 {draft.deadline}
                        </span>
                      )}
                    </div>

                    {/* PROJECT SELECTOR DROPDOWN */}
                    <div className={styles.projectSelectorGroup}>
                      <select
                        className={styles.projectSelector}
                        value={draft.projectId || ''}
                        onChange={e => handleUpdateProject(draft.id, e.target.value)}
                      >
                        <option value="">-- Proyek (Wajib) --</option>
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* ICON ACTIONS */}
                    <div className={styles.rowActions}>
                      <button
                        disabled={isProcessing}
                        onClick={() => startEdit(draft)}
                        className={styles.iconBtn}
                        title="Edit Draf"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        disabled={isProcessing}
                        onClick={() => handleIgnore(draft.id)}
                        className={`${styles.iconBtn} ${styles.iconBtnIgnore}`}
                        title="Abaikan Draf"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                      <button
                        disabled={isProcessing}
                        onClick={() => handleApprove(draft.id)}
                        className={`${styles.iconBtn} ${styles.iconBtnApprove}`}
                        title="Setujui & Sinkronkan"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSaveSettings} className={styles.settingsForm}>
          {settingsFeedback && (
            <div
              className={`${styles.alert} ${
                settingsFeedback.type === 'success' ? styles.alertSuccess : styles.alertError
              }`}
            >
              {settingsFeedback.message}
            </div>
          )}

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Username Bot Telegram</label>
            <input
              type="text"
              placeholder="Contoh: SuperPM_Copilot_Bot"
              className={styles.formInput}
              value={settings.tgBotName}
              onChange={e => setSettings({ ...settings, tgBotName: e.target.value })}
            />
            <span className={styles.formHelp}>Masukkan nama bot Telegram Anda (tanpa tanda @).</span>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Token Bot Telegram</label>
            <input
              type="password"
              placeholder="••••••••••••••••••••••••"
              className={styles.formInput}
              value={settings.tgBotToken}
              onChange={e => setSettings({ ...settings, tgBotToken: e.target.value })}
            />
            <span className={styles.formHelp}>
              Didapat dari @BotFather di Telegram saat Anda membuat bot baru.
            </span>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>PIN Keamanan Bot</label>
            <input
              type="text"
              className={styles.formInput}
              value={settings.tgBotPin}
              onChange={e => setSettings({ ...settings, tgBotPin: e.target.value })}
            />
            <span className={styles.formHelp}>
              PIN angka bebas untuk verifikasi akses awal saat chat bot Telegram Anda.
            </span>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Google Gemini API Key</label>
            <input
              type="password"
              placeholder="••••••••••••••••••••••••"
              className={styles.formInput}
              value={settings.geminiApiKey}
              onChange={e => setSettings({ ...settings, geminiApiKey: e.target.value })}
            />
            <span className={styles.formHelp}>
              API Key Google Gemini untuk memproses penguraian percakapan chat.
            </span>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>URL Aplikasi (App URL)</label>
            <input
              type="url"
              placeholder="e.g. https://pm-super-tools.vercel.app atau domain ngrok"
              className={styles.formInput}
              value={settings.appUrl}
              onChange={e => setSettings({ ...settings, appUrl: e.target.value })}
            />
            <span className={styles.formHelp}>
              Domain publik tempat aplikasi berjalan. Jika mencoba di lokal, Anda harus menggunakan tunnel publik (seperti ngrok) dan memasukkan URL ngrok tersebut di sini agar Telegram dapat mengirim data ke komputer Anda.
            </span>
          </div>

          <button type="submit" disabled={savingSettings} className={styles.saveButton}>
            {savingSettings ? 'Menyimpan & Mendaftarkan Webhook...' : 'Simpan & Daftarkan Webhook'}
          </button>
        </form>
      )}
    </div>
  );
}

export default function WaCopilotPage() {
  return (
    <Suspense fallback={<div className={styles.loadingContainer}>Memuat Dashboard WA Copilot...</div>}>
      <WaCopilotContent />
    </Suspense>
  );
}
