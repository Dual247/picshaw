'use strict';

const menuButton = document.querySelector('.menu-toggle');
const mainNav = document.querySelector('#main-nav');
function closeMenu() {
  mainNav.classList.remove('is-open');
  menuButton.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('menu-open');
}
menuButton.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') !== 'true';
  mainNav.classList.toggle('is-open', isOpen);
  menuButton.setAttribute('aria-expanded', String(isOpen));
  document.body.classList.toggle('menu-open', isOpen);
});
mainNav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => {
  if (menuButton.getAttribute('aria-expanded') !== 'true') return;
  if (event.key === 'Escape') { closeMenu(); menuButton.focus(); }
  if (event.key === 'Tab') {
    const items = [menuButton, ...mainNav.querySelectorAll('a')];
    const first = items[0]; const last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
window.matchMedia('(min-width: 951px)').addEventListener('change', event => { if (event.matches) closeMenu(); });

const services = {
  repair: { title: 'Small marks. Considered repairs.', description: 'Dings, scratches, watermarks and wear can interrupt an otherwise beautiful finish. Discuss touch-ups, gluing and color matching for furniture, built-ins or a property-wide refresh.', note: 'On-site work is available for hospitality properties and pieces you prefer not to transport.', link: 'Ask about repair & touch-up', value: 'Repair & touch-up' },
  finish: { title: 'Keep the character. Refine the finish.', description: 'From French polishing and waxing to staining, lacquers and varnishes. Explore a finish that respects an antique or a color change that suits the next chapter of a room.', note: 'Hospitality services include on-site color matching, correction and changes.', link: 'Talk about a finish', value: 'Finishing & color work' },
  custom: { title: 'Made for the way you see it.', description: 'Discuss cabinetry and furniture made to your specifications, with your choice of wood and finish. Custom and specialty pieces can bring a distinct character to a home or hospitality property.', note: 'Share your ideas, the setting and the details that matter to your project.', link: 'Discuss custom woodwork', value: 'Custom woodwork' },
  training: { title: 'Traditional skills, passed on.', description: 'Murphy’s Master Class, hands-on guidance and on-site consulting give tradespeople and people learning the craft a way to explore restoration and refinishing techniques with Paul.', note: 'Talk to Paul about the skills you want to develop or the work your team is planning.', link: 'Ask about training & consulting', value: 'Training & consulting' }
};
const tabs = [...document.querySelectorAll('.craft-tabs [role="tab"]')];
const panel = document.querySelector('#craft-panel');
const serviceSelect = document.querySelector('#project-service');
let activeService = 'repair';
function selectService(key, shouldFocus = false) {
  if (!services[key]) return;
  activeService = key;
  tabs.forEach(tab => {
    const selected = tab.dataset.service === key;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected && shouldFocus) tab.focus();
  });
  panel.setAttribute('aria-labelledby', `tab-${key}`);
  document.querySelector('#craft-panel-title').textContent = services[key].title;
  document.querySelector('#craft-panel-description').textContent = services[key].description;
  document.querySelector('#craft-panel-note').textContent = services[key].note;
  document.querySelector('#craft-enquiry').textContent = services[key].link;
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectService(tab.dataset.service));
  tab.addEventListener('keydown', event => {
    let nextIndex = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else return;
    event.preventDefault(); selectService(tabs[nextIndex].dataset.service, true);
  });
});
document.querySelector('#craft-enquiry').addEventListener('click', () => {
  serviceSelect.value = services[activeService].value;
  if (activeService === 'custom' || activeService === 'training') document.querySelector('input[name="projectType"][value="Custom or other"]').checked = true;
});
document.querySelectorAll('[data-project]').forEach(link => link.addEventListener('click', () => {
  const target = [...document.querySelectorAll('input[name="projectType"]')].find(input => input.value === link.dataset.project);
  if (target) target.checked = true;
  if (link.dataset.project === 'Home or antique') serviceSelect.value = 'Antique restoration';
  else serviceSelect.value = 'Repair & touch-up';
}));
document.querySelectorAll('[data-service-choice]').forEach(link => link.addEventListener('click', () => {
  serviceSelect.value = link.dataset.serviceChoice;
  document.querySelector('input[name="projectType"][value="Custom or other"]').checked = true;
}));

