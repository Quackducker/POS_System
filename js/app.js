const pageDefinitions = {
  login: { title: 'Login', eyebrow: 'WELCOME', description: 'Sign in to start managing your store.' },
  dashboard: { title: 'Dashboard', eyebrow: 'OVERVIEW', description: 'A clear view of today’s store activity.' },
  products: { title: 'Products', eyebrow: 'CATALOG', description: 'Browse and search the product catalog.' },
  customers: { title: 'Customers', eyebrow: 'RELATIONSHIPS', description: 'Find customer records and account details.' },
  sales: { title: 'Sales', eyebrow: 'TRANSACTIONS', description: 'Process a transaction and review today’s payments.' },
  history: { title: 'Sales history', eyebrow: 'TRANSACTIONS', description: 'Review the latest recorded transactions.' },
  reports: { title: 'Reports', eyebrow: 'PERFORMANCE', description: 'A summary of sales and catalog activity.' },
  users: { title: 'Users', eyebrow: 'TEAM', description: 'View user records available to this account.' },
  receipt: { title: 'Receipt', eyebrow: 'TRANSACTION', description: 'Review a transaction receipt.' }
};

const tableNames = {
  products: 'products',
  customers: 'customers',
  sales: 'sales',
  history: 'sales',
  reports: 'sales',
  users: 'users',
  receipt: 'sales'
};

const pageKey = window.location.pathname.split('/').pop().replace('.html', '') || 'dashboard';
const page = pageDefinitions[pageKey] ? pageKey : (window.location.pathname.endsWith('/login.html') ? 'login' : 'dashboard');
const definition = pageDefinitions[page];
const app = document.querySelector('#app');
let supabase;
let backendMessage = '';

const supabaseReady = import('../supabase.js')
  .then((module) => { supabase = module.supabase; })
  .catch((error) => { backendMessage = `Could not load Supabase: ${error.message}`; });

document.title = `${definition.title} | POS System`;

