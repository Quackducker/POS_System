import { supabase } from '../supabase.js';

const app = document.querySelector('#app');
const fileName = window.location.pathname.split('/').pop();
const page = fileName === '' || fileName === 'index.html' ? 'dashboard' : fileName.replace('.html', '');
const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const cart = [];
let sessionProfile = null;

const pageInfo = {
  dashboard: ['OVERVIEW', 'Dashboard', 'Your store activity and inventory at a glance.'],
  products: ['CATALOG', 'Products', 'Manage products and monitor inventory.'],
  customers: ['RELATIONSHIPS', 'Customers', 'Register and manage customer records.'],
  sales: ['TRANSACTIONS', 'Point of sale', 'Build a cart, process payment, and complete a sale.'],
  history: ['TRANSACTIONS', 'Sales history', 'Search and reprint completed transactions.'],
  receipt: ['TRANSACTION', 'Receipt', 'Review or print a completed sale.'],
  reports: ['PERFORMANCE', 'Sales reports', 'Review sales, products, categories, and payment activity.'],
  users: ['TEAM', 'Users', 'Manage POS roles and access.'],
  login: ['WELCOME', 'Welcome back', 'Sign in to your store workspace.']
};

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function header(actions = '') {
  const [eyebrow, title, description] = pageInfo[page] || ['POS SYSTEM', 'Point of sale', ''];
  document.title = `${title} | POS System`;
  return `<header class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="page-description">${description}</p></div>${actions ? `<div class="page-actions">${actions}</div>` : ''}</header>`;
}

function metric(label, value, detail, tone = '') {
  return `<article class="metric ${tone}"><p>${label}</p><strong>${value}</strong><span>${detail}</span></article>`;
}

function failure(message) {
  return `<div class="empty-state"><span class="empty-symbol">!</span><h2>Could not load data</h2><p>${escapeHtml(message)}</p></div>`;
}

async function loadProfile() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
  if (error || !data) return null;
  if (data.active === false) {
    await supabase.auth.signOut();
    return null;
  }
  sessionProfile = data;
  return session;
}

function canAccess(targetPage) {
  const role = sessionProfile?.role || 'Cashier';
  const access = {
    dashboard: ['Administrator', 'Manager', 'Cashier', 'Inventory Staff'],
    products: ['Administrator', 'Manager', 'Inventory Staff'],
    customers: ['Administrator', 'Manager', 'Cashier'],
    sales: ['Administrator', 'Manager', 'Cashier'],
    history: ['Administrator', 'Manager', 'Cashier'],
    receipt: ['Administrator', 'Manager', 'Cashier'],
    reports: ['Administrator', 'Manager'],
    users: ['Administrator']
  };
  return (access[targetPage] || []).includes(role);
}

function accessDenied() {
  app.innerHTML = `${header()}<div class="empty-state"><span class="empty-symbol">!</span><h2>Access denied</h2><p>Your role does not have permission to open this module.</p><a class="button button-secondary" href="${page === 'dashboard' ? 'index.html' : '../index.html'}">Return to dashboard</a></div>`;
}

