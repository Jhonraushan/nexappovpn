// Global variables for tracking connection stats
let bytesReceived = 0;
let bytesSent = 0;
let connectionStartTime = null;
let statsUpdateInterval = null;
let isConnected = false;

// Format bytes to human-readable format
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format time in HH:MM:SS format
function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Update connection status UI
function updateConnectionStatus(status) {
  const statusElement = document.getElementById('connection-status');
  if (status === 'connected') {
    statusElement.textContent = 'Connected';
    statusElement.classList.add('connected');
    isConnected = true;
    connectionStartTime = Date.now();
    startStatsUpdates();
  } else {
    statusElement.textContent = 'Disconnected';
    statusElement.classList.remove('connected');
    isConnected = false;
    stopStatsUpdates();
    resetStats();
  }
}

// Start periodic updates of connection statistics
function startStatsUpdates() {
  if (statsUpdateInterval) clearInterval(statsUpdateInterval);
  
  // Store the last known values for animation purposes
  let lastBytesReceived = bytesReceived;
  let lastBytesSent = bytesSent;
  
  statsUpdateInterval = setInterval(() => {
    // Update connected time
    if (connectionStartTime) {
      const elapsedSeconds = Math.floor((Date.now() - connectionStartTime) / 1000);
      document.getElementById('connected-time').textContent = formatTime(elapsedSeconds);
    }
    
    // Check if traffic stats have changed since last update
    if (bytesReceived !== lastBytesReceived || bytesSent !== lastBytesSent) {
      updateTrafficDisplay();
      lastBytesReceived = bytesReceived;
      lastBytesSent = bytesSent;
    }
  }, 1000);
}

// Stop periodic updates
function stopStatsUpdates() {
  if (statsUpdateInterval) {
    clearInterval(statsUpdateInterval);
    statsUpdateInterval = null;
  }
}

// Reset all statistics
function resetStats() {
  bytesReceived = 0;
  bytesSent = 0;
  connectionStartTime = null;
  document.getElementById('bytes-received').textContent = '0 B';
  document.getElementById('bytes-sent').textContent = '0 B';
  document.getElementById('connected-time').textContent = '00:00:00';
}

// Parse traffic statistics from OpenVPN log output
// This function is kept for backward compatibility but is no longer the primary method
// for updating traffic statistics, as we now use the traffic-stats event
function parseTrafficStats(logData) {
  // Only parse logs if they contain traffic statistics
  if (logData && logData.includes('STATUS:')) {
    // Parse status log format
    if (logData.includes('BYTECOUNT')) {
      const bytecountMatch = logData.match(/BYTECOUNT:(\d+),(\d+)/);
      if (bytecountMatch && bytecountMatch[1] && bytecountMatch[2]) {
        bytesSent = parseInt(bytecountMatch[1]);
        bytesReceived = parseInt(bytecountMatch[2]);
        updateTrafficDisplay();
      }
    }
    
    // Parse OpenVPN status log format with individual lines
    // Look for TUN/TAP read bytes and TUN/TAP write bytes
    const readRegex = /TUN\/TAP read bytes,(\d+)/;
    const writeRegex = /TUN\/TAP write bytes,(\d+)/;
    
    const readMatch = logData.match(readRegex);
    const writeMatch = logData.match(writeRegex);
    
    if (readMatch && readMatch[1]) {
      bytesReceived = parseInt(readMatch[1]);
      updateTrafficDisplay();
    }
    
    if (writeMatch && writeMatch[1]) {
      bytesSent = parseInt(writeMatch[1]);
      updateTrafficDisplay();
    }
  }
}

// Update the traffic display with animation
function updateTrafficDisplay() {
  const receivedElement = document.getElementById('bytes-received');
  const sentElement = document.getElementById('bytes-sent');
  
  // Update with formatted values
  receivedElement.textContent = formatBytes(bytesReceived);
  sentElement.textContent = formatBytes(bytesSent);
  
  // Add a subtle highlight effect to show changes
  receivedElement.classList.add('updated');
  sentElement.classList.add('updated');
  
  // Remove the highlight effect after animation completes
  setTimeout(() => {
    receivedElement.classList.remove('updated');
    sentElement.classList.remove('updated');
  }, 300);
}

// Connect button event handler
document.getElementById('connect-btn').addEventListener('click', () => {
  const username = document.getElementById('vpn-username').value;
  const password = document.getElementById('vpn-password').value;
  
  if (!username || !password) {
    alert('Please enter both username and password');
    return;
  }
  
  window.electronAPI.connectVPN({ username, password });
});

