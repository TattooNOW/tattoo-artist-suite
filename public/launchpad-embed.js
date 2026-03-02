/**
 * TattooNOW Launchpad Checklist — HighLevel Embed Script
 *
 * Usage: Add to a HighLevel custom page (Custom Code element or HTML block):
 *
 *   <div id="tattoonow-launchpad"></div>
 *   <script src="https://YOUR_DOMAIN/launchpad-embed.js"></script>
 *
 * Or with options:
 *
 *   <div id="tattoonow-launchpad"></div>
 *   <script>
 *     window.TattooNOWLaunchpadConfig = {
 *       containerId: 'tattoonow-launchpad',        // default
 *       baseUrl: 'https://YOUR_DOMAIN',             // where launchpad-checklist.html is hosted
 *       webhookUrl: 'https://your-n8n-or-ghl-webhook-url',  // optional
 *       onStepComplete: function(data) { console.log('Step done:', data); },
 *       onAllComplete: function(data) { console.log('All done:', data); },
 *     };
 *   </script>
 *   <script src="https://YOUR_DOMAIN/launchpad-embed.js"></script>
 */
(function() {
    'use strict';

    // ── Configuration ────────────────────────────────────
    const defaults = {
        containerId: 'tattoonow-launchpad',
        baseUrl: '',   // Auto-detect from script src if empty
        webhookUrl: '',
        onStepComplete: null,
        onAllComplete: null,
        onSkipped: null,
    };

    const config = Object.assign({}, defaults, window.TattooNOWLaunchpadConfig || {});

    // ── Auto-detect base URL from this script's src ──────
    if (!config.baseUrl) {
        try {
            const scripts = document.getElementsByTagName('script');
            for (let i = scripts.length - 1; i >= 0; i--) {
                const src = scripts[i].src || '';
                if (src.includes('launchpad-embed')) {
                    config.baseUrl = src.substring(0, src.lastIndexOf('/'));
                    break;
                }
            }
        } catch (e) { /* fallback to relative */ }
    }

    // ── Extract locationId from parent page URL ──────────
    // HighLevel custom pages include ?location_id= or ?locationId= in the URL
    const parentParams = new URLSearchParams(window.location.search);
    const locationId = parentParams.get('locationId')
        || parentParams.get('location_id')
        || parentParams.get('locationID')
        || parentParams.get('loc')
        || '';

    // ── Build iframe src ─────────────────────────────────
    const iframeParams = new URLSearchParams();
    if (locationId) iframeParams.set('locationId', locationId);
    if (config.webhookUrl) iframeParams.set('webhookUrl', config.webhookUrl);

    // Pass through any additional parent params that might be useful
    ['studioType', 'studio_type', 'package', 'theme'].forEach(function(key) {
        const val = parentParams.get(key);
        if (val) iframeParams.set(key, val);
    });

    const basePath = config.baseUrl
        ? config.baseUrl + '/launchpad-checklist.html'
        : 'launchpad-checklist.html';
    const iframeSrc = basePath + '?' + iframeParams.toString();

    // ── Create iframe ────────────────────────────────────
    function init() {
        const container = document.getElementById(config.containerId);
        if (!container) {
            console.warn('[TattooNOW Launchpad] Container #' + config.containerId + ' not found. Retrying...');
            // Retry once after DOM is ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', init);
            }
            return;
        }

        const iframe = document.createElement('iframe');
        iframe.id = 'tattoonow-launchpad-iframe';
        iframe.src = iframeSrc;
        iframe.style.cssText = 'width:100%;height:100vh;border:none;display:block;';
        iframe.setAttribute('allow', 'clipboard-write; encrypted-media');
        iframe.setAttribute('allowfullscreen', 'true');

        container.innerHTML = '';
        container.style.cssText = 'width:100%;min-height:100vh;overflow:hidden;';
        container.appendChild(iframe);

        console.log('[TattooNOW Launchpad] Embedded:', iframeSrc);
    }

    // ── Listen for postMessage from iframe ───────────────
    window.addEventListener('message', function(event) {
        // Only handle messages from our launchpad
        if (!event.data || event.data.source !== 'tattoonow-launchpad') return;

        var evtType = event.data.event;
        var evtData = event.data.data || {};

        console.log('[TattooNOW Launchpad] Event:', evtType, evtData);

        switch (evtType) {
            case 'step_completed':
                if (typeof config.onStepComplete === 'function') {
                    config.onStepComplete(evtData);
                }
                break;
            case 'onboarding_complete':
                if (typeof config.onAllComplete === 'function') {
                    config.onAllComplete(evtData);
                }
                break;
            case 'setup_skipped':
                if (typeof config.onSkipped === 'function') {
                    config.onSkipped(evtData);
                }
                break;
        }
    });

    // ── Expose global API ────────────────────────────────
    window.TattooNOWLaunchpad = {
        config: config,
        locationId: locationId,
        getIframe: function() {
            return document.getElementById('tattoonow-launchpad-iframe');
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