async function renderDashboard() {
  app.innerHTML = `${header('<a class="button button-primary" href="views/sales.html">Open POS</a>')}<section class="metric-grid" data-metrics><div class="loading-state">Loading dashboard</div></section><section class="dashboard-grid"><article class="data-panel"><div class="panel-heading"><div><h2>Recent sales</h2><p>Latest completed transactions</p></div><a class="text-link" href="views/history.html">View history →</a></div><div data-recent></div></article><aside class="quick-panel"><p class="eyebrow">SHORTCUTS</p><h2>Go to work</h2><a href="views/products.html"><span class="shortcut-symbol">▦</span><span><strong>Products</strong><small>Manage catalog and stock</small></span><b>→</b></a><a href="views/customers.html"><span class="shortcut-symbol">◉</span><span><strong>Customers</strong><small>Manage customer records</small></span><b>→</b></a><a href="views/reports.html"><span class="shortcut-symbol">▤</span><span><strong>Reports</strong><small>Review store performance</small></span><b>→</b></a></aside></section>`;
  const [productsResult, customersResult, salesResult] = await Promise.all([
    supabase.from('products').select('*'),
    supabase.from('customers').select('*'),
    supabase.from('sales').select('*').order('sale_date', { ascending: false })
  ]);
  if (productsResult.error || customersResult.error || salesResult.error) {
    app.querySelector('[data-metrics]').innerHTML = failure(productsResult.error?.message || customersResult.error?.message || salesResult.error?.message);
    return;
  }
  const products = productsResult.data || [];
  const customers = customersResult.data || [];
  const sales = salesResult.data || [];
  const today = new Date().toISOString().slice(0, 10);
  const todaySales = sales.filter(sale => String(sale.sale_date).startsWith(today));
  const todayTotal = todaySales.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0);
  const lowStock = products.filter(product => product.status === 'Active' && Number(product.quantity) <= Number(product.reorder_level)).length;
  app.querySelector('[data-metrics]').innerHTML = `
    ${metric("Today's sales", peso.format(todayTotal), `${todaySales.length} transactions`, 'metric-green')}
    ${metric('Products', products.length, `${lowStock} low stock`, 'metric-orange')}
    ${metric('Customers', customers.length, 'Registered records', 'metric-blue')}
    ${metric('Sales total', peso.format(sales.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0)), 'Available transactions', 'metric-lime')}`;
  app.querySelector('[data-recent]').innerHTML = sales.length
    ? `<div class="table-scroll"><table><thead><tr><th>Transaction</th><th>Date</th><th>Total</th><th>Status</th></tr></thead><tbody>${sales.slice(0, 5).map(sale => `<tr><td>${escapeHtml(sale.transaction_no)}</td><td>${escapeHtml(new Date(sale.sale_date).toLocaleString())}</td><td>${peso.format(Number(sale.total_amount))}</td><td>${escapeHtml(sale.status)}</td></tr>`).join('')}</tbody></table></div>`
    : '<div class="empty-state"><h2>No sales yet</h2></div>';
}

async function renderProducts() {
  app.innerHTML = `${header('<label class="search-box"><span class="search-icon">⌕</span><input type="search" data-search placeholder="Search products"></label>')}<section class="data-panel"><div class="panel-heading"><div><h2>Product details</h2><p>Add or update catalog items.</p></div></div><form class="sale-form" data-product-form><input type="hidden" name="product_id"><div class="field-grid"><label>Product code<input name="product_code" required></label><label>Product name<input name="product_name" required></label><label>Category<input name="category"></label><label>Price<input name="price" type="number" min="0" step="0.01" required></label><label>Cost<input name="cost" type="number" min="0" step="0.01" value="0"></label><label>Quantity<input name="quantity" type="number" min="0" step="1" value="0" required></label><label>Reorder level<input name="reorder_level" type="number" min="0" step="1" value="0"></label></div><button class="button button-primary" type="submit">Save product</button><button class="button button-secondary" type="button" data-reset>Clear</button><p class="form-message" data-message></p></form></section><section class="data-panel"><div class="panel-heading"><div><h2>Product catalog</h2><p data-count></p></div><span class="live-indicator">LIVE DATA</span></div><div data-table class="table-content"></div></section>`;
  const form = app.querySelector('[data-product-form]');
  const message = app.querySelector('[data-message]');
  let rows = [];
  async function load() {
    const { data, error } = await supabase.from('products').select('*').order('product_name');
    if (error) { app.querySelector('[data-table]').innerHTML = failure(error.message); return; }
    rows = data || [];
    renderTable(rows);
  }
  function renderTable(items) {
    app.querySelector('[data-count]').textContent = `${items.length} products`;
    app.querySelector('[data-table]').innerHTML = items.length ? `<div class="table-scroll"><table><thead><tr><th>Code</th><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Action</th></tr></thead><tbody>${items.map(item => `<tr><td>${escapeHtml(item.product_code)}</td><td>${escapeHtml(item.product_name)}</td><td>${escapeHtml(item.category || '—')}</td><td>${peso.format(Number(item.price))}</td><td>${Number(item.quantity) <= Number(item.reorder_level) ? `<strong class="stock-low">${item.quantity} Low</strong>` : item.quantity}</td><td><button class="button button-secondary" data-edit="${item.product_id}">Edit</button> <button class="button button-secondary" data-inactive="${item.product_id}">Deactivate</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state"><h2>No products found</h2></div>';
  }
  app.querySelector('[data-search]').addEventListener('input', event => {
    const term = event.target.value.trim().toLowerCase();
    renderTable(rows.filter(row => [row.product_code, row.product_name, row.category].join(' ').toLowerCase().includes(term)));
  });
  app.querySelector('[data-reset]').addEventListener('click', () => { form.reset(); form.elements.product_id.value = ''; });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(form);
    const id = data.get('product_id');
    const product = {
      product_code: String(data.get('product_code')).trim().toUpperCase(),
      product_name: String(data.get('product_name')).trim(),
      category: String(data.get('category')).trim() || null,
      price: Number(data.get('price')),
      cost: Number(data.get('cost')),
      quantity: Number(data.get('quantity')),
      reorder_level: Number(data.get('reorder_level')),
      status: 'Active'
    };
    if (!product.product_code || !product.product_name) { message.textContent = 'Product code and name are required.'; return; }
    if (product.price < 0 || product.quantity < 0 || product.reorder_level < 0) { message.textContent = 'Price and stock values cannot be negative.'; return; }
    const duplicate = rows.find(row => row.product_code === product.product_code && String(row.product_id) !== String(id));
    if (duplicate) { message.textContent = 'That product code already exists.'; return; }
    message.textContent = 'Saving…';
    const result = id
      ? await supabase.from('products').update(product).eq('product_id', id).select('*').single()
      : await supabase.from('products').insert(product).select('*').single();
    if (result.error) { message.textContent = result.error.message; return; }
    message.textContent = id ? 'Product updated.' : 'Product added.';
    form.reset(); form.elements.product_id.value = '';
    await load();
  });
  app.querySelector('[data-table]').addEventListener('click', async event => {
    const editId = event.target.dataset.edit;
    const inactiveId = event.target.dataset.inactive;
    if (editId) {
      const item = rows.find(row => String(row.product_id) === editId);
      if (!item) return;
      for (const name of ['product_code', 'product_name', 'category', 'price', 'cost', 'quantity', 'reorder_level']) form.elements[name].value = item[name] ?? '';
      form.elements.product_id.value = item.product_id;
      form.elements.product_code.focus();
    }
    if (inactiveId && window.confirm('Deactivate this product?')) {
      await supabase.from('products').update({ status: 'Inactive' }).eq('product_id', inactiveId);
      await load();
    }
  });
  await load();
}

