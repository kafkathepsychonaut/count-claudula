'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('claudeCount', {
  // main -> renderer
  onInit: (cb) => ipcRenderer.on('ui:init', (_e, data) => cb(data)),
  onUsage: (cb) => ipcRenderer.on('usage:update', (_e, data) => cb(data)),
  onError: (cb) => ipcRenderer.on('usage:error', (_e, data) => cb(data)),
  onExpand: (cb) => ipcRenderer.on('ui:expand', () => cb()),
  onTokens: (cb) => ipcRenderer.on('tokens:update', (_e, data) => cb(data)),
  onLocale: (cb) => ipcRenderer.on('ui:locale', (_e, loc) => cb(loc)),
  onTheme: (cb) => ipcRenderer.on('ui:theme', (_e, th) => cb(th)),
  onUpdate: (cb) => ipcRenderer.on('update:state', (_e, data) => cb(data)),
  // renderer -> main
  refresh: () => ipcRenderer.send('ui:refresh'),
  collapse: (next) => ipcRenderer.send('ui:collapse', next),
  setMode: (m) => ipcRenderer.send('ui:mode', m),
  setExtMore: (v) => ipcRenderer.send('ui:extmore', v),
  reportHeight: (h) => ipcRenderer.send('ui:height', h),
  updateDownload: () => ipcRenderer.send('ui:update-download'),
  updateRestart: () => ipcRenderer.send('ui:update-restart'),
  hide: () => ipcRenderer.send('ui:hide'),
  quit: () => ipcRenderer.send('ui:quit'),
  openSettings: () => ipcRenderer.send('ui:settings'),
  // settings
  settingsGet: () => ipcRenderer.invoke('settings:get'),
  settingsSet: (k, v) => ipcRenderer.send('settings:set', { k, v }),
  settingsClose: () => ipcRenderer.send('settings:close'),
  sendFeedback: (text) => ipcRenderer.invoke('feedback:send', text),
  donate: () => ipcRenderer.send('ui:donate'),
});
