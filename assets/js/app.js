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

class ClipboardCopy {
  constructor() {
    this.buttons = Dom.all('[data-copy-email], [data-copy-value]');
    this.status = document.getElementById('copy-status');
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
      this.setStatus(label, button);
      Analytics.track('copy_value');
    } catch {
      this.fallbackCopy(value);
      this.setStatus(label, button);
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

  setStatus(message, button) {
    const scopedStatus = button.closest('[data-contact-modal]')?.querySelector('[data-modal-status]');
    const target = scopedStatus || this.status;
    if (target) {
      target.textContent = message;
      window.setTimeout(() => {
        target.textContent = '';
      }, 1800);
    }
  }
}

class ContactModal {
  constructor() {
    this.modal = document.querySelector('[data-contact-modal]');
    this.openButtons = Dom.all('[data-contact-help]');
    this.closeButtons = Dom.all('[data-modal-close]');
    this.topic = document.querySelector('[data-modal-topic]');
    this.lastFocus = null;
  }

  init() {
    if (!this.modal) return;
    this.openButtons.forEach((button) => {
      button.addEventListener('click', () => this.open(button));
    });
    this.closeButtons.forEach((button) => {
      button.addEventListener('click', () => this.close());
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !this.modal.hidden) {
        this.close();
      }
    });
  }

  open(button) {
    this.lastFocus = button;
    const topic = button.dataset.helpTopic;
    if (this.topic) {
      this.topic.textContent = topic ? `For ${topic}, choose the quickest contact option.` : 'Pick the fastest option for your request.';
    }
    this.modal.hidden = false;
    document.body.classList.add('modal-open');
    this.modal.querySelector('a, button')?.focus();
    Analytics.track('contact_modal_open');
  }

  close() {
    this.modal.hidden = true;
    document.body.classList.remove('modal-open');
    this.lastFocus?.focus();
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
    const payload = new FormData(this.form);

    Analytics.track('contact_form_submit');
    this.setStatus('Sending...', false);
    if (button) {
      button.disabled = true;
      button.textContent = 'Sending...';
    }

    try {
      if (!this.form.action.startsWith('https://formsubmit.co/ajax/')) {
        throw new Error(`Unexpected contact form endpoint: ${this.form.action}`);
      }

      const response = await fetch(this.form.action, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: payload,
      });

      if (!response.ok) {
        throw new Error(`Contact endpoint returned ${response.status}`);
      }

      this.form.reset();
      this.setStatus('Request sent. GraNet will follow up soon. First-time setup may require email confirmation.', false);
      Analytics.track('contact_form_success');
    } catch {
      this.setStatus('Could not send from this page. Use the contact options above or email support@granet.tech.', true);
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
new ContactModal().init();
new ClipboardCopy().init();
new ContactForm().init();
