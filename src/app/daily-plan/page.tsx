'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

interface ActionItem {
  id: string;
  title: string;
  status: string;
  completed: boolean;
  project?: {
    name: string;
  };
}

interface DailyPlanEntry {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  type: 'task' | 'meeting' | 'focus';
  title: string;
  notes: string | null;
  status: string; // task: open/in_progress/done | meeting/focus: pending/done/skipped
  actionItemId: string | null;
  actionItem?: ActionItem | null;
}

// Helper to convert time "HH:MM" to minutes
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// Helper to get Jakarta (UTC+7) Date String (YYYY-MM-DD)
function getJakartaTodayStr(): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const wibTime = new Date(utc + (3600000 * 7));
  return wibTime.toISOString().split('T')[0];
}

// Helper to get Jakarta (UTC+7) Current Time (HH:MM)
function getJakartaCurrentTimeStr(): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const wibTime = new Date(utc + (3600000 * 7));
  const h = String(wibTime.getHours()).padStart(2, '0');
  const m = String(wibTime.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export default function DailyPlanPage() {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [entries, setEntries] = useState<DailyPlanEntry[]>([]);
  const [todayEntries, setTodayEntries] = useState<DailyPlanEntry[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Time tracking
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');
  const [currentMinutes, setCurrentMinutes] = useState<number>(0);

  // Banner states
  const [bannerInfo, setBannerInfo] = useState<{
    type: 'upcoming' | 'ongoing' | 'overdue';
    text: string;
    id: string;
  } | null>(null);
  const [dismissedBannerId, setDismissedBannerId] = useState<string | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formType, setFormType] = useState<'task' | 'meeting' | 'focus'>('task');
  const [formStartTime, setFormStartTime] = useState('09:00');
  const [formEndTime, setFormEndTime] = useState('10:00');
  const [formActionItemId, setFormActionItemId] = useState('');
  const [formCreateActionItem, setFormCreateActionItem] = useState(false);

  // Initialize date and clock
  useEffect(() => {
    const today = getJakartaTodayStr();
    setSelectedDate(today);
    
    const time = getJakartaCurrentTimeStr();
    setCurrentTimeStr(time);
    setCurrentMinutes(timeToMinutes(time));

    // Tick every minute
    const interval = setInterval(() => {
      const t = getJakartaCurrentTimeStr();
      setCurrentTimeStr(t);
      setCurrentMinutes(timeToMinutes(t));
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Fetch entries when date changes
  useEffect(() => {
    if (selectedDate) {
      fetchEntries();
    }
  }, [selectedDate]);

  // Fetch action items and today's entries for banner reminder
  useEffect(() => {
    fetchActionItems();
    fetchTodayEntries();

    // Refresh today's entries for banner reminder every 60s
    const interval = setInterval(fetchTodayEntries, 60000);
    return () => clearInterval(interval);
  }, []);

  // Re-evaluate banner whenever today's entries or current minutes changes
  useEffect(() => {
    evaluateBanner();
  }, [todayEntries, currentMinutes, dismissedBannerId]);

  const fetchEntries = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/daily-plan?date=${selectedDate}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data);
      }
    } catch (error) {
      console.error('Error fetching entries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTodayEntries = async () => {
    try {
      const res = await fetch('/api/daily-plan?date=today');
      if (res.ok) {
        const data = await res.json();
        setTodayEntries(data);
      }
    } catch (error) {
      console.error('Error fetching today entries:', error);
    }
  };

  const fetchActionItems = async () => {
    try {
      const res = await fetch('/api/action-items?completed=false');
      if (res.ok) {
        const data = await res.json();
        setActionItems(data);
      }
    } catch (error) {
      console.error('Error fetching action items:', error);
    }
  };

  const evaluateBanner = () => {
    if (todayEntries.length === 0) {
      setBannerInfo(null);
      return;
    }

    // Check banner conditions
    let activeBanner: typeof bannerInfo = null;

    // Sort entries to find chronologically
    const activeToday = todayEntries.filter(e => e.status !== 'done' && e.status !== 'skipped');
    
    // 1. Check Overdue (startTime < currentMinutes, status not done/skipped)
    const overdueItems = activeToday.filter(e => timeToMinutes(e.startTime) < currentMinutes);
    if (overdueItems.length > 0) {
      // Find the one that was scheduled earliest
      overdueItems.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
      const target = overdueItems[0];
      const bannerId = `overdue-${target.id}-${target.status}`;
      if (dismissedBannerId !== bannerId) {
        activeBanner = {
          id: bannerId,
          type: 'overdue',
          text: `⚠️ Terlewat: "${target.title}" belum diselesaikan!`
        };
      }
    }

    // 2. Check Ongoing (startTime <= currentMinutes < endTime)
    if (!activeBanner) {
      const ongoingItems = activeToday.filter(e => {
        const start = timeToMinutes(e.startTime);
        const end = timeToMinutes(e.endTime);
        return currentMinutes >= start && currentMinutes < end;
      });
      if (ongoingItems.length > 0) {
        const target = ongoingItems[0];
        const bannerId = `ongoing-${target.id}-${target.status}`;
        if (dismissedBannerId !== bannerId) {
          activeBanner = {
            id: bannerId,
            type: 'ongoing',
            text: `🔥 Sedang Berjalan: "${target.title}" (${target.startTime} – ${target.endTime})`
          };
        }
      }
    }

    // 3. Check Upcoming (startTime > currentMinutes, starts in <= 15 minutes)
    if (!activeBanner) {
      const upcomingItems = activeToday.filter(e => {
        const start = timeToMinutes(e.startTime);
        return start > currentMinutes && (start - currentMinutes) <= 15;
      });
      if (upcomingItems.length > 0) {
        // Find nearest
        upcomingItems.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
        const target = upcomingItems[0];
        const bannerId = `upcoming-${target.id}`;
        if (dismissedBannerId !== bannerId) {
          activeBanner = {
            id: bannerId,
            type: 'upcoming',
            text: `⏰ Mendatang: "${target.title}" mulai pukul ${target.startTime} (dalam ${timeToMinutes(target.startTime) - currentMinutes} menit)`
          };
        }
      }
    }

    setBannerInfo(activeBanner);
  };

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
  };

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    const dateStr = d.toISOString().split('T')[0];
    setSelectedDate(dateStr);
  };

  const setDateToToday = () => {
    setSelectedDate(getJakartaTodayStr());
  };

  const isPastDate = () => {
    const today = getJakartaTodayStr();
    return selectedDate < today;
  };

  // Time selection change auto-updates end time
  const handleStartTimeChange = (start: string) => {
    setFormStartTime(start);
    const [h, m] = start.split(':').map(Number);
    const endH = (h + 1) % 24;
    const endHStr = String(endH).padStart(2, '0');
    const endMStr = String(m).padStart(2, '0');
    setFormEndTime(`${endHStr}:${endMStr}`);
  };

  const openAddModal = () => {
    setModalMode('add');
    setFormTitle('');
    setFormNotes('');
    setFormType('task');
    // Set start time to current hour rounded, or 09:00
    const now = new Date();
    const currentHStr = String(now.getHours()).padStart(2, '0');
    setFormStartTime(`${currentHStr}:00`);
    const nextHStr = String((now.getHours() + 1) % 24).padStart(2, '0');
    setFormEndTime(`${nextHStr}:00`);
    setFormActionItemId('');
    setFormCreateActionItem(false);
    setIsModalOpen(true);
  };

  const openEditModal = (entry: DailyPlanEntry) => {
    setModalMode('edit');
    setEditingId(entry.id);
    setFormTitle(entry.title);
    setFormNotes(entry.notes || '');
    setFormType(entry.type);
    setFormStartTime(entry.startTime);
    setFormEndTime(entry.endTime);
    setFormActionItemId(entry.actionItemId || '');
    setFormCreateActionItem(false);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      date: selectedDate,
      startTime: formStartTime,
      endTime: formEndTime,
      type: formType,
      title: formTitle,
      notes: formNotes,
      actionItemId: formType === 'task' ? formActionItemId : null,
      createActionItem: formType === 'task' ? formCreateActionItem : false
    };

    try {
      let res;
      if (modalMode === 'add') {
        res = await fetch('/api/daily-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`/api/daily-plan/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        setIsModalOpen(false);
        fetchEntries();
        fetchTodayEntries();
        fetchActionItems();
      } else {
        const errorData = await res.json();
        alert(`Gagal menyimpan: ${errorData.error || 'Terjadi kesalahan'}`);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

  const updateEntryStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/daily-plan/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchEntries();
        fetchTodayEntries();
        fetchActionItems();
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus rencana ini?')) return;

    try {
      const res = await fetch(`/api/daily-plan/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchEntries();
        fetchTodayEntries();
      }
    } catch (error) {
      console.error('Error deleting entry:', error);
    }
  };

  return (
    <div className={styles.container}>
      {/* Banner Reminder */}
      {bannerInfo && (
        <div className={`${styles.banner} ${styles[bannerInfo.type]}`}>
          <span>{bannerInfo.text}</span>
          <button 
            className={styles.bannerClose} 
            onClick={() => setDismissedBannerId(bannerInfo.id)}
          >
            &times;
          </button>
        </div>
      )}

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>📅 Rencana Harian</h1>
          <p>Kelola jadwal harian, rapat, dan sesi fokus Anda terintegrasi dengan Action Items.</p>
        </div>
        {!isPastDate() && (
          <button className={styles.addButton} onClick={openAddModal}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Tambah Rencana
          </button>
        )}
      </div>

      {/* Date Navigation */}
      <div className={styles.dateNavRow}>
        <div className={styles.datePickerArea}>
          <button className={styles.navBtn} onClick={() => shiftDate(-1)} title="Hari Sebelumnya">
            &larr;
          </button>
          <input 
            type="date" 
            className={styles.dateInput} 
            value={selectedDate} 
            onChange={(e) => handleDateChange(e.target.value)}
          />
          <button className={styles.navBtn} onClick={() => shiftDate(1)} title="Hari Berikutnya">
            &rarr;
          </button>
          <button className={styles.todayBtn} onClick={setDateToToday}>
            Hari Ini
          </button>
        </div>
        {isPastDate() && (
          <span className={styles.readOnlyBadge}>Riwayat (Read-Only)</span>
        )}
      </div>

      {/* Timeline Section */}
      {isLoading ? (
        <div className={styles.loadingText}>Memuat rencana harian...</div>
      ) : entries.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📅</div>
          <h2>Belum ada rencana harian</h2>
          <p>Mulai atur harimu dengan menambahkan tugas (task), rapat (meeting), atau sesi fokus baru.</p>
          {!isPastDate() && (
            <button className={styles.addButton} onClick={openAddModal}>
              Buat Rencana Pertama
            </button>
          )}
        </div>
      ) : (
        <div className={styles.timeline}>
          <div className={styles.timelineLine} />
          
          {(() => {
            const renderedElements: React.JSX.Element[] = [];
            let timeIndicatorRendered = false;
            const isViewingToday = selectedDate === getJakartaTodayStr();

            // Sort entries chronologically just in case
            const sortedEntries = [...entries].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

            // Render Time Indicator Helper
            const renderTimeIndicator = () => {
              timeIndicatorRendered = true;
              return (
                <div key="time-indicator" className={styles.timeIndicatorLine}>
                  <div className={styles.indicatorLine} />
                  <span className={styles.indicatorLabel}>jam sekarang ({currentTimeStr})</span>
                </div>
              );
            };

            sortedEntries.forEach((entry) => {
              const entryStartMinutes = timeToMinutes(entry.startTime);

              // If viewing today, and indicator hasn't been rendered yet, and this entry starts after the current time
              if (isViewingToday && !timeIndicatorRendered && entryStartMinutes > currentMinutes) {
                renderedElements.push(renderTimeIndicator());
              }

              // Duration calculation
              const startMin = timeToMinutes(entry.startTime);
              const endMin = timeToMinutes(entry.endTime);
              let diffMin = endMin - startMin;
              if (diffMin < 0) diffMin += 1440; // overnight fallback
              const hours = Math.floor(diffMin / 60);
              const mins = diffMin % 60;
              const durationStr = `${hours > 0 ? `${hours} jam ` : ''}${mins > 0 ? `${mins} menit` : ''}`.trim() || '0 menit';

              // Build Entry Element
              renderedElements.push(
                <div key={entry.id} className={styles.entryWrapper}>
                  <div className={styles.timeCol}>
                    <span className={styles.timeRange}>{entry.startTime} - {entry.endTime}</span>
                    <span className={styles.duration}>{durationStr}</span>
                  </div>

                  <div className={styles.cardCol}>
                    <div className={styles.cardHeader}>
                      <div className={styles.cardTitleArea}>
                        <span className={`${styles.typeBadge} ${styles[entry.type]}`}>
                          {entry.type === 'task' && '🎯 Task'}
                          {entry.type === 'meeting' && '🤝 Meeting'}
                          {entry.type === 'focus' && '🧘 Focus Block'}
                        </span>
                        <h3 className={styles.entryTitle}>{entry.title}</h3>
                      </div>
                      
                      {!isPastDate() && (
                        <div className={styles.actionsSection}>
                          <button className={styles.iconBtn} onClick={() => openEditModal(entry)} title="Edit rencana">
                            ✏️
                          </button>
                          <button className={`${styles.iconBtn} ${styles.delete}`} onClick={() => handleDeleteEntry(entry.id)} title="Hapus rencana">
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>

                    {entry.notes && (
                      <p className={styles.notesText}>{entry.notes}</p>
                    )}

                    {entry.type === 'task' && entry.actionItem && (
                      <Link 
                        href="/action-items" 
                        target="_blank" 
                        className={styles.actionItemLink}
                      >
                        🔗 Linked Action Item: {entry.actionItem.title} 
                        {entry.actionItem.project && ` (${entry.actionItem.project.name})`}
                      </Link>
                    )}

                    <div className={styles.cardFooter}>
                      <div className={styles.statusSection}>
                        <span className={styles.statusLabel}>Status:</span>
                        <span className={`${styles.statusValue} ${styles[entry.status]}`}>{entry.status}</span>
                      </div>

                      {!isPastDate() && (
                        <div className={styles.actionsSection}>
                          {entry.type === 'task' && (
                            <>
                              {entry.status === 'open' && (
                                <button 
                                  className={`${styles.quickActionBtn} ${styles.start}`}
                                  onClick={() => updateEntryStatus(entry.id, 'in_progress')}
                                >
                                  Mulai ⏩
                                </button>
                              )}
                              {entry.status === 'in_progress' && (
                                <button 
                                  className={`${styles.quickActionBtn} ${styles.complete}`}
                                  onClick={() => updateEntryStatus(entry.id, 'done')}
                                >
                                  Selesai ✅
                                </button>
                              )}
                              {entry.status === 'done' && (
                                <button 
                                  className={`${styles.quickActionBtn} ${styles.start}`}
                                  onClick={() => updateEntryStatus(entry.id, 'open')}
                                >
                                  Buka Kembali ↩️
                                </button>
                              )}
                            </>
                          )}

                          {(entry.type === 'meeting' || entry.type === 'focus') && (
                            <>
                              {entry.status === 'pending' && (
                                <>
                                  <button 
                                    className={`${styles.quickActionBtn} ${styles.complete}`}
                                    onClick={() => updateEntryStatus(entry.id, 'done')}
                                  >
                                    Done ✅
                                  </button>
                                  <button 
                                    className={`${styles.quickActionBtn} ${styles.skip}`}
                                    onClick={() => updateEntryStatus(entry.id, 'skipped')}
                                  >
                                    Skip ❌
                                  </button>
                                </>
                              )}
                              {entry.status !== 'pending' && (
                                <button 
                                  className={`${styles.quickActionBtn} ${styles.start}`}
                                  onClick={() => updateEntryStatus(entry.id, 'pending')}
                                >
                                  Reset ↩️
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            });

            // If viewing today, and the indicator still hasn't been rendered (because all entries are in the past or list is empty), render it at the bottom
            if (isViewingToday && !timeIndicatorRendered) {
              renderedElements.push(renderTimeIndicator());
            }

            return renderedElements;
          })()}
        </div>
      )}

      {/* Modal Dialog for Add / Edit */}
      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>{modalMode === 'add' ? 'Tambah Rencana Baru' : 'Edit Rencana'}</h2>
              <span className={styles.closeBtn} onClick={() => setIsModalOpen(false)}>
                &times;
              </span>
            </div>

            <form onSubmit={handleFormSubmit} className={styles.modalContent}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Tipe</label>
                  <select 
                    className={styles.select}
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                  >
                    <option value="task">🎯 Task (Tugas)</option>
                    <option value="meeting">🤝 Meeting (Rapat)</option>
                    <option value="focus">🧘 Focus Block</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Judul Rencana</label>
                  <input 
                    type="text"
                    required
                    placeholder="Contoh: Sprint Review, Kerja Mandiri"
                    className={styles.input}
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Waktu Mulai</label>
                  <input 
                    type="time"
                    required
                    className={styles.input}
                    value={formStartTime}
                    onChange={(e) => handleStartTimeChange(e.target.value)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Waktu Selesai</label>
                  <input 
                    type="time"
                    required
                    className={styles.input}
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Catatan Tambahan (Opsional)</label>
                <textarea 
                  className={styles.textarea}
                  placeholder="Detail rencana atau hasil rapat..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                />
              </div>

              {formType === 'task' && modalMode === 'add' && (
                <div className={styles.formGroup} style={{ borderTop: '1px solid var(--card-border)', paddingTop: '0.75rem' }}>
                  <label className={styles.label}>Hubungkan ke Action Item</label>
                  <select
                    className={styles.select}
                    value={formActionItemId}
                    onChange={(e) => {
                      setFormActionItemId(e.target.value);
                      if (e.target.value !== '') {
                        setFormCreateActionItem(false);
                      }
                    }}
                    disabled={formCreateActionItem}
                  >
                    <option value="">-- Pilih Action Item (Opsional) --</option>
                    {actionItems.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.title} {item.project ? `(${item.project.name})` : ''}
                      </option>
                    ))}
                  </select>

                  <label className={styles.checkboxLabel}>
                    <input 
                      type="checkbox"
                      checked={formCreateActionItem}
                      onChange={(e) => {
                        setFormCreateActionItem(e.target.checked);
                        if (e.target.checked) {
                          setFormActionItemId('');
                        }
                      }}
                    />
                    Buat Action Item baru otomatis dari rencana ini
                  </label>
                </div>
              )}

              {formType === 'task' && modalMode === 'edit' && (
                <div className={styles.formGroup} style={{ borderTop: '1px solid var(--card-border)', paddingTop: '0.75rem' }}>
                  <label className={styles.label}>Hubungkan ke Action Item</label>
                  <select
                    className={styles.select}
                    value={formActionItemId}
                    onChange={(e) => setFormActionItemId(e.target.value)}
                  >
                    <option value="">-- Pilih Action Item (Opsional) --</option>
                    {actionItems.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.title} {item.project ? `(${item.project.name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className={styles.modalFooter}>
                <button 
                  type="button" 
                  className={`${styles.btn} ${styles.secondary}`}
                  onClick={() => setIsModalOpen(false)}
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className={`${styles.btn} ${styles.primary}`}
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
