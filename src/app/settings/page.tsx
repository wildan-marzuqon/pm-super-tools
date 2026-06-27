'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useModalDialog } from '@/components/ModalProvider';
import styles from './page.module.css';

interface SystemSetting {
  tgBotName: string;
  tgBotToken: string;
  tgBotPin: string;
  geminiApiKey: string;
  appUrl: string;
  jiraUrl: string;
  jiraEmail: string;
  jiraToken: string;
  actionItemStatuses?: string[];
}

function SettingsContent() {
  const { alert } = useModalDialog();
  const [activeTab, setActiveTab] = useState<'telegram' | 'jira' | 'statuses'>('telegram');
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [newStatusInput, setNewStatusInput] = useState('');

  // Drag and drop refs
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // Settings State
  const [settings, setSettings] = useState<SystemSetting>({
    tgBotName: '',
    tgBotToken: '',
    tgBotPin: '1234',
    geminiApiKey: '',
    appUrl: '',
    jiraUrl: '',
    jiraEmail: '',
    jiraToken: '',
    actionItemStatuses: []
  });

  const [settingsFeedback, setSettingsFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Load Settings
  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/wa-copilot/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings({
          tgBotName: data.tgBotName || '',
          tgBotToken: data.tgBotToken || '',
          tgBotPin: data.tgBotPin || '1234',
          geminiApiKey: data.geminiApiKey || '',
          appUrl: data.appUrl || '',
          jiraUrl: data.jiraUrl || '',
          jiraEmail: data.jiraEmail || '',
          jiraToken: data.jiraToken || '',
          actionItemStatuses: data.actionItemStatuses || ["Pending", "Open", "In Progress", "Selesai"]
        });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // Drag and Drop Handlers
  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = () => {
    if (dragItem.current !== null && dragOverItem.current !== null) {
      const copyListItems = [...(settings.actionItemStatuses || [])];
      const dragItemContent = copyListItems[dragItem.current];
      copyListItems.splice(dragItem.current, 1);
      copyListItems.splice(dragOverItem.current, 0, dragItemContent);
      dragItem.current = null;
      dragOverItem.current = null;
      setSettings(prev => ({
        ...prev,
        actionItemStatuses: copyListItems
      }));
    }
  };

  const handleAddStatus = () => {
    const trimmed = newStatusInput.trim();
    if (!trimmed) return;
    const currentList = settings.actionItemStatuses || [];
    if (currentList.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      alert('Status tersebut sudah ada!');
      return;
    }
    setSettings(prev => ({
      ...prev,
      actionItemStatuses: [...currentList, trimmed]
    }));
    setNewStatusInput('');
  };

  const handleDeleteStatus = (index: number) => {
    const currentList = settings.actionItemStatuses || [];
    if (currentList.length <= 1) {
      alert('Minimal harus ada 1 status!');
      return;
    }
    const updated = currentList.filter((_, i) => i !== index);
    setSettings(prev => ({
      ...prev,
      actionItemStatuses: updated
    }));
  };

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
        if (data.webhookRegistered || !settings.tgBotToken) {
          setSettingsFeedback({
            type: 'success',
            message: 'Pengaturan berhasil disimpan!' + (data.webhookRegistered ? ' Webhook Telegram sukses didaftarkan.' : '')
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

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>Memuat Pengaturan...</div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} animate-fade-in`}>
      <header className={styles.header}>
        <h1 className={styles.title}>⚙️ Pengaturan Aplikasi</h1>
        <p className={styles.subtitle}>Konfigurasi bot Telegram, model AI Gemini, status action item, dan kredensial Jira Cloud Anda secara terpusat.</p>
      </header>

      <div className={styles.tabs}>
        <button
          type="button"
          onClick={() => setActiveTab('telegram')}
          className={`${styles.tab} ${activeTab === 'telegram' ? styles.activeTab : ''}`}
        >
          🤖 Telegram & AI
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('statuses')}
          className={`${styles.tab} ${activeTab === 'statuses' ? styles.activeTab : ''}`}
        >
          📋 Status Action Item
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('jira')}
          className={`${styles.tab} ${activeTab === 'jira' ? styles.activeTab : ''}`}
        >
          🔄 Jira Cloud
        </button>
      </div>

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

        {activeTab === 'telegram' && (
          <div className={styles.tabContent}>
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
          </div>
        )}

        {activeTab === 'statuses' && (
          <div className={styles.tabContent}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Daftar Status Action Item (Geser untuk Mengatur Urutan)</label>
              
              <div className={styles.statusesListContainer}>
                {(settings.actionItemStatuses || []).map((status, index) => (
                  <div
                    key={status}
                    className={styles.statusDragItem}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragEnter={() => handleDragEnter(index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                  >
                    <div className={styles.statusDragContent}>
                      <span className={styles.dragHandle}>☰</span>
                      <span className={styles.statusNameBadge}>{status}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteStatus(index)}
                      className={styles.deleteStatusBtn}
                      title="Hapus Status"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              
              <div className={styles.addStatusContainer} style={{ marginTop: '16px' }}>
                <input
                  type="text"
                  placeholder="Tambahkan status baru (misal: Testing, Backlog)..."
                  className={styles.formInput}
                  value={newStatusInput}
                  onChange={(e) => setNewStatusInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddStatus();
                    }
                  }}
                  style={{ flexGrow: 1 }}
                />
                <button
                  type="button"
                  onClick={handleAddStatus}
                  className={styles.addStatusBtn}
                >
                  + Tambah
                </button>
              </div>
              <span className={styles.formHelp}>
                Urutan di atas menentukan urutan prioritas di halaman Action Items (paling atas adalah prioritas utama). Status yang cocok dengan "done" atau "selesai" (atau status terakhir) akan dianggap menyelesaikan tugas.
              </span>
            </div>
          </div>
        )}

        {activeTab === 'jira' && (
          <div className={styles.tabContent}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>URL Jira Cloud</label>
              <input
                type="url"
                placeholder="Contoh: https://nama-domain.atlassian.net"
                className={styles.formInput}
                value={settings.jiraUrl}
                onChange={e => setSettings({ ...settings, jiraUrl: e.target.value })}
              />
              <span className={styles.formHelp}>URL lengkap workspace Jira Cloud Anda.</span>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Email Akun Atlassian</label>
              <input
                type="email"
                placeholder="Contoh: email@perusahaan.com"
                className={styles.formInput}
                value={settings.jiraEmail}
                onChange={e => setSettings({ ...settings, jiraEmail: e.target.value })}
              />
              <span className={styles.formHelp}>Email yang digunakan untuk masuk ke akun Atlassian/Jira Anda.</span>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>API Token Atlassian</label>
              <input
                type="password"
                placeholder="Masukkan API Token Anda"
                className={styles.formInput}
                value={settings.jiraToken}
                onChange={e => setSettings({ ...settings, jiraToken: e.target.value })}
              />
              <span className={styles.formHelp}>
                API Token Atlassian. Dapatkan token di:{' '}
                <a
                  href="https://id.atlassian.com/manage-profile/security/api-tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#B45309', textDecoration: 'underline', fontWeight: '600' }}
                >
                  Atlassian API Tokens
                </a>.
              </span>
            </div>
          </div>
        )}

        <button type="submit" disabled={savingSettings} className={styles.saveButton}>
          {savingSettings ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </button>
      </form>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className={styles.loadingContainer}>Memuat Pengaturan...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
