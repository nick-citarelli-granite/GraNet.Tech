class ContactApiForm {

  constructor() {
    /** @type {HTMLFormElement} */
    this.form = document.querySelector('[data-contact-form]');

    /** @type {string} */
    this.endpoint = '/api/contact';
  }

  init() {
    if (!this.form) return;

    /** @type {HTMLButtonElement} */
    this.button = this.form.querySelector('[type="submit"]');

    /** @type {HTMLElement} */
    this.status = this.form.querySelector('[data-contact-form-status]');

    this.form.addEventListener('submit', (event) => this.submit(event));
  }

  /**
   * @param {SubmitEvent} event
   */
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
    const defaultErrorMessage = 'We could not send your request. Please call or email us instead.';

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
        throw new Error(result?.message || defaultErrorMessage);
      }

      this.form.reset();
      this.showStatus(result?.message || 'Contact request sent.', 'success');

      setTimeout(() => {
        window.location.href = "../thank-you/?method=contact";
      }, 1000);
    } catch (error) {
      this.showStatus(error.message || defaultErrorMessage, 'error');
    } finally {
      this.setPending(false);
    }
  }

  /**
   * @param {string} value
   * @returns {string}
   */
  clean(value) {
    return String(value || '').trim();
  }

  /**
   * @param {{name: string, email: string, phone: string, message: string}}
   * @returns {string}
   */
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

  /**
   * @param {boolean} isPending
   */
  setPending(isPending) {
    if (!this.button) return;
    this.button.disabled = isPending;
    this.button.textContent = isPending ? 'Sending...' : 'Send request';
  }

  /**
   * @param {string} message
   * @param {'error' | 'success' | ''} type
   */
  showStatus(message, type) {
    if (!this.status) return;
    this.status.textContent = message;
    this.status.classList.toggle('error', type === 'error');
    this.status.classList.toggle('success', type === 'success');
  }
}

class ContactModal {

  constructor() {
    this.modal = document.querySelector('[data-contact-modal]');
    this.openers = Array.from(document.querySelectorAll('[data-contact-open]'));
    this.closers = Array.from(document.querySelectorAll('[data-contact-close]'));
    this.formLinks = Array.from(document.querySelectorAll('[data-contact-form-link]'));
    this.lastFocus = null;
  }

  init() {
    if (!this.modal) return;

    this.dialog = this.modal.querySelector('.contact-modal-dialog');

    this.openers.forEach((opener) => {
      opener.addEventListener('click', (event) => {
        event.preventDefault();
        this.open();
      });
    });

    this.closers.forEach((closer) => {
      closer.addEventListener('click', () => this.close());
    });

    this.formLinks.forEach((link) => {
      link.addEventListener('click', () => this.close({ restoreFocus: false }));
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.modal.classList.contains('is-open')) {
        this.close();
      }
    });
  }

  open() {
    this.lastFocus = document.activeElement;
    this.modal.classList.add('is-open');
    this.modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    this.dialog?.focus();
  }

  /**
   * @param {{restoreFocus?: boolean}} options
   */
  close(options = { restoreFocus: true }) {
    this.modal.classList.remove('is-open');
    this.modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');

    if (options.restoreFocus !== false && this.lastFocus && typeof this.lastFocus.focus === 'function') {
      this.lastFocus.focus();
    }
  }
}

new ContactModal().init();
new ContactApiForm().init();
