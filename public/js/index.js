const {ipcRenderer} = require('electron')

ipcRenderer.send("wipe-session-data")