// Disconnect button event handler
document.getElementById('disconnect-btn').addEventListener('click', () => {
  window.electronAPI.disconnectVPN();
});

// Log event handler
window.electronAPI.onLog((data) => {
  const log = document.getElementById('log-output');
  
  // Filter out OpenVPN statistics logs to reduce clutter
  if (!data.includes('STATUS: OpenVPN STATISTICS')) {
    log.textContent += data;
    log.scrollTop = log.scrollHeight;
  }

  // Check for connection status changes
  if (data.includes("AUTH_FAILED")) {
    updateConnectionStatus('disconnected');
    alert("Login failed: Invalid username or password");
  } else if (data.includes("Initialization Sequence Completed")) {
    updateConnectionStatus('connected');
    // Use notification instead of alert for better UX
    const notification = document.createElement('div');
    notification.className = 'notification success';
    notification.textContent = 'VPN connected successfully!';
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  } else if (data.includes("SIGTERM") || data.includes("process exited")) {
    updateConnectionStatus('disconnected');
    // Use notification instead of alert for better UX
    const notification = document.createElement('div');
    notification.className = 'notification info';
    notification.textContent = 'VPN disconnected';
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  }

  if (data.includes("ERROR")) {
    updateConnectionStatus('disconnected');
    // Use notification instead of alert for better UX
    const notification = document.createElement('div');
    notification.className = 'notification error';
    notification.textContent = 'An error occurred: ' + data;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
  }
});

// File input event handler
console.log('Setting up file input event handler');
const fileInput = document.getElementById('file-input');
console.log('File input element:', fileInput);

// Function to handle file input change
function handleFileInput(event) {
  const file = event.target.files[0];
  if (file) {
    console.log('File selected:', file.name);
    document.getElementById('file-name').textContent = file.name;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const fileData = e.target.result;
      window.electronAPI.importProfile(fileData)
        .then(result => {
          console.log('Import result:', result);
          if (result.success) {
            // Load recent files after successful import
            loadRecentFiles();
          }
        })
        .catch(err => {
          console.error('Error importing profile:', err);
        });
    };
    reader.readAsArrayBuffer(file);
  }
}

// Create a dropdown for recent files
// Function to handle menu navigation
function handleMenuNavigation() {
  const menuItems = document.querySelectorAll('.menu-item');
  const mainContent = document.querySelector('.main-content');
  
  // Store the original dashboard content
  const dashboardContent = mainContent.innerHTML;
  
  // Create content for Certificates & Tokens section
  const certificatesContent = `
    <div class="header">
      <h1>Certificates & Tokens</h1>
    </div>
    
    <div class="card certificate-card">
      <h3><i class="fas fa-certificate"></i> Admin Certificate</h3>
      <div class="certificate-container">
        <pre id="certificate-content">Loading certificate...</pre>
      </div>
      <div class="certificate-actions">
        <button id="add-certificate-btn" class="primary-btn"><i class="fas fa-plus"></i> Add Certificate</button>
      </div>
    </div>
  `;
  
  // Create content for other sections (placeholders)
  const proxiesContent = `
    <div class="header">
      <h1>Proxies</h1>
    </div>
    
    <div class="card">
      <h3><i class="fas fa-network-wired"></i> Proxy Configuration</h3>
      <p>Proxy configuration will be available soon.</p>
    </div>
  `;
  
  const statisticsContent = `
    <div class="header">
      <h1>Statistics</h1>
    </div>
    
    <div class="card">
      <h3><i class="fas fa-chart-bar"></i> Usage Statistics</h3>
      <p>Detailed statistics will be available soon.</p>
    </div>
  `;
  
  const settingsContent = `
    <div class="header">
      <h1>Settings</h1>
    </div>
    
    <div class="card">
      <h3><i class="fas fa-cog"></i> Application Settings</h3>
      <p>Settings will be available soon.</p>
    </div>
  `;
  
  const aboutContent = `
    <div class="header">
      <h1>About</h1>
    </div>
    
    <div class="card">
      <h3><i class="fas fa-info-circle"></i> About Nexapp EDGE VPN</h3>
      <p>Nexapp EDGE VPN is a secure and reliable VPN client for your everyday needs.</p>
      <p>Version: 1.0.0</p>
    </div>
  `;
  
  // Add click event to each menu item
  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      // Remove active class from all menu items
      menuItems.forEach(i => i.classList.remove('active'));
      
      // Add active class to clicked menu item
      item.classList.add('active');
      
      // Update content based on selected menu item
      const menuText = item.textContent.trim();
      
      if (menuText.includes('Dashboard')) {
        mainContent.innerHTML = dashboardContent;
        // Reinitialize event listeners for dashboard
        initializeDashboardListeners();
      } else if (menuText.includes('Certificates & Tokens')) {
        mainContent.innerHTML = certificatesContent;
        // Load certificate data
        loadCertificate();
      } else if (menuText.includes('Proxies')) {
        mainContent.innerHTML = proxiesContent;
      } else if (menuText.includes('Statistics')) {
        mainContent.innerHTML = statisticsContent;
      } else if (menuText.includes('Settings')) {
        mainContent.innerHTML = settingsContent;
      } else if (menuText.includes('About')) {
        mainContent.innerHTML = aboutContent;
      }
    });
  });
}

