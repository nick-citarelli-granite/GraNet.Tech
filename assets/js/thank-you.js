(() => {
  const count = document.querySelector('#redirect-count');
  let seconds = 10;
  const searchParams = new URLSearchParams(window.location.search);
  const interval = window.setInterval(() => {
    seconds -= 1;
    if (count) count.textContent = String(Math.max(seconds, 0));
    if (seconds > 0) return;
    window.clearInterval(interval);
    if (searchParams.get('debug') !== 'true') {
      window.location.href = window.location.protocol === 'file:' ? '../index.html' : '../';
    }
  }, 1000);
})();