async function renderCustomers() {
  app.innerHTML = `${header('<label class="search-box"><span class="search-icon">⌕</span><input type="search" data-search placeholder="Search customers"></label>')}<section class="data-panel"><div class="panel-heading"><div><h2>Customer details</h2><p>Register or update customer records.</p></div></div><form class="sale-form" data-customer-form><input type="hidden" name="customer_id"><div class="field-grid"><label>Customer code<input name="customer_code" placeholder="CUST-001"></label><label>Customer name<input name="customer_name" required></label><label>Contact number<input name="contact_number"></label><label>Email<input name="email" type="email"></label><label>Address<input name="address"></label></div><button class="button button-primary" type="submit">Save customer</button><button class="button button-secondary" type="button" data-reset>Clear</button><p class="form-message" data-message></p></form></section><section class="data-panel"><div class="panel-heading"><div><h2>All customers</h2><p data-count></p></div><span class="live-indicator">LIVE DATA</span></div><div data-table class="table-content"></div></section>`;
  const form = app.querySelector('[data-customer-form]');
  const message = app.querySelector('[data-message]');
  let rows = [];
  async function load() {
    const { data, error } = await supabase.from('customers').select('*').order('customer_name');
    if (error) { app.querySelector('[data-table]').innerHTML = failure(error.message); return; }
    rows = data || [];
    renderTable(rows);
  }
  function renderTable(items) {
    app.querySelector('[data-count]').textContent = `${items.length} customers`;
    app.querySelector('[data-table]').innerHTML = items.length ? `<div class="table-scroll"><table><thead><tr><th>Code</th><th>Name</th><th>Contact</th><th>Email</th><th>Address</th><th>Action</th></tr></thead><tbody>${items.map(item => `<tr><td>${escapeHtml(item.customer_code || '—')}</td><td>${escapeHtml(item.customer_name)}</td><td>${escapeHtml(item.contact_number || '—')}</td><td>${escapeHtml(item.email || '—')}</td><td>${escapeHtml(item.address || '—')}</td><td><button class="button button-secondary" data-edit="${item.customer_id}">Edit</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state"><h2>No customers found</h2></div>';
  }
  app.querySelector('[data-search]').addEventListener('input', event => {
    const term = event.target.value.trim().toLowerCase();
    renderTable(rows.filter(row => [row.customer_code, row.customer_name, row.contact_number, row.email, row.address].join(' ').toLowerCase().includes(term)));
  });
  app.querySelector('[data-reset]').addEventListener('click', () => { form.reset(); form.elements.customer_id.value = ''; });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(form);
    const id = data.get('customer_id');
    const customer = {
      customer_code: String(data.get('customer_code')).trim().toUpperCase() || null,
      customer_name: String(data.get('customer_name')).trim(),
      contact_number: String(data.get('contact_number')).trim() || null,
      email: String(data.get('email')).trim() || null,
      address: String(data.get('address')).trim() || null,
      status: 'Active'
    };
    if (!customer.customer_name) { message.textContent = 'Customer name is required.'; return; }
    if (customer.customer_code && rows.some(row => row.customer_code === customer.customer_code && String(row.customer_id) !== String(id))) { message.textContent = 'That customer code already exists.'; return; }
    const result = id
      ? await supabase.from('customers').update(customer).eq('customer_id', id)
      : await supabase.from('customers').insert(customer);
    if (result.error) { message.textContent = result.error.message; return; }
    message.textContent = id ? 'Customer updated.' : 'Customer registered.';
    form.reset(); form.elements.customer_id.value = '';
    await load();
  });
  app.querySelector('[data-table]').addEventListener('click', event => {
    if (!event.target.dataset.edit) return;
    const item = rows.find(row => String(row.customer_id) === event.target.dataset.edit);
    if (!item) return;
    for (const name of ['customer_code', 'customer_name', 'contact_number', 'email', 'address']) form.elements[name].value = item[name] ?? '';
    form.elements.customer_id.value = item.customer_id;
  });
  await load();
}

