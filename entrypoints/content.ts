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
        width: 24px;
        height: 24px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 2px;
      `;

      // KeePass app icon - green background with white lock
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.style.width = '100%';
      svg.style.height = '100%';
      svg.innerHTML = `
        <!-- Green background -->
        <rect x="0" y="0" width="24" height="24" rx="3" fill="#34A853"/>

        <!-- White lock -->
        <g fill="none" stroke="white" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
          <!-- Lock shackle (top part) -->
          <path d="M7 11V8C7 5.24 9.24 3 12 3C14.76 3 17 5.24 17 8V11"/>
          <!-- Lock body -->
          <rect x="5" y="11" width="14" height="9" rx="1"/>
          <!-- Lock keyhole -->
          <circle cx="12" cy="15.5" r="1.5" fill="white" stroke="none"/>
        </g>
      `;

      indicator.appendChild(svg);
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
