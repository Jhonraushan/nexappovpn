const { app, BrowserWindow, ipcMain, Tray, Menu, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { isAdmin } = require('./check-admin');
// Correct path to openvpn.exe depending on whether app is packaged
const openvpnPath = app.isPackaged
  ? path.join(process.resourcesPath, 'app.asar.unpacked', 'openvpn', 'openvpn.exe')
  : path.join(__dirname, 'openvpn', 'openvpn.exe');
  
let tray = null;
let win;
let vpnProcess = null;
let connectionStatus = 'disconnected';
let trafficStatsInterval = null;

// Global variables for tracking traffic statistics
let bytesReceived = 0;
let bytesSent = 0;

// Format bytes to human-readable format
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

// Restart app with admin privileges if not already running as admin
function restartAsAdmin() {
  const exePath = process.execPath;
  const args = process.argv.slice(1);
  
  console.log('Attempting to restart with admin privileges...');
  console.log('Executable path:', exePath);
  console.log('Arguments:', args);
  
  try {
    // Use PowerShell to start process with admin rights
    const startInfo = {
      file: 'powershell.exe',
      arguments: [
        '-Command',
        `Start-Process -FilePath '${exePath}' -ArgumentList '${args.join(' ')}' -Verb RunAs`
      ]
    };
    
    console.log('Starting PowerShell with command:', startInfo.arguments.join(' '));
    const childProcess = spawn(startInfo.file, startInfo.arguments, { detached: true });
    
    childProcess.on('error', (err) => {
      console.error('Failed to spawn process:', err);
    });
    
    console.log('Process spawned, quitting current instance...');
    app.quit();
  } catch (error) {
    console.error('Failed to restart with admin privileges:', error);
    dialog.showErrorBox(
      'Administrator Privileges Required',
      'This application requires administrator privileges to connect to VPN. Please run the application as administrator.'
    );
  }
}

// Load recent files when app starts
app.whenReady().then(() => {
  loadRecentFiles();
});

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'app', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: true,
      enableRemoteModule: true
    },
    autoHideMenuBar: false,
    show: false
  });
  
  // Create application menu with admin check option
  const menuTemplate = [
    {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    },
    {
      label: 'Tools',
      submenu: [
        { 
          label: 'Check Administrator Status',
          click: () => {
            const { checkAndNotifyAdminStatus } = require('./check-admin');
            checkAndNotifyAdminStatus(win);
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox(win, {
              type: 'info',
              title: 'About Nexapp EDGE VPN',
              message: 'Nexapp EDGE VPN v1.0.0\nA simple OpenVPN client for Windows.',
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
  
  win.loadFile('app/index.html');
  
  // Show window when ready
  win.once('ready-to-show', () => {
    win.show();
    // Removed automatic DevTools opening
    // win.webContents.openDevTools(); // Open DevTools for debugging
  });
  
  // Handle window close event
  win.on('close', (event) => {
    if (vpnProcess) {
      const choice = dialog.showMessageBoxSync(win, {
        type: 'question',
        buttons: ['Yes', 'No'],
        title: 'Confirm',
        message: 'VPN is still connected. Do you want to disconnect and quit?'
      });
      
      if (choice === 0) { // Yes
        stopVPN();
      } else { // No
        event.preventDefault();
      }
    }
  });
}

app.whenReady().then(() => {
  console.log('App is ready, bypassing admin privileges check for testing...');
  // TEMPORARY: Bypassing admin check for testing purposes
  // if (!isAdmin()) {
  //   console.log('Showing admin privileges dialog...');
  //   // Create a temporary window to show the dialog
  //   const tempWin = new BrowserWindow({
  //     width: 400,
  //     height: 200,
  //     show: false
  //   });
  //   
  //   dialog.showMessageBox(tempWin, {
  //     type: 'warning',
  //     title: 'Administrator Privileges Required',
  //     message: 'This application requires administrator privileges to connect to VPN. The application will now restart with elevated privileges.',
  //     buttons: ['OK', 'Cancel']
  //   }).then(({ response }) => {
  //     console.log('Dialog response:', response);
  //     if (response === 0) { // OK button
  //       restartAsAdmin();
  //     } else { // Cancel button
  //       app.quit();
  //     }
  //     tempWin.destroy();
  //   });
  //   return;
  // }
  
  console.log('Admin privileges confirmed, creating window...');
  createWindow();

  // Use a default icon from Electron instead of custom icons
  tray = new Tray(path.join(__dirname, 'app', 'icon.png'));
  updateTrayMenu();

  win.on('minimize', (event) => {
    event.preventDefault();
    win.hide();
  });

  tray.on('double-click', () => win.show());
});

// Update tray menu based on connection status
function updateTrayMenu() {
  const menuTemplate = [
    { 
      label: connectionStatus === 'connected' ? 'Connected' : 'Disconnected',
      enabled: false
    }
  ];
  
  // Add traffic statistics to the menu if connected
  if (connectionStatus === 'connected') {
    menuTemplate.push(
      { 
        label: `Download: ${formatBytes(bytesReceived)}`,
        enabled: false 
      },
      { 
        label: `Upload: ${formatBytes(bytesSent)}`,
        enabled: false 
      }
    );
  }
  
  // Add the rest of the menu items
  menuTemplate.push(
    { type: 'separator' },
    { label: 'Show', click: () => win.show() },
    { 
      label: connectionStatus === 'connected' ? 'Disconnect' : 'Connect',
      click: () => {
        if (connectionStatus === 'connected') {
          stopVPN();
        } else {
          win.show();
        }
      }
    },
    { type: 'separator' },
    { label: 'Exit', click: () => app.quit() }
  );
  
  const contextMenu = Menu.buildFromTemplate(menuTemplate);
  
  // Update tray tooltip to include traffic stats if connected
  let tooltipText = `Nexapp EDGE VPN - ${connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}`;
  
  if (connectionStatus === 'connected') {
    tooltipText += ` - Down: ${formatBytes(bytesReceived)} - Up: ${formatBytes(bytesSent)}`;
  }
  
  tray.setToolTip(tooltipText);
  tray.setContextMenu(contextMenu);
}

// Function to start VPN connection
ipcMain.handle('start-vpn', async (event, { username, password }) => {
  // Check if VPN is already running
  if (vpnProcess) {
    event.sender.send('vpn-log', 'VPN is already running. Please disconnect first.\n');
    return;
  }
  
  // Check if config file exists
  const configPath = path.join(__dirname, 'config', 'default.ovpn');
  if (!fs.existsSync(configPath)) {
    event.sender.send('vpn-log', 'Error: VPN configuration file not found. Please import a profile first.\n');
    return;
  }
  
  // Write credentials to auth file
  const authPath = path.join(__dirname, 'config', 'auth.txt');
  fs.writeFileSync(authPath, `${username}\n${password}`);
  
  // Set file permissions to be more secure
  try {
    fs.chmodSync(authPath, 0o600); // Read/write for owner only
  } catch (error) {
    console.error('Failed to set file permissions:', error);
  }
  
  // Start OpenVPN process
  //vpnProcess = spawn(path.join(__dirname, 'openvpn', 'openvpn.exe'), [
  vpnProcess = spawn(openvpnPath, [
    '--config', configPath,
    '--auth-user-pass', authPath,
    '--verb', '3',
    '--status', path.join(__dirname, 'config', 'status.log'), '1'
  ]);

  // Handle process output
  vpnProcess.stdout.on('data', (data) => {
    const output = data.toString();
    
    // Filter out excessive log entries while keeping important ones
    const isImportantLog = (
      output.includes('Initialization Sequence Completed') ||
      output.includes('AUTH_FAILED') ||
      output.includes('SIGTERM') ||
      output.includes('ERROR') ||
      output.includes('WARNING') ||
      output.includes('FATAL') ||
      output.includes('Connection')
    );
    
    // Only send important logs to the UI
    //if (isImportantLog) 
    {
      event.sender.send('vpn-log', output);
    }
    
    // Always log to console for debugging
    console.log(output);
    
    // Check for successful connection
    if (output.includes('Initialization Sequence Completed')) {
      connectionStatus = 'connected';
      updateTrayMenu();
      startTrafficMonitoring(event.sender);
    }
  });

  vpnProcess.stderr.on('data', (data) => {
    // Always send error output to the UI
    event.sender.send('vpn-log', data.toString());
  });

  // Handle process exit
  vpnProcess.on('exit', (code) => {
  if (win && win.webContents && !win.webContents.isDestroyed()) {
    win.webContents.send('vpn-log', `VPN process exited with code ${code || 0}\n`);
  }

  connectionStatus = 'disconnected';  
  updateTrayMenu();
  stopTrafficMonitoring();
  vpnProcess = null;
});

});

// Function to stop VPN connection
function stopVPN() {
  if (vpnProcess) {
    vpnProcess.kill();
    connectionStatus = 'disconnected';
    updateTrayMenu();
    stopTrafficMonitoring();
    // vpnProcess will be set to null in the exit handler
  }
}

ipcMain.handle('stop-vpn', () => {
  stopVPN();
});

// Function to start monitoring traffic statistics
function startTrafficMonitoring(sender) {
  if (trafficStatsInterval) {
    clearInterval(trafficStatsInterval);
  }
  
  trafficStatsInterval = setInterval(() => {
    // Read OpenVPN status log if it exists
    const statusLogPath = path.join(__dirname, 'config', 'status.log');
    if (fs.existsSync(statusLogPath)) {
      try {
        const statusData = fs.readFileSync(statusLogPath, 'utf8');
        
        // Parse traffic statistics from the status log
        parseTrafficStats(statusData);
        
        // Update the tray menu with the new statistics
        updateTrayMenu();
        
        // Send only traffic statistics to renderer instead of full log
        // This reduces log clutter while maintaining functionality
        sender.send('traffic-stats', {
          bytesReceived: bytesReceived,
          bytesSent: bytesSent,
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19)
        });
      } catch (error) {
        console.error('Failed to read status log:', error);
      }
    }
  }, 1000); // Update every 1 second for more responsive live updates
}

// Parse traffic statistics from OpenVPN status log
function parseTrafficStats(statusData) {
  // Look for the TUN/TAP interface statistics
  // Format from user input: TUN/TAP read bytes,0 \n TUN/TAP write bytes,11694
  const readRegex = /TUN\/TAP read bytes,(\d+)/;
  const writeRegex = /TUN\/TAP write bytes,(\d+)/;
  
  const readMatch = statusData.match(readRegex);
  const writeMatch = statusData.match(writeRegex);
  
  if (readMatch && readMatch[1]) {
    bytesReceived = parseInt(readMatch[1]);
  }
  
  if (writeMatch && writeMatch[1]) {
    bytesSent = parseInt(writeMatch[1]);
  }
  
  console.log(`Parsed traffic stats - Download: ${formatBytes(bytesReceived)}, Upload: ${formatBytes(bytesSent)}`);
}

// Function to stop monitoring traffic statistics
function stopTrafficMonitoring() {
  if (trafficStatsInterval) {
    clearInterval(trafficStatsInterval);
    trafficStatsInterval = null;
  }
}

// Handle profile import
ipcMain.handle('import-profile', async (event, fileData) => {
  try {
    const configPath = path.join(__dirname, 'config', 'default.ovpn');
    
    // Ensure config directory exists
    const configDir = path.join(__dirname, 'config');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    // Write the file
    fs.writeFileSync(configPath, Buffer.from(fileData));
    
    return { success: true, message: 'Profile imported successfully!' };
  } catch (error) {
    console.error('Error importing profile:', error);
    return { success: false, error: error.message };
  }
});

// Store recent .ovpn files
const RECENT_FILES_MAX = 5;
let recentOvpnFiles = [];

// Function to load recent files from storage
function loadRecentFiles() {
  try {
    const recentFilesPath = path.join(app.getPath('userData'), 'recent-files.json');
    if (fs.existsSync(recentFilesPath)) {
      const data = fs.readFileSync(recentFilesPath, 'utf8');
      recentOvpnFiles = JSON.parse(data);
      console.log('Loaded recent files:', recentOvpnFiles);
    }
  } catch (error) {
    console.error('Error loading recent files:', error);
    recentOvpnFiles = [];
  }
}

// Function to save recent files to storage
function saveRecentFiles() {
  try {
    const recentFilesPath = path.join(app.getPath('userData'), 'recent-files.json');
    fs.writeFileSync(recentFilesPath, JSON.stringify(recentOvpnFiles));
    console.log('Saved recent files:', recentOvpnFiles);
  } catch (error) {
    console.error('Error saving recent files:', error);
  }
}

// Function to add a file to recent files list
function addToRecentFiles(filePath, fileName) {
  // Check if file already exists in the list
  const existingIndex = recentOvpnFiles.findIndex(file => file.path === filePath);
  
  // If it exists, remove it so we can add it to the top
  if (existingIndex !== -1) {
    recentOvpnFiles.splice(existingIndex, 1);
  }
  
  // Add the file to the beginning of the array
  recentOvpnFiles.unshift({
    path: filePath,
    name: fileName,
    timestamp: Date.now()
  });
  
  // Limit the list to RECENT_FILES_MAX items
  if (recentOvpnFiles.length > RECENT_FILES_MAX) {
    recentOvpnFiles = recentOvpnFiles.slice(0, RECENT_FILES_MAX);
  }
  
  // Save the updated list
  saveRecentFiles();
}

// Handle getting recent files
ipcMain.handle('get-recent-files', () => {
  return recentOvpnFiles;
});

// Handle getting certificate file
ipcMain.handle('get-certificate', () => {
  try {
    const certPath = path.join(__dirname, 'config', 'admin.crt');
    if (fs.existsSync(certPath)) {
      const certData = fs.readFileSync(certPath, 'utf8');
      return { success: true, data: certData };
    } else {
      return { success: false, error: 'Certificate file not found' };
    }
  } catch (error) {
    console.error('Error reading certificate:', error);
    return { success: false, error: error.message };
  }
});

// Handle file dialog open
ipcMain.handle('open-file-dialog', async (event, fileType) => {
  try {
    // Default filter is for OpenVPN config files
    let filters = [{ name: 'OpenVPN Config', extensions: ['ovpn'] }];
    
    // Set filters based on fileType
    if (fileType === 'certificate') {
      filters = [{ name: 'Certificate Files', extensions: ['crt', 'pem', 'cer', 'der'] }];
    } else if (fileType === 'ovpn') {
      filters = [{ name: 'OpenVPN Config', extensions: ['ovpn'] }];
    }
    
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: filters
    });
    
    if (result.canceled) {
      return { canceled: true };
    }
    
    const filePath = result.filePaths[0];
    const fileData = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    
    // Import the profile
    const configPath = path.join(__dirname, 'config', 'default.ovpn');
    
    // Ensure config directory exists
    const configDir = path.join(__dirname, 'config');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    // Write the file
    fs.writeFileSync(configPath, fileData);
    
    // Add to recent files
    addToRecentFiles(filePath, fileName);
    
    return { 
      success: true, 
      message: 'Profile imported successfully!',
      fileName: fileName
    };
  } catch (error) {
    console.error('Error opening file dialog:', error);
    return { success: false, error: error.message };
  }
});

// Handle selecting a recent file
ipcMain.handle('select-recent-file', async (event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      // Remove the file from recent files if it no longer exists
      recentOvpnFiles = recentOvpnFiles.filter(file => file.path !== filePath);
      saveRecentFiles();
      return { success: false, error: 'File no longer exists' };
    }
    
    const fileData = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    
    // Import the profile
    const configPath = path.join(__dirname, 'config', 'default.ovpn');
    
    // Ensure config directory exists
    const configDir = path.join(__dirname, 'config');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    // Write the file
    fs.writeFileSync(configPath, fileData);
    
    // Move this file to the top of recent files
    addToRecentFiles(filePath, fileName);
    
    return { 
      success: true, 
      message: 'Profile imported successfully!',
      fileName: fileName
    };
  } catch (error) {
    console.error('Error selecting recent file:', error);
    return { success: false, error: error.message };
  }
});