async function renderSales() {
  app.innerHTML = `${header('<button class="button button-secondary" type="button" data-clear>Clear cart</button>')}<section class="sale-layout"><article class="data-panel sale-terminal"><div class="panel-heading"><div><h2>Current transaction</h2><p>Select a customer and add products.</p></div><span class="live-indicator">LIVE</span></div><div class="sale-form"><div class="field-grid"><label>Customer<select name="customer_id" data-customer><option value="">Walk-in customer</option></select></label><label>Search product<input type="search" data-product-search placeholder="Name or product code"></label></div><div data-product-list class="sale-items"></div></div></article><aside class="receipt-card"><p class="eyebrow">SUMMARY</p><h2>Order total</h2><div class="summary-row"><span>Subtotal</span><strong data-subtotal>₱0.00</strong></div><label class="payment-field">Discount <input type="number" min="0" step="0.01" value="0" data-discount></label><label class="payment-field">Tax <input type="number" min="0" step="0.01" value="0" data-tax></label><div class="summary-row total"><span>Total</span><strong data-total>₱0.00</strong></div><label class="payment-field">Payment method<select data-method><option>Cash</option><option>Card</option><option>E-wallet</option></select></label><label class="payment-field">Cash / amount<input type="number" min="0" step="0.01" value="0" data-paid></label><div class="summary-row"><span>Change</span><strong data-change>₱0.00</strong></div><button class="button button-primary wide" type="button" data-checkout>Complete payment</button><p class="form-message" data-sale-message></p></aside></section><section class="data-panel"><div class="panel-heading"><div><h2>Shopping cart</h2><p data-cart-count>0 items</p></div></div><div data-cart class="table-content"></div></section>`;
  let products = [];
  const [productResult, customerResult] = await Promise.all([
    supabase.from('products').select('*').eq('status', 'Active').order('product_name'),
    supabase.from('customers').select('*').eq('status', 'Active').order('customer_name')
  ]);
  products = productResult.data || [];
  const customerSelect = app.querySelector('[data-customer]');
  for (const customer of customerResult.data || []) {
    const option = document.createElement('option');
    option.value = customer.customer_id;
    option.textContent = `${customer.customer_name}${customer.customer_code ? ` (${customer.customer_code})` : ''}`;
    customerSelect.append(option);
  }
  function subtotal() { return cart.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0); }
  function totals() { const discount = Math.max(Number(app.querySelector('[data-discount]').value) || 0, 0); const tax = Math.max(Number(app.querySelector('[data-tax]').value) || 0, 0); return { discount, tax, total: Math.max(subtotal() - discount + tax, 0) }; }
  function renderCart() {
    app.querySelector('[data-cart-count]').textContent = `${cart.reduce((sum, item) => sum + item.quantity, 0)} items`;
    const total = totals();
    app.querySelector('[data-subtotal]').textContent = peso.format(subtotal());
    app.querySelector('[data-total]').textContent = peso.format(total.total);
    const paid = Math.max(Number(app.querySelector('[data-paid]').value) || 0, 0);
    app.querySelector('[data-change]').textContent = peso.format(Math.max(paid - total.total, 0));
    app.querySelector('[data-cart]').innerHTML = cart.length ? `<div class="table-scroll"><table><thead><tr><th>Product</th><th>Quantity</th><th>Price</th><th>Subtotal</th><th>Action</th></tr></thead><tbody>${cart.map(item => `<tr><td>${escapeHtml(item.product_name)}</td><td><input class="cart-qty" type="number" min="1" max="${item.quantity_available}" data-qty="${item.product_id}" value="${item.quantity}"></td><td>${peso.format(item.price)}</td><td>${peso.format(item.price * item.quantity)}</td><td><button class="button button-secondary" data-remove="${item.product_id}">Remove</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state"><h2>Cart is empty</h2><p>Add an available product from the list.</p></div>';
  }
  function renderProducts(term = '') {
    const filtered = products.filter(item => [item.product_code, item.product_name, item.category].join(' ').toLowerCase().includes(term.toLowerCase()));
    app.querySelector('[data-product-list]').innerHTML = filtered.length ? `<div class="sale-item-head"><span>Item</span><span>Stock</span><span>Price</span><span>Action</span></div>${filtered.map(item => `<div class="sale-item-row"><span>${escapeHtml(item.product_name)}</span><span>${item.quantity}</span><span>${peso.format(item.price)}</span><button class="button button-secondary" data-add="${item.product_id}" ${item.quantity < 1 ? 'disabled' : ''}>Add</button></div>`).join('')}` : '<div class="empty-state"><h2>No products found</h2></div>';
  }
  app.querySelector('[data-product-search]').addEventListener('input', event => renderProducts(event.target.value));
  app.querySelector('[data-product-list]').addEventListener('click', event => {
    if (!event.target.dataset.add) return;
    const product = products.find(item => String(item.product_id) === event.target.dataset.add);
    if (!product || product.quantity < 1) return;
    const existing = cart.find(item => item.product_id === product.product_id);
    if (existing) {
      if (existing.quantity >= product.quantity) return;
      existing.quantity += 1;
    } else cart.push({ product_id: product.product_id, product_name: product.product_name, price: Number(product.price), quantity: 1, quantity_available: product.quantity });
    renderCart();
  });
  app.querySelector('[data-cart]').addEventListener('input', event => {
    if (!event.target.dataset.qty) return;
    const item = cart.find(cartItem => String(cartItem.product_id) === event.target.dataset.qty);
    if (!item) return;
    const requested = Math.max(1, Number(event.target.value) || 1);
    if (requested > item.quantity_available) { event.target.value = item.quantity_available; item.quantity = item.quantity_available; }
    else item.quantity = requested;
    renderCart();
  });
  app.querySelector('[data-cart]').addEventListener('click', event => {
    if (!event.target.dataset.remove) return;
    const index = cart.findIndex(item => String(item.product_id) === event.target.dataset.remove);
    if (index >= 0) cart.splice(index, 1);
    renderCart();
  });
  for (const selector of ['[data-discount]', '[data-tax]', '[data-paid]']) app.querySelector(selector).addEventListener('input', renderCart);
  app.querySelector('[data-clear]').addEventListener('click', () => { cart.splice(0); renderCart(); });
  app.querySelector('[data-checkout]').addEventListener('click', async () => {
    const message = app.querySelector('[data-sale-message]');
    if (!cart.length) { message.textContent = 'Cart is empty.'; return; }
    const total = totals();
    const paid = Number(app.querySelector('[data-paid]').value) || 0;
    if (paid < total.total) { message.textContent = 'Insufficient payment.'; return; }
    const button = app.querySelector('[data-checkout]'); button.disabled = true; message.textContent = 'Processing transaction…';
    const items = cart.map(item => ({ product_id: item.product_id, quantity: item.quantity }));
    const cashierName = sessionProfile?.full_name || sessionProfile?.username || 'Cashier';
    const { data, error } = await supabase.rpc('process_sale', {
      p_customer_id: app.querySelector('[data-customer]').value ? Number(app.querySelector('[data-customer]').value) : null,
      p_items: items,
      p_discount: total.discount,
      p_tax: total.tax,
      p_payment_method: app.querySelector('[data-method]').value,
      p_amount_received: paid,
      p_cashier_name: cashierName
    });
    button.disabled = false;
    if (error) { message.textContent = error.message; return; }
    const sale = data?.[0];
    if (!sale) { message.textContent = 'Sale completed but receipt data was unavailable.'; return; }
    sessionStorage.setItem('pos_receipt_sale_id', String(sale.sale_id));
    window.location.href = `receipt.html?id=${encodeURIComponent(sale.sale_id)}`;
  });
  renderProducts(); renderCart();
}

