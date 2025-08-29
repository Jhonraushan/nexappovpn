const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

contextBridge.exposeInMainWorld('electronAPI', {
  connectVPN: (creds) => ipcRenderer.invoke('start-vpn', creds),
  disconnectVPN: () => ipcRenderer.invoke('stop-vpn'),
  onLog: (callback) => ipcRenderer.on('vpn-log', (_, data) => callback(data)),
  onTrafficStats: (callback) => ipcRenderer.on('traffic-stats', (_, data) => callback(data)),
  // Add file import functionality
  importProfile: (fileData) => ipcRenderer.invoke('import-profile', fileData),
  // Add dialog functionality
  openFileDialog: (fileType) => ipcRenderer.invoke('open-file-dialog', fileType),
  // Add recent files functionality
  getRecentFiles: () => ipcRenderer.invoke('get-recent-files'),
  selectRecentFile: (filePath) => ipcRenderer.invoke('select-recent-file', filePath),
  // Add certificate functionality
  getCertificate: () => ipcRenderer.invoke('get-certificate')
});
