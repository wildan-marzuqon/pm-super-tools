# PRD — PM Workspace (Notes + Project Tracker)

**Author:** PM  
**Status:** Draft v3  
**Last Updated:** 2026-06-20

---

## 1. Problem

Sebagai PM di startup AI, ada dua gap utama:

1. **Notes** — Mac Notes kurang terorganisir saat notes sudah banyak dan tidak bisa convert checklist item ke action item berstruktur.
2. **Project Tracking** — Jira tidak bisa merepresentasikan progress tahapan project secara visual step-by-step, sehingga susah tahu project mana di tahap mana.

---

## 2. Goals

- Satu platform ringan, compact, dan tidak membosankan untuk daily PM workflow.
- Notes yang bisa di-format dan checklistnya bisa dijadikan action item.
- Project tracking berbasis step-by-step pipeline (per project, customizable) dengan visualisasi progress yang jelas.
- Semua terhubung: notes ↔ action items ↔ projects.
- Deployable di Vercel dengan persistent data via PostgreSQL (Neon DB).

---

## 3. Target User

PM di startup AI Indonesia yang butuh tools personal (bukan tim besar), sederhana namun terstruktur.

---

## 4. Features

### 4.1 Notes

| # | Fitur | Deskripsi |
|---|-------|-----------|
| N1 | Rich text formatting | Bold, italic, heading, bullet list, numbered list |
| N2 | Checklist | Checkbox item di dalam notes |
| N3 | Convert to Action Item | Checklist item bisa di-convert jadi action item via **inline popover** di samping item (tidak memblok halaman) — isi deadline, PIC, keterangan, dan pilih project (opsional) langsung dari popover |
| N4 | Organisasi | Notes bisa dikelompokkan per folder/tag |
| N5 | Search | Full-text search di semua notes |

### 4.2 Action Items

| # | Fitur | Deskripsi |
|---|-------|-----------|
| A1 | Field standar | Title, deadline, PIC (free text), keterangan/deskripsi |
| A2 | Status | Open / In Progress / Done |
| A3 | Sumber | Dari notes (convert) atau dibuat manual |
| A4 | Link ke Project | Action item bisa dikaitkan ke project tertentu |

### 4.3 Project Tracker (Step-by-Step Pipeline)

| # | Fitur | Deskripsi |
|---|-------|-----------|
| P1 | Project list | Daftar semua project dengan info ringkas (nama, tahap saat ini, deadline, PIC) |
| P2 | Step visualizer | Setiap project punya tampilan step-by-step horizontal: tahap yang selesai berubah jadi centang (✓), tahap aktif di-highlight, tahap berikutnya abu-abu |
| P3 | Tahapan custom per project | Setiap project punya daftar tahapannya sendiri, bisa ditambah/edit/hapus via Project Settings |
| P4 | Default stages | Ideation → POC → Kick Off → Implementation → Live (bisa dimodif) |
| P5 | Advance stage | Tombol untuk menandai tahap saat ini selesai dan lanjut ke tahap berikutnya |
| P6 | Project detail | Nama, deskripsi, deadline, PIC, action items terkait, artifacts |
| P7 | Action Items per project | List action items yang terhubung ke project ini |
| P8 | Artifacts | Lampiran berupa link (Google Drive, Notion, Figma, dll.) dengan label dan deskripsi singkat |
| P9 | Project Settings | Menu per project untuk edit info dasar dan manage daftar tahapan (tambah, edit, urutkan, hapus) |

### 4.4 Dashboard

| # | Fitur | Deskripsi |
|---|-------|-----------|
| D1 | Project overview | Ringkasan semua project dengan tahap saat ini dan progress bar |
| D2 | Upcoming action items | Action items dengan deadline terdekat (7 hari ke depan) |
| D3 | Recent notes | Notes yang terakhir diedit |

---

## 5. Out of Scope (v1)

- Kolaborasi multi-user / real-time
- Integrasi langsung dengan Jira atau tool eksternal
- Upload file (cukup link eksternal)
- Mobile app
- Notifikasi / reminder

---

## 6. User Flow Utama

```
[Notes] → tambah checklist item → convert → [Action Item]
                                                    ↓
                                          kaitkan ke [Project]
                                                    ↓
                              tampil di [Project Detail] & [Dashboard]

[Project] → buka Project Settings → define stages → klik "Advance Stage"
         → tahap selesai (✓) → tahap berikutnya aktif
```

---

## 7. Data Model

**notes**
- `id`, `title`, `content` (rich text / JSON), `folder`, `tags`, `created_at`, `updated_at`

**action_items**
- `id`, `title`, `description`, `deadline`, `pic` (text), `status` (open/in_progress/done), `source_note_id?`, `project_id?`, `created_at`

**projects**
- `id`, `name`, `description`, `deadline`, `pic` (text), `current_stage_index`, `created_at`

**project_stages**
- `id`, `project_id`, `name`, `order`, `completed_at?`

**artifacts**
- `id`, `project_id`, `label`, `url`, `description`

---

## 8. UI Design Direction

- **Color scheme:** Putih & kuning (warm accent), clean tapi tidak flat/boring — gunakan subtle shadow, rounded corner, micro-animation
- **Layout:** Sidebar kiri navigasi (Dashboard / Notes / Projects / Action Items)
- **Notes:** Editor minimalis dengan toolbar compact di atas
- **Project Tracker:**
  - List view untuk semua project
  - Per-project: step indicator horizontal (✓ → aktif → abu-abu) di atas, konten detail di bawah
  - Tab dalam project detail: Overview | Action Items | Artifacts | Settings
- **Dashboard:** Card-based, grid layout, info yang paling actionable di atas

---

## 9. Tech Stack

| Layer | Pilihan |
|-------|--------|
| Frontend | Next.js (App Router) |
| Styling | Vanilla CSS / CSS Modules |
| Backend/API | Next.js API Routes |
| Database | PostgreSQL via Neon DB |
| ORM | Prisma |
| Deployment | Vercel |
| Auth | **Tidak ada** — single user, no login |

### API Endpoints (Overview)

```
# Notes
GET    /api/notes
POST   /api/notes
PUT    /api/notes/[id]
DELETE /api/notes/[id]

# Action Items
GET    /api/action-items
POST   /api/action-items
PUT    /api/action-items/[id]
DELETE /api/action-items/[id]

# Projects
GET    /api/projects
POST   /api/projects
PUT    /api/projects/[id]
DELETE /api/projects/[id]
POST   /api/projects/[id]/advance   ← advance ke stage berikutnya

# Project Stages
GET    /api/projects/[id]/stages
POST   /api/projects/[id]/stages
PUT    /api/projects/[id]/stages/[stageId]
DELETE /api/projects/[id]/stages/[stageId]

# Artifacts
GET    /api/projects/[id]/artifacts
POST   /api/projects/[id]/artifacts
PUT    /api/artifacts/[id]
DELETE /api/artifacts/[id]
```

---

## 10. Keputusan yang Sudah Final

| Topik | Keputusan |
|-------|-----------|
| Auth | Tidak ada — no login, langsung akses |
| Convert checklist → action item | Muncul sebagai **inline popover kecil** di samping checklist item yang diklik, memuat field: Title (auto-fill dari teks checklist), PIC, Deadline, Keterangan, Link ke Project (dropdown, opsional). Tidak memblok halaman. |
| PIC | Free text di semua tempat |
