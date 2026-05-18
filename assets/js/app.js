const READY_CLASS = 'js-enabled';

class Dom {
  static all(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
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

  open(panelId, options = {}) {
    const selectedPanel = document.getElementById(panelId);
    const selectedTab = this.tabs.find((tab) => tab.dataset.panelTarget === panelId);
    if (!selectedPanel || !selectedTab) {
      throw new Error(`Panel target not found: ${panelId}`);
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

    if (options.scroll !== false) {
      selectedPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

class CopyEmail {
  constructor() {
    this.buttons = Dom.all('[data-copy-email]');
    this.status = document.getElementById('copy-status');
  }

  init() {
    this.buttons.forEach((button) => {
      button.addEventListener('click', () => this.copy(button));
    });
  }

  async copy(button) {
    const email = button.dataset.copyEmail;
    if (!email) {
      throw new Error('Copy email button is missing an email value.');
    }

    try {
      await navigator.clipboard.writeText(email);
      this.setStatus('Copied');
      Analytics.track('copy_email');
    } catch {
      this.fallbackCopy(email);
      this.setStatus('Copied');
      Analytics.track('copy_email_fallback');
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
    if (this.status) {
      this.status.textContent = message;
      window.setTimeout(() => {
        this.status.textContent = '';
      }, 1800);
    }
  }
}

class ContactForm {
  constructor() {
    this.form = document.querySelector('[data-contact-form]');
    this.status = document.querySelector('[data-form-status]');
  }

  init() {
    if (!this.form) return;
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.submit();
    });
  }

  async submit() {
    const button = this.form.querySelector('button[type="submit"]');
    const originalLabel = button?.textContent || 'Send request';
    const payload = Object.fromEntries(new FormData(this.form).entries());

    Analytics.track('contact_form_submit');
    this.setStatus('Sending...', false);
    if (button) {
      button.disabled = true;
      button.textContent = 'Sending...';
    }

    try {
      const response = await fetch(this.form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Contact endpoint returned ${response.status}`);
      }

      this.form.reset();
      this.setStatus('Request sent. GraNet will follow up soon.', false);
      Analytics.track('contact_form_success');
    } catch {
      this.setStatus('Could not send from this page. Call/text or copy the email above.', true);
      Analytics.track('contact_form_error');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalLabel;
      }
    }
  }

  setStatus(message, isError) {
    if (!this.status) return;
    this.status.textContent = message;
    this.status.classList.toggle('error', Boolean(isError));
  }
}

class Analytics {
  static init() {
    Dom.all('[data-analytics]').forEach((element) => {
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
Analytics.init();
new PanelSwitcher().init();
new CopyEmail().init();
new ContactForm().init();
