const views = {
  dashboard: {
    image: './assets/dashboard.webp',
    alt: 'NOVA dashboard with a translucent toolbar, vertical sidebar, and a flowing aurora wallpaper.',
    caption: 'A home for your favorite sites, with a look that’s yours.'
  },
  search: {
    image: './assets/search.webp',
    alt: 'NOVA’s quick search overlay with a list of matching sites and suggestions.',
    caption: 'Press ⌘K to open quick search over the page you’re on.'
  },
  tabs: {
    image: './assets/tabs.webp',
    alt: 'Tab Overview with three open pages arranged as floating previews.',
    caption: 'Pinch in to see every open tab together.'
  }
};

const tabs = [...document.querySelectorAll('[role="tab"]')];
const panel = document.querySelector('#view-panel');
const caption = document.querySelector('#demo-caption');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
let requestedView = 0;

async function showView(tab) {
  const view = views[tab.dataset.view];
  if (!view) return;
  const request = ++requestedView;
  const next = new Image(1280, 774);
  next.alt = view.alt;
  next.src = view.image;
  try { await next.decode(); } catch { return; }
  if (request !== requestedView) return;
  const previous = panel.querySelector('img');
  for (const item of tabs) {
    item.setAttribute('aria-selected', String(item === tab));
    item.tabIndex = item === tab ? 0 : -1;
  }
  panel.setAttribute('aria-labelledby', tab.id);
  caption.textContent = view.caption;
  panel.replaceChildren(next);
  if (!reduceMotion.matches && previous?.src !== next.src) {
    next.animate([{ opacity: .5, transform: 'scale(.993)' }, { opacity: 1, transform: 'none' }], {
      duration: 310, easing: 'cubic-bezier(.2,.8,.2,1)'
    });
  }
}

for (const [index, tab] of tabs.entries()) {
  tab.addEventListener('click', () => void showView(tab));
  tab.addEventListener('keydown', event => {
    const offsets = { ArrowRight: 1, ArrowLeft: -1, Home: -index, End: tabs.length - 1 - index };
    if (!Object.hasOwn(offsets, event.key)) return;
    event.preventDefault();
    const next = tabs[(index + offsets[event.key] + tabs.length) % tabs.length];
    next.focus();
    void showView(next);
  });
}

if ('IntersectionObserver' in window && !reduceMotion.matches) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.animate([{ opacity: .65, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], {
        duration: 560, easing: 'cubic-bezier(.2,.75,.2,1)'
      });
      observer.unobserve(entry.target);
    }
  }, { threshold: .13 });
  document.querySelectorAll('.reveal').forEach(item => observer.observe(item));
}
