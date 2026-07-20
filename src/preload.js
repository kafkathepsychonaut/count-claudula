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
  onModeSet: (cb) => ipcRenderer.on('ui:modeset', (_e, m) => cb(m)),
  // renderer -> main
  refresh: () => ipcRenderer.send('ui:refresh'),
  autoRefresh: () => ipcRenderer.send('ui:autorefresh'),
  collapse: (next) => ipcRenderer.send('ui:collapse', next),
  setMode: (m) => ipcRenderer.send('ui:mode', m),
  setExtMore: (v) => ipcRenderer.send('ui:extmore', v),
  reportHeight: (h) => ipcRenderer.send('ui:height', h),
  updateDownload: () => ipcRenderer.send('ui:update-download'),
  updateRestart: () => ipcRenderer.send('ui:update-restart'),
  updateDismiss: () => ipcRenderer.send('ui:update-dismiss'),
  hide: () => ipcRenderer.send('ui:hide'),
  quit: () => ipcRenderer.send('ui:quit'),
  openSettings: () => ipcRenderer.send('ui:settings'),
  onboarded: () => ipcRenderer.send('ui:onboarded'),
  // settings
  settingsGet: () => ipcRenderer.invoke('settings:get'),
  // `consent` carries "the user actually answered the ToS prompt" through to
  // main, which refuses the move onto the endpoint source without it.
  settingsSet: (k, v, consent) => ipcRenderer.send('settings:set', { k, v, consent }),
  settingsClose: () => ipcRenderer.send('settings:close'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  statuslineInspect: () => ipcRenderer.invoke('statusline:inspect'),
  // opts.confirmReplace says the "replace your existing statusLine?" dialog was
  // answered; main refuses to overwrite a foreign command without it.
  statuslineApply: (opts) => ipcRenderer.invoke('statusline:apply', opts),
  sendFeedback: (text) => ipcRenderer.invoke('feedback:send', text),
  donate: () => ipcRenderer.send('ui:donate'),
});
