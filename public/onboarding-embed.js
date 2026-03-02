/**
 * TattooNOW Onboarding — HighLevel Embed Script (fetch-and-inject)
 *
 * Fetches onboarding.html from n8n (or GitHub Pages) and injects it
 * inline into the HighLevel page. CSS is scoped under .tnow-onboarding
 * so it won't leak into the host page.
 *
 * === QUICK EMBED (inline snippet for HighLevel page) ===
 *
 *   <div id="tnow-onboarding-loader"></div>
 *   <script>
 *   fetch('https://tn.reinventingai.com/webhook/YOUR_WEBHOOK_ID?file=onboarding')
 *     .then(function(r) { return r.text(); })
 *     .then(function(html) {
 *       var c = document.getElementById('tnow-onboarding-loader');
 *       c.innerHTML = html;
 *       c.querySelectorAll('script').forEach(function(old) {
 *         var s = document.createElement('script');
 *         s.textContent = old.textContent;
 *         old.parentNode.replaceChild(s, old);
 *       });
 *     });
 *   </script>
 *
 * === SCRIPT EMBED (using this file) ===
 *
 *   <div id="tnow-onboarding-loader"></div>
 *   <script>
 *     window.TattooNOWOnboardingConfig = {
 *       // REQUIRED: URL that returns the onboarding HTML
 *       fetchUrl: 'https://tn.reinventingai.com/webhook/YOUR_WEBHOOK_ID?file=onboarding',
 *       // Optional overrides:
 *       containerId: 'tnow-onboarding-loader',  // default
 *       webhookUrl: '',                           // n8n webhook for form submissions
 *     };
 *   </script>
 *   <script src="https://YOUR_DOMAIN/onboarding-embed.js"></script>
 */
(function() {
    'use strict';

    var defaults = {
        containerId: 'tnow-onboarding-loader',
        fetchUrl: '',
        webhookUrl: '',
    };

    var config = Object.assign({}, defaults, window.TattooNOWOnboardingConfig || {});

    if (!config.fetchUrl) {
        console.error('[TattooNOW Onboarding] No fetchUrl configured. Set window.TattooNOWOnboardingConfig.fetchUrl');
        return;
    }

    // Append URL params (locationId, webhookUrl, etc.) to the fetch URL
    var parentParams = new URLSearchParams(window.location.search);
    var locationId = parentParams.get('locationId')
        || parentParams.get('location_id')
        || parentParams.get('locationID')
        || parentParams.get('loc')
        || '';

    // Build params to append to the page URL so the injected script can read them
    var extraParams = new URLSearchParams(window.location.search);
    if (locationId && !extraParams.has('locationId')) {
        extraParams.set('locationId', locationId);
    }
    if (config.webhookUrl && !extraParams.has('webhookUrl')) {
        extraParams.set('webhookUrl', config.webhookUrl);
    }

    function init() {
        var container = document.getElementById(config.containerId);
        if (!container) {
            console.warn('[TattooNOW Onboarding] Container #' + config.containerId + ' not found. Retrying...');
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', init);
            }
            return;
        }

        fetch(config.fetchUrl)
            .then(function(r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.text();
            })
            .then(function(html) {
                container.innerHTML = html;

                // Re-execute scripts (innerHTML doesn't run <script> tags)
                container.querySelectorAll('script').forEach(function(old) {
                    var s = document.createElement('script');
                    s.textContent = old.textContent;
                    old.parentNode.replaceChild(s, old);
                });

                console.log('[TattooNOW Onboarding] Loaded and injected');
            })
            .catch(function(err) {
                console.error('[TattooNOW Onboarding] Failed to load:', err);
                container.innerHTML = '<p style="color:#999;text-align:center;padding:2rem;">Onboarding is temporarily unavailable. Please refresh or try again later.</p>';
            });
    }

    // ── Expose global API ────────────────────────────────
    window.TattooNOWOnboarding = {
        config: config,
        locationId: locationId,
        reload: init,
    };

    // ── Initialize ───────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
