const READY_CLASS = 'js-enabled';

class Dom {
  static all(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }
}

class BrowserMetadata {
  static init() {
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    if (document.querySelector('link[rel="manifest"]')) return;

    const manifest = document.createElement('link');
    manifest.rel = 'manifest';
    manifest.href = 'site.webmanifest';
    document.head.append(manifest);
  }
}

class PanelSwitcher {
  constructor() {
    this.triggers = Dom.all('[data-panel-target]');
    this.tabs = Dom.all('.panel-tab[data-panel-target]');
    this.panels = Dom.all('.info-panel');
  }

  init() {
    this.triggers.forEach((trigger) => {
      trigger.addEventListener('click', (event) => this.openFromEvent(event, trigger));
    });
    this.open(this.defaultPanelId(), { scroll: false });
  }

  defaultPanelId() {
    const hashPanel = document.getElementById(window.location.hash.slice(1));
    return hashPanel?.classList.contains('info-panel') ? hashPanel.id : 'repair-panel';
  }

  openFromEvent(event, trigger) {
    event.preventDefault();
    this.open(trigger.dataset.panelTarget);
  }

  open(panelId, options = { scroll: false }) {
    const selectedPanel = document.getElementById(panelId);
    const selectedTab = this.tabs.find((tab) => tab.dataset.panelTarget === panelId);
    if (!selectedPanel || !selectedTab) {
      console.warn(`Panel target not found: ${panelId}`);
      return;
    }

    this.tabs.forEach((tab) => {
      const isSelected = tab === selectedTab;
      tab.classList.toggle('active', isSelected);
      tab.setAttribute('aria-expanded', String(isSelected));
    });

    this.panels.forEach((panel) => {
      const isSelected = panel === selectedPanel;
      panel.classList.toggle('open', isSelected);
      panel.hidden = !isSelected;
    });

    window.dispatchEvent(new CustomEvent('granet:panelchange', { detail: { panelId } }));

    if (options.scroll !== false) {
      selectedPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

class ClipboardCopy {
  constructor() {
    this.buttons = Dom.all('[data-copy-email], [data-copy-value]');
    this.status = document.getElementById('copy-status');
    this.toast = null;
  }

  init() {
    this.buttons.forEach((button) => {
      button.addEventListener('click', () => this.copy(button));
    });
  }

  async copy(button) {
    const value = button.dataset.copyValue || button.dataset.copyEmail;
    if (!value) {
      throw new Error('Copy button is missing a value.');
    }
    const label = button.dataset.copyLabel || 'Copied';

    try {
      await navigator.clipboard.writeText(value);
      this.setStatus(label);
      Analytics.track('copy_value');
    } catch {
      this.fallbackCopy(value);
      this.setStatus(label);
      Analytics.track('copy_value_fallback');
    }
  }

  fallbackCopy(value) {
    const input = document.createElement('textarea');
    input.value = value;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.top = '-999px';
    document.body.append(input);
    input.select();
    document.execCommand('copy');
    input.remove();
  }

  setStatus(message) {
    this.showToast(message);
    if (!this.status) return;

    this.status.textContent = message;
    window.setTimeout(() => {
      this.status.textContent = '';
    }, 1800);
  }

  showToast(message) {
    if (!this.toast) {
      this.toast = document.createElement('div');
      this.toast.className = 'copy-toast';
      this.toast.setAttribute('role', 'status');
      this.toast.setAttribute('aria-live', 'polite');
      document.body.append(this.toast);
    }

    this.toast.textContent = message;
    this.toast.classList.add('visible');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toast.classList.remove('visible');
    }, 1800);
  }
}

class ContactApiForm {
  constructor() {
    this.form = document.querySelector('[data-contact-form]');
    this.endpoint = '/api/contact';
  }

  init() {
    if (!this.form) return;
    this.button = this.form.querySelector('[type="submit"]');
    this.status = this.form.querySelector('[data-contact-form-status]');
    this.form.addEventListener('submit', (event) => this.submit(event));
  }

  async submit(event) {
    event.preventDefault();
    const formData = new FormData(this.form);
    const name = this.clean(formData.get('name'));
    const email = this.clean(formData.get('email'));
    const phone = this.clean(formData.get('phone'));
    const message = this.clean(formData.get('message'));
    const website = this.clean(formData.get('website'));

    const validationMessage = this.validate({ name, email, phone, message });
    if (validationMessage) {
      this.showStatus(validationMessage, 'error');
      return;
    }

    this.setPending(true);
    this.showStatus('Sending...', '');

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          name,
          email,
          phone,
          service: 'Website contact form',
          message,
          website
        })
      });

      let result = null;
      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if (!response.ok || result?.ok === false) {
        throw new Error(result?.message || 'We could not send your request. Please call or email us instead.');
      }

      this.form.reset();
      this.showStatus(result?.message || 'Contact request sent.', 'success');
      Analytics.track(this.button?.dataset.analytics);
    } catch (error) {
      this.showStatus(error.message || 'We could not send your request. Please call or email us instead.', 'error');
    } finally {
      this.setPending(false);
    }
  }

  clean(value) {
    return String(value || '').trim();
  }

  validate({ name, email, phone, message }) {
    if (!name) return 'Please enter your name.';
    if (name.length < 2) return 'Please enter at least 2 characters for your name.';
    if (name.length > 100) return 'Please keep your name under 100 characters.';
    if (!message) return 'Please tell us what you need.';
    if (message.length < 10) return 'Please enter at least 10 characters in your message.';
    if (message.length > 5000) return 'Please keep your message under 5000 characters.';
    if (!email && !phone) return 'Please enter an email address or phone number.';
    if (email.length > 254) return 'Please keep your email address under 254 characters.';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email address or leave it blank.';
    if (phone.length > 40) return 'Please keep your phone number under 40 characters.';
    return '';
  }

  setPending(isPending) {
    if (!this.button) return;
    this.button.disabled = isPending;
    this.button.textContent = isPending ? 'Sending...' : 'Send request';
  }

  showStatus(message, type) {
    if (!this.status) return;
    this.status.textContent = message;
    this.status.classList.toggle('error', type === 'error');
    this.status.classList.toggle('success', type === 'success');
  }
}

class Analytics {
  static init() {
    Dom.all('[data-analytics]').forEach((element) => {
      if (element.matches('button[type="submit"], input[type="submit"]')) return;
      element.addEventListener('click', () => {
        Analytics.track(element.dataset.analytics);
      });
    });
  }

  static track(eventName) {
    if (!eventName) return;
    if (typeof window.plausible === 'function') {
      window.plausible(eventName);
    }
    window.dispatchEvent(new CustomEvent('granet:analytics', { detail: { eventName } }));
  }
}

document.documentElement.classList.add(READY_CLASS);
BrowserMetadata.init();
Analytics.init();
new PanelSwitcher().init();
window.GraNetCircuit?.init();
new ClipboardCopy().init();
new ContactApiForm().init();