// Function to load certificate data
function loadCertificate() {
  const certificateContent = document.getElementById('certificate-content');
  if (certificateContent) {
    window.electronAPI.getCertificate()
      .then(result => {
        if (result.success) {
          certificateContent.textContent = result.data;
        } else {
          certificateContent.textContent = `Error: ${result.error}`;
        }
      })
      .catch(err => {
        certificateContent.textContent = `Error: ${err.message}`;
      });
  }
  
  // Add event listener for the Add Certificate button
  const addCertificateBtn = document.getElementById('add-certificate-btn');
  if (addCertificateBtn) {
    addCertificateBtn.addEventListener('click', () => {
      console.log('Add Certificate button clicked');
      // Open a file dialog to select a certificate file
      window.electronAPI.openFileDialog('certificate')
        .then(result => {
          if (!result.canceled && result.filePath) {
            console.log('Selected certificate file:', result.filePath);
            // Here you would add code to import the certificate
            alert(`Certificate file selected: ${result.fileName}\nThis feature will be implemented in a future update.`);
          }
        })
        .catch(err => {
          console.error('Error opening file dialog:', err);
          alert('Error opening file dialog: ' + err.message);
        });
    });
  }
}

// Function to initialize dashboard event listeners
function initializeDashboardListeners() {
  // Re-initialize recent files dropdown
  const profileCard = document.querySelector('.profile-card');
  if (profileCard) {
    console.log('Re-initializing recent files dropdown');
    // Create container for recent files dropdown
    const recentFilesContainer = document.createElement('div');
    recentFilesContainer.className = 'recent-files-container';
    
    // Create dropdown label
    const dropdownLabel = document.createElement('div');
    dropdownLabel.className = 'recent-files-label';
    dropdownLabel.innerHTML = '<i class="fas fa-history"></i> Recent Files';
    recentFilesContainer.appendChild(dropdownLabel);
    
    // Create dropdown select
    const recentFilesSelect = document.createElement('select');
    recentFilesSelect.id = 'recent-files-select';
    recentFilesSelect.className = 'recent-files-select';
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select a recent file';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    recentFilesSelect.appendChild(defaultOption);
    
    // Load recent files
    loadRecentFiles();
    
    // Add event listener for select change
    recentFilesSelect.addEventListener('change', (e) => {
      const selectedFilePath = e.target.value;
      if (selectedFilePath) {
        console.log('Selected recent file:', selectedFilePath);
        selectRecentFile(selectedFilePath);
      }
    });
    
    recentFilesContainer.appendChild(recentFilesSelect);
    profileCard.appendChild(recentFilesContainer);
    
    // Re-initialize other dashboard event listeners
    setupDashboardEventListeners();
  }
}

// Function to set up dashboard-specific event listeners
function setupDashboardEventListeners() {
  // Connect button
  const connectBtn = document.getElementById('connect-btn');
  if (connectBtn) {
    connectBtn.addEventListener('click', connectVPN);
  }
  
  // Disconnect button
  const disconnectBtn = document.getElementById('disconnect-btn');
  if (disconnectBtn) {
    disconnectBtn.addEventListener('click', disconnectVPN);
  }
  
  // File input
  const fileInput = document.getElementById('file-input');
  if (fileInput) {
    fileInput.addEventListener('change', handleFileInput);
  }
  
  // File input label
  const fileInputLabel = document.querySelector('.file-input-label');
  if (fileInputLabel) {
    fileInputLabel.addEventListener('click', () => {
      window.electronAPI.openFileDialog('ovpn')
        .then(result => {
          if (!result.canceled && result.filePath) {
            document.getElementById('file-name').textContent = result.fileName;
            // Load recent files after successful import
            loadRecentFiles();
          }
        })
        .catch(err => {
          console.error('Error opening file dialog:', err);
        });
    });
  }
}

