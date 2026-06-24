'use client';

import { useEffect, useState, Suspense } from 'react';
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
}

function SettingsContent() {
  const { alert } = useModalDialog();
  const [activeTab, setActiveTab] = useState<'telegram' | 'jira'>('telegram');
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // Settings State
  const [settings, setSettings] = useState<SystemSetting>({
    tgBotName: '',
    tgBotToken: '',
    tgBotPin: '1234',
    geminiApiKey: '',
    appUrl: '',
    jiraUrl: '',
    jiraEmail: '',
    jiraToken: ''
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
          jiraToken: data.jiraToken || ''
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
        <p className={styles.subtitle}>Konfigurasi bot Telegram, model AI Gemini, dan kredensial Jira Cloud Anda secara terpusat.</p>
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

        {activeTab === 'telegram' ? (
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
        ) : (
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
