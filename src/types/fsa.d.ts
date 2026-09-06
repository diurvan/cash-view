// Tipos para la File System Access API (Chrome/Edge/desktop; no tipado en lib.dom).
interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: { description?: string; accept?: Record<string, string[]> }[];
}

interface OpenFilePickerOptions {
  multiple?: boolean;
  types?: { description?: string; accept?: Record<string, string[]> }[];
}

interface Window {
  showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
}