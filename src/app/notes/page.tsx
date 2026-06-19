'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './page.module.css';

interface Note {
  id: string;
  title: string;
  content: string;
  folder: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface Project {
  id: string;
  name: string;
}

function NotesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedNoteId = searchParams.get('id');

  const [notes, setNotes] = useState<Note[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  
  // Filtering & Folders
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('All');
  
  // Editor State
  const [editorTitle, setEditorTitle] = useState('');
  const [editorFolder, setEditorFolder] = useState('');
  const [editorTags, setEditorTags] = useState('');
  const [saveStatus, setSaveStatus] = useState<'Saved' | 'Saving...' | 'Unsaved Changes'>('Saved');
  
  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Popover State (Convert checklist to action item)
  const [showPopover, setShowPopover] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const [selectedCheckboxId, setSelectedCheckboxId] = useState<string>('');
  const [popoverFields, setPopoverFields] = useState({
    title: '',
    pic: '',
    deadline: '',
    projectId: '',
    description: ''
  });

  // Fetch initial notes and projects
  useEffect(() => {
    async function fetchData() {
      try {
        const [notesRes, projRes] = await Promise.all([
          fetch('/api/notes'),
          fetch('/api/projects')
        ]);
        if (notesRes.ok && projRes.ok) {
          const notesData = await notesRes.json();
          const projectsData = await projRes.json();
          setNotes(notesData);
          setProjects(projectsData);

          // If a note ID is provided in query, select it
          if (selectedNoteId) {
            const activeNote = notesData.find((n: Note) => n.id === selectedNoteId);
            if (activeNote) {
              selectNote(activeNote);
            }
          } else if (notesData.length > 0) {
            selectNote(notesData[0]);
          }
        }
      } catch (error) {
        console.error('Error fetching notes page data:', error);
      }
    }
    fetchData();
  }, [selectedNoteId]);

  // Handle note selection
  const selectNote = (note: Note) => {
    setSelectedNote(note);
    setEditorTitle(note.title);
    setEditorFolder(note.folder);
    setEditorTags(note.tags.join(', '));
    setShowPopover(false);
    
    if (editorRef.current) {
      editorRef.current.innerHTML = note.content || '<p><br></p>';
    }
    setSaveStatus('Saved');
  };

  // Helper to trigger save
  const triggerSave = (updatedFields: Partial<Note>) => {
    if (!selectedNote) return;
    
    setSaveStatus('Saving...');
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const updatedNote = {
          ...selectedNote,
          ...updatedFields,
          updated_at: new Date().toISOString()
        };

        const res = await fetch(`/api/notes/${selectedNote.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedNote)
        });

        if (res.ok) {
          const savedNote = await res.json();
          // Update notes list
          setNotes((prevNotes) =>
            prevNotes.map((n) => (n.id === savedNote.id ? savedNote : n))
          );
          setSelectedNote(savedNote);
          setSaveStatus('Saved');
        } else {
          setSaveStatus('Unsaved Changes');
        }
      } catch (error) {
        console.error('Error auto-saving note:', error);
        setSaveStatus('Unsaved Changes');
      }
    }, 1000); // 1s debounce
  };

  // Handle Input Changes
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEditorTitle(val);
    triggerSave({ title: val });
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEditorFolder(val);
    triggerSave({ folder: val || 'Uncategorized' });
  };

  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEditorTags(val);
    const tagsArr = val.split(',').map((t) => t.trim()).filter((t) => t !== '');
    triggerSave({ tags: tagsArr });
  };

  const handleContentChange = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    triggerSave({ content: html });
  };

  // Create new note
  const handleNewNote = async () => {
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Note Baru',
          content: '<p>Tulis di sini...</p>',
          folder: selectedFolder !== 'All' ? selectedFolder : 'Work',
          tags: []
        })
      });

      if (res.ok) {
        const newNote = await res.json();
        setNotes((prev) => [newNote, ...prev]);
        selectNote(newNote);
        router.push(`/notes?id=${newNote.id}`);
      }
    } catch (error) {
      console.error('Error creating note:', error);
    }
  };

  // Delete note
  const handleDeleteNote = async () => {
    if (!selectedNote) return;
    if (!confirm('Apakah Anda yakin ingin menghapus note ini?')) return;

    try {
      const res = await fetch(`/api/notes/${selectedNote.id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        const remainingNotes = notes.filter((n) => n.id !== selectedNote.id);
        setNotes(remainingNotes);
        if (remainingNotes.length > 0) {
          selectNote(remainingNotes[0]);
          router.push(`/notes?id=${remainingNotes[0].id}`);
        } else {
          setSelectedNote(null);
          router.push('/notes');
        }
      }
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  // Rich Text Editor Command execution
  const executeCmd = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    handleContentChange();
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  // Insert checklist checkbox in editor
  const insertChecklist = () => {
    // Generate a unique checkbox ID
    const chkId = `chk-${Date.now()}`;
    const checklistHtml = `<ul><li><input type="checkbox" id="${chkId}">&nbsp;</li></ul>`;
    executeCmd('insertHTML', checklistHtml);
  };

  // Handle editor clicks to manage checkboxes and popover triggers
  const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    // 1. If checkbox clicked, toggle check state inside contentEditable and save
    if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') {
      const isChecked = (target as HTMLInputElement).checked;
      target.setAttribute(isChecked ? 'checked' : '', isChecked ? 'true' : '');
      if (!isChecked) {
        target.removeAttribute('checked');
      }
      handleContentChange();
      return;
    }

    // 2. We can show a small floating action trigger next to a checkbox to trigger popover
    // Alternatively, clicking the checkbox or hovering could display a button.
    // Let's implement an elegant approach: Clicking a checklist item's text or hover 
    // triggers popover. To be very explicit, let's look for a checkbox.
    // If the click is near a checkbox (e.g. inside a LI that has a checkbox),
    // let's show a small "⚡" indicator next to the editor page or right above it.
    // Let's make it so that if a checklist text is clicked or focused, we can offer to convert.
  };

  // We can attach mousemove/hover or context menu or click handlers.
  // Let's show an indicator next to any checklist item. To make it extremely reliable:
  // When a user hovers a checkbox or clicks a text in checklist, we can show a floating "⚡ Convert" button.
  // Let's implement dynamic detection of checkbox elements on editor focus / selection change.
  const handleEditorKeyUpOrMouseUp = () => {
    // Check if current selection is inside a list item with a checkbox
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    let node = range.startContainer as HTMLElement;
    
    // Climb up to find LI
    while (node && node.nodeName !== 'LI' && node.id !== 'editor-body') {
      node = node.parentNode as HTMLElement;
    }

    if (node && node.nodeName === 'LI') {
      const checkbox = node.querySelector('input[type="checkbox"]') as HTMLInputElement;
      if (checkbox) {
        // We found a checklist item!
        // Show a converter popover positioned relative to this list item
        const rect = node.getBoundingClientRect();
        const editorContainer = editorRef.current?.getBoundingClientRect();
        
        if (editorContainer) {
          // Set popover position next to the LI
          setPopoverPos({
            top: rect.top - editorContainer.top + 32, // offset
            left: Math.max(10, rect.left - editorContainer.left)
          });
          
          setSelectedCheckboxId(checkbox.id || '');
          
          // Get text of list item (excluding checkbox)
          const textContent = node.textContent?.trim() || '';
          setPopoverFields((prev) => ({
            ...prev,
            title: textContent,
            pic: prev.pic || 'Wildan', // Default PIC
            deadline: prev.deadline || new Date().toISOString().split('T')[0] // Default today
          }));
          
          // Wait, let's not auto-show it immediately on click, but rather show a small "⚡" button.
          // Let's show the "⚡" floating trigger button at this position!
          // Then if they click the ⚡ button, we open the full popover.
          // This prevents popover from popping up constantly while typing.
          setFloatButtonPos({
            top: rect.top - editorContainer.top + 2,
            left: Math.max(0, rect.left - editorContainer.left - 24),
            visible: true,
            nodeText: textContent,
            nodeId: checkbox.id || ''
          });
        }
      } else {
        setFloatButtonPos((prev) => ({ ...prev, visible: false }));
      }
    } else {
      setFloatButtonPos((prev) => ({ ...prev, visible: false }));
    }
  };

  const [floatButtonPos, setFloatButtonPos] = useState({
    top: 0,
    left: 0,
    visible: false,
    nodeText: '',
    nodeId: ''
  });

  // Open popover from float button click
  const handleOpenPopover = () => {
    setPopoverFields({
      title: floatButtonPos.nodeText,
      pic: 'Wildan',
      deadline: new Date().toISOString().split('T')[0],
      projectId: projects[0]?.id || '',
      description: ''
    });
    setSelectedCheckboxId(floatButtonPos.nodeId);
    setPopoverPos({
      top: floatButtonPos.top + 24,
      left: floatButtonPos.left + 24
    });
    setShowPopover(true);
  };

  // Convert checklist to Action Item
  const handleConvertToActionItem = async () => {
    if (!popoverFields.title) return;

    try {
      const res = await fetch('/api/action-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: popoverFields.title,
          description: popoverFields.description,
          deadline: popoverFields.deadline,
          pic: popoverFields.pic,
          status: 'open',
          project_id: popoverFields.projectId || undefined,
          source_note_id: selectedNote?.id
        })
      });

