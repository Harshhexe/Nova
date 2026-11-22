const { ipcRenderer } = require('electron');

if (process.isMainFrame && location.protocol === 'https:') {
  const visible = input => input.getClientRects().length > 0 && getComputedStyle(input).visibility === 'visible';
  const canOffer = () => ![...document.querySelectorAll('input[type=password], input[autocomplete=one-time-code], [role=alert]')].some(visible);
  let observer;
  let settle;
  let expires;
  let enabled = false;
  let configured = false;
  ipcRenderer.on('nova:login-config', (_event, value) => {
    configured = true;
    enabled = value === true;
  });
  void ipcRenderer.invoke('nova:login-enabled').then(value => {
    if (!configured) enabled = value === true;
  }).catch(() => {});

  function stop() {
    observer?.disconnect();
    clearTimeout(settle);
    clearTimeout(expires);
  }

  function report() {
    if (!canOffer()) return;
    stop();
    ipcRenderer.send('nova:login-cleared');
  }

  window.addEventListener('load', () => setTimeout(report, 800), { once: true });

  document.addEventListener('submit', event => {
    const form = event.target;
    if (!enabled || !event.isTrusted || !(form instanceof HTMLFormElement)) return;
    const method = (event.submitter?.getAttribute('formmethod') || form.method).toLowerCase();
    const action = new URL(event.submitter?.getAttribute('formaction') || form.action, location.href);
    if (method !== 'post' || action.origin !== location.origin) return;
    const passwords = [...form.querySelectorAll('input[type=password]')].filter(input => !input.disabled && visible(input));
    if (passwords.length !== 1 || passwords[0].autocomplete === 'new-password' || !passwords[0].value) return;
    const username = [...form.querySelectorAll('input[autocomplete=username], input[type=email], input[type=text]')]
      .find(input => visible(input) && !input.disabled && input.value);
    if (!username) return;
    stop();
    ipcRenderer.send('nova:login-submitted', { username: username.value.slice(0, 320), password: passwords[0].value });
    observer = new MutationObserver(() => {
      clearTimeout(settle);
      if (canOffer()) settle = setTimeout(report, 850);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class', 'style', 'type'] });
    expires = setTimeout(stop, 20000);
  }, true);
}
