/**
 * Builds the srcdoc HTML string for the UIPreviewFrame iframe.
 *
 * Injects React, ReactDOM, Babel standalone, and Tailwind CDN so the
 * AI-generated component code runs without a build step.
 *
 * The generated component must follow the contract:
 *   - Named export: function App() { ... }
 *   - No import statements
 *   - React.* prefix on all hooks
 */
export function buildSrcdoc(code: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
    /* Smooth scrollbar */
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 99px; }
    #__dg_hl__ { pointer-events: none; transition: top 0.12s ease, left 0.12s ease, width 0.12s ease, height 0.12s ease, opacity 0.12s ease; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    ${
      // Strip any residual @dg-components metadata block before Babel parses the code.
      // Closed: /* @dg-components ... */  Unterminated: /* @dg-components ... <EOF>
      code
        .replace(/\/\*\s*@dg-components[\s\S]*?\*\//g, "")
        .replace(/\/\*\s*@dg-components[\s\S]*$/, "")
        .trim()
    }
    ReactDOM.createRoot(document.getElementById('root')).render(<App />);
  </script>
  <script>
    window.addEventListener('message', function(e) {
      var old = document.getElementById('__dg_hl__');
      if (old) old.remove();
      if (e.data && e.data.type === 'DG_HIGHLIGHT' && e.data.componentKey) {
        var key = e.data.componentKey;
        var isPhantom = e.data.highlightType === 'phantom';
        var stroke = isPhantom ? 'rgba(239,68,68,0.95)' : 'rgba(99,102,241,0.95)';
        var glow   = isPhantom ? 'rgba(239,68,68,0.25)' : 'rgba(99,102,241,0.25)';
        var fill   = isPhantom ? 'rgba(239,68,68,0.04)' : 'rgba(99,102,241,0.04)';
        var el = document.querySelector('[data-dg-component="' + key + '"]');
        if (el) {
          var r = el.getBoundingClientRect();
          var pad = 5;
          var margin = 2; // min distance from viewport edge so border is always visible
          var vpW = document.documentElement.clientWidth;
          var vpH = document.documentElement.clientHeight;
          // Clamp overlay to viewport so left/right borders are never clipped
          var ovLeft   = Math.max(margin,        r.left   - pad);
          var ovTop    = Math.max(margin,        r.top    - pad);
          var ovRight  = Math.min(vpW - margin,  r.right  + pad);
          var ovBottom = Math.min(vpH - margin,  r.bottom + pad);
          var ov = document.createElement('div');
          ov.id = '__dg_hl__';
          ov.setAttribute('aria-hidden', 'true');
          ov.style.cssText =
            'position:fixed;pointer-events:none;z-index:9999;' +
            'top:'    + ovTop              + 'px;' +
            'left:'   + ovLeft             + 'px;' +
            'width:'  + (ovRight - ovLeft) + 'px;' +
            'height:' + (ovBottom - ovTop) + 'px;' +
            'border:2.5px solid ' + stroke + ';' +
            'border-radius:8px;' +
            'background:' + fill + ';' +
            'box-shadow:0 0 0 4px ' + glow + ';';
          document.body.appendChild(ov);
        }
      }
    });
  </script>
  <script>
    // Relay runtime errors back to parent for display in dev page
    window.addEventListener('error', function(e) {
      window.parent.postMessage({ type: 'preview-error', message: e.message, filename: e.filename, lineno: e.lineno }, '*');
    });
  </script>
</body>
</html>`;
}
