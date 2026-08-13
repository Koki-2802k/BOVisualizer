export interface DirectoryReadOptions {
  mode: 'read';
}

export interface ReadableDirectoryHandle extends FileSystemDirectoryHandle {
  queryPermission?(options?: DirectoryReadOptions): Promise<PermissionState>;
  requestPermission?(options?: DirectoryReadOptions): Promise<PermissionState>;
}

export interface DirectoryPickerWindow extends Window {
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
}