function escapeHtml(value) {
  let text = '';
  if (value !== null && value !== undefined) {
    text = String(value);
  }
  text = text.replace(/&/g, '&amp;');
  text = text.replace(/</g, '&lt;');
  text = text.replace(/>/g, '&gt;');
  text = text.replace(/"/g, '&quot;');
  text = text.replace(/'/g, '&#39;');
  return text;
}

function formatLabel(value) {
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatValue(key, value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  if (/price|amount|total|revenue|cost/i.test(key) && Number.isFinite(Number(value))) {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PHP' }).format(Number(value));
  }
  if (/date|time|created|updated|sold/i.test(key)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }
  return String(value);
}

function pageHeader(actions = '') {
  return `
    <header class="page-heading">
      <div>
        <p class="eyebrow">${definition.eyebrow}</p>
        <h1>${definition.title}</h1>
        <p class="page-description">${definition.description}</p>
      </div>
      ${actions ? `<div class="page-actions">${actions}</div>` : ''}
    </header>`;
}

function metricCard(label, value, detail, tone = '') {
  return `<article class="metric ${tone}"><p>${label}</p><strong>${value}</strong><span>${detail}</span></article>`;
}

function alertMarkup(message) {
  return `<div class="notice" role="status"><span class="notice-mark" aria-hidden="true">!</span><p>${escapeHtml(message)}</p></div>`;
}

async function fetchRows(table) {
  await supabaseReady;
  if (!supabase) throw new Error(backendMessage || 'Supabase is unavailable.');
  const { data, error } = await supabase.from(table).select('*').limit(200);
  if (error) throw error;
  return data ?? [];
}

function showFailure(container, error) {
  container.innerHTML = `<div class="empty-state"><span class="empty-symbol" aria-hidden="true">!</span><h2>Couldn’t load this data</h2><p>${escapeHtml(error.message || 'Check your connection and Supabase table permissions, then try again.')}</p><button class="button button-secondary" data-retry>Try again</button></div>`;
  const retryButton = container.querySelector('[data-retry]');
  if (retryButton) {
    retryButton.addEventListener('click', () => window.location.reload());
  }
}

function tableMarkup(rows) {
  if (!rows.length) {
    return `<div class="empty-state"><span class="empty-symbol" aria-hidden="true">+</span><h2>No records yet</h2><p>Records from the <code>${escapeHtml(tableNames[page])}</code> table will appear here when available.</p></div>`;
  }

  const columns = Object.keys(rows[0]).slice(0, 7);
  let heading = '';
  let body = '';

  for (const column of columns) {
    heading += `<th scope="col">${escapeHtml(formatLabel(column))}</th>`;
  }

  for (const row of rows) {
    let cells = '';
    for (const column of columns) {
      cells += `<td>${escapeHtml(formatValue(column, row[column]))}</td>`;
    }
    body += `<tr>${cells}</tr>`;
  }

  return `<div class="table-scroll"><table><thead><tr>${heading}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function setupSearch(rows, container) {
  const input = document.querySelector('[data-search]');
  if (!input) return;
  input.addEventListener('input', () => {
    const term = input.value.trim().toLowerCase();
    const filtered = [];

    for (const row of rows) {
      let matchesSearch = false;
      for (const value of Object.values(row)) {
        const text = value === null || value === undefined ? '' : String(value);
        if (text.toLowerCase().includes(term)) {
          matchesSearch = true;
          break;
        }
      }
      if (matchesSearch) filtered.push(row);
    }

    container.innerHTML = tableMarkup(filtered);
  });
}

async function renderList() {
  app.innerHTML = `${pageHeader(`<label class="search-box"><span class="search-icon" aria-hidden="true">⌕</span><input type="search" data-search placeholder="Search ${definition.title.toLowerCase()}" aria-label="Search ${definition.title.toLowerCase()}"></label>`)}
    <section class="data-panel" aria-label="${definition.title} records"><div class="panel-heading"><div><h2>All ${definition.title.toLowerCase()}</h2><p class="record-count" data-record-count>Loading records…</p></div><span class="live-indicator">LIVE DATA</span></div><div data-table-content class="table-content"><div class="loading-state"><span class="loader"></span>Loading from Supabase</div></div></section>`;
  const container = app.querySelector('[data-table-content]');

  try {
    const rows = await fetchRows(tableNames[page]);
    app.querySelector('[data-record-count]').textContent = `${rows.length} ${rows.length === 1 ? 'record' : 'records'}`;
    container.innerHTML = tableMarkup(rows);
    setupSearch(rows, container);
  } catch (error) {
    app.querySelector('[data-record-count]').textContent = 'Data unavailable';
    showFailure(container, error);
  }
}

function getAmount(row) {
  for (const key of Object.keys(row)) {
    const value = row[key];
    if (/amount|total|revenue|price/i.test(key) && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return 0;
}

function getDate(row) {
  for (const key of Object.keys(row)) {
    if (/date|created|sold|time/i.test(key)) {
      return new Date(row[key]);
    }
  }
  return null;
}

async function renderDashboard() {
  app.innerHTML = `${pageHeader('<a class="button button-primary" href="views/sales.html"><span aria-hidden="true">＋</span> Open POS</a>')}
    <section class="metric-grid" aria-label="Store summary">
      ${metricCard('Products', '<span data-product-count>—</span>', 'In your catalog', 'metric-green')}
      ${metricCard('Customers', '<span data-customer-count>—</span>', 'Customer records', 'metric-orange')}
      ${metricCard('Sales recorded', '<span data-sales-count>—</span>', 'Transactions available', 'metric-blue')}
      ${metricCard('Recorded revenue', '<span data-sales-total>—</span>', 'Based on available sales data', 'metric-lime')}
    </section>
    <section class="dashboard-grid">
      <article class="data-panel recent-panel">
        <div class="panel-heading">
          <div>
            <h2>Recent sales</h2>
            <p>Latest transactions in the database</p>
          </div>
          <a class="text-link" href="views/sales.html">View all <span aria-hidden="true">→</span></a>
        </div>
        <div data-recent-sales class="table-content"><div class="loading-state"><span class="loader"></span>Loading activity</div></div>
      </article>
      <aside class="quick-panel">
        <p class="eyebrow">SHORTCUTS</p>
        <h2>Go to work</h2>
        <a href="views/products.html"><span class="shortcut-symbol">▦</span><span><strong>Product catalog</strong><small>Search inventory records</small></span><b aria-hidden="true">→</b></a>
        <a href="views/customers.html"><span class="shortcut-symbol">◉</span><span><strong>Customer directory</strong><small>Find customer records</small></span><b aria-hidden="true">→</b></a>
        <a href="views/reports.html"><span class="shortcut-symbol">▤</span><span><strong>Reports</strong><small>Review sales performance</small></span><b aria-hidden="true">→</b></a>
      </aside>
    </section>
    <p class="data-footnote"><span class="live-indicator">LIVE DATA</span> Values are read from your connected Supabase tables.</p>`;

  const data = {};
  const tables = ['products', 'customers', 'sales'];
  let salesLoaded = true;
  let salesError = null;
  let anyTableFailed = false;

  for (const table of tables) {
    let countSelector = '[data-sales-count]';
    if (table === 'products') countSelector = '[data-product-count]';
    if (table === 'customers') countSelector = '[data-customer-count]';

    try {
      data[table] = await fetchRows(table);
      app.querySelector(countSelector).textContent = data[table].length;
    } catch (error) {
      data[table] = [];
      anyTableFailed = true;
      app.querySelector(countSelector).textContent = '—';
      app.querySelector(countSelector).closest('.metric').title = error.message;
      if (table === 'sales') {
        salesLoaded = false;
        salesError = error;
      }
    }
  }

  let total = 0;
  for (const sale of data.sales) {
    total += getAmount(sale);
  }
  app.querySelector('[data-sales-total]').textContent = salesLoaded
    ? new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(total)
    : '—';
  const recent = app.querySelector('[data-recent-sales]');
  const sales = data.sales.slice();
  sales.sort((first, second) => {
    const firstDate = getDate(first);
    const secondDate = getDate(second);
    const firstTime = firstDate ? firstDate.getTime() : 0;
    const secondTime = secondDate ? secondDate.getTime() : 0;
    return secondTime - firstTime;
  });

  if (salesLoaded) {
    recent.innerHTML = tableMarkup(sales.slice(0, 5));
  } else {
    showFailure(recent, salesError);
  }
  if (anyTableFailed) {
    app.insertAdjacentHTML('beforeend', alertMarkup('Some dashboard values could not be loaded. Confirm the Supabase tables and permissions are configured.'));
  }
}

async function renderSales() {
  app.innerHTML = `
    <header class="page-heading">
      <div>
        <p class="eyebrow">POS TERMINAL</p>
        <h1>Point of sale</h1>
        <p class="page-description">Capture sales quickly and keep the checkout flow moving.</p>
      </div>
      <div class="page-actions">
        <button class="button button-secondary" type="button">Hold sale</button>
        <button class="button button-primary" type="button">Process sale</button>
      </div>
    </header>
    <section class="sale-layout">
      <article class="data-panel sale-terminal">
        <div class="panel-heading">
          <div>
            <h2>Current transaction</h2>
            <p>Checkout overview</p>
          </div>
          <span class="live-indicator">LIVE</span>
        </div>
        <div class="sale-form">
          <div class="field-grid">
            <label>Product<select><option>Classic Burger</option><option>Chicken Sandwich</option><option>Fries Bucket</option><option>Soft Drink</option></select></label>
            <label>Quantity<input type="number" value="1" min="1"></label>
            <label>Customer<select><option>Walk-in</option><option>Ana Dela Cruz</option><option>Mark Santos</option></select></label>
            <label>Discount<input type="text" value="0%"></label>
          </div>
          <div class="sale-items">
            <div class="sale-item-head"><span>Item</span><span>Qty</span><span>Price</span><span>Total</span></div>
            <div class="sale-item-row"><span>Classic Burger</span><span>1</span><span>₱180</span><span>₱180</span></div>
            <div class="sale-item-row"><span>Fries Bucket</span><span>2</span><span>₱90</span><span>₱180</span></div>
            <div class="sale-item-row"><span>Soft Drink</span><span>1</span><span>₱60</span><span>₱60</span></div>
          </div>
        </div>
      </article>
      <aside class="receipt-card">
        <p class="eyebrow">SUMMARY</p>
        <h2>Order total</h2>
        <div class="summary-row"><span>Subtotal</span><strong>₱420</strong></div>
        <div class="summary-row"><span>VAT</span><strong>₱42</strong></div>
        <div class="summary-row"><span>Discount</span><strong>₱0</strong></div>
        <div class="summary-row total"><span>Total</span><strong>₱462</strong></div>
        <button class="button button-primary wide" type="button">Complete payment</button>
      </aside>
    </section>
    <section class="data-panel recent-panel">
      <div class="panel-heading">
        <div>
          <h2>Today’s sales</h2>
          <p>Recent transactions from your store</p>
        </div>
        <a class="text-link" href="views/history.html">View history <span aria-hidden="true">→</span></a>
      </div>
      <div data-sales-table class="table-content"></div>
    </section>`;

  const recent = app.querySelector('[data-sales-table]');
  try {
    const rows = await fetchRows('sales');
    recent.innerHTML = tableMarkup(rows.slice(0, 5));
  } catch (error) {
    showFailure(recent, error);
  }
}

async function renderReports() {
  app.innerHTML = `${pageHeader()}<section class="metric-grid report-metrics">${metricCard('Transactions', '<span data-report-count>—</span>', 'Sales records')} ${metricCard('Total recorded sales', '<span data-report-total>—</span>', 'Sum of available transaction amounts', 'metric-orange')} ${metricCard('Average sale', '<span data-report-average>—</span>', 'Across loaded transactions', 'metric-blue')}</section><section class="data-panel"><div class="panel-heading"><div><h2>Sales records</h2><p>Latest records returned by Supabase</p></div><span class="live-indicator">LIVE DATA</span></div><div class="table-content" data-report-table><div class="loading-state"><span class="loader"></span>Building report</div></div></section>`;
  const container = app.querySelector('[data-report-table]');
  try {
    const rows = await fetchRows('sales');
    let total = 0;
    for (const row of rows) {
      total += getAmount(row);
    }
    app.querySelector('[data-report-count]').textContent = rows.length;
    app.querySelector('[data-report-total]').textContent = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PHP' }).format(total);
    app.querySelector('[data-report-average]').textContent = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PHP' }).format(rows.length ? total / rows.length : 0);
    container.innerHTML = tableMarkup(rows);
  } catch (error) {
    showFailure(container, error);
  }
}

async function renderReceipt() {
  app.innerHTML = `${pageHeader('<button class="button button-secondary" data-print><span aria-hidden="true">↗</span> Print</button>')}<section class="data-panel receipt-panel"><div class="panel-heading"><div><h2>Transaction details</h2><p>Receipt data from your sales table</p></div><span class="live-indicator">LIVE DATA</span></div><div class="table-content" data-receipt-content><div class="loading-state"><span class="loader"></span>Loading receipt</div></div></section>`;
  app.querySelector('[data-print]').addEventListener('click', () => window.print());
  const container = app.querySelector('[data-receipt-content]');
  try {
    const rows = await fetchRows('sales');
    const requestedId = new URLSearchParams(window.location.search).get('id');
    let row = rows[0];
    if (requestedId) {
      row = null;
      for (const sale of rows) {
        for (const value of Object.values(sale)) {
          if (String(value) === requestedId) {
            row = sale;
            break;
          }
        }
        if (row) break;
      }
    }

    if (row) {
      let details = '';
      for (const key of Object.keys(row)) {
        details += `<div><dt>${escapeHtml(formatLabel(key))}</dt><dd>${escapeHtml(formatValue(key, row[key]))}</dd></div>`;
      }
      container.innerHTML = `<dl class="receipt-details">${details}</dl>`;
    } else {
      container.innerHTML = '<div class="empty-state"><h2>No matching receipt</h2><p>Choose a sale from the Sales page to review its details.</p><a class="button button-secondary" href="sales.html">Browse sales</a></div>';
    }
  } catch (error) {
    showFailure(container, error);
  }
}

// ===== NEW (1 of 2): the Customers page with the data entry form and Course dropdown =====
async function renderCustomers() {
  const customerModel = await import('../models/customers.js');
  const courseModel = await import('../models/courses.js');

  app.innerHTML = `${pageHeader(`<label class="search-box"><span class="search-icon" aria-hidden="true">⌕</span><input type="search" data-search placeholder="Search customers" aria-label="Search customers"></label>`)}
    <section class="data-panel" aria-label="Add customer">
      <div class="panel-heading"><div><h2>Add customer</h2><p>Fill in the details and choose a course.</p></div></div>
      <form data-customer-form class="sale-form">
        <div class="field-grid">
          <label>Customer name<input name="customer_name" required></label>
          <label>Contact number<input name="contact_number"></label>
          <label>Email<input name="email" type="email"></label>
          <label>Address<input name="address"></label>
          <label>Course<select name="course_id" data-course-select required><option value="">Select a course</option></select></label>
        </div>
        <button class="button button-primary" type="submit">Save customer</button>
        <p class="form-message" aria-live="polite" data-form-message></p>
      </form>
    </section>
    <section class="data-panel" aria-label="Customer records">
      <div class="panel-heading"><div><h2>All customers</h2><p class="record-count" data-record-count>Loading records…</p></div><span class="live-indicator">LIVE DATA</span></div>
      <div data-table-content class="table-content"><div class="loading-state"><span class="loader"></span>Loading from Supabase</div></div>
    </section>`;

  const form = app.querySelector('[data-customer-form]');
  const message = app.querySelector('[data-form-message]');
  const select = app.querySelector('[data-course-select]');
  const container = app.querySelector('[data-table-content]');
  let allRows = [];

  // EXAM STEP 4: fill the Course dropdown from the courses table
  async function loadCourseOptions() {
    const { data, error } = await courseModel.listCourses();
    if (error) {
      message.textContent = 'Could not load courses: ' + error.message;
      return;
    }
    for (const course of data) {
      const option = document.createElement('option');
      option.value = course.course_id;
      option.textContent = course.course_code;
      select.append(option);
    }
  }

  // EXAM STEP 6: the table now has a Course column
  function customerTable(rows) {
    if (!rows.length) {
      return `<div class="empty-state"><span class="empty-symbol" aria-hidden="true">+</span><h2>No customers found</h2><p>Add a customer using the form above.</p></div>`;
    }
    let body = '';
    for (const row of rows) {
      body += `<tr>
        <td>${escapeHtml(row.customer_code ?? '—')}</td>
        <td>${escapeHtml(row.customer_name)}</td>
        <td>${escapeHtml(row.contact_number ?? '—')}</td>
        <td>${escapeHtml(row.email ?? '—')}</td>
        <td>${escapeHtml(row.courses ? row.courses.course_code : '—')}</td>
      </tr>`;
    }
    return `<div class="table-scroll"><table><thead><tr><th scope="col">Code</th><th scope="col">Name</th><th scope="col">Contact</th><th scope="col">Email</th><th scope="col">Course</th></tr></thead><tbody>${body}</tbody></table></div>`;
  }

  async function loadCustomers() {
    const { data, error } = await customerModel.listCustomers();
    if (error) {
      app.querySelector('[data-record-count]').textContent = 'Data unavailable';
      showFailure(container, error);
      return;
    }
    allRows = data;
    app.querySelector('[data-record-count]').textContent = `${data.length} ${data.length === 1 ? 'record' : 'records'}`;
    container.innerHTML = customerTable(allRows);
  }

  // Search box
  app.querySelector('[data-search]').addEventListener('input', (event) => {
    const term = event.target.value.trim().toLowerCase();
    const filtered = allRows.filter((row) =>
      [row.customer_code, row.customer_name, row.contact_number, row.email, row.courses?.course_code]
        .join(' ').toLowerCase().includes(term)
    );
    container.innerHTML = customerTable(filtered);
  });

  // EXAM STEP 5: save the customer together with the selected course
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const customer = {
      customer_name: String(formData.get('customer_name')).trim(),
      contact_number: String(formData.get('contact_number')).trim() || null,
      email: String(formData.get('email')).trim() || null,
      address: String(formData.get('address')).trim() || null,
      course_id: formData.get('course_id') ? Number(formData.get('course_id')) : null
    };

    // Validation
    if (!customer.customer_name) { message.textContent = 'Customer name is required.'; return; }
    if (!customer.course_id) { message.textContent = 'Please select a course.'; return; }

    const button = form.querySelector('button');
    button.disabled = true;
    message.textContent = 'Saving…';
    const { error } = await customerModel.addCustomer(customer);
    button.disabled = false;

    if (error) { message.textContent = 'Could not save: ' + error.message; return; }
    message.textContent = 'Customer saved.';
    form.reset();
    loadCustomers();
  });

  await loadCourseOptions();
  await loadCustomers();
}
// ===== END NEW (1 of 2) =====

async function renderLogin() {
  app.innerHTML = `<section class="login-panel"><p class="eyebrow">POS SYSTEM</p><h1>Welcome back</h1><p class="page-description">Sign in to your store workspace.</p><form data-login-form><label>Email address<input name="email" type="email" autocomplete="username" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><button class="button button-primary" type="submit">Sign in</button><p class="form-message" aria-live="polite"></p></form></section>`;
  const form = app.querySelector('[data-login-form]');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = form.querySelector('.form-message');
    await supabaseReady;
    if (!supabase) {
      message.textContent = backendMessage || 'Supabase is unavailable.';
      return;
    }
    const button = form.querySelector('button');
    button.disabled = true;
    message.textContent = 'Signing in…';
    const formData = new FormData(form);
    const { error } = await supabase.auth.signInWithPassword({ email: formData.get('email'), password: formData.get('password') });
    button.disabled = false;
    message.textContent = error ? error.message : 'Signed in. Open the dashboard to continue.';
    if (!error) window.location.href = 'index.html';
  });
}

if (page === 'dashboard') {
  await renderDashboard();
} else if (page === 'sales') {
  await renderSales();
} else if (page === 'reports') {
  await renderReports();
} else if (page === 'receipt') {
  await renderReceipt();
} else if (page === 'customers') {
  // NEW (2 of 2): use the new Customers page
  await renderCustomers();
} else if (page === 'login') {
  await renderLogin();
} else {
  await renderList();
}