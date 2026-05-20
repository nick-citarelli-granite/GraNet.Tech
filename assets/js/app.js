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
    this.showToast(message);
    if (this.status) {
      this.status.textContent = message;
      window.setTimeout(() => {
        this.status.textContent = '';
      }, 1800);
    }
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
new ClipboardCopy().init();