      if (res.ok) {
        const newAction = await res.json();
        
        // Update the checkbox line in editor to indicate it has been converted
        if (editorRef.current && selectedCheckboxId) {
          const checkboxEl = editorRef.current.querySelector(`#${selectedCheckboxId}`);
          if (checkboxEl) {
            const li = checkboxEl.closest('li');
            if (li) {
              // Append a badge/status indicating it has been converted to action item
              // Make sure to preserve checkbox state
              const isChecked = (checkboxEl as HTMLInputElement).checked;
              
              // We replace the text node with styled HTML that indicates it's converted
              // E.g. Checkbox + Text + Converted Badge
              const textSpan = document.createElement('span');
              textSpan.style.color = '#B45309';
              textSpan.style.fontWeight = '500';
              textSpan.innerHTML = ` ${popoverFields.title} <span class="${styles.convertedBadge}" style="font-size: 10px; background-color: #FEF3C7; color: #D97706; padding: 2px 6px; border-radius: 4px; font-weight: bold; margin-left: 6px;">⚡ Action (PIC: ${popoverFields.pic})</span>`;
              
              // Clear text inside LI except the checkbox input itself
              while (li.childNodes.length > 1) {
                li.removeChild(li.lastChild!);
              }
              li.appendChild(textSpan);
              
              // Trigger save of note content
              handleContentChange();
            }
          }
        }

        setShowPopover(false);
        setFloatButtonPos((prev) => ({ ...prev, visible: false }));
        alert(`Berhasil membuat Action Item: "${newAction.title}"!`);
      }
    } catch (error) {
      console.error('Error converting checklist to action item:', error);
    }
  };

  // Get distinct folders from notes
  const folders = ['All', ...Array.from(new Set(notes.map((note) => note.folder))).filter(Boolean)];

  // Filter notes by search query and active folder
  const filteredNotes = notes.filter((note) => {
    const matchesSearch =
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFolder = selectedFolder === 'All' || note.folder === selectedFolder;
    return matchesSearch && matchesFolder;
  });

  return (
    <div className={styles.container}>
      {/* Sidebar for Notes navigation */}
      <div className={styles.notesSidebar}>
        <div className={styles.sidebarHeader}>
          <h2>Catatan saya</h2>
          <button className={styles.newNoteBtn} onClick={handleNewNote}>
            + Note Baru
          </button>
        </div>

        {/* Search */}
        <div className={styles.searchContainer}>
          <input
            type="text"
            placeholder="Cari catatan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        {/* Folders tabs */}
        <div className={styles.foldersList}>
          {folders.map((folder) => (
            <button
              key={folder}
              onClick={() => setSelectedFolder(folder)}
              className={`${styles.folderBtn} ${selectedFolder === folder ? styles.activeFolder : ''}`}
            >
              📁 {folder}
            </button>
          ))}
        </div>

        {/* Notes List */}
        <div className={styles.notesList}>
          {filteredNotes.length === 0 ? (
            <p className={styles.noNotes}>Tidak ada note ditemukan.</p>
          ) : (
            filteredNotes.map((note) => (
              <div
                key={note.id}
                onClick={() => selectNote(note)}
                className={`${styles.noteListItem} ${selectedNote?.id === note.id ? styles.activeNoteItem : ''}`}
              >
                <span className={styles.noteListFolder}>{note.folder}</span>
                <h4 className={styles.noteListTitle}>{note.title || 'Untitled Note'}</h4>
                <p 
                  className={styles.noteListSnippet}
                  dangerouslySetInnerHTML={{ 
                    __html: note.content 
                      ? note.content.replace(/<[^>]*>/g, ' ').substring(0, 60) + '...'
                      : 'No content...'
                  }}
                />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Editor View */}
      <div className={styles.editorArea}>
        {selectedNote ? (
          <div className={styles.editorContainer}>
            {/* Editor Header metadata */}
            <div className={styles.editorHeader}>
              <div className={styles.titleRow}>
                <input
                  type="text"
                  value={editorTitle}
                  onChange={handleTitleChange}
                  placeholder="Judul Catatan..."
                  className={styles.titleInput}
                />
                <div className={styles.saveStatus}>
                  <span className={`${styles.statusDot} ${saveStatus === 'Saved' ? styles.statusSaved : styles.statusSaving}`}></span>
                  {saveStatus}
                </div>
              </div>

              <div className={styles.metadataRow}>
                <div className={styles.metaField}>
                  <span className={styles.metaLabel}>Folder:</span>
                  <input
                    type="text"
                    value={editorFolder}
                    onChange={handleFolderChange}
                    placeholder="Work / Personal / Design..."
                    className={styles.metaInput}
                  />
                </div>
                <div className={styles.metaField}>
                  <span className={styles.metaLabel}>Tags (koma):</span>
                  <input
                    type="text"
                    value={editorTags}
                    onChange={handleTagsChange}
                    placeholder="AI, Product, UX..."
                    className={styles.metaInput}
                  />
                </div>
                <button className={styles.deleteBtn} onClick={handleDeleteNote}>
                  🗑️ Hapus Note
                </button>
              </div>
            </div>

            {/* Custom Rich Text Formatting Toolbar */}
            <div className={styles.toolbar}>
              <button title="Heading" onClick={() => executeCmd('formatBlock', '<h3>')}><b>H1</b></button>
              <button title="Paragraph" onClick={() => executeCmd('formatBlock', '<p>')}>P</button>
              <button title="Bold" onClick={() => executeCmd('bold')}><b>B</b></button>
              <button title="Italic" onClick={() => executeCmd('italic')}><i>I</i></button>
              <button title="Bullet List" onClick={() => executeCmd('insertUnorderedList')}>• List</button>
              <button title="Checklist" onClick={insertChecklist} className={styles.checklistBtn}>
                ✓ Checklist
              </button>
            </div>

            {/* ContentEditable Editor Body */}
            <div className={styles.editorBodyContainer}>
              <div
                id="editor-body"
                className={`${styles.editorBody} rich-editor`}
                contentEditable
                ref={editorRef}
                onInput={handleContentChange}
                onClick={handleEditorClick}
                onKeyUp={handleEditorKeyUpOrMouseUp}
                onMouseUp={handleEditorKeyUpOrMouseUp}
              />

              {/* Floating Convert Button Trigger */}
              {floatButtonPos.visible && (
                <button
                  className={styles.floatConvertBtn}
                  style={{ top: floatButtonPos.top, left: floatButtonPos.left }}
                  onClick={handleOpenPopover}
                  title="Convert checklist item ke Action Item"
                >
                  ⚡
                </button>
              )}

              {/* Popover Form (Convert checklist to action item) */}
              {showPopover && (
                <div
                  className={`${styles.popover} animate-popover`}
                  style={{ top: popoverPos.top, left: popoverPos.left }}
                >
                  <div className={styles.popoverHeader}>
                    <h4>Buat Action Item ⚡</h4>
                    <button className={styles.popoverClose} onClick={() => setShowPopover(false)}>×</button>
                  </div>
                  <div className={styles.popoverBody}>
                    <div className={styles.popoverField}>
                      <label>Judul Action Item</label>
                      <input
                        type="text"
                        value={popoverFields.title}
                        onChange={(e) => setPopoverFields({ ...popoverFields, title: e.target.value })}
                        placeholder="Nama tugas..."
                      />
                    </div>
                    <div className={styles.popoverRow}>
                      <div className={styles.popoverField}>
                        <label>PIC (freetext)</label>
                        <input
                          type="text"
                          value={popoverFields.pic}
                          onChange={(e) => setPopoverFields({ ...popoverFields, pic: e.target.value })}
                          placeholder="Nama PIC..."
                        />
                      </div>
                      <div className={styles.popoverField}>
                        <label>Deadline</label>
                        <input
                          type="date"
                          value={popoverFields.deadline}
                          onChange={(e) => setPopoverFields({ ...popoverFields, deadline: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className={styles.popoverField}>
                      <label>Kaitkan ke Project</label>
                      <select
                        value={popoverFields.projectId}
                        onChange={(e) => setPopoverFields({ ...popoverFields, projectId: e.target.value })}
                      >
                        <option value="">-- Tanpa Project (Standalone) --</option>
                        {projects.map((proj) => (
                          <option key={proj.id} value={proj.id}>
                            {proj.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.popoverField}>
                      <label>Keterangan</label>
                      <textarea
                        value={popoverFields.description}
                        onChange={(e) => setPopoverFields({ ...popoverFields, description: e.target.value })}
                        placeholder="Detail atau catatan tambahan..."
                        rows={2}
                      />
                    </div>
                    <button className={styles.convertSubmitBtn} onClick={handleConvertToActionItem}>
                      Convert Jadi Action Item
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.emptyEditor}>
            <span className={styles.emptyIcon}>📝</span>
            <p>Silakan buat catatan baru atau pilih catatan yang ada di sidebar kiri.</p>
            <button className={styles.newNoteBtnLarge} onClick={handleNewNote}>
              + Buat Catatan Baru
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NotesPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#6B7280' }}>
        Loading Editor...
      </div>
    }>
      <NotesContent />
    </Suspense>
  );
}
