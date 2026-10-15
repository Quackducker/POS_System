const appRoot = new URL('../', import.meta.url);
const navigationItems = [
  { label: 'Dashboard', path: 'index.html' },
  { label: 'Products', path: 'views/products.html' },
  { label: 'Customers', path: 'views/customers.html' },
  { label: 'Sales', path: 'views/sales.html' },
  { label: 'Reports', path: 'views/reports.html' },
  { label: 'Users', path: 'views/users.html' }
];

const styles = document.createElement('style');
styles.textContent = `
  .app-navbar {
    align-items: center;
    background: #173b3a;
    border-bottom: 3px solid #d89b42;
    color: #fff;
    display: flex;
    flex-wrap: wrap;
    gap: 1rem 2rem;
    justify-content: space-between;
    padding: 0.75rem clamp(1rem, 4vw, 3rem);
  }
  .app-navbar__brand {
    color: #fff;
    font: 700 0.9rem/1.2 system-ui, sans-serif;
    letter-spacing: 0.08em;
    white-space: nowrap;
  }
  .app-navbar__links {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .app-navbar__link {
    border-radius: 3px;
    color: #e4edeb;
    display: block;
    font: 500 0.95rem/1.2 system-ui, sans-serif;
    padding: 0.6rem 0.8rem;
    text-decoration: none;
  }
  .app-navbar__link:hover,
  .app-navbar__link:focus-visible {
    background: #27514f;
    color: #fff;
    outline: none;
  }
  .app-navbar__link[aria-current="page"] {
    background: #d89b42;
    color: #1d2b29;
  }
  @media (max-width: 600px) {
    .app-navbar { align-items: flex-start; gap: 0.5rem; }
    .app-navbar__links { width: 100%; }
    .app-navbar__link { padding: 0.55rem 0.65rem; }
  }
`;
document.head.append(styles);

const navbar = document.createElement('nav');
navbar.className = 'app-navbar';
navbar.setAttribute('aria-label', 'Main navigation');

const brand = document.createElement('span');
brand.className = 'app-navbar__brand';
brand.textContent = 'POS SYSTEM';
navbar.append(brand);

const links = document.createElement('ul');
links.className = 'app-navbar__links';

for (const item of navigationItems) {
  const link = document.createElement('a');
  const destination = new URL(item.path, appRoot);
  link.className = 'app-navbar__link';
  link.href = destination.href;
  link.textContent = item.label;

  if (destination.href === window.location.href) {
    link.setAttribute('aria-current', 'page');
  }

  const listItem = document.createElement('li');
  listItem.append(link);
  links.append(listItem);
}

navbar.append(links);
document.body.prepend(navbar);
