'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { TextStyle } from '@tiptap/extension-text-style';
import { Extension } from '@tiptap/core';
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
  categories?: Array<{ id: string; name: string }>;
}

// Custom Font Size Extension
export const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return {
      types: ['textStyle'],
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize || element.getAttribute('size'),
            renderHTML: attributes => {
              if (!attributes.fontSize) {
                return {};
              }
              let sizeStr = attributes.fontSize;
              if (sizeStr === '2') sizeStr = '12px';
              else if (sizeStr === '3') sizeStr = '15px';
              else if (sizeStr === '4') sizeStr = '20px';
              
              return {
                style: `font-size: ${sizeStr}`,
              };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize: (fontSize: string) => ({ chain }) => {
        return chain()
          .setMark('textStyle', { fontSize })
          .run();
      },
      unsetFontSize: () => ({ chain }) => {
        return chain()
          .setMark('textStyle', { fontSize: null })
          .removeEmptyTextStyle()
          .run();
      },
    };
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

function NotesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedNoteId = searchParams.get('id');

  const [notes, setNotes] = useState<Note[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Button Loading States
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [isDeletingNote, setIsDeletingNote] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  // Filtering & Folders
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('All');
  const [selectedTag, setSelectedTag] = useState('All');
  
  // Editor State
  const [editorTitle, setEditorTitle] = useState('');
  const [editorFolder, setEditorFolder] = useState('');
  const [editorTags, setEditorTags] = useState('');
  const [saveStatus, setSaveStatus] = useState<'Saved' | 'Saving...' | 'Unsaved Changes'>('Saved');
  const [mounted, setMounted] = useState(false);
  const isDirtyRef = useRef(false);
  const lastSavedContentRef = useRef<string>('');

  useEffect(() => {
    setMounted(true);
  }, []);
  
  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Popover State (Convert checklist/bold text to action item)
  const [showPopover, setShowPopover] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const [selectedCheckboxId, setSelectedCheckboxId] = useState<string>('');
  const [popoverFields, setPopoverFields] = useState({
    title: '',
    pic: '',
    deadline: '',
    projectId: '',
    categoryId: '',
    description: ''
  });

  // Tiptap Editor Initialization
  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      TextStyle,
      FontSize,
    ],
    content: '',
    immediatelyRender: false,
    onSelectionUpdate: ({ editor }) => {
      handleSelectionChange(editor);
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      handleContentChange(html);
    },
  });

  // 1. Fetch initial notes and projects on mount
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
          const urlNoteId = new URLSearchParams(window.location.search).get('id');
          if (urlNoteId) {
            const activeNote = notesData.find((n: Note) => n.id === urlNoteId);
            if (activeNote) {
              selectNote(activeNote);
              return;
            }
          }
          if (notesData.length > 0) {
            selectNote(notesData[0]);
          }
        }
      } catch (error) {
        console.error('Error fetching notes page data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // 2. Select note when selectedNoteId in query changes
  useEffect(() => {
    if (!loading && selectedNoteId && notes.length > 0) {
      if (selectedNote?.id !== selectedNoteId) {
        const activeNote = notes.find((n) => n.id === selectedNoteId);
        if (activeNote) {
          setSelectedNote(activeNote);
          setEditorTitle(activeNote.title);
          setEditorFolder(activeNote.folder);
          setEditorTags(activeNote.tags.join(', '));
          setShowPopover(false);
          setSaveStatus('Saved');
        }
      }
    }
  }, [selectedNoteId, notes, loading]);

  // 3. Keep Tiptap editor content synchronized with selectedNote.id changes
  useEffect(() => {
    if (editor && selectedNote) {
      if (editorRef.current?.getAttribute('data-note-id') !== selectedNote.id) {
        editorRef.current?.setAttribute('data-note-id', selectedNote.id);
        editor.commands.setContent(selectedNote.content || '<p></p>');
      }
    }
  }, [selectedNote, editor]);

  // Handle note selection
  const selectNote = (note: Note) => {
    setSelectedNote(note);
    setEditorTitle(note.title);
    setEditorFolder(note.folder);
    setEditorTags(note.tags.join(', '));
    setShowPopover(false);
    
    if (editor) {
      editorRef.current?.setAttribute('data-note-id', note.id);
      editor.commands.setContent(note.content || '<p></p>');
    }
    setSaveStatus('Saved');
    router.push(`/notes?id=${note.id}`, { scroll: false });
  };

  // Helper to trigger save
  const triggerSave = (updatedFields: Partial<Note>) => {
    if (!selectedNote) return;
    
    // Skip if content hasn't changed
    if (updatedFields.content !== undefined && updatedFields.content === lastSavedContentRef.current) {
      return;
    }

    isDirtyRef.current = true;
    setSaveStatus('Unsaved Changes');
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      if (!isDirtyRef.current) return;
      setSaveStatus('Saving...');
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
          setNotes((prevNotes) =>
            prevNotes.map((n) => (n.id === savedNote.id ? savedNote : n))
          );
          setSelectedNote(savedNote);
          if (updatedFields.content !== undefined) {
            lastSavedContentRef.current = updatedFields.content;
          }
          isDirtyRef.current = false;
          setSaveStatus('Saved');
        } else {
          setSaveStatus('Unsaved Changes');
        }
      } catch (error) {
        console.error('Error auto-saving note:', error);
        setSaveStatus('Unsaved Changes');
      }
    }, 1500);
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

  const handleContentChange = (htmlContent?: string) => {
    let html = '';
    if (htmlContent !== undefined) {
      html = htmlContent;
    } else if (editor) {
      html = editor.getHTML();
    } else if (editorRef.current) {
      const prosemirrorEl = editorRef.current.querySelector('.ProseMirror');
      html = prosemirrorEl ? prosemirrorEl.innerHTML : editorRef.current.innerHTML;
    } else {
      return;
    }
    triggerSave({ content: html });
  };

  // Create new note
  const handleNewNote = async () => {
    if (isCreatingNote) return;
    setIsCreatingNote(true);
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
    } finally {
      setIsCreatingNote(false);
    }
  };

  // Delete note
  const handleDeleteNote = async () => {
    if (!selectedNote || isDeletingNote) return;
    if (!confirm('Apakah Anda yakin ingin menghapus note ini?')) return;

    setIsDeletingNote(true);
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
    } finally {
      setIsDeletingNote(false);
    }
  };

  // Tiptap Command executions
  const executeCmd = (command: string, value: string = '') => {
    if (!editor) return;
    if (command === 'bold') {
      editor.chain().focus().toggleBold().run();
    } else if (command === 'italic') {
      editor.chain().focus().toggleItalic().run();
    } else if (command === 'insertUnorderedList') {
      editor.chain().focus().toggleBulletList().run();
    } else if (command === 'formatBlock') {
      if (value === '<h3>') {
        editor.chain().focus().toggleHeading({ level: 3 }).run();
      } else if (value === '<p>') {
        editor.chain().focus().setParagraph().run();
      }
    } else if (command === 'fontSize') {
      let size = value;
      if (size === '2') size = '12px';
      else if (size === '3') size = '15px';
      else if (size === '4') size = '20px';
      editor.chain().focus().setFontSize(size).run();
    }
  };

  // Insert checklist checkbox in editor
  const insertChecklist = () => {
    if (!editor) return;
    editor.chain().focus().toggleTaskList().run();
  };

  // Clear data-converting attributes
  const clearConvertingFlags = () => {
    if (editorRef.current) {
      const elements = editorRef.current.querySelectorAll('[data-converting]');
      elements.forEach((el) => el.removeAttribute('data-converting'));
    }
  };

  // Monitor selection change in Tiptap
  const handleSelectionChange = (editorInstance: any) => {
    const { state, view } = editorInstance;
    const { selection } = state;
    
    if (!selection) {
      setFloatButtonPos((prev) => ({ ...prev, visible: false }));
      clearConvertingFlags();
      return;
    }

    // 1. Text Selection Highlight Mode (Non-collapsed selection)
    if (!selection.empty) {
      const text = state.doc.textBetween(selection.from, selection.to, ' ').trim();
      if (text.length > 0) {
        const rect = view.coordsAtPos(selection.to);
        const editorContainer = editorRef.current?.getBoundingClientRect();
        if (editorContainer) {
          clearConvertingFlags();
          setFloatButtonPos({
            top: rect.top - editorContainer.top - 28 + (editorRef.current?.scrollTop || 0),
            left: rect.left - editorContainer.left,
            visible: true,
            nodeText: text,
            nodeId: ''
          });
          return;
        }
      }
    }

    // 2. Bold Text Focus Mode (Cursor inside a bold element)
    if (editorInstance.isActive('bold')) {
      const { $from } = selection;
      const dom = view.domAtPos($from.pos);
      let boldNode = dom.node as HTMLElement;
      
      while (boldNode && boldNode !== view.dom && boldNode.nodeName !== 'STRONG' && boldNode.nodeName !== 'B') {
        boldNode = boldNode.parentNode as HTMLElement;
      }
      
      if (boldNode && boldNode !== view.dom) {
        const rect = boldNode.getBoundingClientRect();
        const editorContainer = editorRef.current?.getBoundingClientRect();
        if (editorContainer) {
          clearConvertingFlags();
          boldNode.setAttribute('data-converting', 'true');
          setFloatButtonPos({
            top: rect.top - editorContainer.top + 2 + (editorRef.current?.scrollTop || 0),
            left: rect.right - editorContainer.left + 8,
            visible: true,
            nodeText: boldNode.textContent?.trim() || '',
            nodeId: ''
          });
          return;
        }
      }
    }

    // 3. Checklist Item Focus Mode (Cursor inside checklist)
    let node = view.nodeDOM(selection.$from.before(selection.$from.depth)) as HTMLElement;
    while (node && node.nodeName !== 'LI' && node !== view.dom) {
      node = node.parentNode as HTMLElement;
    }

    if (node && node.nodeName === 'LI' && node.getAttribute('data-type') === 'taskItem') {
      const checkbox = node.querySelector('input[type="checkbox"]') as HTMLInputElement;
      const rect = node.getBoundingClientRect();
      const editorContainer = editorRef.current?.getBoundingClientRect();
      
      if (editorContainer) {
        clearConvertingFlags();
        const textContent = node.textContent?.trim() || '';
        
        if (checkbox && !checkbox.id) {
          checkbox.id = `chk-${Date.now()}`;
        }
        
        setFloatButtonPos({
          top: rect.top - editorContainer.top + 2 + (editorRef.current?.scrollTop || 0),
          left: Math.max(0, rect.left - editorContainer.left - 24),
          visible: true,
          nodeText: textContent,
          nodeId: checkbox ? checkbox.id : ''
        });
        return;
      }
    }

    // Otherwise, hide float button
    setFloatButtonPos((prev) => ({ ...prev, visible: false }));
    clearConvertingFlags();
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
      categoryId: '',
      description: ''
    });
    setSelectedCheckboxId(floatButtonPos.nodeId);
    setPopoverPos({
      top: floatButtonPos.top + 24,
      left: floatButtonPos.left + 24
    });
    setShowPopover(true);
  };

  // Convert checklist/bold text to Action Item
  const handleConvertToActionItem = async () => {
    if (!popoverFields.title || isConverting) return;

    setIsConverting(true);
    try {
      const res = await fetch('/api/action-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: popoverFields.title,
          description: popoverFields.description,
          deadline: popoverFields.deadline,
          pic: popoverFields.pic,
          completed: false,
          project_id: popoverFields.projectId || null,
          category_id: popoverFields.categoryId || null,
          source_note_id: selectedNote?.id
        })
      });

      if (res.ok) {
        const newAction = await res.json();
        
        // 1. Update the checkbox line in editor
        if (editor && editorRef.current && selectedCheckboxId) {
          const checkboxEl = editorRef.current.querySelector(`#${selectedCheckboxId}`);
          if (checkboxEl) {
            const li = checkboxEl.closest('li');
            if (li) {
              const textSpan = document.createElement('span');
              textSpan.style.color = '#B45309';
              textSpan.style.fontWeight = '500';
              textSpan.innerHTML = ` ${popoverFields.title} <span class="${styles.convertedBadge}" style="font-size: 10px; background-color: #FEF3C7; color: #D97706; padding: 2px 6px; border-radius: 4px; font-weight: bold; margin-left: 6px;">⚡ Action (PIC: ${popoverFields.pic})</span>`;
              
              const label = li.querySelector('label');
              if (label) {
                while (li.childNodes.length > 0) {
                  li.removeChild(li.firstChild!);
                }
                li.appendChild(label);
                li.appendChild(textSpan);
              } else {
                while (li.childNodes.length > 1) {
                  li.removeChild(li.lastChild!);
                }
                li.appendChild(textSpan);
              }
              editor.commands.setContent(editorRef.current.innerHTML);
            }
          }
        }

        // 2. Update the bold tag in editor
        if (editor && editorRef.current && !selectedCheckboxId) {
          const boldEl = editorRef.current.querySelector('[data-converting]');
          if (boldEl) {
            const badge = document.createElement('span');
            badge.style.fontSize = '10px';
            badge.style.backgroundColor = '#FEF3C7';
            badge.style.color = '#D97706';
            badge.style.padding = '2px 6px';
            badge.style.borderRadius = '4px';
            badge.style.fontWeight = 'bold';
            badge.style.marginLeft = '6px';
            badge.style.display = 'inline-block';
            badge.style.verticalAlign = 'middle';
            badge.innerHTML = `⚡ Action (PIC: ${popoverFields.pic})`;

            boldEl.parentNode?.insertBefore(badge, boldEl.nextSibling);
            boldEl.removeAttribute('data-converting');
            editor.commands.setContent(editorRef.current.innerHTML);
          }
        }

        setShowPopover(false);
        setFloatButtonPos((prev) => ({ ...prev, visible: false }));
        clearConvertingFlags();
        alert(`Berhasil membuat Action Item: "${newAction.title}"!`);
      }
    } catch (error) {
      console.error('Error converting to action item:', error);
    } finally {
      setIsConverting(false);
    }
  };

  // Helper formatting date
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Folder helper list
  const folders = ['All', ...Array.from(new Set(notes.map((n) => n.folder).filter(Boolean)))];

  // Tag helper list
  const allTags = ['All', ...Array.from(new Set(notes.flatMap((n) => n.tags || []).filter(Boolean)))];

  // Filtering notes
  const filteredNotes = notes.filter((n) => {
    const matchesSearch =
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (n.content && n.content.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesFolder = selectedFolder === 'All' || n.folder === selectedFolder;

    const matchesTag = selectedTag === 'All' || (n.tags && n.tags.includes(selectedTag));
    
    return matchesSearch && matchesFolder && matchesTag;
  });

  return (
    <div className={styles.container}>
      {/* Sidebar List */}
      <div className={styles.notesSidebar}>
        <div className={styles.sidebarHeader}>
          <h2>Catatan 📝</h2>
          <button className={styles.newNoteBtn} onClick={handleNewNote} disabled={isCreatingNote}>
            + Note Baru
          </button>
        </div>

        <div className={styles.searchContainer}>
          <input
            type="text"
            placeholder="Cari catatan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        {/* Folders row list */}
        <div className={styles.foldersList}>
          {folders.map((folderName) => (
            <button
              key={folderName}
              onClick={() => setSelectedFolder(folderName)}
              className={`${styles.folderBtn} ${selectedFolder === folderName ? styles.activeFolder : ''}`}
            >
              {folderName}
            </button>
          ))}
        </div>

        {/* Tags Row List */}
        {allTags.length > 1 && (
          <div className={styles.tagsFilterList}>
            <span className={styles.tagLabel}>Tag:</span>
            <div className={styles.tagsContainer}>
              {allTags.map((tagName) => (
                <button
                  key={tagName}
                  onClick={() => setSelectedTag(tagName)}
                  className={`${styles.tagFilterBtn} ${selectedTag === tagName ? styles.activeTagFilter : ''}`}
                >
                  {tagName}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={styles.notesList}>
          {filteredNotes.length === 0 ? (
            <p className={styles.noNotes}>Tidak ada catatan.</p>
          ) : (
            filteredNotes.map((n) => {
              const isSelected = selectedNote?.id === n.id;
              const textSnippet = n.content
                ? n.content.replace(/<[^>]*>/g, ' ').substring(0, 70)
                : 'Mulai menulis catatan...';

              return (
                <div
                  key={n.id}
                  onClick={() => selectNote(n)}
                  className={`${styles.noteListItem} ${isSelected ? styles.activeNoteItem : ''}`}
                >
                  <span className={styles.noteListFolder}>{n.folder || 'Work'}</span>
                  <h4 className={styles.noteListTitle}>{n.title || 'Note Tanpa Judul'}</h4>
                  <p className={styles.noteListSnippet}>{textSnippet}</p>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Editor Area */}
      <div className={styles.editorArea}>
        {selectedNote ? (
          <div className={styles.editorContainer}>
            {/* Header info */}
            <div className={styles.editorHeader}>
              <div className={styles.titleRow}>
                <input
                  type="text"
                  value={editorTitle}
                  onChange={handleTitleChange}
                  className={styles.titleInput}
                  placeholder="Judul Catatan..."
                />
                <div className={styles.saveStatus}>
                  <div
                    className={`${styles.statusDot} ${
                      saveStatus === 'Saved' ? styles.statusSaved : styles.statusSaving
                    }`}
                  />
                  <span>{saveStatus}</span>
                </div>
              </div>

              <div className={styles.metadataRow}>
                <div className={styles.metaField}>
                  <span className={styles.metaLabel}>Folder:</span>
                  <input
                    type="text"
                    value={editorFolder}
                    onChange={handleFolderChange}
                    className={styles.metaInput}
                    placeholder="Work, Personal..."
                  />
                </div>
                <div className={styles.metaField}>
                  <span className={styles.metaLabel}>Tags:</span>
                  <input
                    type="text"
                    value={editorTags}
                    onChange={handleTagsChange}
                    placeholder="AI, Product, UX (koma)..."
                    className={styles.metaInput}
                  />
                </div>
                <button className={styles.deleteBtn} onClick={handleDeleteNote} disabled={isDeletingNote}>
                  🗑️ {isDeletingNote ? 'Menghapus...' : 'Hapus Note'}
                </button>
              </div>
            </div>

            {/* Custom Rich Text Formatting Toolbar */}
            <div className={styles.toolbar}>
              <select 
                title="Ukuran Teks" 
                onChange={(e) => {
                  if (e.target.value) {
                    executeCmd('fontSize', e.target.value);
                    e.target.value = '';
                  }
                }}
                className={styles.fontSizeSelect}
                defaultValue=""
              >
                <option value="" disabled>Aa Teks</option>
                <option value="2">Kecil</option>
                <option value="3">Sedang</option>
                <option value="4">Besar</option>
              </select>
              <button 
                title="Heading" 
                onClick={() => executeCmd('formatBlock', '<h3>')}
                className={editor?.isActive('heading', { level: 3 }) ? styles.activeToolbarBtn : ''}
              >
                <b>H1</b>
              </button>
              <button 
                title="Paragraph" 
                onClick={() => executeCmd('formatBlock', '<p>')}
                className={editor?.isActive('paragraph') ? styles.activeToolbarBtn : ''}
              >
                P
              </button>
              <button 
                title="Bold" 
                onClick={() => executeCmd('bold')}
                className={editor?.isActive('bold') ? styles.activeToolbarBtn : ''}
              >
                <b>B</b>
              </button>
              <button 
                title="Italic" 
                onClick={() => executeCmd('italic')}
                className={editor?.isActive('italic') ? styles.activeToolbarBtn : ''}
              >
                <i>I</i>
              </button>
              <button 
                title="Bullet List" 
                onClick={() => executeCmd('insertUnorderedList')}
                className={editor?.isActive('bulletList') ? styles.activeToolbarBtn : ''}
              >
                • List
              </button>
              <button 
                title="Checklist" 
                onClick={insertChecklist} 
                className={`${styles.checklistBtn} ${editor?.isActive('taskList') ? styles.activeChecklistBtn : ''}`}
              >
                ✓ Checklist
              </button>
            </div>

            {/* Tiptap Editor Body */}
            <div className={styles.editorBodyContainer} ref={editorRef}>
              {mounted && editor ? (
                <EditorContent
                  editor={editor}
                  className={`${styles.editorBody} rich-editor`}
                />
              ) : (
                <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}>
                  Loading Editor...
                </div>
              )}

              {/* Floating Convert Button Trigger */}
              {floatButtonPos.visible && (
                <button
                  className={styles.floatConvertBtn}
                  style={{ top: floatButtonPos.top, left: floatButtonPos.left }}
                  onClick={handleOpenPopover}
                  title="Convert checklist / bold ke Action Item"
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
                    <button className={styles.popoverClose} onClick={() => { setShowPopover(false); clearConvertingFlags(); }}>×</button>
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
                        onChange={(e) => setPopoverFields({ ...popoverFields, projectId: e.target.value, categoryId: '' })}
                      >
                        <option value="">-- Tanpa Project (Standalone) --</option>
                        {projects.map((proj) => (
                          <option key={proj.id} value={proj.id}>
                            {proj.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {popoverFields.projectId && (
                      <div className={styles.popoverField}>
                        <label>Kategori</label>
                        <select
                          value={popoverFields.categoryId}
                          onChange={(e) => setPopoverFields({ ...popoverFields, categoryId: e.target.value })}
                        >
                          <option value="">Tanpa Kategori</option>
                          {projects.find(p => p.id === popoverFields.projectId)?.categories?.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className={styles.popoverField}>
                      <label>Keterangan</label>
                      <textarea
                        value={popoverFields.description}
                        onChange={(e) => setPopoverFields({ ...popoverFields, description: e.target.value })}
                        placeholder="Detail atau catatan tambahan..."
                        rows={2}
                      />
                    </div>
                    <button className={styles.convertSubmitBtn} onClick={handleConvertToActionItem} disabled={isConverting}>
                      {isConverting ? 'Mengonversi...' : 'Convert Jadi Action Item'}
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
            <button className={styles.newNoteBtnLarge} onClick={handleNewNote} disabled={isCreatingNote}>
              {isCreatingNote ? 'Membuat...' : '+ Buat Catatan Baru'}
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
