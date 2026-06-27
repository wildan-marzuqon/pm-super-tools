'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import styles from './page.module.css';
import { useModalDialog } from '@/components/ModalProvider';

interface JiraIssue {
  id: string;
  key: string;
  issueType: string;
  summary: string;
  assignee: string;
  priority: string;
  status: string;
  startDate: string | null;
  dueDate: string | null;
  originalEstimate: number; // in seconds
}

export default function TeamsLoadPage() {
  const { alert } = useModalDialog();
  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [activeIssues, setActiveIssues] = useState<JiraIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [jiraUrl, setJiraUrl] = useState('');

  // Drag and drop refs
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const handleRowDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleRowDragEnter = (index: number) => {
    dragOverItem.current = index;
  };

  const handleRowDragEnd = () => {
    if (dragItem.current !== null && dragOverItem.current !== null) {
      const copyListItems = [...activeIssues];
      const dragItemContent = copyListItems[dragItem.current];
      copyListItems.splice(dragItem.current, 1);
      copyListItems.splice(dragOverItem.current, 0, dragItemContent);
      dragItem.current = null;
      dragOverItem.current = null;
      setActiveIssues(copyListItems);

      const orderedKeys = copyListItems.map(item => item.key);
      saveOrder(selectedAssignee, orderedKeys);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.csv')) {
      setCsvFile(file);
    } else {
      await alert('Hanya file CSV yang diperbolehkan!', 'Format File Salah', 'error');
    }
  };

  // Filters
  const [selectedAssignee, setSelectedAssignee] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<'week' | 'month' | 'custom'>('week');
  const [startDateStr, setStartDateStr] = useState<string>('');
  const [endDateStr, setEndDateStr] = useState<string>('');

  // Dropdown list of assignees
  const [assigneeList, setAssigneeList] = useState<string[]>([]);

  // Fetch initial Jira issues
  const fetchIssues = async () => {
    try {
      const [issuesRes, settingsRes] = await Promise.all([
        fetch('/api/jira-issues'),
        fetch('/api/wa-copilot/settings')
      ]);

      if (issuesRes.ok) {
        const data = await issuesRes.json();
        setIssues(data);
        
        // Extract unique assignees
        const assignees: string[] = Array.from(
          new Set(data.map((item: JiraIssue) => item.assignee).filter(Boolean))
        );
        setAssigneeList(assignees.sort());

        // Set default filter if assignee is available
        if (assignees.length > 0 && selectedAssignee === 'all') {
          setSelectedAssignee(assignees[0]);
        }
      }

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setJiraUrl(settingsData.jiraUrl || '');
      }
    } catch (error) {
      console.error('Error fetching Jira issues data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncJira = async (direction: 'pull' | 'push') => {
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/jira/sync?direction=${direction}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        const actionLabel = direction === 'pull' ? 'Pull dari Jira' : 'Push ke Jira';
        await alert(
          `${actionLabel} sukses!\n- Cached: ${data.cached} issue(s) di cache local\n- Pushed: ${data.pushed} task(s)\n- Pulled: ${data.pulled} task(s)`,
          'Sukses',
          'success'
        );
        fetchIssues();
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
    fetchIssues();
  }, []);

  // Initialize dates based on preset using current system date (today)
  useEffect(() => {
    const baseDate = new Date();
    
    if (datePreset === 'week') {
      // Find Monday of the week
      const day = baseDate.getDay();
      const diff = baseDate.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
      const monday = new Date(baseDate.setDate(diff));
      const friday = new Date(monday);
      friday.setDate(monday.getDate() + 4);

      setStartDateStr(monday.toISOString().split('T')[0]);
      setEndDateStr(friday.toISOString().split('T')[0]);
    } else if (datePreset === 'month') {
      const firstDay = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
      const lastDay = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);

      setStartDateStr(firstDay.toISOString().split('T')[0]);
      setEndDateStr(lastDay.toISOString().split('T')[0]);
    }
  }, [datePreset]);

  // Robust date parser
  const parseJiraDate = (str: string): Date | null => {
    if (!str) return null;
    
    // Try native date parsing first
    const direct = new Date(str);
    if (!isNaN(direct.getTime())) return direct;

    // Clean up time part if it exists (e.g. "22/06/2026 14:56" -> "22/06/2026")
    const datePart = str.split(/[ \t]+/)[0];
    
    // Split by slash, dash, or dot
    const parts = datePart.split(/[\/\-\.]+/);
    if (parts.length === 3) {
      // 1. Check for numeric parsing first: DD/MM/YYYY or YYYY-MM-DD
      let year = parseInt(parts[2], 10);
      let month = parseInt(parts[1], 10) - 1;
      let day = parseInt(parts[0], 10);

      if (parts[0].length === 4) {
        // YYYY-MM-DD
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        day = parseInt(parts[2], 10);
      }

      // If it's month name based
      const monthsMap: { [key: string]: number } = {
        jan: 0, peb: 1, feb: 1, mar: 2, apr: 3, mei: 4, may: 4, jun: 5,
        jul: 6, agu: 7, aug: 7, sep: 8, okt: 9, oct: 9, nov: 10, des: 11, dec: 11
      };

      const part1Lower = parts[1].toLowerCase();
      const part0Lower = parts[0].toLowerCase();

      if (monthsMap[part1Lower] !== undefined) {
        // e.g. 22/Jun/2026
        month = monthsMap[part1Lower];
        day = parseInt(parts[0], 10);
        year = parseInt(parts[2], 10);
      } else if (monthsMap[part0Lower] !== undefined) {
        // e.g. Jun/22/2026
        month = monthsMap[part0Lower];
        day = parseInt(parts[1], 10);
        year = parseInt(parts[2], 10);
      }

      // Adjust 2-digit years
      if (year < 100) {
        year += year < 50 ? 2000 : 1900;
      }

      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) return date;
      }
    }

    return null;
  };

  // Basic CSV Parser
  const parseCSV = (text: string): string[][] => {
    const lines: string[] = [];
    let row = [''];
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          row[row.length - 1] += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push('');
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        lines.push(JSON.stringify(row));
        row = [''];
      } else {
        row[row.length - 1] += char;
      }
    }
    if (row.length > 1 || row[0] !== '') {
      lines.push(JSON.stringify(row));
    }
    return lines.map(line => JSON.parse(line) as string[]);
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile || uploading) return;

    setUploading(true);
    try {
      const text = await csvFile.text();
      const rows = parseCSV(text);
      if (rows.length < 2) {
        await alert('File CSV kosong atau tidak valid!', 'File Kosong', 'error');
        setUploading(false);
        return;
      }

      const headers = rows[0].map(h => h.trim().toLowerCase());
      
      // Index mapping helper: respects priority order in possibleHeaders array
      const getIndex = (possibleHeaders: string[]) => {
        for (const ph of possibleHeaders) {
          const idx = headers.indexOf(ph);
          if (idx !== -1) return idx;
        }
        return -1;
      };

      const keyIdx = getIndex(['issue key', 'key', 'issue id']);
      const typeIdx = getIndex(['issue type', 'type']);
      const summaryIdx = getIndex(['summary', 'title']);
      const assigneeIdx = getIndex(['assignee']);
      const priorityIdx = getIndex(['priority']);
      const statusIdx = getIndex(['status']);
      const startDateIdx = getIndex(['start date', 'created']);
      const dueDateIdx = getIndex(['due date']);
      const estimateIdx = getIndex(['original estimate', 'estimate']);

      if (keyIdx === -1 || summaryIdx === -1) {
        await alert('Header CSV harus memiliki minimal kolom "Key" dan "Summary"!', 'Header Tidak Valid', 'error');
        setUploading(false);
        return;
      }

      const parsedIssues = rows.slice(1).map(row => {
        if (row.length < headers.length) return null;

        const keyVal = row[keyIdx]?.trim();
        const summaryVal = row[summaryIdx]?.trim();
        if (!keyVal || !summaryVal) return null;

        const assigneeVal = assigneeIdx !== -1 ? row[assigneeIdx]?.trim() || 'Unassigned' : 'Unassigned';
        const typeVal = typeIdx !== -1 ? row[typeIdx]?.trim() || 'Task' : 'Task';
        const priorityVal = priorityIdx !== -1 ? row[priorityIdx]?.trim() || 'Medium' : 'Medium';
        const statusVal = statusIdx !== -1 ? row[statusIdx]?.trim() || 'To Do' : 'To Do';
        
        let startVal = startDateIdx !== -1 ? row[startDateIdx]?.trim() : null;
        let dueVal = dueDateIdx !== -1 ? row[dueDateIdx]?.trim() : null;

        let parsedStart = startVal ? parseJiraDate(startVal) : null;
        let parsedDue = dueVal ? parseJiraDate(dueVal) : null;

        // Fallbacks if dates are missing
        if (!parsedStart && !parsedDue) {
          parsedStart = new Date();
          parsedDue = new Date();
        } else if (!parsedStart) {
          parsedStart = parsedDue;
        } else if (!parsedDue) {
          parsedDue = parsedStart;
        }

        const startDate = parsedStart ? parsedStart.toISOString() : null;
        const dueDate = parsedDue ? parsedDue.toISOString() : null;

        const rawEstimate = estimateIdx !== -1 ? parseFloat(row[estimateIdx]) : 0;
        const originalEstimate = isNaN(rawEstimate) ? 0 : rawEstimate;

        return {
          key: keyVal,
          issueType: typeVal,
          summary: summaryVal,
          assignee: assigneeVal,
          priority: priorityVal,
          status: statusVal,
          startDate,
          dueDate,
          originalEstimate
        };
      }).filter(Boolean);

      // Send to server
      const res = await fetch('/api/jira-issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issues: parsedIssues })
      });

      if (res.ok) {
        await alert('Data Jira berhasil diupload dan diperbarui!', 'Berhasil', 'success');
        setShowUploadModal(false);
        setCsvFile(null);
        fetchIssues();
      } else {
        const err = await res.json();
        await alert(`Gagal menyimpan data: ${err.error || 'Server error'}`, 'Gagal Menyimpan', 'error');
      }
    } catch (err) {
      console.error('File reading failed:', err);
      await alert('Gagal membaca file CSV!', 'Gagal Membaca', 'error');
    } finally {
      setUploading(false);
    }
  };

  // Generate date array between start and end (inclusive)
  const getDatesInRange = (startStr: string, endStr: string): Date[] => {
    if (!startStr || !endStr) return [];
    const dates: Date[] = [];
    const current = new Date(startStr);
    const end = new Date(endStr);
    current.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    let safety = 0;
    while (current <= end && safety < 100) {
      safety++;
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  const selectedDates = getDatesInRange(startDateStr, endDateStr);

  // Weekday counter helper
  const countWorkdays = (start: Date, end: Date): number => {
    let count = 0;
    const current = new Date(start);
    current.setHours(0, 0, 0, 0);
    const last = new Date(end);
    last.setHours(0, 0, 0, 0);

    let safety = 0;
    while (current <= last && safety < 500) {
      safety++;
      const day = current.getDay();
      if (day !== 0 && day !== 6) { // Mon-Fri
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    return count || 1; // avoid divide by zero
  };

  // Load saved order from localStorage
  const getSavedOrder = (assignee: string): string[] => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(`teams-load-order-${assignee.toLowerCase()}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  };

  // Save order to localStorage
  const saveOrder = (assignee: string, orderedKeys: string[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`teams-load-order-${assignee.toLowerCase()}`, JSON.stringify(orderedKeys));
    } catch (e) {
      console.error('Failed to save order to localStorage:', e);
    }
  };

  // Sync and filter/sort issues to activeIssues state
  useEffect(() => {
    const statusOrder = ['open', 'in progress', 'testing', 'backlog'];
    const getStatusRank = (statusName: string) => {
      const norm = statusName.toLowerCase();
      const idx = statusOrder.indexOf(norm);
      return idx === -1 ? 999 : idx;
    };

    const filtered = issues.filter(issue => {
      // 0. Filter out done tasks
      if (issue.status.toLowerCase() === 'done') {
        return false;
      }

      // 1. Assignee Filter
      if (selectedAssignee !== 'all' && issue.assignee.toLowerCase() !== selectedAssignee.toLowerCase()) {
        return false;
      }

      // 2. Date Overlap Filter
      const start = issue.startDate ? new Date(issue.startDate) : null;
      const due = issue.dueDate ? new Date(issue.dueDate) : null;
      if (!start || !due) return true; // Keep if no dates

      if (!startDateStr || !endDateStr) return true;

      const rangeStart = new Date(startDateStr);
      const rangeEnd = new Date(endDateStr);
      rangeStart.setHours(0, 0, 0, 0);
      rangeEnd.setHours(23, 59, 59, 999);

      return start <= rangeEnd && due >= rangeStart;
    });

    const savedOrder = getSavedOrder(selectedAssignee);
    if (savedOrder.length > 0) {
      filtered.sort((a, b) => {
        const idxA = savedOrder.indexOf(a.key);
        const idxB = savedOrder.indexOf(b.key);
        
        if (idxA !== -1 && idxB !== -1) {
          return idxA - idxB;
        }
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        
        const hasEstimateA = a.originalEstimate > 0 ? 1 : 0;
        const hasEstimateB = b.originalEstimate > 0 ? 1 : 0;
        if (hasEstimateA !== hasEstimateB) {
          return hasEstimateB - hasEstimateA;
        }
        const rankA = getStatusRank(a.status);
        const rankB = getStatusRank(b.status);
        return rankA - rankB;
      });
    } else {
      // Prioritize tasks with estimate > 0, empty estimate at the bottom
      filtered.sort((a, b) => {
        const hasEstimateA = a.originalEstimate > 0 ? 1 : 0;
        const hasEstimateB = b.originalEstimate > 0 ? 1 : 0;
        if (hasEstimateA !== hasEstimateB) {
          return hasEstimateB - hasEstimateA;
        }
        const rankA = getStatusRank(a.status);
        const rankB = getStatusRank(b.status);
        return rankA - rankB;
      });
    }

    setActiveIssues(filtered);
  }, [issues, selectedAssignee, startDateStr, endDateStr]);

  // Calculate daily load for each task
  const taskDailyLoads = activeIssues.map(issue => {
    const start = issue.startDate ? new Date(issue.startDate) : null;
    const due = issue.dueDate ? new Date(issue.dueDate) : null;
    
    // Estimate in hours
    const totalHours = issue.originalEstimate / 3600;

    if (!start || !due) {
      return {
        issue,
        totalHours,
        dailyHours: 0,
        isActiveOnDate: () => false
      };
    }

    start.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);

    const workdaysCount = countWorkdays(start, due);
    const dailyHours = totalHours / workdaysCount;

    const isActiveOnDate = (date: Date) => {
      date.setHours(0, 0, 0, 0);
      const isWithinRange = date >= start && date <= due;
      const day = date.getDay();
      const isWorkday = day !== 0 && day !== 6;
      return isWithinRange && isWorkday;
    };

    return {
      issue,
      totalHours,
      dailyHours,
      isActiveOnDate
    };
  });

  // Calculate total load for each date in selected range
  const dateTotals = selectedDates.map(date => {
    const loadSum = taskDailyLoads.reduce((sum, task) => {
      if (task.isActiveOnDate(date)) {
        return sum + task.dailyHours;
      }
      return sum;
    }, 0);
    return {
      date,
      totalLoad: parseFloat(loadSum.toFixed(1))
    };
  });

  // Daily capacity per person
  const dailyCapacityPerDay = selectedAssignee === 'all' ? assigneeList.length * 8 : 8;

  // Weekly aggregate calculations: sum of daily loads on workdays in range
  const totalAllocatedHours = dateTotals.reduce((sum, item) => {
    const day = item.date.getDay();
    const isWeekend = day === 0 || day === 6;
    if (isWeekend) return sum;
    return sum + item.totalLoad;
  }, 0);
  
  const totalWorkdays = selectedDates.filter(d => d.getDay() !== 0 && d.getDay() !== 6).length || 1;
  const capacityTotal = totalWorkdays * dailyCapacityPerDay;
  const remainingCapacity = capacityTotal - totalAllocatedHours;

  const formatDateLabel = (date: Date) => {
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  };

  const getCapacityColorClass = (load: number) => {
    if (load === 0) return styles.capacityZero;
    const limit = selectedAssignee === 'all' ? assigneeList.length * 8 : 8;
    if (load > limit) return styles.capacityOverloaded; // Red
    if (load >= limit * 0.75) return styles.capacityFull; // Orange/Amber (75% to 100%)
    return styles.capacityGood; // Green
  };

  return (
    <div className={`${styles.container} animate-fade-in`}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>👥 Teams Capacity & Load Projection</h1>
          <p className={styles.subtitle}>Analisis proyeksi beban kerja anggota tim berdasarkan estimasi tugas Jira.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => setShowUploadModal(true)}
            title="Upload Jira Export CSV"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--card-bg, #1E293B)',
              color: 'var(--text, #F8FAFC)',
              border: '1px solid var(--border-color, #334155)',
              padding: '8px 14px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            📄 Upload CSV
          </button>
        </div>
      </header>

      {/* Stats Board */}
      <section className={styles.statsRow}>
        <div className={styles.statBox}>
          <span className={styles.statLabel}>Total Allocated Hours</span>
          <span className={styles.statVal}>{totalAllocatedHours.toFixed(1)}h</span>
        </div>
        <div className={styles.statBox}>
          <span className={styles.statLabel}>Total Work Days</span>
          <span className={styles.statVal}>{totalWorkdays} hari</span>
        </div>
        <div className={styles.statBox}>
          <span className={styles.statLabel}>Remaining Capacity</span>
          <span className={`${styles.statVal} ${remainingCapacity < 0 ? styles.overloadVal : styles.goodVal}`}>
            {remainingCapacity.toFixed(1)}h
          </span>
        </div>
        <div className={styles.statBox}>
          <span className={styles.statLabel}>Total Tasks</span>
          <span className={styles.statVal}>{activeIssues.length}</span>
        </div>
      </section>

      {/* Control Panel (Presets + Assignee Filter) */}
      <section className={styles.filterToolbar}>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Rentang Waktu:</span>
          <div className={styles.btnGroup}>
            <button
              onClick={() => setDatePreset('week')}
              className={`${styles.filterBtn} ${datePreset === 'week' ? styles.activeFilter : ''}`}
            >
              🗓️ 1 Minggu
            </button>
            <button
              onClick={() => setDatePreset('month')}
              className={`${styles.filterBtn} ${datePreset === 'month' ? styles.activeFilter : ''}`}
            >
              📅 1 Bulan
            </button>
            <button
              onClick={() => setDatePreset('custom')}
              className={`${styles.filterBtn} ${datePreset === 'custom' ? styles.activeFilter : ''}`}
            >
              ⚙️ Custom
            </button>
          </div>
        </div>

        {datePreset === 'custom' && (
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Dari:</span>
            <input
              type="date"
              value={startDateStr}
              onChange={(e) => setStartDateStr(e.target.value)}
              className={styles.filterDateInput}
            />
            <span className={styles.filterLabel}>Sampai:</span>
            <input
              type="date"
              value={endDateStr}
              onChange={(e) => setEndDateStr(e.target.value)}
              className={styles.filterDateInput}
            />
          </div>
        )}

        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Anggota Tim:</span>
          <select
            value={selectedAssignee}
            onChange={(e) => setSelectedAssignee(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">Semua Anggota Tim</option>
            {assigneeList.map(assignee => (
              <option key={assignee} value={assignee}>
                {assignee}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Load Grid */}
      <section className={styles.loadGridCard}>
        {issues.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>📊</span>
            <h3>Belum Ada Data Team Load</h3>
            <p>Silakan sinkronisasikan dari Jira API atau upload file export Jira CSV terlebih dahulu untuk melihat proyeksi beban kerja tim.</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '16px' }}>
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
              >
                {isSyncing ? '🔄 Menyinkronkan...' : '📥 Pull dari Jira API'}
              </button>
              <button 
                onClick={() => handleSyncJira('push')}
                disabled={isSyncing}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#B45309',
                  color: '#F8FAFC',
                  border: '1px solid #9A3412',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  opacity: isSyncing ? 0.7 : 1
                }}
              >
                {isSyncing ? '🔄 Menyinkronkan...' : '📤 Push ke Jira'}
              </button>
              <button className={styles.uploadBtn} onClick={() => setShowUploadModal(true)}>
                Upload Jira CSV Sekarang
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.loadTable}>
              <thead>
                <tr>
                  <th className={styles.fixedCol}>ID</th>
                  <th className={styles.taskCol}>Task</th>
                  <th>Status</th>
                  {selectedDates.map(date => (
                    <th key={date.getTime()} className={styles.dateCol}>
                      {formatDateLabel(date)}
                    </th>
                  ))}
                  <th className={styles.totalCol}>Total (h)</th>
                </tr>
                {/* Total Row */}
                <tr className={styles.totalsRow}>
                  <td className={styles.fixedCol} style={{ fontWeight: 800 }}>Capacity</td>
                  <td className={styles.taskCol} style={{ color: 'var(--muted-text)', fontWeight: 600 }}>
                    {selectedAssignee === 'all' ? `Daily team capacity (${assigneeList.length} orang)` : 'Daily capacity (1 orang)'}
                  </td>
                  <td style={{ fontWeight: 600 }}>-</td>
                  {dateTotals.map(item => {
                    const day = item.date.getDay();
                    const isWeekend = day === 0 || day === 6;
                    if (isWeekend) {
                      return <td key={item.date.getTime()} className={styles.weekendCell}>-</td>;
                    }
                    return (
                      <td key={item.date.getTime()} className={`${styles.totalCell} ${getCapacityColorClass(item.totalLoad)}`}>
                        {item.totalLoad}h
                      </td>
                    );
                  })}
                  <td className={`${styles.weeklyRemaining} ${remainingCapacity < 0 ? styles.overloadCell : styles.goodCell}`}>
                    {remainingCapacity.toFixed(1)}h
                  </td>
                </tr>
              </thead>
              <tbody>
                {taskDailyLoads.map(({ issue, totalHours, dailyHours, isActiveOnDate }, idx) => (
                  <tr
                    key={issue.id}
                    draggable
                    onDragStart={() => handleRowDragStart(idx)}
                    onDragEnter={() => handleRowDragEnter(idx)}
                    onDragEnd={handleRowDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                    className={styles.draggableRow}
                  >
                    <td className={styles.fixedCol}>
                      <a 
                        href={jiraUrl ? `${jiraUrl.replace(/\/+$/, '')}/browse/${issue.key}` : '#'} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={styles.issueKeyLink}
                        onClick={(e) => !jiraUrl && e.preventDefault()}
                      >
                        <span className={styles.issueKey}>{issue.key}</span>
                      </a>
                    </td>
                    <td className={styles.taskCol}>
                      <div className={styles.taskTitle} title={issue.summary} style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{
                          backgroundColor: 'var(--primary-light, #FEF3C7)',
                          color: '#B45309',
                          border: '1px solid rgba(245, 158, 11, 0.2)',
                          borderRadius: '4px',
                          padding: '1px 6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          marginRight: '8px',
                          fontFamily: 'monospace',
                          flexShrink: 0
                        }}>
                          {issue.key.split('-')[0]}
                        </span>
                        <span>{issue.summary}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${issue.status.toLowerCase() === 'done' ? styles.statusDone : issue.status.toLowerCase() === 'in progress' ? styles.statusProgress : styles.statusTodo}`}>
                        {issue.status}
                      </span>
                    </td>
                    {selectedDates.map((date, idx) => {
                      const isActive = isActiveOnDate(date);
                      const isPrevActive = isActive && idx > 0 ? isActiveOnDate(selectedDates[idx - 1]) : false;
                      const isNextActive = isActive && idx < selectedDates.length - 1 ? isActiveOnDate(selectedDates[idx + 1]) : false;

                      const day = date.getDay();
                      const isWeekend = day === 0 || day === 6;

                      if (isWeekend) {
                        return <td key={date.getTime()} className={styles.weekendCell}></td>;
                      }

                      let activeClass = '';
                      if (isActive) {
                        activeClass = styles.loadActive;
                        if (!isPrevActive && !isNextActive) {
                          activeClass += ` ${styles.loadActiveSingle}`;
                        } else if (!isPrevActive) {
                          activeClass += ` ${styles.loadActiveStart}`;
                        } else if (!isNextActive) {
                          activeClass += ` ${styles.loadActiveEnd}`;
                        } else {
                          activeClass += ` ${styles.loadActiveMiddle}`;
                        }
                      }

                      return (
                        <td 
                          key={date.getTime()} 
                          className={`${styles.loadCell} ${activeClass}`}
                        >
                          {isActive ? `${dailyHours.toFixed(1)}h` : ''}
                        </td>
                      );
                    })}
                    <td className={styles.totalCol} style={{ fontWeight: 600 }}>
                      {totalHours.toFixed(1)}h
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Upload CSV Modal */}
      {showUploadModal && (
        <div className={styles.modalOverlay} onClick={() => setShowUploadModal(false)}>
          <div className={`${styles.modal} animate-popover`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Upload Jira Export CSV 📤</h3>
              <button className={styles.closeBtn} onClick={() => setShowUploadModal(false)}>×</button>
            </div>
            <form onSubmit={handleFileUpload}>
              <div className={styles.modalBody}>
                <p className={styles.modalDesc}>
                  Upload file hasil export CSV Jira Anda. Data baru akan menggantikan proyeksi beban tim sebelumnya secara keseluruhan.
                </p>
                <div 
                  className={`${styles.fileDropZone} ${isDragging ? styles.dragActive : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    accept=".csv"
                    required
                    onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                    className={styles.fileInput}
                    id="jira-csv-file"
                  />
                  <label htmlFor="jira-csv-file" className={styles.dropZoneLabel}>
                    <span className={styles.uploadIcon}>📄</span>
                    {csvFile ? (
                      <span className={styles.fileName}>{csvFile.name}</span>
                    ) : (
                      <span>Pilih file export Jira CSV Anda atau drag & drop di sini</span>
                    )}
                  </label>
                </div>
                <div className={styles.requirementsBox}>
                  <h4>Panduan Kolom CSV Jira:</h4>
                  <ul>
                    <li>Kolom utama wajib: <strong>Key</strong> (misal: ST-418) dan <strong>Summary</strong>.</li>
                    <li>Untuk proyeksi: sediakan kolom <strong>Start date</strong> (atau fallback: Created) dan <strong>Due date</strong>.</li>
                    <li>Estimasi waktu: gunakan kolom <strong>Original estimate</strong> (dalam unit detik).</li>
                    <li>Kolom pelengkap: Assignee, Priority, Status, Issue Type.</li>
                  </ul>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowUploadModal(false)}>
                  Batal
                </button>
                <button type="submit" className={styles.submitBtn} disabled={uploading || !csvFile}>
                  {uploading ? 'Memproses CSV...' : 'Proyeksikan Tim Load'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
