'use strict';

const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#primary-nav');
function closeMenu() {
  menuButton.setAttribute('aria-expanded', 'false');
  navigation.classList.remove('is-open');
  document.body.classList.remove('menu-open');
}
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  navigation.classList.toggle('is-open', open);
  document.body.classList.toggle('menu-open', open);
});
navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    menuButton.focus();
  }
});
window.matchMedia('(min-width: 951px)').addEventListener('change', event => {
  if (event.matches) closeMenu();
});

const services = {
  drains: { kicker: 'LET’S KEEP THINGS MOVING', title: 'Clear drains. Less disruption.', description: 'A slow sink or a recurring backup deserves attention. Ask about drain cleaning for your home or commercial property.', image: 'sc-hydrojetting.webp', alt: 'Drain service illustration from the company’s website', link: 'Ask about drain cleaning', value: 'Drain cleaning' },
  hydrojetting: { kicker: 'FOR THE TOUGHER BUILDUP', title: 'A fresh start for your pipes.', description: 'Hydrojetting uses a high-powered stream of water to clear debris. Talk to the team about whether it suits your drain or sewer problem.', image: 'sc-hydrojetting.webp', alt: 'Hydrojetting service image published on the company’s website', link: 'Ask about hydrojetting', value: 'Hydrojetting' },
  inspection: { kicker: 'SEE WHAT’S GOING ON', title: 'A closer look, below the surface.', description: 'A sewer line video inspection helps show what’s happening inside the pipe. Useful when investigating a blockage or planning a project.', image: 'sc-video-inspection.webp', alt: 'Sewer inspection service equipment pictured on the company’s website', link: 'Ask about an inspection', value: 'Sewer video inspection' },
  repiping: { kicker: 'FOR THE PLUMBING YOU RELY ON', title: 'Give the essentials some attention.', description: 'Damaged drain lines and aging water pipes need a considered plan. Discuss drain line and water repiping for your property.', image: 'sc-commercial.webp', alt: 'Plumbing fixtures shown in service imagery from the company’s website', link: 'Ask about repiping', value: 'Drain and water repiping' },
  heaters: { kicker: 'A LITTLE MORE EVERYDAY COMFORT', title: 'Ready for your next water heater?', description: 'Thinking about a tankless water heater? Get help with a replacement or upgrade that fits your property’s needs.', image: 'sc-water-heater.webp', alt: 'Tankless water heater service image from the company’s website', link: 'Talk about a water heater', value: 'Tankless water heater' },
  gas: { kicker: 'CARE FOR THE CONNECTIONS', title: 'Gas line help for your property.', description: 'Talk to Second City Plumbing about gas line services and repairs for your home or commercial property.', image: 'sc-truck.webp', alt: 'Second City Plumbing’s branded service van', link: 'Ask about gas line work', value: 'Gas line service', safety: 'Suspect an active gas leak? Leave the area and contact your gas utility or emergency services first.' }
};
const tabs = [...document.querySelectorAll('.service-tab')];
const panel = document.querySelector('#service-panel');
const quoteLink = document.querySelector('#service-quote');
const serviceSelect = document.querySelector('#service-select');
let selectedService = 'drains';
function selectService(key, focus = false) {
  if (!services[key]) return;
  selectedService = key;
  const service = services[key];
  tabs.forEach(tab => {
    const active = tab.dataset.service === key;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    if (active && focus) { tab.focus(); tab.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  });
  panel.setAttribute('aria-labelledby', `tab-${key}`);
  document.querySelector('#service-kicker').textContent = service.kicker;
  document.querySelector('#service-title').textContent = service.title;
  document.querySelector('#service-description').textContent = service.description;
  const image = document.querySelector('#service-image');
  image.src = `./assets/${service.image}`;
  image.alt = service.alt;
  const safety = document.querySelector('#service-safety');
  safety.hidden = !service.safety;
  safety.textContent = service.safety || '';
  quoteLink.textContent = service.link;
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectService(tab.dataset.service));
  tab.addEventListener('keydown', event => {
    let target = index;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') target = (index + 1) % tabs.length;
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') target = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = tabs.length - 1;
    else return;
    event.preventDefault();
    selectService(tabs[target].dataset.service, true);
  });
});
const compactServices = window.matchMedia('(max-width: 700px)');
function updateTabOrientation() {
  document.querySelector('.service-tabs').setAttribute('aria-orientation', compactServices.matches ? 'horizontal' : 'vertical');
}
compactServices.addEventListener('change', updateTabOrientation);
updateTabOrientation();
quoteLink.addEventListener('click', () => { serviceSelect.value = services[selectedService].value; });
document.querySelectorAll('[data-project]').forEach(link => link.addEventListener('click', () => {
  const choice = document.querySelector(`input[name="property"][value="${link.dataset.project}"]`);
  if (choice) choice.checked = true;
  serviceSelect.value = 'Commercial plumbing';
}));

