// Download handler for offscreen document
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'DOWNLOAD_FILE') {
    const { data, filename } = message.payload;
    try {
      console.log('[Offscreen] Received download request:', filename, 'size:', data.length);

      // Convert array to Uint8Array
      const buffer = new Uint8Array(data);
      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);

      console.log('[Offscreen] Triggering download...');
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        console.log('[Offscreen] Download completed');
      }, 100);

      sendResponse({ success: true });
    } catch (err) {
      console.error('[Offscreen] Error:', err);
      sendResponse({ success: false, error: String(err) });
    }
  }
});

console.log('[Offscreen] Document loaded and ready');