async function renderReceipt() {
  app.innerHTML = `${header('<button class="button button-secondary" data-print>Print receipt</button>')}<section class="data-panel receipt-panel" data-receipt><div class="loading-state">Loading receipt</div></section>`;
  app.querySelector('[data-print]').addEventListener('click', () => window.print());
  const id = new URLSearchParams(window.location.search).get('id') || sessionStorage.getItem('pos_receipt_sale_id');
  if (!id) { app.querySelector('[data-receipt]').innerHTML = failure('No receipt was selected.'); return; }
  const { data: sale, error } = await supabase
    .from('sales')
    .select('*, customers(customer_name, customer_code), sale_items(*, products(product_name, product_code)), payments(*)')
    .eq('sale_id', id)
    .maybeSingle();
  if (error) { app.querySelector('[data-receipt]').innerHTML = failure(error.message); return; }
  if (!sale) { app.querySelector('[data-receipt]').innerHTML = failure('Receipt not found.'); return; }
  const payment = sale.payments?.[0];
  app.querySelector('[data-receipt]').innerHTML = `<article class="print-receipt"><h2>POS SYSTEM</h2><p>Point-of-Sale System</p><hr><dl class="receipt-details"><div><dt>Transaction</dt><dd>${escapeHtml(sale.transaction_no)}</dd></div><div><dt>Date</dt><dd>${escapeHtml(new Date(sale.sale_date).toLocaleString())}</dd></div><div><dt>Customer</dt><dd>${escapeHtml(sale.customers?.customer_name || 'Walk-in customer')}</dd></div><div><dt>Cashier</dt><dd>${escapeHtml(sale.cashier_name || 'Cashier')}</dd></div></dl><div class="table-scroll"><table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Subtotal</th></tr></thead><tbody>${(sale.sale_items || []).map(item => `<tr><td>${escapeHtml(item.products?.product_name || 'Product')}</td><td>${item.quantity}</td><td>${peso.format(item.unit_price)}</td><td>${peso.format(item.subtotal)}</td></tr>`).join('')}</tbody></table></div><dl class="receipt-details"><div><dt>Subtotal</dt><dd>${peso.format(sale.subtotal)}</dd></div><div><dt>Discount</dt><dd>${peso.format(sale.discount)}</dd></div><div><dt>Tax</dt><dd>${peso.format(sale.tax)}</dd></div><div><dt>Total</dt><dd>${peso.format(sale.total_amount)}</dd></div><div><dt>${escapeHtml(payment?.payment_method || 'Payment')}</dt><dd>${peso.format(payment?.amount_received || 0)}</dd></div><div><dt>Change</dt><dd>${peso.format(payment?.change_amount || 0)}</dd></div></dl><p class="receipt-thanks">THANK YOU!</p></article>`;
}

