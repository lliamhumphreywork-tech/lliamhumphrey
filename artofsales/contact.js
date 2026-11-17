// Art of Sales contact email. Change it here and every page updates.
// Any element with data-contact-email becomes a mailto: link (and shows the address if it has no text of its own).
(function () {
  var EMAIL = 'lliam@lliamhumphrey.com';
  document.querySelectorAll('[data-contact-email]').forEach(function (a) {
    a.href = 'mailto:' + EMAIL;
    if (!a.textContent.trim()) a.textContent = EMAIL;
  });
})();
