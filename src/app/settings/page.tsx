'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
  jiraSyncStatuses?: string[];
  jiraSyncDaysBack?: number;
  jiraSyncMaxResults?: number;
}

function SettingsContent() {
  const router = useRouter();
  const { alert } = useModalDialog();
  const [activeTab, setActiveTab] = useState<'telegram' | 'jira' | 'statuses' | 'rbac'>('telegram');
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
    actionItemStatuses: [],
    jiraSyncStatuses: ['To Do', 'In Progress', 'Done'],
    jiraSyncDaysBack: 30,
    jiraSyncMaxResults: 500
  });

  const [settingsFeedback, setSettingsFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Current user state
  const [currentUser, setCurrentUser] = useState<any>(null);

  // RBAC States
  const [usersList, setUsersList] = useState<any[]>([]);
  const [rolesList, setRolesList] = useState<any[]>([]);
  const [capabilitiesList, setCapabilitiesList] = useState<any[]>([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    roleIds: [] as string[]
  });
  const [isSavingUser, setIsSavingUser] = useState(false);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);

        const roles = data.user?.roles || [];
        const caps = data.user?.capabilities || [];
        if (!roles.includes('Super Admin') && !caps.includes('view_settings')) {
          router.push('/unauthorized');
        }
      } else {
        router.push('/login');
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const fetchRbacData = async () => {
    try {
      const [uRes, rRes, cRes] = await Promise.all([
        fetch('/api/rbac/users'),
        fetch('/api/rbac/roles'),
        fetch('/api/rbac/capabilities')
      ]);
      if (uRes.ok && rRes.ok && cRes.ok) {
        setUsersList(await uRes.json());
        setRolesList(await rRes.json());
        setCapabilitiesList(await cRes.json());
      }
    } catch (err) {
      console.error('Failed to load RBAC data:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'rbac') {
      fetchRbacData();
    }
  }, [activeTab]);

  const handleToggleRoleCapability = async (roleId: string, capabilityId: string, checked: boolean) => {
    setRolesList(prev =>
      prev.map(role => {
        if (role.id !== roleId) return role;
        
        let newCaps = [...role.capabilities];
        if (checked) {
          newCaps.push({ roleId, capabilityId });
        } else {
          newCaps = newCaps.filter((rc: any) => rc.capabilityId !== capabilityId);
        }
        return { ...role, capabilities: newCaps };
      })
    );

    try {
      const roleObj = rolesList.find(r => r.id === roleId);
      if (!roleObj) return;

      const currentCapIds = roleObj.capabilities.map((rc: any) => rc.capabilityId);
      const nextCapIds = checked
        ? [...currentCapIds, capabilityId]
        : currentCapIds.filter((id: string) => id !== capabilityId);

      await fetch('/api/rbac/roles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roleId,
          capabilityIds: nextCapIds
        })
      });
    } catch (err) {
      console.error('Error updating role capabilities:', err);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.name || !userForm.email || isSavingUser) return;
    if (!editingUser && !userForm.password) {
      alert('Password wajib diisi untuk pengguna baru');
      return;
    }

    setIsSavingUser(true);
    try {
      const method = editingUser ? 'PUT' : 'POST';
      const body = editingUser 
        ? { userId: editingUser.id, ...userForm }
        : userForm;

      const res = await fetch('/api/rbac/users', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        setShowAddUserModal(false);
        fetchRbacData();
      } else {
        const errorData = await res.json();
        alert('Gagal menyimpan user: ' + (errorData.error || 'Terjadi kesalahan'));
      }
    } catch (err: any) {
      console.error('Error saving user:', err);
      alert('Error saving user: ' + err.message);
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus pengguna ini?')) return;

    try {
      const res = await fetch(`/api/rbac/users?id=${userId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        fetchRbacData();
      } else {
        const errorData = await res.json();
        alert('Gagal menghapus user: ' + (errorData.error || 'Terjadi kesalahan'));
      }
    } catch (err: any) {
      console.error('Error deleting user:', err);
      alert('Error deleting user: ' + err.message);
    }
  };

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
          actionItemStatuses: data.actionItemStatuses || ["Pending", "Open", "In Progress", "Selesai"],
          jiraSyncStatuses: data.jiraSyncStatuses || ["To Do", "In Progress", "Done"],
          jiraSyncDaysBack: data.jiraSyncDaysBack !== undefined && data.jiraSyncDaysBack !== null ? Number(data.jiraSyncDaysBack) : 30,
          jiraSyncMaxResults: data.jiraSyncMaxResults !== undefined && data.jiraSyncMaxResults !== null ? Number(data.jiraSyncMaxResults) : 500
        });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      await fetchCurrentUser();
      await loadSettings();
    };
    init();
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
        {(currentUser?.roles?.includes('Super Admin') || currentUser?.capabilities?.includes('manage_rbac')) && (
          <button
            type="button"
            onClick={() => setActiveTab('rbac')}
            className={`${styles.tab} ${activeTab === 'rbac' ? styles.activeTab : ''}`}
          >
            🔐 Kelola Akses & RBAC
          </button>
        )}
      </div>

      {activeTab !== 'rbac' ? (
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
                <label className={styles.formLabel}>Alur Kerja Status Action Item (Workflow)</label>
                <span className={styles.formHelp} style={{ marginBottom: '12px', display: 'block' }}>
                  Geser nama status ke atas/bawah untuk merubah urutan prioritas sorting pada list. Double klik atau gunakan tombol delete untuk menghapus.
                </span>

                <div className={styles.statusDragList}>
                  {(settings.actionItemStatuses || []).map((status, index) => (
                    <div
                      key={status}
                      className={styles.statusDragItem}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragEnter={() => handleDragEnter(index)}
                      onDragEnd={handleDragEnd}
                      onDragOver={e => e.preventDefault()}
                    >
                      <div className={styles.statusDragItemLeft}>
                        <span className={styles.dragHandleIcon}>☰</span>
                        <span className={styles.statusDragText}>{status}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteStatus(index)}
                        className={styles.deleteStatusBtn}
                        title="Hapus Status"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>

                <div className={styles.addStatusContainer} style={{ marginTop: '16px' }}>
                  <input
                    type="text"
                    placeholder="Tambah status baru (e.g. In Review, Testing)"
                    className={styles.formInput}
                    value={newStatusInput}
                    onChange={e => setNewStatusInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddStatus();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddStatus}
                    className={styles.addStatusBtn}
                  >
                    Tambah Status
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'jira' && (
            <div className={styles.tabContent}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>URL Host Jira Cloud</label>
                <input
                  type="url"
                  placeholder="Contoh: https://perusahaan-anda.atlassian.net"
                  className={styles.formInput}
                  value={settings.jiraUrl}
                  onChange={e => setSettings({ ...settings, jiraUrl: e.target.value })}
                />
                <span className={styles.formHelp}>URL utama domain Jira Cloud instansi Anda.</span>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Email Pengguna Jira</label>
                <input
                  type="email"
                  placeholder="Contoh: user@perusahaan.com"
                  className={styles.formInput}
                  value={settings.jiraEmail}
                  onChange={e => setSettings({ ...settings, jiraEmail: e.target.value })}
                />
                <span className={styles.formHelp}>Email akun Atlassian yang digunakan untuk otentikasi API.</span>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Atlassian API Token</label>
                <input
                  type="password"
                  placeholder="••••••••••••••••••••••••"
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

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Status Isu Jira yang Ingin Diambil (Pull)</label>
                <input
                  type="text"
                  placeholder="Contoh: To Do, In Progress, Done"
                  className={styles.formInput}
                  value={settings.jiraSyncStatuses ? settings.jiraSyncStatuses.join(', ') : ''}
                  onChange={e => {
                    const val = e.target.value;
                    setSettings(prev => ({
                      ...prev,
                      jiraSyncStatuses: val.split(',').map(s => s.trim()).filter(Boolean)
                    }));
                  }}
                />
                <span className={styles.formHelp}>Pisahkan dengan koma (contoh: <code>To Do, In Progress, Done, Backlog</code>). Jika kosong, semua status akan ditarik.</span>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label className={styles.formLabel}>Rentang Waktu Update (Hari)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Contoh: 30"
                    className={styles.formInput}
                    value={settings.jiraSyncDaysBack ?? 30}
                    onChange={e => setSettings({ ...settings, jiraSyncDaysBack: e.target.value === '' ? 30 : Number(e.target.value) })}
                  />
                  <span className={styles.formHelp}>Tarik isu yang diperbarui dalam X hari terakhir (masukkan 0 untuk menarik semua). Default: 30.</span>
                </div>

                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label className={styles.formLabel}>Maksimal Isu yang Ditarik</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Contoh: 500"
                    className={styles.formInput}
                    value={settings.jiraSyncMaxResults ?? 500}
                    onChange={e => setSettings({ ...settings, jiraSyncMaxResults: e.target.value === '' ? 500 : Number(e.target.value) })}
                  />
                  <span className={styles.formHelp}>Jumlah maksimal isu yang ditarik per sinkronisasi. Default: 500.</span>
                </div>
              </div>
            </div>
          )}

          <button type="submit" disabled={savingSettings} className={styles.saveButton}>
            {savingSettings ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        </form>
      ) : (
        <div className={styles.settingsForm}>
          <div className={styles.tabContent}>
            {/* User Management Section */}
            <div className={styles.sectionHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>👤 Manajemen Pengguna (Users)</h3>
              <button
                type="button"
                className={styles.addBtnSmall}
                onClick={() => {
                  setUserForm({ name: '', email: '', password: '', roleIds: [] });
                  setEditingUser(null);
                  setShowAddUserModal(true);
                }}
              >
                + Tambah Pengguna
              </button>
            </div>

            <table className={styles.rbacTable}>
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Email</th>
                  <th>Peran (Roles)</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map((user) => (
                  <tr key={user.id}>
                    <td><strong>{user.name}</strong></td>
                    <td>{user.email}</td>
                    <td>
                      {user.roles.map((r: any) => (
                        <span key={r.id} className={styles.roleBadge}>
                          {r.name}
                        </span>
                      ))}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.actionBtnEdit}
                        onClick={() => {
                          setEditingUser(user);
                          setUserForm({
                            name: user.name,
                            email: user.email,
                            password: '', // blank by default
                            roleIds: user.roles.map((r: any) => r.id)
                          });
                          setShowAddUserModal(true);
                        }}
                      >
                        ✏️ Edit
                      </button>
                      {user.email !== 'admin@pmtools.com' && (
                        <button
                          type="button"
                          className={styles.actionBtnDelete}
                          onClick={() => handleDeleteUser(user.id)}
                        >
                          🗑️ Hapus
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Role & Capability Matrix Section */}
            <h3 style={{ marginTop: '32px', marginBottom: '16px', fontSize: '15px', fontWeight: 800 }}>🔐 Pemetaan Hak Akses (Role & Capability Matrix)</h3>
            <p style={{ fontSize: '12px', color: 'var(--muted-text)', margin: '0 0 16px 0' }}>
              Tentukan capability apa saja yang dapat dilakukan oleh masing-masing Role. Ceklis/un-ceklis untuk merubah hak akses peran.
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table className={styles.rbacMatrixTable}>
                <thead>
                  <tr>
                    <th>Kapabilitas (Capability)</th>
                    {rolesList.map(role => (
                      <th key={role.id} style={{ textAlign: 'center' }}>{role.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {capabilitiesList.map(cap => (
                    <tr key={cap.id}>
                      <td>
                        <strong>{cap.id}</strong>
                        <div style={{ fontSize: '11px', color: 'var(--muted-text)', marginTop: '2px' }}>{cap.description}</div>
                      </td>
                      {rolesList.map(role => {
                        const isMapped = role.capabilities.some((rc: any) => rc.capabilityId === cap.id);
                        
                        return (
                          <td key={role.id} style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={role.name === 'Super Admin' ? true : isMapped}
                              disabled={role.name === 'Super Admin'} // Super Admin has all capabilities, locked
                              onChange={(e) => handleToggleRoleCapability(role.id, cap.id, e.target.checked)}
                              style={{ width: '16px', height: '16px', cursor: role.name === 'Super Admin' ? 'not-allowed' : 'pointer', accentColor: '#B45309' }}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal Overlay */}
      {showAddUserModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>{editingUser ? '✏️ Edit Pengguna' : '👤 Tambah Pengguna Baru'}</h3>
              <button type="button" className={styles.closeBtn} onClick={() => setShowAddUserModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleSaveUser}>
              <div className={styles.modalBody}>
                <div>
                  <label className={styles.formLabel}>Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    className={styles.formInput}
                    placeholder="Contoh: Mokhamad Wildan Marzuqon"
                    value={userForm.name}
                    onChange={e => setUserForm({ ...userForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className={styles.formLabel}>Email</label>
                  <input
                    type="email"
                    required
                    className={styles.formInput}
                    placeholder="nama@pmtools.com"
                    value={userForm.email}
                    onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className={styles.formLabel}>Password {editingUser && '(biarkan kosong jika tidak diubah)'}</label>
                  <input
                    type="password"
                    required={!editingUser}
                    className={styles.formInput}
                    placeholder="••••••••"
                    value={userForm.password}
                    onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                  />
                </div>
                <div>
                  <label className={styles.formLabel}>Pilih Peran / Roles</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                    {rolesList.map(role => (
                      <label key={role.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={userForm.roleIds.includes(role.id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setUserForm({ ...userForm, roleIds: [...userForm.roleIds, role.id] });
                            } else {
                              setUserForm({ ...userForm, roleIds: userForm.roleIds.filter(id => id !== role.id) });
                            }
                          }}
                          style={{ accentColor: '#B45309' }}
                        />
                        <strong>{role.name}</strong> - <span style={{ color: 'var(--muted-text)', fontSize: '12px' }}>{role.description}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowAddUserModal(false)}>
                  Batal
                </button>
                <button type="submit" className={styles.submitBtn} disabled={isSavingUser}>
                  {isSavingUser ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
