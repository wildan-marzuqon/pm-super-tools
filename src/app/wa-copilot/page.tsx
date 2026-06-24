'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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

  const [activeTab, setActiveTab] = useState<'drafts' | 'settings'>('drafts');
  const [drafts, setDrafts] = useState<WACopilotDraft[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [processingDraftId, setProcessingDraftId] = useState<string | null>(null);

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
      // Load drafts
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
            message: `Pengaturan disimpan, namun GAGAL mendaftarkan Webhook Telegram: ${data.webhookError || 'Unknown Error'}. Harap periksa Token Bot dan App URL Anda.`
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
    
    // Check if description has blocker severity mapped
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
    setProcessingDraftId(id);
    const draft = drafts.find(d => d.id === id);
    if (!draft) return;

    // Build the payload
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
        projectId: draft.projectId || null,
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
        alert(`Gagal approve draft: ${errorData.error || 'Server error'}`);
      }
    } catch (err) {
      console.error('Error approving draft:', err);
    } finally {
      setProcessingDraftId(null);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>WA Copilot Insights</h1>
        <p className={styles.subtitle}>
          Urai draf action items, keputusan penting, dan blocker proyek yang dikirim via bot Telegram Anda.
        </p>
      </header>

      <div className={styles.tabs}>
        <button
          onClick={() => setActiveTab('drafts')}
          className={`${styles.tab} ${activeTab === 'drafts' ? styles.activeTab : ''}`}
        >
          Drafts Review ({drafts.length})
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`${styles.tab} ${activeTab === 'settings' ? styles.activeTab : ''}`}
        >
          Bot Settings
        </button>
      </div>

      {loading ? (
        <div className={styles.loadingContainer}>Memuat data...</div>
      ) : activeTab === 'drafts' ? (
        <div className={styles.draftList}>
          {drafts.length === 0 ? (
            <div className={styles.emptyState}>
              <h3 className={styles.emptyTitle}>Tidak Ada Draf Tertunda</h3>
              <p className={styles.emptyText}>
                Belum ada draf hasil ekstraksi WhatsApp di database. Kirimkan berkas ZIP chat WhatsApp Anda ke bot Telegram untuk mulai mendeteksi otomatis!
              </p>
            </div>
          ) : (
            drafts.map(draft => {
              const isEditing = editingId === draft.id;
              const isProcessing = processingDraftId === draft.id;

              return (
                <div key={draft.id} className={styles.draftCard}>
                  <div className={styles.draftHeader}>
                    <span className={`${styles.typeBadge} ${styles[`badge_${draft.type}`]}`}>
                      {draft.type === 'action_item' && '📋 Action Item'}
                      {draft.type === 'decision' && '🎯 Keputusan'}
                      {draft.type === 'blocker' && '⚠️ Blocker'}
                    </span>
                    <span className={styles.draftDate}>
                      {new Date(draft.createdAt).toLocaleString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>

                  {isEditing ? (
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
                          {draft.type === 'blocker' ? 'Dampak Risiko' : 'Keterangan Detail'}
                        </label>
                        <textarea
                          className={`${styles.formInput} ${styles.textarea}`}
                          value={editFields.description}
                          onChange={e => setEditFields({ ...editFields, description: e.target.value })}
                        />
                      </div>

                      <div className={styles.editorRow}>
                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>Assignee / PIC</label>
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
                              placeholder="YYYY-MM-DD atau teks bebas"
                              value={editFields.deadline}
                              onChange={e => setEditFields({ ...editFields, deadline: e.target.value })}
                            />
                          </div>
                        )}

                        {draft.type === 'blocker' && (
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Keparahan (Severity)</label>
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
                        <label className={styles.formLabel}>Hubungkan ke Project (Opsional)</label>
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
                  ) : (
                    <div className={styles.draftBody}>
                      <h3 className={styles.draftTitle}>{draft.title}</h3>
                      {draft.description && <p className={styles.draftDesc}>{draft.description}</p>}

                      <div className={styles.draftMeta}>
                        {draft.pic && (
                          <span className={styles.metaItem}>
                            <span className={styles.metaLabel}>PIC:</span> {draft.pic}
                          </span>
                        )}
                        {draft.deadline && (
                          <span className={styles.metaItem}>
                            <span className={styles.metaLabel}>Deadline:</span> {draft.deadline}
                          </span>
                        )}
                        {draft.projectId && (
                          <span className={styles.metaItem}>
                            <span className={styles.metaLabel}>Project:</span>{' '}
                            {projects.find(p => p.id === draft.projectId)?.name || 'Unknown'}
                          </span>
                        )}
                      </div>

                      <div className={styles.cardActions} style={{ marginTop: '16px' }}>
                        <button
                          disabled={isProcessing}
                          onClick={() => startEdit(draft)}
                          className={`${styles.btn} ${styles.btnSecondary}`}
                        >
                          Edit
                        </button>
                        <button
                          disabled={isProcessing}
                          onClick={() => handleIgnore(draft.id)}
                          className={`${styles.btn} ${styles.btnDanger}`}
                        >
                          {isProcessing && processingDraftId === draft.id ? 'Loading...' : 'Ignore'}
                        </button>
                        <button
                          disabled={isProcessing}
                          onClick={() => handleApprove(draft.id)}
                          className={`${styles.btn} ${styles.btnPrimary}`}
                        >
                          {isProcessing && processingDraftId === draft.id
                            ? 'Processing...'
                            : 'Approve & Sync'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
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
            <label className={styles.formLabel}>Telegram Bot Username</label>
            <input
              type="text"
              placeholder="e.g. SuperPM_Copilot_Bot"
              className={styles.formInput}
              value={settings.tgBotName}
              onChange={e => setSettings({ ...settings, tgBotName: e.target.value })}
            />
            <span className={styles.formHelp}>Masukkan nama bot Telegram Anda (tanpa tanda @).</span>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Telegram Bot Token</label>
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
            <label className={styles.formLabel}>PIN Keamanan Bot (Bot Security PIN)</label>
            <input
              type="text"
              className={styles.formInput}
              value={settings.tgBotPin}
              onChange={e => setSettings({ ...settings, tgBotPin: e.target.value })}
            />
            <span className={styles.formHelp}>
              PIN angka bebas yang wajib diinput di Telegram pertama kali untuk memverifikasi akun Anda.
            </span>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Gemini API Key</label>
            <input
              type="password"
              placeholder="••••••••••••••••••••••••"
              className={styles.formInput}
              value={settings.geminiApiKey}
              onChange={e => setSettings({ ...settings, geminiApiKey: e.target.value })}
            />
            <span className={styles.formHelp}>
              API Key Google Gemini untuk memproses penguraian chat AI.
            </span>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Application URL (App URL)</label>
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
            {savingSettings ? 'Saving & Registering...' : 'Save & Register Webhook'}
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
