(() => {
  const form = document.querySelector('[data-contact-form]');
  if (!(form instanceof HTMLFormElement)) return;
  const statusNode = form.querySelector('[data-form-status]');
  const submitButton = form.querySelector('[type="submit"]');
  const configuredEndpoint = window.GRANET_CONTACT_CONFIG?.endpoint || '';
  const configured = configuredEndpoint.startsWith('https://') && !configuredEndpoint.includes('CONFIGURE_PUBLIC_IDENTIFIER');
  if (configured) form.action = configuredEndpoint;

  let pendingSubmission = null;

  const showStatus = (message, state = '') => {
    if (!statusNode) return;
    statusNode.textContent = message;
    statusNode.dataset.state = state;
  };
  const setPending = (pending) => {
    if (!(submitButton instanceof HTMLButtonElement)) return;
    submitButton.disabled = pending;
    submitButton.textContent = pending ? 'Sending securely…' : 'Send request';
  };
  const normalize = (value) => String(value || '').trim();
  const validate = (payload) => {
    if (payload.name.length < 2) return 'Please enter your name.';
    if (!payload.email && !payload.phone) return 'Please provide an email address or phone number.';
    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) return 'Please enter a valid email address.';
    if (payload.message.length < 10) return 'Please tell us a little more about what you need.';
    return '';
  };
  const buildPayload = () => {
    const fields = Object.fromEntries(new FormData(form));
    return {
      submission_request_id: crypto.randomUUID(),
      name: normalize(fields.name),
      email: normalize(fields.email),
      phone: normalize(fields.phone),
      service: normalize(fields.service),
      message: normalize(fields.message),
      website: normalize(fields.website),
      challenge_response: normalize(fields.challenge_response)
    };
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!configured) {
      showStatus('Online intake is awaiting its public source. Please call or email us in the meantime.', 'error');
      return;
    }
    if (pendingSubmission === null) pendingSubmission = buildPayload();
    const validationError = validate(pendingSubmission);
    if (validationError) {
      pendingSubmission = null;
      showStatus(validationError, 'error');
      return;
    }

    setPending(true);
    showStatus('Sending your request…');
    let response;
    try {
      response = await fetch(configuredEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingSubmission),
        credentials: 'omit'
      });
    } catch {
      setPending(false);
      showStatus('The connection was interrupted. Try again to safely retry this request, or call us.', 'error');
      return;
    }

    if (response.status >= 500) {
      setPending(false);
      showStatus('The server is temporarily unavailable. Try again to safely retry this request, or call us.', 'error');
      return;
    }
    if (!response.ok) {
      pendingSubmission = null;
      setPending(false);
      let message = 'Review the submitted information and try again.';
      try { message = (await response.json()).error || message; } catch { /* authoritative status is enough */ }
      showStatus(message, 'error');
      return;
    }

    let result;
    try { result = await response.json(); } catch {
      setPending(false);
      showStatus('The server returned a response we could not read. Try again to safely replay this request, or call us for confirmation.', 'error');
      return;
    }
    if (response.status !== 202) {
      pendingSubmission = null;
      setPending(false);
      showStatus('The server did not accept this request. Please review it and try again.', 'error');
      return;
    }
    if (result.ok !== true || typeof result.receipt_id !== 'string' || !result.receipt_id) {
      setPending(false);
      showStatus('The server returned a response we could not verify. Try again to safely replay this request, or call us for confirmation.', 'error');
      return;
    }

    pendingSubmission = null;
    form.reset();
    showStatus('Request received. We will follow up shortly.', 'success');
    window.setTimeout(() => {
      const thankYou = window.location.protocol === 'file:'
        ? '../thank-you/index.html?method=contact'
        : '../thank-you/?method=contact';
      window.location.href = thankYou;
    }, 900);
  });
})();
