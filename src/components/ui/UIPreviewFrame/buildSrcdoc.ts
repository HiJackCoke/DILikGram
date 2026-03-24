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
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
    /* Smooth scrollbar */
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 99px; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    ${code}
    ReactDOM.createRoot(document.getElementById('root')).render(<App />);
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
