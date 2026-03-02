// loader.js - embeds the audit dashboard in an iframe
// Usage: <script src="/path/to/loader.js?locationId=56Jnv0OGTMdU1XSZyJIR"></script>

(function() {
  function getParam(key) {
    var match = window.location.search.match(new RegExp('[?&]' + key + '=([^&]+)'));
    return match && decodeURIComponent(match[1]);
  }

  var locationId = getParam('locationId') || getParam('location_id');
  if (!locationId) {
    console.error('Missing locationId parameter for TattooNOW audit loader');
    return;
  }

  var iframe = document.createElement('iframe');
  iframe.src = 'https://tattoonow.github.io/site-audit/dashboard.html?locationId=' + encodeURIComponent(locationId);
  iframe.style.border = 'none';
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.minHeight = '600px';
  iframe.setAttribute('allowfullscreen', '');

  document.currentScript.parentNode.insertBefore(iframe, document.currentScript);
})();