// Initialize menu navigation when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded, initializing application');
  handleMenuNavigation();
  
  // Add recent files dropdown to dashboard (initial load)
  console.log('Adding recent files dropdown');
  const profileCard = document.querySelector('.profile-card');
  if (profileCard) {
    // Create container for recent files dropdown
    const recentFilesContainer = document.createElement('div');
    recentFilesContainer.className = 'recent-files-container';
    
    // Create dropdown label
    const dropdownLabel = document.createElement('div');
    dropdownLabel.className = 'recent-files-label';
    dropdownLabel.innerHTML = '<i class="fas fa-history"></i> Recent Files';
    recentFilesContainer.appendChild(dropdownLabel);
    
    // Create dropdown select
    const recentFilesSelect = document.createElement('select');
    recentFilesSelect.id = 'recent-files-select';
    recentFilesSelect.className = 'recent-files-select';
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select a recent file';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    recentFilesSelect.appendChild(defaultOption);
    
    // Load recent files
    loadRecentFiles();
    
    // Add event listener for select change
    recentFilesSelect.addEventListener('change', (e) => {
      const selectedFilePath = e.target.value;
      if (selectedFilePath) {
        console.log('Selected recent file:', selectedFilePath);
        selectRecentFile(selectedFilePath);
      }
    });
    
    recentFilesContainer.appendChild(recentFilesSelect);
    profileCard.appendChild(recentFilesContainer);
    console.log('Recent files dropdown added to profile card');
  } else {
    console.error('Profile card not found for recent files dropdown');
  }
});

// Function to load recent files into dropdown
function loadRecentFiles() {
  console.log('Loading recent files');
  window.electronAPI.getRecentFiles()
    .then(recentFiles => {
      console.log('Recent files loaded:', recentFiles);
      updateRecentFilesDropdown(recentFiles);
    })
    .catch(err => {
      console.error('Error loading recent files:', err);
    });
}

// Function to update the recent files dropdown
function updateRecentFilesDropdown(recentFiles) {
  const recentFilesSelect = document.getElementById('recent-files-select');
  if (!recentFilesSelect) return;
  
  // Clear existing options except the first default one
  while (recentFilesSelect.options.length > 1) {
    recentFilesSelect.remove(1);
  }
  
  // Add recent files to dropdown
  if (recentFiles && recentFiles.length > 0) {
    recentFiles.forEach(file => {
      const option = document.createElement('option');
      option.value = file.path;
      option.textContent = file.name;
      recentFilesSelect.appendChild(option);
    });
    recentFilesSelect.disabled = false;
  } else {
    // If no recent files, disable the dropdown
    recentFilesSelect.disabled = true;
  }
}

// Function to select a recent file
function selectRecentFile(filePath) {
  window.electronAPI.selectRecentFile(filePath)
    .then(result => {
      console.log('Select recent file result:', result);
      
      if (result.success) {
        // Update the file name display
        const fileNameElement = document.getElementById('file-name');
        if (fileNameElement) {
          fileNameElement.textContent = result.fileName || 'default.ovpn';
        }
        
        // Reset dropdown to default option
        const recentFilesSelect = document.getElementById('recent-files-select');
        if (recentFilesSelect) {
          recentFilesSelect.selectedIndex = 0;
        }
        
        // Show success notification
        const notification = document.createElement('div');
        notification.className = 'notification success';
        notification.textContent = result.message || 'Profile imported successfully!';
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
        
        // Reload recent files to update the dropdown
        loadRecentFiles();
      } else if (result.error) {
        // Show error notification
        console.error('Error selecting recent file:', result.error);
        const notification = document.createElement('div');
        notification.className = 'notification error';
        notification.textContent = 'Error importing profile: ' + result.error;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
        
        // Reload recent files to update the dropdown (in case a file was removed)
        loadRecentFiles();
      }
    })
    .catch(err => {
      console.error('Error in selectRecentFile:', err);
    });
}

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    // Update the file name display
    const fileNameElement = document.getElementById('file-name');
    console.log('File name element:', fileNameElement);
    fileNameElement.textContent = file.name;
    
    file.arrayBuffer().then(buffer => {
      // Use IPC to import the profile
      window.electronAPI.importProfile(Array.from(new Uint8Array(buffer)))
        .then(result => {
          console.log('Import result:', result);
          
          if (result.success) {
            // Use notification instead of alert for better UX
            const notification = document.createElement('div');
            notification.className = 'notification success';
            notification.textContent = result.message || 'Profile imported successfully!';
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 3000);
            
            // Reload recent files to update the dropdown
            loadRecentFiles();
          } else {
            // Handle file write error
            console.error('Error importing profile:', result.error);
            const notification = document.createElement('div');
            notification.className = 'notification error';
            notification.textContent = 'Error importing profile: ' + result.error;
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 5000);
          }
        })
        .catch(err => {
          console.error('Error importing profile:', err);
          // Use notification instead of alert for better UX
          const notification = document.createElement('div');
          notification.className = 'notification error';
          notification.textContent = 'Error importing profile: ' + err.message;
          document.body.appendChild(notification);
          setTimeout(() => notification.remove(), 5000);
        });
    }).catch(err => {
      console.error('Error reading file:', err);
      // Use notification instead of alert for better UX
      const notification = document.createElement('div');
      notification.className = 'notification error';
      notification.textContent = 'Error reading file: ' + err.message;
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 5000);
    });
  }
});

