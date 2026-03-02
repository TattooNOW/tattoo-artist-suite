/**
 * TattooNOW Onboarding — HighLevel Embed Script
 *
 * Usage: Add to a HighLevel custom page (Custom Code element or HTML block):
 *
 *   <div id="tattoonow-onboarding"></div>
 *   <script src="https://YOUR_DOMAIN/onboarding-embed.js"></script>
 *
 * Or with options:
 *
 *   <div id="tattoonow-onboarding"></div>
 *   <script>
 *     window.TattooNOWOnboardingConfig = {
 *       containerId: 'tattoonow-onboarding',            // default
 *       baseUrl: 'https://YOUR_DOMAIN',                  // where onboarding.html is hosted
 *       webhookUrl: 'https://your-n8n-or-ghl-webhook-url',  // optional
 *       onPrioritiesSelected: function(data) { console.log('Priorities:', data); },
 *       onTaskComplete: function(data) { console.log('Task done:', data); },
 *       onComplete: function(data) { console.log('Onboarding done:', data); },
 *     };
 *   </script>
 *   <script src="https://YOUR_DOMAIN/onboarding-embed.js"></script>
 */
(function() {
    'use strict';

    // ── Configuration ────────────────────────────────────
    var defaults = {
        containerId: 'tattoonow-onboarding',
        baseUrl: '',   // Auto-detect from script src if empty
        webhookUrl: '',
        onPrioritiesSelected: null,
        onTaskComplete: null,
        onComplete: null,
    };

    var config = Object.assign({}, defaults, window.TattooNOWOnboardingConfig || {});

    // ── Auto-detect base URL from this script's src ──────
    if (!config.baseUrl) {
        try {
            var scripts = document.getElementsByTagName('script');
            for (var i = scripts.length - 1; i >= 0; i--) {
                var src = scripts[i].src || '';
                if (src.includes('onboarding-embed')) {
                    config.baseUrl = src.substring(0, src.lastIndexOf('/'));
                    break;
                }
            }
        } catch (e) { /* fallback to relative */ }
    }

    // ── Extract locationId from parent page URL ──────────
    var parentParams = new URLSearchParams(window.location.search);
    var locationId = parentParams.get('locationId')
        || parentParams.get('location_id')
        || parentParams.get('locationID')
        || parentParams.get('loc')
        || '';

    // ── Build iframe src ─────────────────────────────────
    var iframeParams = new URLSearchParams();
    if (locationId) iframeParams.set('locationId', locationId);
    if (config.webhookUrl) iframeParams.set('webhookUrl', config.webhookUrl);

    // Pass through additional parent params
    ['studioType', 'studio_type', 'package', 'theme'].forEach(function(key) {
        var val = parentParams.get(key);
        if (val) iframeParams.set(key, val);
    });

    var basePath = config.baseUrl
        ? config.baseUrl + '/onboarding.html'
        : 'onboarding.html';
    var paramString = iframeParams.toString();
    var iframeSrc = paramString ? basePath + '?' + paramString : basePath;

    // ── Create iframe ────────────────────────────────────
    function init() {
        var container = document.getElementById(config.containerId);
        if (!container) {
            console.warn('[TattooNOW Onboarding] Container #' + config.containerId + ' not found. Retrying...');
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', init);
            }
            return;
        }

        var iframe = document.createElement('iframe');
        iframe.id = 'tattoonow-onboarding-iframe';
        iframe.src = iframeSrc;
        iframe.style.cssText = 'width:100%;height:100vh;border:none;display:block;';
        iframe.setAttribute('allow', 'clipboard-write; encrypted-media');
        iframe.setAttribute('allowfullscreen', 'true');

        container.innerHTML = '';
        container.style.cssText = 'width:100%;min-height:100vh;overflow:hidden;';
        container.appendChild(iframe);

        console.log('[TattooNOW Onboarding] Embedded:', iframeSrc);
    }

    // ── Listen for postMessage from iframe ───────────────
    window.addEventListener('message', function(event) {
        if (!event.data || event.data.source !== 'tattoonow-onboarding') return;

        var evtType = event.data.event;
        var evtData = event.data.data || {};

        console.log('[TattooNOW Onboarding] Event:', evtType, evtData);

        switch (evtType) {
            case 'priorities_selected':
                if (typeof config.onPrioritiesSelected === 'function') {
                    config.onPrioritiesSelected(evtData);
                }
                break;
            case 'task_completed':
                if (typeof config.onTaskComplete === 'function') {
                    config.onTaskComplete(evtData);
                }
                break;
            case 'onboarding_complete':
                if (typeof config.onComplete === 'function') {
                    config.onComplete(evtData);
                }
                break;
        }
    });

    // ── Expose global API ────────────────────────────────
    window.TattooNOWOnboarding = {
        config: config,
        locationId: locationId,
        getIframe: function() {
            return document.getElementById('tattoonow-onboarding-iframe');
        },
        reload: function() {
            var iframe = this.getIframe();
            if (iframe) iframe.src = iframeSrc;
        },
    };

    // ── Initialize ───────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
