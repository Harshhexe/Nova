const views = {
  dashboard: {
    image: './assets/dashboard.webp',
    alt: 'NOVA dashboard with a translucent toolbar, vertical sidebar, and a flowing aurora wallpaper.',
    caption: 'A home for your favorite sites, with a look that’s yours.'
  },
  search: {
    image: './assets/search.webp',
    alt: 'NOVA’s quick search overlay showing an instant calculation.',
    caption: 'Press ⌘K to open quick search over the page you’re on.'
  },
  tabs: {
    image: './assets/tabs.webp',
    alt: 'Tab Overview with open pages arranged as floating previews.',
    caption: 'Pinch in to see every open tab together.'
  },
  wallpaper: {
    image: './assets/wallpaper.webp',
    alt: 'Wallpaper Studio showing four time-of-day color controls.',
    caption: 'Choose a wallpaper or let the colors shift with the time of day.'
  },
  tray: {
    image: './assets/tray.webp',
    alt: 'Tray with a saved link and a text snippet.',
    caption: 'Keep files, links, and snippets in reach.'
  },
  settings: {
    image: './assets/settings.webp',
    alt: 'NOVA settings with controls for the browser, sidebar, and top bar.',
    caption: 'Arrange the browser around the way you work.'
  }
};

const tabs = [...document.querySelectorAll('[role="tab"]')];
const panel = document.querySelector('#view-panel');
const caption = document.querySelector('#demo-caption');
const image = panel.querySelector('img');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
image.addEventListener('load', () => {
  if (reduceMotion.matches) return;
  image.animate([{ opacity: .45 }, { opacity: 1 }], {
    duration: 280,
    easing: 'ease-out'
  });
});
image.addEventListener('error', () => {
  caption.textContent = 'This preview couldn’t load. Select the tab to try again.';
});

function showView(tab) {
  const view = views[tab.dataset.view];
  for (const item of tabs) {
    item.setAttribute('aria-selected', String(item === tab));
    item.tabIndex = item === tab ? 0 : -1;
  }
  panel.setAttribute('aria-labelledby', tab.id);
  caption.textContent = view.caption;
  image.alt = view.alt;
  if (image.getAttribute('src') !== view.image || (image.complete && !image.naturalWidth)) {
    image.src = view.image;
  }
}

for (const [index, tab] of tabs.entries()) {
  tab.addEventListener('click', () => showView(tab));
  tab.addEventListener('keydown', event => {
    const offsets = { ArrowRight: 1, ArrowLeft: -1, Home: -index, End: tabs.length - 1 - index };
    if (!Object.hasOwn(offsets, event.key)) return;
    event.preventDefault();
    const next = tabs[(index + offsets[event.key] + tabs.length) % tabs.length];
    next.focus();
    showView(next);
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