const form = document.querySelector('#quote-form');
const fileInput = document.querySelector('#photos');
const photoList = document.querySelector('#photo-list');
const errorMessage = document.querySelector('#form-error');
const success = document.querySelector('#form-success');
let photos = [];
function setError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = !message;
}
function clearPhotos() {
  photos.forEach(photo => URL.revokeObjectURL(photo.url));
  photos = [];
  fileInput.value = '';
  photoList.replaceChildren();
}
function renderPhotos() {
  photoList.replaceChildren();
  photos.forEach((photo, index) => {
    const item = document.createElement('div');
    item.className = 'photo-thumb';
    const img = document.createElement('img');
    img.src = photo.url;
    img.alt = `Local preview of ${photo.name}`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Remove ${photo.name}`);
    remove.addEventListener('click', () => {
      URL.revokeObjectURL(photos[index].url);
      photos.splice(index, 1);
      renderPhotos();
      if (photos.length) photoList.querySelector('button').focus();
      else fileInput.focus();
    });
    item.append(img, remove);
    photoList.append(item);
  });
}
fileInput.addEventListener('change', () => {
  setError('');
  const chosen = [...fileInput.files];
  let rejected = '';
  for (const file of chosen) {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) { rejected = 'Please choose JPG, PNG, WebP or GIF images.'; continue; }
    if (file.size > 10 * 1024 * 1024) { rejected = 'Each photo must be 10 MB or smaller.'; continue; }
    if (photos.length >= 4) { rejected = 'This demo accepts up to four photos.'; break; }
    photos.push({ name: file.name, url: URL.createObjectURL(file) });
  }
  fileInput.value = '';
  renderPhotos();
  if (rejected) setError(rejected);
});
form.addEventListener('input', event => {
  event.target.removeAttribute('aria-invalid');
  if (!errorMessage.hidden) setError('');
});
form.addEventListener('submit', event => {
  event.preventDefault();
  setError('');
  const required = ['name', 'phone', 'area', 'details'].map(id => document.getElementById(id));
  let firstInvalid;
  for (const field of required) {
    const valid = field.value.trim().length > 0 && (field.id !== 'phone' || field.value.replace(/\D/g, '').length >= 7);
    field.setAttribute('aria-invalid', String(!valid));
    if (!valid && !firstInvalid) firstInvalid = field;
  }
  if (firstInvalid) {
    setError(firstInvalid.id === 'phone' ? 'Please add a phone number with at least seven digits.' : 'Please complete your name, phone, neighborhood and a few project details.');
    firstInvalid.focus();
    return;
  }
  // This is a deliberately local demonstration: there is no network request,
  // persistence, analytics, email action, or customer-data submission.
  form.reset();
  required.forEach(field => field.removeAttribute('aria-invalid'));
  clearPhotos();
  form.hidden = true;
  success.hidden = false;
  success.focus();
});
// Enable submission only after the local-only handler is registered.
form.querySelector('button[type="submit"]').disabled = false;
document.querySelector('#reset-demo').addEventListener('click', () => {
  success.hidden = true;
  form.hidden = false;
  document.querySelector('#name').focus();
});
window.addEventListener('pagehide', () => {
  clearPhotos();
  form.reset();
});
