const appRoot = new URL('../', import.meta.url);
const navigationItems = [
  { label: 'Dashboard', path: 'index.html' },
  { label: 'Products', path: 'views/products.html' },
  { label: 'Customers', path: 'views/customers.html' },
  { label: 'Sales', path: 'views/sales.html' },
  { label: 'Reports', path: 'views/reports.html' },
  { label: 'Users', path: 'views/users.html' }
];

if (!window.location.pathname.endsWith('/login.html')) {
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
}
