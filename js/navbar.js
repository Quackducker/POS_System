import { supabase } from '../supabase.js';

const appRoot = new URL('../', import.meta.url);
const allNavigationItems = [
  { label: 'Dashboard', path: 'index.html', roles: ['Administrator', 'Manager', 'Cashier', 'Inventory Staff'] },
  { label: 'Products', path: 'views/products.html', roles: ['Administrator', 'Manager', 'Inventory Staff'] },
  { label: 'Customers', path: 'views/customers.html', roles: ['Administrator', 'Manager', 'Cashier'] },
  { label: 'Sales', path: 'views/sales.html', roles: ['Administrator', 'Manager', 'Cashier'] },
  { label: 'History', path: 'views/history.html', roles: ['Administrator', 'Manager', 'Cashier'] },
  { label: 'Reports', path: 'views/reports.html', roles: ['Administrator', 'Manager'] },
  { label: 'Users', path: 'views/users.html', roles: ['Administrator'] }
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
  navbar.append(links);

  async function buildNavigation() {
    const demoProfile = localStorage.getItem('pos_demo_profile');
    if (demoProfile) {
      try {
        const profile = JSON.parse(demoProfile);
        const role = profile.role;
        const displayName = profile.full_name;
        for (const item of allNavigationItems) {
          if (!item.roles.includes(role)) continue;
          const link = document.createElement('a');
          const destination = new URL(item.path, appRoot);
          link.className = 'app-navbar__link';
          link.href = destination.href;
          link.textContent = item.label;
          if (destination.href === window.location.href) link.setAttribute('aria-current', 'page');
          const listItem = document.createElement('li');
          listItem.append(link);
          links.append(listItem);
        }
        const sessionArea = document.createElement('span');
        sessionArea.className = 'app-navbar__session';
        const name = document.createElement('span');
        name.className = 'app-navbar__user';
        name.textContent = `${displayName} · ${role} (Demo)`;
        const logout = document.createElement('button');
        logout.type = 'button'; logout.className = 'app-navbar__logout'; logout.textContent = 'Logout';
        logout.addEventListener('click', () => { localStorage.removeItem('pos_demo_profile'); window.location.href = new URL('login.html', appRoot).href; });
        sessionArea.append(name, logout);
        navbar.append(sessionArea);
        return;
      } catch { localStorage.removeItem('pos_demo_profile'); }
    }

    const { data: { session } } = await supabase.auth.getSession();
    let role = 'Cashier';
    let displayName = '';

    if (session) {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      if (profile?.active === false) {
        await supabase.auth.signOut();
        window.location.href = new URL('login.html', appRoot).href;
        return;
      }
      role = profile?.role || 'Cashier';
      displayName = profile?.full_name || profile?.username || session.user.email;
    } else {
      window.location.href = new URL('login.html', appRoot).href;
      return;
    }

    for (const item of allNavigationItems) {
      if (!item.roles.includes(role)) continue;
      const link = document.createElement('a');
      const destination = new URL(item.path, appRoot);
      link.className = 'app-navbar__link';
      link.href = destination.href;
      link.textContent = item.label;
      if (destination.href === window.location.href) link.setAttribute('aria-current', 'page');
      const listItem = document.createElement('li');
      listItem.append(link);
      links.append(listItem);
    }

    const sessionArea = document.createElement('span');
    sessionArea.className = 'app-navbar__session';
    const name = document.createElement('span');
    name.className = 'app-navbar__user';
    name.textContent = `${displayName} · ${role}`;
    const logout = document.createElement('button');
    logout.type = 'button';
    logout.className = 'app-navbar__logout';
    logout.textContent = 'Logout';
    logout.addEventListener('click', async () => {
      localStorage.removeItem('pos_demo_profile');
      await supabase.auth.signOut();
      window.location.href = new URL('login.html', appRoot).href;
    });
    sessionArea.append(name, logout);
    navbar.append(sessionArea);
  }

  document.body.prepend(navbar);
  buildNavigation();
}

