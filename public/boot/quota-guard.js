// Loaded as a classic (blocking) script in <head> so it is installed before the
// app bundle runs. Kept outside index.html so the CSP needs no 'unsafe-inline'.
(function () {
  function suppressQuota(event) {
    try {
      var reason = event.reason || event.error;
      var msg = String((reason && reason.message) || reason || (event && event.message) || '');
      if (
        msg.indexOf('kQuotaBytes') !== -1 ||
        msg.indexOf('quota exceeded') !== -1 ||
        msg.indexOf('QUOTA_BYTES') !== -1 ||
        (reason && reason.name === 'QuotaExceededError')
      ) {
        if (typeof event.preventDefault === 'function') event.preventDefault();
        if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
        return true;
      }
    } catch (_) {
      // Ignore handler failures
    }
  }
  window.addEventListener('unhandledrejection', suppressQuota, true);
  window.addEventListener('error', suppressQuota, true);
})();
