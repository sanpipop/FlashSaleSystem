export function getHomeScripts(): string {
  return `
    // State in memory only (never saved to localStorage / sessionStorage)
    let inMemoryToken = null;
    let inMemoryUserId = null;

    function setUserId(userId) {
      document.getElementById('user-id-input').value = userId;
    }

    function showAlert(message, type = 'success') {
      const banner = document.getElementById('alert-banner');
      banner.style.display = 'block';
      if (type === 'success') {
        banner.style.background = 'rgba(16, 185, 129, 0.15)';
        banner.style.color = '#34d399';
        banner.style.border = '1px solid rgba(16, 185, 129, 0.3)';
      } else if (type === 'warning' || type === 'processing') {
        banner.style.background = 'rgba(6, 182, 212, 0.15)';
        banner.style.color = '#22d3ee';
        banner.style.border = '1px solid rgba(6, 182, 212, 0.3)';
      } else {
        banner.style.background = 'rgba(244, 63, 94, 0.15)';
        banner.style.color = '#fb7185';
        banner.style.border = '1px solid rgba(244, 63, 94, 0.3)';
      }
      banner.innerHTML = message;
      setTimeout(() => {
        banner.style.display = 'none';
      }, 7000);
    }

    function appendLog(status, method, url, data, latencyMs, reqId) {
      const logContainer = document.getElementById('console-log');
      const item = document.createElement('div');
      item.className = 'log-item log-' + status;

      const time = new Date().toLocaleTimeString();
      const statusClass = status >= 200 && status < 300 ? 'color: #34d399;' : 'color: #fb7185;';

      item.innerHTML = \`
        <div>
          <span style="color: var(--text-muted); margin-right: 0.5rem;">\${time}</span>
          <strong style="\${statusClass}">[\${status}]</strong>
          <span style="font-weight: 600; margin-left: 0.25rem;">\${method} \${url}</span>
          <span style="color: var(--text-muted); margin-left: 0.5rem;">(\${latencyMs}ms)</span>
          <div style="margin-top: 0.25rem; color: #cbd5e1; word-break: break-all;">\${JSON.stringify(data)}</div>
        </div>
        <div style="font-size: 0.6875rem; color: var(--text-muted); text-align: right;">
          ReqID: \${reqId ? reqId.substring(0, 8) + '...' : '-'}
        </div>
      \`;

      logContainer.prepend(item);
    }

    function clearLogs() {
      document.getElementById('console-log').innerHTML = '<div style="color: var(--text-muted); text-align: center;">Console cleared.</div>';
    }

    async function requestJwtToken() {
      const userId = document.getElementById('user-id-input').value.trim();
      if (!userId) {
        showAlert('Please enter a User ID', 'error');
        return;
      }

      const btn = document.getElementById('btn-get-token');
      btn.disabled = true;
      btn.innerText = 'Requesting...';

      const startTime = performance.now();
      try {
        const response = await fetch('/api/v1/auth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });

        const latency = Math.round(performance.now() - startTime);
        const reqId = response.headers.get('x-request-id');
        const data = await response.json();

        appendLog(response.status, 'POST', '/api/v1/auth/token', data, latency, reqId);

        if (response.ok && data.accessToken) {
          inMemoryToken = data.accessToken;
          inMemoryUserId = userId;

          document.getElementById('session-user-label').innerHTML = \`🟢 Authenticated: <strong>\${userId}</strong>\`;
          document.getElementById('session-user-label').style.color = 'var(--accent-emerald)';
          document.getElementById('session-token-label').innerText = 'Bearer ' + data.accessToken.substring(0, 16) + '... (In Memory)';
          document.getElementById('btn-clear-token').style.display = 'inline-flex';

          showAlert(\`✅ Authentication successful for <strong>\${userId}</strong> (Token active in memory)\`, 'success');
        } else {
          showAlert('Failed to get token: ' + (data.message || 'Unknown error'), 'error');
        }
      } catch (err) {
        showAlert('Network error: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerText = 'Get Token';
      }
    }

    function clearToken() {
      inMemoryToken = null;
      inMemoryUserId = null;
      document.getElementById('session-user-label').innerText = 'Not Authenticated';
      document.getElementById('session-user-label').style.color = 'var(--text-muted)';
      document.getElementById('session-token-label').innerText = 'No Bearer Token in memory';
      document.getElementById('btn-clear-token').style.display = 'none';
      showAlert('Session cleared.', 'warning');
    }

    async function loadProducts() {
      const container = document.getElementById('products-container');
      const startTime = performance.now();

      try {
        const response = await fetch('/api/v1/products?page=1&limit=20');
        const latency = Math.round(performance.now() - startTime);
        const reqId = response.headers.get('x-request-id');
        const result = await response.json();

        appendLog(response.status, 'GET', '/api/v1/products?page=1&limit=20', { total: result?.meta?.total, count: result?.data?.length }, latency, reqId);

        if (response.ok && Array.isArray(result.data)) {
          if (result.data.length === 0) {
            container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">No products found.</div>';
            return;
          }

          container.innerHTML = result.data.map(p => {
            const isFlash = p.isFlashSaleActive;
            const remaining = Number(p.remainingStock ?? 0);
            const total = Number(p.availableStock ?? 50);
            const percent = total > 0 ? Math.max(0, Math.min(100, Math.round((remaining / total) * 100))) : 0;
            const stockColorClass = percent > 40 ? 'stock-high' : (percent > 0 ? 'stock-low' : 'stock-out');

            return \`
              <div class="product-card" id="card-\${p.productId}">
                <div>
                  <div class="product-header">
                    <span class="product-id">\${p.productId}</span>
                    <span class="\${isFlash ? 'tag-active' : 'tag-inactive'}">\${isFlash ? '🔥 FLASH SALE' : '⚪ REGULAR'}</span>
                  </div>
                  <div class="product-name">\${p.name}</div>
                  <div class="product-price">฿\${Number(p.price).toLocaleString()}</div>
                  <div class="stock-bar-container">
                    <div class="stock-label">
                      <span>Stock: <strong>\${remaining}</strong> / \${total}</span>
                      <span>\${percent}%</span>
                    </div>
                    <div class="stock-progress-bg">
                      <div class="stock-progress-fill \${stockColorClass}" style="width: \${percent}%;"></div>
                    </div>
                  </div>
                </div>
                <button class="btn \${isFlash && remaining > 0 ? 'btn-primary' : 'btn-secondary'}" 
                        \${!isFlash || remaining <= 0 ? 'disabled' : ''} 
                        onclick="orderProduct('\${p.productId}', '\${p.name}')">
                  \${remaining <= 0 ? 'Sold Out' : (isFlash ? '⚡ Buy Now' : 'Sale Inactive')}
                </button>
              </div>
            \`;
          }).join('');
        } else {
          container.innerHTML = \`<div style="grid-column: 1/-1; text-align: center; color: var(--accent-rose); padding: 2rem;">Failed to load products: \${result.message || 'Unknown error'}</div>\`;
        }
      } catch (err) {
        container.innerHTML = \`<div style="grid-column: 1/-1; text-align: center; color: var(--accent-rose); padding: 2rem;">Network error: \${err.message}</div>\`;
      }
    }

    async function orderProduct(productId, productName) {
      if (!inMemoryToken) {
        showAlert('🔒 Please request a JWT Token first before placing an order!', 'error');
        document.getElementById('user-id-input').focus();
        return;
      }

      const card = document.getElementById('card-' + productId);
      const buyBtn = card ? card.querySelector('button') : null;
      if (buyBtn) buyBtn.disabled = true;

      const startTime = performance.now();

      try {
        const response = await fetch('/api/v1/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + inMemoryToken,
          },
          body: JSON.stringify({ productId }),
        });

        const latency = Math.round(performance.now() - startTime);
        const reqId = response.headers.get('x-request-id');
        const data = await response.json();

        appendLog(response.status, 'POST', '/api/v1/orders', data, latency, reqId);

        if (response.status === 202) {
          showAlert(\`📥 <strong>202 Accepted!</strong> Order for <strong>\${productId}</strong> admitted into Queue. Job ID: <code>\${data.orderJobId}</code> (Background Worker will execute DB transaction)\`, 'processing');
          setTimeout(loadProducts, 1500);
        } else if (response.status === 409) {
          showAlert(\`⚠️ <strong>409 Conflict:</strong> \${data.message || 'Duplicate admission in progress / already claimed'}\`, 'warning');
        } else if (response.status === 422) {
          showAlert(\`🚫 <strong>422 Unprocessable:</strong> \${data.message || 'Flash sale inactive or item out of stock'}\`, 'error');
        } else if (response.status === 401) {
          showAlert('🔒 <strong>401 Unauthorized:</strong> Invalid or expired token. Please get a new token.', 'error');
        } else {
          showAlert(\`❌ <strong>[\${response.status}]</strong> \${data.message || 'Order failed'}\`, 'error');
        }
      } catch (err) {
        showAlert('Network error: ' + err.message, 'error');
      } finally {
        if (buyBtn) buyBtn.disabled = false;
      }
    }

    // Initialize on page load
    document.addEventListener('DOMContentLoaded', () => {
      loadProducts();
    });
  `;
}
