import type { EntriesResponse } from '@/lib/messages';

export default defineContentScript({
  matches: ['*://*/*'],
  main() {
    // Detect login forms on the page
    const observer = new MutationObserver(() => {
      detectForms();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Initial scan
    setTimeout(detectForms, 500);

    function detectForms() {
      const passwordFields = document.querySelectorAll<HTMLInputElement>(
        'input[type="password"]',
      );

      if (passwordFields.length === 0) return;

      // Check if we already attached our markers
      passwordFields.forEach((field) => {
        if (field.dataset.keepassDetected) return;
        field.dataset.keepassDetected = 'true';

        // Find the associated username field
        const form = field.closest('form');
        const usernameField = form
          ? form.querySelector<HTMLInputElement>(
              'input[type="text"], input[type="email"], input[name*="user"], input[name*="login"], input[name*="email"], input[autocomplete="username"]',
            )
          : null;

        // Request matching credentials from background
        requestCredentials(field, usernameField);
      });
    }

    async function requestCredentials(
      passwordField: HTMLInputElement,
      usernameField: HTMLInputElement | null,
    ) {
      try {
        const response = (await browser.runtime.sendMessage({
          type: 'GET_ENTRIES_FOR_URL',
          payload: { url: window.location.href },
        })) as EntriesResponse;

        if (response.success && response.data.length > 0) {
          // Add a subtle indicator that credentials are available
          addFillIndicator(passwordField, usernameField, response.data);
        }
      } catch {
        // Extension might not be unlocked — silently ignore
      }
    }

    function addFillIndicator(
      passwordField: HTMLInputElement,
      usernameField: HTMLInputElement | null,
      entries: EntriesResponse['data'],
    ) {
      // Add a small icon inside the password field to indicate autofill availability
      const indicator = document.createElement('div');
      indicator.style.cssText = `
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        width: 20px;
        height: 20px;
        background: #059669;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-size: 12px;
        color: white;
        font-weight: bold;
      `;
      indicator.textContent = 'K';
      indicator.title = `KeePass: ${entries.length} credential(s) available`;

      // Make the parent positioned so we can place the indicator
      const parent = passwordField.parentElement;
      if (parent) {
        const parentPosition = window.getComputedStyle(parent).position;
        if (parentPosition === 'static') {
          parent.style.position = 'relative';
        }
        parent.appendChild(indicator);
      }

      // Click to fill
      indicator.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const entry = entries[0]; // Use first match for now
        if (usernameField) {
          setNativeValue(usernameField, entry.username);
        }
        setNativeValue(passwordField, entry.password);
      });
    }

    /** Set value on input in a way that triggers React/Vue/Angular change detection */
    function setNativeValue(input: HTMLInputElement, value: string) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;

      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(input, value);
      } else {
        input.value = value;
      }

      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  },
});
