export function getHomeLayout(instanceId: string): string {
  return `
  <header>
    <div class="brand">
      <div class="brand-icon">⚡</div>
      <div>
        <div class="brand-title">Flash Sale System</div>
        <div class="brand-subtitle">High-Concurrency API Playground</div>
      </div>
    </div>
    <div class="header-badges">
      <div class="badge badge-node">
        <span>Node:</span>
        <strong id="node-id">${instanceId}</strong>
      </div>
      <div class="badge">
        <div class="badge-dot"></div>
        <span id="system-status">Nginx Connected</span>
      </div>
    </div>
  </header>

  <main class="container">

    <!-- Alert / Toast Banner -->
    <div id="alert-banner"></div>

    <!-- Section 1: Authentication Simulation -->
    <section class="card">
      <div class="card-header">
        <div class="card-title">🔑 1. User Identity & JWT Authentication (POST /api/v1/auth/token)</div>
        <span style="font-size: 0.75rem; color: var(--text-muted);">Memory-Only Session (No Storage)</span>
      </div>
      <div class="auth-grid">
        <div>
          <label style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem; display: block;">User ID (e.g. user-001)</label>
          <div class="input-group">
            <input type="text" id="user-id-input" value="user-001" placeholder="Enter User ID">
            <button class="btn btn-primary" id="btn-get-token" onclick="requestJwtToken()">Get Token</button>
          </div>
          <div class="preset-chips">
            <span style="font-size: 0.75rem; color: var(--text-muted); align-self: center;">Quick fill:</span>
            <button class="chip" onclick="setUserId('user-001')">user-001</button>
            <button class="chip" onclick="setUserId('user-002')">user-002</button>
            <button class="chip" onclick="setUserId('user-003')">user-003</button>
            <button class="chip" onclick="setUserId('user-500')">user-500</button>
          </div>
        </div>
        <div>
          <label style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem; display: block;">Active Token Status</label>
          <div class="token-status-box">
            <div class="token-status-text">
              <span id="session-user-label" style="font-weight: 600; color: var(--text-muted);">Not Authenticated</span>
              <span id="session-token-label" style="font-family: monospace; font-size: 0.6875rem; color: var(--text-muted);">No Bearer Token in memory</span>
            </div>
            <button class="btn btn-danger" id="btn-clear-token" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; display: none;" onclick="clearToken()">Clear</button>
          </div>
        </div>
      </div>
    </section>

    <!-- Section 2: Products & Live Flash Sale Grid -->
    <section class="card">
      <div class="card-header">
        <div class="card-title">🛍️ 2. Flash Sale Catalog (GET /api/v1/products & POST /api/v1/orders)</div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="loadProducts()">🔄 Refresh Products</button>
        </div>
      </div>

      <div style="margin-bottom: 1rem; font-size: 0.8125rem; color: var(--text-muted); background: rgba(99, 102, 241, 0.08); border-left: 3px solid var(--accent-primary); padding: 0.5rem 0.75rem; border-radius: 0.25rem;">
        ⚡ <strong>Order Rule:</strong> กดสั่งซื้อจะส่ง <code>POST /api/v1/orders</code> พร้อม Bearer Token และ <code>{ productId }</code> โดยตรง หากได้รับ <strong>202 Accepted</strong> หมายถึงงานเข้าสู่ BullMQ Queue เรียบร้อยแล้ว (การตัดสต็อกจริงขึ้นอยู่กับ Worker)
      </div>

      <div class="products-grid" id="products-container">
        <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">Loading products from API...</div>
      </div>
    </section>

    <!-- Section 3: Live Activity / Response Console -->
    <section class="card">
      <div class="card-header">
        <div class="card-title">📟 3. Live Request Console</div>
        <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="clearLogs()">Clear Log</button>
      </div>
      <div class="console-log" id="console-log">
        <div style="color: var(--text-muted); text-align: center;">Console ready. Perform actions to see live HTTP responses.</div>
      </div>
    </section>

    <!-- Section 4: System Links & Docs -->
    <section class="card">
      <div class="card-header">
        <div class="card-title">🌐 4. System Quick Links</div>
      </div>
      <div class="links-grid">
        <a href="/health" target="_blank" class="link-card">
          <div class="link-card-title">🩺 Health Endpoint</div>
          <div class="link-card-desc">GET /health (Cluster Health & Instance ID)</div>
        </a>
        <a href="/admin/queues" target="_blank" class="link-card">
          <div class="link-card-title">📊 Bull Board Dashboard</div>
          <div class="link-card-desc">/admin/queues (Monitor BullMQ Jobs & Backlog)</div>
        </a>
        <a href="/api/v1/products?page=1&limit=10" target="_blank" class="link-card">
          <div class="link-card-title">📦 Raw Products JSON</div>
          <div class="link-card-desc">GET /api/v1/products (Cache-Aside Endpoint)</div>
        </a>
      </div>
    </section>

  </main>
  `;
}