async function renderHistory() {
  app.innerHTML = `${header('<label class="search-box"><span class="search-icon">⌕</span><input type="search" data-search placeholder="Transaction or customer"></label>')}<section class="data-panel"><div class="panel-heading"><div><h2>Sales history</h2><p data-count></p></div><span class="live-indicator">LIVE DATA</span></div><div data-table class="table-content"></div></section>`;
  const { data, error } = await supabase.from('sales').select('*, customers(customer_name), payments(*)').order('sale_date', { ascending: false });
  if (error) { app.querySelector('[data-table]').innerHTML = failure(error.message); return; }
  let rows = data || [];
  function render(items) {
    app.querySelector('[data-count]').textContent = `${items.length} transactions`;
    app.querySelector('[data-table]').innerHTML = items.length ? `<div class="table-scroll"><table><thead><tr><th>Transaction</th><th>Date</th><th>Customer</th><th>Cashier</th><th>Payment</th><th>Total</th><th>Status</th><th>Action</th></tr></thead><tbody>${items.map(sale => `<tr><td>${escapeHtml(sale.transaction_no)}</td><td>${escapeHtml(new Date(sale.sale_date).toLocaleString())}</td><td>${escapeHtml(sale.customers?.customer_name || 'Walk-in')}</td><td>${escapeHtml(sale.cashier_name || '—')}</td><td>${escapeHtml(sale.payments?.[0]?.payment_method || '—')}</td><td>${peso.format(sale.total_amount)}</td><td>${escapeHtml(sale.status)}</td><td><a class="button button-secondary" href="receipt.html?id=${sale.sale_id}">View</a></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state"><h2>No transactions found</h2></div>';
  }
  app.querySelector('[data-search]').addEventListener('input', event => {
    const term = event.target.value.trim().toLowerCase();
    render(rows.filter(sale => [sale.transaction_no, sale.customers?.customer_name, sale.cashier_name, sale.status].join(' ').toLowerCase().includes(term)));
  });
  render(rows);
}

