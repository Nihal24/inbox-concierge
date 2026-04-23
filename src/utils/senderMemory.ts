const STORAGE_KEY = 'inbox_sender_memory';
const CUSTOM_BUCKETS_KEY = 'inbox_custom_buckets';
const REMOVED_DEFAULTS_KEY = 'inbox_removed_defaults';

export function getRemovedDefaultBuckets(): string[] {
  try {
    return JSON.parse(localStorage.getItem(REMOVED_DEFAULTS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveRemovedDefaultBuckets(removed: string[]): void {
  localStorage.setItem(REMOVED_DEFAULTS_KEY, JSON.stringify(removed));
}

export function getCustomBuckets(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_BUCKETS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveCustomBuckets(customBuckets: string[]): void {
  localStorage.setItem(CUSTOM_BUCKETS_KEY, JSON.stringify(customBuckets));
}

export interface SenderMemory {
  [senderEmail: string]: string; // email address → bucket
}

export function extractEmailAddress(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match ? match[1] : from).toLowerCase().trim();
}

export function getSenderMemory(): SenderMemory {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function saveSenderPreference(from: string, bucket: string): void {
  const memory = getSenderMemory();
  memory[extractEmailAddress(from)] = bucket;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
}

export function clearSenderMemory(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getMemoryCount(): number {
  return Object.keys(getSenderMemory()).length;
}