const galleryImages = [
  { src: './assets/masterclass-finish.jpg', title: 'Fine finishing & traditional techniques', alt: 'A collection of wood finishing and restoration techniques from the company’s website' },
  { src: './assets/consulting-service.jpg', title: 'Architectural woodwork & cabinetry', alt: 'Timber paneling, cabinetry and shelving used as service imagery on the company’s website' },
  { src: './assets/specialty-interior.jpg', title: 'Furniture for distinctive interiors', alt: 'A timber interior used to illustrate custom and specialty furniture services' }
];
const dialog = document.querySelector('#image-dialog');
let imageIndex = 0;
let galleryTrigger;
function showImage(index) {
  imageIndex = (index + galleryImages.length) % galleryImages.length;
  const selected = galleryImages[imageIndex];
  document.querySelector('#dialog-title').textContent = selected.title;
  const image = document.querySelector('#dialog-image');
  image.src = selected.src; image.alt = selected.alt;
}
document.querySelectorAll('[data-gallery]').forEach(button => button.addEventListener('click', () => {
  galleryTrigger = button;
  showImage(Number(button.dataset.gallery));
  dialog.showModal();
  document.body.classList.add('dialog-open');
}));
document.querySelector('#dialog-close').addEventListener('click', () => dialog.close());
document.querySelector('#dialog-previous').addEventListener('click', () => showImage(imageIndex - 1));
document.querySelector('#dialog-next').addEventListener('click', () => showImage(imageIndex + 1));
dialog.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft') { event.preventDefault(); showImage(imageIndex - 1); }
  if (event.key === 'ArrowRight') { event.preventDefault(); showImage(imageIndex + 1); }
});
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const box = dialog.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
});
dialog.addEventListener('close', () => {
  document.body.classList.remove('dialog-open');
  if (galleryTrigger) galleryTrigger.focus();
});

const form = document.querySelector('#project-form');
const fileInput = document.querySelector('#project-photos');
const photoList = document.querySelector('#photo-list');
const error = document.querySelector('#form-error');
const success = document.querySelector('#form-success');
let photos = [];
function setError(message) { error.textContent = message; error.hidden = !message; }
function clearPhotos() {
  photos.forEach(photo => URL.revokeObjectURL(photo.url));
  photos = []; fileInput.value = ''; photoList.replaceChildren();
}
function renderPhotos() {
  photoList.replaceChildren();
  photos.forEach((photo, index) => {
    const wrapper = document.createElement('div'); wrapper.className = 'photo-preview';
    const image = document.createElement('img'); image.src = photo.url; image.alt = `Local preview of ${photo.name}`;
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', `Remove ${photo.name}`);
    remove.addEventListener('click', () => {
      URL.revokeObjectURL(photos[index].url); photos.splice(index, 1); renderPhotos();
      if (photos.length) photoList.querySelector('button').focus(); else fileInput.focus();
    });
    wrapper.append(image, remove); photoList.append(wrapper);
  });
}
fileInput.addEventListener('change', () => {
  setError(''); let message = '';
  for (const file of [...fileInput.files]) {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) { message = 'Please choose JPG, PNG, WebP or GIF images.'; continue; }
    if (file.size > 10 * 1024 * 1024) { message = 'Each image must be 10 MB or smaller.'; continue; }
    if (photos.length >= 4) { message = 'This demonstration accepts up to four images.'; break; }
    photos.push({ name: file.name, url: URL.createObjectURL(file) });
  }
  fileInput.value = ''; renderPhotos(); if (message) setError(message);
});
form.addEventListener('input', event => { event.target.removeAttribute('aria-invalid'); if (!error.hidden) setError(''); });
form.addEventListener('submit', event => {
  event.preventDefault(); setError('');
  const required = ['project-name', 'project-contact', 'project-location', 'project-details'].map(id => document.getElementById(id));
  let firstInvalid;
  for (const field of required) {
    const value = field.value.trim();
    const validContact = field.id !== 'project-contact' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || (/^[+\d\s().-]+$/.test(value) && value.replace(/\D/g, '').length >= 7);
    const valid = value.length > 0 && validContact;
    field.setAttribute('aria-invalid', String(!valid));
    if (!valid && !firstInvalid) firstInvalid = field;
  }
  if (firstInvalid) {
    setError(firstInvalid.id === 'project-contact' ? 'Please add an email address or a phone number with at least seven digits.' : 'Please add your name, contact details, project location and a short description.');
    firstInvalid.focus(); return;
  }
  // Local demonstration only: no request, storage or customer-data submission.
  form.reset(); required.forEach(field => field.removeAttribute('aria-invalid')); clearPhotos();
  form.hidden = true; success.hidden = false; success.focus();
});
// The disabled HTML button cannot submit until the local handler is installed.
form.querySelector('button[type="submit"]').disabled = false;
document.querySelector('#reset-form').addEventListener('click', () => {
  success.hidden = true; form.hidden = false; document.querySelector('#project-name').focus();
});
window.addEventListener('pagehide', () => { clearPhotos(); form.reset(); });
