import AdmZip from 'adm-zip';

export interface ExtractedChat {
  fileName: string;
  content: string;
  uniqueDates: string[]; // Sorted from newest to oldest
}

/**
 * Parses a date string of format DD/MM/YY or DD/MM/YYYY into a Date object
 */
export function parseChatDate(dateStr: string): Date | null {
  try {
    // Replace dots/dashes with slashes
    const normalized = dateStr.replace(/[\.\-]/g, '/');
    const parts = normalized.split('/');
    if (parts.length !== 3) return null;

    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10) - 1; // 0-indexed
    let year = parseInt(parts[2], 10);

    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;

    if (year < 100) {
      year += 2000; // e.g., 26 -> 2026
    }

    return new Date(year, month, day);
  } catch {
    return null;
  }
}

/**
 * Extracts the .txt file from a WhatsApp zip export,
 * and parses all unique dates present in the log.
 */
export function parseWhatsAppZip(zipBuffer: Buffer): ExtractedChat {
  const zip = new AdmZip(zipBuffer);
  const zipEntries = zip.getEntries();

  // Find the chat text file (often named _chat.txt or WhatsApp Chat with...txt)
  const txtEntry = zipEntries.find(entry => entry.entryName.endsWith('.txt'));

  if (!txtEntry) {
    throw new Error('No .txt file found in the zip archive');
  }

  const content = txtEntry.getData().toString('utf8');

  // Regex to match dates at start of lines:
  // e.g. iOS "[23/06/26, 10.32]" or Android "23/06/2026, 10:32 - "
  // Captures the date portion DD/MM/YY or DD/MM/YYYY
  const iosRegex = /^\[(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4})/;
  const androidRegex = /^(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4})/;

  const dateSet = new Set<string>();
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    let match = line.match(iosRegex) || line.match(androidRegex);
    if (match && match[1]) {
      dateSet.add(match[1]);
    }
  }

  const uniqueDatesArray = Array.from(dateSet);

  // Sort unique dates from newest to oldest
  uniqueDatesArray.sort((a, b) => {
    const dateA = parseChatDate(a);
    const dateB = parseChatDate(b);
    if (!dateA || !dateB) return 0;
    return dateB.getTime() - dateA.getTime(); // Descending
  });

  return {
    fileName: txtEntry.entryName,
    content,
    uniqueDates: uniqueDatesArray
  };
}

/**
 * Filters the WhatsApp chat log, keeping only lines matching the selected date.
 * Also preserves lines that don't start with a date but belong to the previous message (multi-line messages).
 */
export function filterChatByDate(content: string, targetDate: string): string {
  const lines = content.split(/\r?\n/);
  const filteredLines: string[] = [];

  const iosRegex = /^\[(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4})/;
  const androidRegex = /^(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4})/;

  let isPreviousLineMatched = false;

  for (const line of lines) {
    const match = line.match(iosRegex) || line.match(androidRegex);
    
    if (match && match[1]) {
      // It's a new message line starting with a date
      if (match[1] === targetDate) {
        filteredLines.push(line);
        isPreviousLineMatched = true;
      } else {
        isPreviousLineMatched = false;
      }
    } else {
      // It's a continuation of the previous message
      if (isPreviousLineMatched) {
        filteredLines.push(line);
      }
    }
  }

  return filteredLines.join('\n');
}