async function renderReports() {
  app.innerHTML = `${header()}<section class="metric-grid" data-metrics></section><section class="data-panel"><div class="panel-heading"><div><h2>Sales records</h2><p data-report-count></p></div><span class="live-indicator">LIVE DATA</span></div><div data-report-table class="table-content"></div></section>`;
  const { data, error } = await supabase.from('sales').select('*, sale_items(*, products(product_name, category)), payments(payment_method)').order('sale_date', { ascending: false });
  if (error) { app.querySelector('[data-report-table]').innerHTML = failure(error.message); return; }
  const rows = data || [];
  const total = rows.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0);
  app.querySelector('[data-metrics]').innerHTML = metric('Transactions', rows.length, 'Completed records') + metric('Total sales', peso.format(total), 'Available sales', 'metric-orange') + metric('Average sale', peso.format(rows.length ? total / rows.length : 0), 'Per transaction', 'metric-blue');
  app.querySelector('[data-report-count]').textContent = `${rows.length} records`;
  app.querySelector('[data-report-table]').innerHTML = rows.length ? `<div class="table-scroll"><table><thead><tr><th>Date</th><th>Transaction</th><th>Payment</th><th>Subtotal</th><th>Discount</th><th>Tax</th><th>Total</th></tr></thead><tbody>${rows.map(sale => `<tr><td>${escapeHtml(new Date(sale.sale_date).toLocaleDateString())}</td><td>${escapeHtml(sale.transaction_no)}</td><td>${escapeHtml(sale.payments?.[0]?.payment_method || '—')}</td><td>${peso.format(sale.subtotal)}</td><td>${peso.format(sale.discount)}</td><td>${peso.format(sale.tax)}</td><td>${peso.format(sale.total_amount)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state"><h2>No sales reports yet</h2></div>';
}