// Add event listeners for menu items
document.querySelectorAll('.menu-item').forEach(item => {
  item.addEventListener('click', function() {
    // Remove active class from all menu items
    document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
    // Add active class to clicked item
    this.classList.add('active');
    // Here you would implement showing/hiding different sections based on menu selection
  });
});

// Add click event listener to file input label
const fileInputLabel = document.querySelector('.file-input-label');
console.log('File input label element:', fileInputLabel);

// Add a global click handler to debug click events
document.addEventListener('click', (e) => {
  console.log('Document click event on element:', e.target);
  console.log('Element classes:', e.target.className);
  console.log('Element tag:', e.target.tagName);
  
  // Check if the click is on or inside the file input label
  const isFileInputLabelClick = e.target.classList.contains('file-input-label') || 
                               e.target.closest('.file-input-label');
  if (isFileInputLabelClick) {
    console.log('Click detected on or inside file input label');
  }
});

if (fileInputLabel) {
  console.log('Adding click event listener to file input label');
  fileInputLabel.addEventListener('click', (e) => {
    console.log('File input label clicked - event fired');
    console.log('Event target:', e.target);
    console.log('Current target:', e.currentTarget);
    e.preventDefault(); // Prevent default behavior
    e.stopPropagation(); // Stop event propagation
    
    // Use the IPC channel to open file dialog
    console.log('Calling openFileDialog IPC method');
    window.electronAPI.openFileDialog()
      .then(result => {
        console.log('File dialog result:', result);
        
        if (result.success) {
          // Update the file name display
          const fileNameElement = document.getElementById('file-name');
          console.log('File name element for update:', fileNameElement);
          if (fileNameElement) {
            fileNameElement.textContent = result.fileName || 'default.ovpn';
            console.log('Updated file name to:', result.fileName);
          }
          
          // Show success notification
          const notification = document.createElement('div');
          notification.className = 'notification success';
          notification.textContent = result.message || 'Profile imported successfully!';
          document.body.appendChild(notification);
          console.log('Added success notification');
          setTimeout(() => notification.remove(), 3000);
          
          // Reload recent files to update the dropdown
          loadRecentFiles();
        } else if (result.error) {
          // Show error notification
          console.error('Error opening file dialog:', result.error);
          const notification = document.createElement('div');
          notification.className = 'notification error';
          notification.textContent = 'Error importing profile: ' + result.error;
          document.body.appendChild(notification);
          setTimeout(() => notification.remove(), 5000);
        }
      })
      .catch(err => {
        console.error('Error opening file dialog:', err);
        const notification = document.createElement('div');
        notification.className = 'notification error';
        notification.textContent = 'Error opening file dialog: ' + err.message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
      });
  });
}

// Traffic stats event handler
window.electronAPI.onTrafficStats((data) => {
  // Update the traffic statistics directly from the data object
  bytesReceived = data.bytesReceived;
  bytesSent = data.bytesSent;
  
  // Update the UI with the new values
  updateTrafficDisplay();
});

// Initialize the UI
updateConnectionStatus('disconnected');
resetStats();