const { execSync } = require('child_process');
const { dialog } = require('electron');

/**
 * Checks if the application is running with administrator privileges
 * @returns {boolean} True if running with admin privileges, false otherwise
 */
function isAdmin() {
  try {
    // This command will fail if not running as admin
    execSync('net session', { stdio: 'ignore' });
    console.log('Application is running with administrator privileges');
    return true;
  } catch (e) {
    console.log('Application is NOT running with administrator privileges');
    return false;
  }
}

/**
 * Displays a message to the user about the current privilege level
 * @param {BrowserWindow} window - The Electron BrowserWindow to use for the dialog
 */
function checkAndNotifyAdminStatus(window) {
  const isAdminUser = isAdmin();
  
  if (isAdminUser) {
    dialog.showMessageBox(window, {
      type: 'info',
      title: 'Administrator Privileges',
      message: 'The application is running with administrator privileges. VPN connections should work properly.',
      buttons: ['OK']
    });
  } else {
    dialog.showMessageBox(window, {
      type: 'warning',
      title: 'Administrator Privileges Required',
      message: 'The application is NOT running with administrator privileges. VPN connections may not work properly. Please restart the application with administrator privileges.',
      buttons: ['OK']
    });
  }
  
  return isAdminUser;
}

module.exports = {
  isAdmin,
  checkAndNotifyAdminStatus
};