async function renderUsers() {
  app.innerHTML = `${header()}<section class="data-panel"><div class="panel-heading"><div><h2>Create user</h2><p>Supabase securely stores passwords and user sessions.</p></div></div><form class="sale-form" data-user-form><div class="field-grid"><label>Full name<input name="full_name" required></label><label>Username<input name="username" autocomplete="username" required></label><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Password<input name="password" type="password" minlength="6" autocomplete="new-password" required></label><label>Role<select name="role"><option>Administrator</option><option>Manager</option><option>Cashier</option><option>Inventory Staff</option></select></label></div><button class="button button-primary" type="submit">Create user</button><p class="form-message" data-user-message></p></form></section><section class="data-panel"><div class="panel-heading"><div><h2>User access</h2><p>Roles control POS permissions.</p></div></div><div data-users class="table-content"></div></section>`;
  if (sessionProfile?.role !== 'Administrator') { app.querySelector('[data-users]').innerHTML = '<div class="empty-state"><h2>Administrator access required</h2></div>'; return; }

  async function loadUsers() {
    const { data, error } = await supabase.from('profiles').select('*').order('full_name');
    if (error) { app.querySelector('[data-users]').innerHTML = failure(error.message); return; }
    const rows = data || [];
    app.querySelector('[data-users]').innerHTML = rows.length ? `<div class="table-scroll"><table><thead><tr><th>Name</th><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows.map(row => `<tr><td>${escapeHtml(row.full_name || '—')}</td><td>${escapeHtml(row.username || '—')}</td><td>${escapeHtml(row.email || '—')}</td><td><select data-role="${row.id}" ${row.id === sessionProfile.id ? 'disabled' : ''}><option ${row.role === 'Administrator' ? 'selected' : ''}>Administrator</option><option ${row.role === 'Manager' ? 'selected' : ''}>Manager</option><option ${row.role === 'Cashier' ? 'selected' : ''}>Cashier</option><option ${row.role === 'Inventory Staff' ? 'selected' : ''}>Inventory Staff</option></select></td><td>${row.active === false ? 'Inactive' : 'Active'}</td><td><button class="button button-secondary" data-toggle-user="${row.id}" ${row.id === sessionProfile.id ? 'disabled' : ''}>${row.active === false ? 'Activate' : 'Deactivate'}</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state"><h2>No profiles found</h2></div>';
  }

  const form = app.querySelector('[data-user-form]');
  const message = app.querySelector('[data-user-message]');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(form);
    const email = String(data.get('email')).trim().toLowerCase();
    const username = String(data.get('username')).trim();
    const password = String(data.get('password'));
    const fullName = String(data.get('full_name')).trim();
    const role = String(data.get('role'));
    if (!username || !email || password.length < 6) { message.textContent = 'Enter a username, valid email, and password of at least 6 characters.'; return; }
    const usernameCheck = await supabase.from('profiles').select('id').eq('username', username).maybeSingle();
    if (usernameCheck.data) { message.textContent = 'That username already exists.'; return; }
    message.textContent = 'Creating secure account…';
    const { data: { session: administratorSession } } = await supabase.auth.getSession();
    const { data: created, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username, full_name: fullName, role } }
    });
    if (error) { message.textContent = error.message; return; }
    if (created.user) {
      await supabase.from('profiles').upsert({ id: created.user.id, username, full_name: fullName, email, role, active: true });
    }
    if (administratorSession && created.session) {
      await supabase.auth.setSession({
        access_token: administratorSession.access_token,
        refresh_token: administratorSession.refresh_token
      });
    }
    message.textContent = 'User account created.';
    form.reset();
    await loadUsers();
  });

  app.querySelector('[data-users]').addEventListener('change', async event => {
    if (!event.target.dataset.role) return;
    await supabase.from('profiles').update({ role: event.target.value }).eq('id', event.target.dataset.role);
    await loadUsers();
  });
  app.querySelector('[data-users]').addEventListener('click', async event => {
    if (!event.target.dataset.toggleUser) return;
    const id = event.target.dataset.toggleUser;
    const row = (await supabase.from('profiles').select('active').eq('id', id).maybeSingle()).data;
    await supabase.from('profiles').update({ active: row?.active === false }).eq('id', id);
    await loadUsers();
  });
  await loadUsers();
}

async function renderLogin() {
  app.innerHTML = `<section class="login-panel"><p class="eyebrow">POS SYSTEM</p><h1>Welcome back</h1><p class="page-description">Sign in to your store workspace.</p><form data-login-form><label>Username<input name="username" autocomplete="username" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><button class="button button-primary" type="submit">Login</button><p class="form-message" data-login-message></p></form></section>`;
  const form = app.querySelector('[data-login-form]');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(form); const message = app.querySelector('[data-login-message]');
    const credential = String(data.get('username')).trim();
    const password = String(data.get('password'));
    if (!credential || !password) { message.textContent = 'Username and password are required.'; return; }
    const button = form.querySelector('button'); button.disabled = true; message.textContent = 'Signing in…';

    let email = credential.includes('@') ? credential : null;
    if (!email) {
      const { data: profile, error } = await supabase.from('profiles').select('email, active').eq('username', credential).maybeSingle();
      if (error || !profile) { button.disabled = false; message.textContent = 'Invalid username or password.'; return; }
      if (profile.active === false) { button.disabled = false; message.textContent = 'This account is inactive.'; return; }
      email = profile.email;
    }

    if (!email) { button.disabled = false; message.textContent = 'This account has no login email.'; return; }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    button.disabled = false;
    if (error) { message.textContent = 'Invalid username or password.'; return; }
    window.location.href = 'index.html';
  });
}

const activeSession = await loadProfile();
if (page === 'login') {
  if (activeSession) window.location.href = 'index.html';
  else await renderLogin();
} else if (!activeSession) {
  window.location.href = '../login.html';
} else if (!canAccess(page)) {
  accessDenied();
} else if (page === 'dashboard') await renderDashboard();
else if (page === 'products') await renderProducts();
else if (page === 'customers') await renderCustomers();
else if (page === 'sales') await renderSales();
else if (page === 'receipt') await renderReceipt();
else if (page === 'history') await renderHistory();
else if (page === 'reports') await renderReports();
else if (page === 'users') await renderUsers();
else await renderDashboard();
