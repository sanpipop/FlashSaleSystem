export function getHomeStyles(): string {
  return `
    :root {
      --bg-base: #090d16;
      --bg-surface: #111827;
      --bg-card: #1a2234;
      --bg-card-hover: #222d44;
      --border-subtle: #243047;
      --border-focus: #4f46e5;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --accent-primary: #6366f1;
      --accent-primary-hover: #4f46e5;
      --accent-cyan: #06b6d4;
      --accent-emerald: #10b981;
      --accent-amber: #f59e0b;
      --accent-rose: #f43f5e;
      --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--font-family);
      background-color: var(--bg-base);
      color: var(--text-main);
      line-height: 1.5;
      min-height: 100vh;
      padding-bottom: 3rem;
    }

    /* Header */
    header {
      background: rgba(17, 24, 39, 0.85);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border-subtle);
      position: sticky;
      top: 0;
      z-index: 50;
      padding: 0.875rem 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .brand-icon {
      background: linear-gradient(135deg, #f59e0b, #ef4444);
      color: #fff;
      font-size: 1.25rem;
      width: 2.25rem;
      height: 2.25rem;
      border-radius: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      box-shadow: 0 0 15px rgba(245, 158, 11, 0.4);
    }

    .brand-title {
      font-size: 1.125rem;
      font-weight: 700;
      letter-spacing: -0.025em;
    }

    .brand-subtitle {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .header-badges {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.25rem 0.625rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      border: 1px solid var(--border-subtle);
      background: var(--bg-surface);
    }

    .badge-dot {
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 9999px;
      background-color: var(--accent-emerald);
      box-shadow: 0 0 8px var(--accent-emerald);
    }

    .badge-node {
      background: rgba(99, 102, 241, 0.15);
      border-color: rgba(99, 102, 241, 0.3);
      color: #818cf8;
    }

    /* Container */
    .container {
      max-width: 1200px;
      margin: 1.5rem auto;
      padding: 0 1rem;
      display: grid;
      gap: 1.5rem;
    }

    /* Cards */
    .card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 0.75rem;
      padding: 1.25rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--border-subtle);
    }

    .card-title {
      font-size: 1rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    /* Auth Playground */
    .auth-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      align-items: center;
    }

    @media (max-width: 768px) {
      .auth-grid {
        grid-template-columns: 1fr;
      }
    }

    .input-group {
      display: flex;
      gap: 0.5rem;
    }

    input[type="text"] {
      background: var(--bg-base);
      border: 1px solid var(--border-subtle);
      color: var(--text-main);
      padding: 0.5rem 0.75rem;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      width: 100%;
      outline: none;
      transition: border-color 0.15s;
    }

    input[type="text"]:focus {
      border-color: var(--border-focus);
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.375rem;
      padding: 0.5rem 1rem;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: all 0.15s;
      white-space: nowrap;
    }

    .btn-primary {
      background: var(--accent-primary);
      color: #fff;
    }

    .btn-primary:hover:not(:disabled) {
      background: var(--accent-primary-hover);
      box-shadow: 0 0 12px rgba(99, 102, 241, 0.4);
    }

    .btn-secondary {
      background: var(--bg-card);
      color: var(--text-main);
      border: 1px solid var(--border-subtle);
    }

    .btn-secondary:hover:not(:disabled) {
      background: var(--bg-card-hover);
    }

    .btn-danger {
      background: rgba(244, 63, 94, 0.15);
      color: #fb7185;
      border: 1px solid rgba(244, 63, 94, 0.3);
    }

    .btn-danger:hover:not(:disabled) {
      background: rgba(244, 63, 94, 0.25);
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .preset-chips {
      display: flex;
      gap: 0.375rem;
      margin-top: 0.5rem;
      flex-wrap: wrap;
    }

    .chip {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      color: var(--text-muted);
      font-size: 0.75rem;
      padding: 0.125rem 0.5rem;
      border-radius: 0.25rem;
      cursor: pointer;
      transition: all 0.15s;
    }

    .chip:hover {
      color: var(--text-main);
      border-color: var(--border-focus);
    }

    .token-status-box {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 0.375rem;
      padding: 0.75rem;
      font-size: 0.8125rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .token-status-text {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }

    /* Products Grid */
    .products-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 1rem;
    }

    .product-card {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 0.5rem;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: transform 0.15s, border-color 0.15s;
    }

    .product-card:hover {
      transform: translateY(-2px);
      border-color: var(--border-focus);
    }

    .product-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.5rem;
    }

    .product-id {
      font-family: monospace;
      font-size: 0.75rem;
      color: var(--accent-cyan);
      background: rgba(6, 182, 212, 0.1);
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
    }

    .product-name {
      font-weight: 600;
      font-size: 0.9375rem;
      margin-bottom: 0.25rem;
    }

    .product-price {
      font-size: 1.125rem;
      font-weight: 700;
      color: var(--accent-amber);
      margin-bottom: 0.75rem;
    }

    .stock-bar-container {
      margin-bottom: 0.75rem;
    }

    .stock-label {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-bottom: 0.25rem;
    }

    .stock-progress-bg {
      background: var(--bg-base);
      height: 0.375rem;
      border-radius: 9999px;
      overflow: hidden;
    }

    .stock-progress-fill {
      height: 100%;
      border-radius: 9999px;
      transition: width 0.3s ease;
    }

    .stock-high { background-color: var(--accent-emerald); }
    .stock-low { background-color: var(--accent-amber); }
    .stock-out { background-color: var(--accent-rose); }

    .tag-active {
      font-size: 0.6875rem;
      font-weight: 600;
      color: #34d399;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
    }

    .tag-inactive {
      font-size: 0.6875rem;
      font-weight: 600;
      color: #f87171;
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
    }

    /* Console / Feed */
    .console-log {
      background: var(--bg-base);
      border: 1px solid var(--border-subtle);
      border-radius: 0.375rem;
      padding: 0.75rem;
      font-family: monospace;
      font-size: 0.75rem;
      max-height: 220px;
      overflow-y: auto;
      display: flex;
      flex-direction: column-reverse;
      gap: 0.375rem;
    }

    .log-item {
      padding: 0.25rem 0.375rem;
      border-radius: 0.25rem;
      display: flex;
      justify-content: space-between;
      border-left: 3px solid var(--border-subtle);
    }

    .log-200 { border-left-color: var(--accent-emerald); background: rgba(16, 185, 129, 0.05); }
    .log-202 { border-left-color: var(--accent-cyan); background: rgba(6, 182, 212, 0.08); }
    .log-400, .log-401, .log-404, .log-409, .log-422 { border-left-color: var(--accent-amber); background: rgba(245, 158, 11, 0.05); }
    .log-500, .log-503 { border-left-color: var(--accent-rose); background: rgba(244, 63, 94, 0.08); }

    /* Quick Links */
    .links-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 0.75rem;
    }

    .link-card {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 0.375rem;
      padding: 0.75rem;
      color: var(--text-main);
      text-decoration: none;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      transition: all 0.15s;
    }

    .link-card:hover {
      border-color: var(--border-focus);
      background: var(--bg-card-hover);
    }

    .link-card-title {
      font-size: 0.875rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }

    .link-card-desc {
      font-size: 0.6875rem;
      color: var(--text-muted);
    }

    /* Modal / Alert Banner */
    #alert-banner {
      display: none;
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
      margin-bottom: 1rem;
      font-size: 0.875rem;
      font-weight: 500;
      animation: fadeIn 0.2s ease-in;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
}
