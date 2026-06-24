'use client';

import Link from 'next/link';
import styles from './page.module.css';

export default function UserGuidePage() {
  return (
    <div className={`${styles.container} animate-fade-in`}>
      <header className={styles.header}>
        <h1 className={styles.title}>📖 User Guide — SuperPM</h1>
        <p className={styles.subtitle}>
          Panduan lengkap cara menggunakan SuperPM dari awal sampai sinkronisasi dengan Jira.
        </p>
      </header>

      {/* Overview */}
      <div className={styles.overviewGrid}>
        {[
          {
            icon: '🏠',
            title: 'Dashboard',
            desc: 'Ringkasan cepat semua projects & action items aktif'
          },
          {
            icon: '📁',
            title: 'Projects',
            desc: 'Buat & kelola semua project beserta detail dan action item-nya'
          },
          {
            icon: '✅',
            title: 'Action Items',
            desc: 'Kelola semua tugas lintas project, sync dua arah dengan Jira'
          },
          {
            icon: '👥',
            title: 'Teams Load',
            desc: 'Proyeksi beban kerja tim berdasarkan data estimasi Jira'
          },
          {
            icon: '💬',
            title: 'WA Copilot',
            desc: 'Input action item dan notes via pesan WhatsApp dengan AI'
          },
          {
            icon: '📝',
            title: 'Notes',
            desc: 'Simpan catatan rapat, meeting notes, atau konteks project'
          },
          {
            icon: '⚙️',
            title: 'Settings',
            desc: 'Konfigurasi koneksi Jira, token, dan pengaturan WA Copilot'
          }
        ].map(item => (
          <div key={item.title} className={styles.overviewCard}>
            <span className={styles.overviewIcon}>{item.icon}</span>
            <span className={styles.overviewTitle}>{item.title}</span>
            <span className={styles.overviewDesc}>{item.desc}</span>
          </div>
        ))}
      </div>

      {/* End-to-End Flow */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>🗺️ Alur End-to-End Manage Projects</h2>
        <div className={styles.flowDiagram}>

          <div className={styles.flowStep}>
            <div className={styles.flowNum}>1</div>
            <div className={styles.flowContent}>
              <h3>⚙️ Setup Koneksi Jira (sekali saja)</h3>
              <p>
                Buka menu <strong>Settings</strong> dan isi kredensial Jira: Jira URL, Email, dan API Token.
                Juga atur nomor WhatsApp dan sistem prompt untuk WA Copilot.
                Tanpa ini, fitur sync Jira dan WA tidak akan berfungsi.
              </p>
              <div className={styles.flowTags}>
                <span className={styles.flowTag}>→ Settings</span>
                <span className={`${styles.flowTag} ${styles.flowTagGreen}`}>Jira URL &amp; Token</span>
                <span className={`${styles.flowTag} ${styles.flowTagGreen}`}>WA Number</span>
              </div>
            </div>
          </div>

          <div className={styles.flowStep}>
            <div className={styles.flowNum}>2</div>
            <div className={styles.flowContent}>
              <h3>📁 Buat Project Baru</h3>
              <p>
                Di menu <strong>Projects</strong>, klik tombol <em>"Buat Project"</em>.
                Isi nama project, Jira Project Key (misal: <code>ST</code> atau <code>PM</code>), deskripsi, tanggal mulai, dan target selesai.
                Jira Project Key digunakan untuk memetakan action item ke project Jira yang tepat saat sync.
              </p>
              <div className={styles.flowTags}>
                <span className={styles.flowTag}>→ Projects</span>
                <span className={`${styles.flowTag} ${styles.flowTagOrange}`}>Jira Key Penting!</span>
              </div>
            </div>
          </div>

          <div className={styles.flowStep}>
            <div className={styles.flowNum}>3</div>
            <div className={styles.flowContent}>
              <h3>✅ Buat Action Items</h3>
              <p>
                Ada 3 cara membuat action item:
              </p>
              <ul style={{ margin: '0.3rem 0 0.5rem', paddingLeft: '1.2rem', fontSize: '0.85rem', color: 'var(--muted-text)', lineHeight: '1.8' }}>
                <li><strong>Manual</strong> — di menu Action Items, klik "Tambah Action Item"</li>
                <li><strong>Dari detail Project</strong> — buka project, lalu tambah action item di sana</li>
                <li><strong>Via WA Copilot</strong> — kirim pesan WhatsApp, AI akan mengekstrak action item otomatis</li>
              </ul>
              <p>
                Setiap action item punya: judul, deskripsi, PIC/assignee, due date, dan <strong>status</strong> (Open / In Progress / Done).
              </p>
              <div className={styles.flowTags}>
                <span className={styles.flowTag}>→ Action Items</span>
                <span className={styles.flowTag}>→ WA Copilot</span>
              </div>
            </div>
          </div>

          <div className={styles.flowStep}>
            <div className={styles.flowNum}>4</div>
            <div className={styles.flowContent}>
              <h3>🔄 Sync ke Jira (Push)</h3>
              <p>
                Di menu <strong>Action Items</strong>, <em>centang</em> satu atau beberapa action item yang ingin disinkronisasi.
                Tombol <strong>"Push ke Jira (n)"</strong> akan aktif. Klik untuk mengirim item-item tersebut ke Jira.
                Data yang dikirim: judul, deskripsi, PIC/assignee, due date, dan status.
              </p>
              <p>
                Filter project terlebih dahulu agar push hanya mengirim item ke project Jira yang tepat.
              </p>
              <div className={styles.flowTags}>
                <span className={`${styles.flowTag} ${styles.flowTagOrange}`}>📤 Push ke Jira</span>
                <span className={styles.flowTag}>Centang dulu!</span>
              </div>
            </div>
          </div>

          <div className={styles.flowStep}>
            <div className={styles.flowNum}>5</div>
            <div className={styles.flowContent}>
              <h3>📥 Tarik Update dari Jira (Pull)</h3>
              <p>
                Jika ada update di Jira (status berubah, assignee berganti, deskripsi ditambah), gunakan
                tombol <strong>"Pull dari Jira"</strong> di Action Items. Data lokal akan diperbarui mengikuti Jira.
              </p>
              <p>
                Di menu <strong>Action Items</strong>, filter project spesifik sebelum pull untuk sync
                yang lebih presisi. Di menu <strong>Teams Load</strong>, pull dari Jira akan mengambil semua project.
              </p>
              <div className={styles.flowTags}>
                <span className={`${styles.flowTag} ${styles.flowTagGreen}`}>📥 Pull dari Jira</span>
                <span className={styles.flowTag}>Semua field diperbarui</span>
              </div>
            </div>
          </div>

          <div className={styles.flowStep}>
            <div className={styles.flowNum}>6</div>
            <div className={styles.flowContent}>
              <h3>👥 Monitor Beban Tim (Teams Load)</h3>
              <p>
                Setelah data Jira tersync, buka <strong>Teams Load</strong> untuk melihat proyeksi beban kerja harian tim.
                Upload CSV export Jira jika diperlukan atau lakukan Pull dari Jira API.
                Filter per anggota tim dan rentang waktu (mingguan/bulanan/custom).
              </p>
              <div className={styles.flowTags}>
                <span className={styles.flowTag}>→ Teams Load</span>
                <span className={`${styles.flowTag} ${styles.flowTagOrange}`}>📄 Upload CSV</span>
              </div>
            </div>
          </div>

          <div className={styles.flowStep}>
            <div className={styles.flowNum}>7</div>
            <div className={styles.flowContent}>
              <h3>💬 Gunakan WA Copilot untuk Input Cepat</h3>
              <p>
                Kirim pesan ke nomor WA yang dikonfigurasi di Settings. AI akan mengekstrak action item, notes,
                dan informasi project dari pesan Anda secara otomatis.
                Hasil akan muncul di menu WA Copilot — review dan konfirmasi sebelum disimpan.
              </p>
              <div className={styles.flowTags}>
                <span className={styles.flowTag}>→ WA Copilot</span>
                <span className={`${styles.flowTag} ${styles.flowTagGreen}`}>AI-Powered</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Jira Sync Reference */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>🔄 Referensi Sinkronisasi Jira</h2>
        <table className={styles.syncTable}>
          <thead>
            <tr>
              <th>Aksi</th>
              <th>Lokasi</th>
              <th>Scope</th>
              <th>Keterangan</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span className={`${styles.badge} ${styles.badgePull}`}>📥 Pull dari Jira</span></td>
              <td>Action Items</td>
              <td>Project yang dipilih di filter</td>
              <td>Tarik update (judul, desc, PIC, due date, status) dari Jira ke lokal</td>
            </tr>
            <tr>
              <td><span className={`${styles.badge} ${styles.badgePush}`}>📤 Push ke Jira</span></td>
              <td>Action Items</td>
              <td>Item yang dicentang saja</td>
              <td>Kirim item terpilih ke Jira, update/buat issue baru</td>
            </tr>
            <tr>
              <td><span className={`${styles.badge} ${styles.badgePull}`}>📥 Pull dari Jira</span></td>
              <td>Teams Load</td>
              <td>Semua project</td>
              <td>Ambil semua issue Jira untuk proyeksi beban tim</td>
            </tr>
            <tr>
              <td><span className={`${styles.badge} ${styles.badgeWA}`}>📄 Upload CSV</span></td>
              <td>Teams Load</td>
              <td>Semua issue di file</td>
              <td>Import data via file export Jira CSV (bulk)</td>
            </tr>
          </tbody>
        </table>

        <div className={styles.infoBox}>
          <strong>Data yang disinkronisasi:</strong> Judul task · Deskripsi · PIC/Assignee · Due Date · Status (Open → To Do, In Progress → In Progress, Done → Done). Sinkronisasi bersifat dua arah — perubahan di Jira dan di lokal bisa saling diperbarui.
        </div>
      </section>

      {/* Status Legend */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>🏷️ Status Action Item</h2>
        <div className={styles.statusLegend}>
          <div className={styles.statusDot}>
            <div className={`${styles.dot} ${styles.dotOpen}`}></div>
            <span><strong>Open</strong> — Belum dimulai (→ Jira: <em>To Do</em>)</span>
          </div>
          <div className={styles.statusDot}>
            <div className={`${styles.dot} ${styles.dotProgress}`}></div>
            <span><strong>In Progress</strong> — Sedang dikerjakan (→ Jira: <em>In Progress</em>)</span>
          </div>
          <div className={styles.statusDot}>
            <div className={`${styles.dot} ${styles.dotDone}`}></div>
            <span><strong>Done</strong> — Selesai (→ Jira: <em>Done</em>)</span>
          </div>
        </div>

        <div className={styles.infoBox} style={{ marginTop: '1rem' }}>
          Di menu <strong>Action Items</strong>, status bisa diganti langsung dari dropdown di card.
          Di halaman lain (Dashboard, detail Project), status hanya ditampilkan sebagai label/badge — tidak bisa diubah dari sana.
        </div>
      </section>

      {/* Quick Tips */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>💡 Tips &amp; Best Practices</h2>
        <div className={styles.tipsGrid}>
          <div className={styles.tipCard}>
            <div className={styles.tipHeader}>
              <span className={styles.tipIcon}>🔑</span>
              <span className={styles.tipTitle}>Jira Project Key</span>
            </div>
            <ul>
              <li>Selalu isi Jira Key saat buat project (misal: <strong>ST</strong>, <strong>PM</strong>)</li>
              <li>Key ini dipakai untuk routing sync yang tepat</li>
              <li>Cek di Jira: Settings → Projects → Project Key</li>
            </ul>
          </div>

          <div className={styles.tipCard}>
            <div className={styles.tipHeader}>
              <span className={styles.tipIcon}>✅</span>
              <span className={styles.tipTitle}>Push Selektif</span>
            </div>
            <ul>
              <li>Centang item spesifik sebelum push ke Jira</li>
              <li>Push hanya item yang sudah ada perubahan</li>
              <li>Cek jumlah di tombol: <strong>Push (n)</strong></li>
            </ul>
          </div>

          <div className={styles.tipCard}>
            <div className={styles.tipHeader}>
              <span className={styles.tipIcon}>🔄</span>
              <span className={styles.tipTitle}>Urutan Sync</span>
            </div>
            <ul>
              <li>Selalu <strong>Pull dulu</strong> sebelum Push</li>
              <li>Ini mencegah override data terbaru dari Jira</li>
              <li>Pull → Update lokal → Push perubahan baru</li>
            </ul>
          </div>

          <div className={styles.tipCard}>
            <div className={styles.tipHeader}>
              <span className={styles.tipIcon}>💬</span>
              <span className={styles.tipTitle}>WA Copilot</span>
            </div>
            <ul>
              <li>Kirim format: "Action: [judul] - PIC: [nama] - Due: [tanggal]"</li>
              <li>AI akan mengekstrak otomatis dari percakapan natural</li>
              <li>Review hasil sebelum disimpan ke sistem</li>
            </ul>
          </div>

          <div className={styles.tipCard}>
            <div className={styles.tipHeader}>
              <span className={styles.tipIcon}>📊</span>
              <span className={styles.tipTitle}>Teams Load</span>
            </div>
            <ul>
              <li>Isi <strong>Original Estimate</strong> di Jira (dalam detik)</li>
              <li>Contoh: 8 jam = 28800 detik</li>
              <li>Tanpa estimasi, beban tidak terhitung</li>
            </ul>
          </div>

          <div className={styles.tipCard}>
            <div className={styles.tipHeader}>
              <span className={styles.tipIcon}>📝</span>
              <span className={styles.tipTitle}>Notes &amp; Konteks</span>
            </div>
            <ul>
              <li>Simpan meeting notes di menu Notes</li>
              <li>Link notes ke project untuk konteks mudah</li>
              <li>Notes bisa jadi input WA Copilot juga</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Quick Nav */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>⚡ Navigasi Cepat</h2>
        <div className={styles.shortcutGrid}>
          {[
            { emoji: '🏠', title: 'Dashboard', desc: 'Overview semua project & tasks', href: '/' },
            { emoji: '📁', title: 'Projects', desc: 'Buat & kelola project', href: '/projects' },
            { emoji: '✅', title: 'Action Items', desc: 'Semua tugas + sync Jira', href: '/action-items' },
            { emoji: '👥', title: 'Teams Load', desc: 'Proyeksi beban kerja', href: '/teams-load' },
            { emoji: '💬', title: 'WA Copilot', desc: 'Input via WhatsApp AI', href: '/wa-copilot' },
            { emoji: '📝', title: 'Notes', desc: 'Catatan & meeting notes', href: '/notes' },
            { emoji: '⚙️', title: 'Settings', desc: 'Konfigurasi Jira & WA', href: '/settings' },
          ].map(item => (
            <Link key={item.href} href={item.href} className={styles.shortcutItem} style={{ textDecoration: 'none' }}>
              <span className={styles.shortcutEmoji}>{item.emoji}</span>
              <div className={styles.shortcutText}>
                <strong>{item.title}</strong>
                <span>{item.desc}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
