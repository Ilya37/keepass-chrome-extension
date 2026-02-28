# Privacy Policy

## KeePass Password Manager Chrome Extension

**Last Updated: February 2026**

### Overview

The KeePass Password Manager extension is designed with privacy as the core principle. All data encryption and storage happens entirely on your device.

### Data Collection

**We do NOT collect any personal data:**
- No user tracking
- No analytics
- No telemetry
- No crash reporting to remote servers
- No network requests to external services

### Data Storage

All your passwords and database information are stored **locally** on your device:

1. **Chrome Storage (chrome.storage.local)**
   - Encrypted KeePass database (.kdbx)
   - Database metadata
   - Persists across browser restarts

2. **IndexedDB Database**
   - Backup copies of your database
   - Version history (last 5 versions)
   - Automatic snapshots (hourly)
   - Recovery codes
   - Operation journal

3. **Session Storage (chrome.storage.session)**
   - Encrypted auto-unlock tokens
   - Cleared when browser exits

### Encryption

- Master password is never stored in plaintext
- Uses PBKDF2 with SHA-256 hashing
- Database blob is encrypted with KeePass format
- Auto-unlock tokens are encrypted with 1-hour expiration

### Permissions

- `storage`: To store encrypted database
- `alarms`: For auto-lock (15 min) and clipboard auto-clear
- `activeTab`: To fill passwords when you open the extension on a login page
- `scripting`: To fill username/password into the current page (only when you click Fill)
- `clipboardWrite` (optional, requested when you first copy): To copy passwords

None of these permissions are used to transmit data externally.

### Third-Party Services

This extension does NOT use any third-party services:
- No cloud storage
- No external authentication
- No remote backups
- No advertising

### Data Deletion

You can delete all data by:
1. Opening extension settings
2. Clicking "Delete Database"
3. All data in chrome.storage.local and IndexedDB is permanently removed

### Open Source

This extension is open source. You can review the code:
- GitHub: https://github.com/Ilya37/keepass-chrome-extension

### Contact

For privacy concerns or questions, open an issue on GitHub.

### Changes to This Policy

We may update this policy. Changes will be reflected here with an updated date.
