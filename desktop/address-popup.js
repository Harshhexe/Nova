const list = document.querySelector('#rows');

window.addressPopup.update(({ rows, selected }) => {
  const items = rows.map(({ title, kind }, index) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', String(index === selected));
    const icon = document.createElement('span');
    icon.className = 'row-icon ' + kind;
    icon.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'row-title';
    label.textContent = title;
    item.append(icon, label);
    item.addEventListener('mousedown', event => event.preventDefault());
    item.addEventListener('click', () => window.addressPopup.select(index));
    return item;
  });
  list.replaceChildren(...items);
});
