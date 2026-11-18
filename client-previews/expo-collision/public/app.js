(() => {
  'use strict';
  const menuButton = document.querySelector('.menu-toggle');
  const navigation = document.getElementById('main-nav');
  const closeMenu = () => {
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.querySelector('span').textContent = 'Menu';
    navigation.classList.remove('is-open');
  };
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!open));
    menuButton.querySelector('span').textContent = open ? 'Menu' : 'Close';
    navigation.classList.toggle('is-open', !open);
  });
  navigation.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && navigation.classList.contains('is-open')) {
      closeMenu(); menuButton.focus();
    }
  });

  const serviceData = {
    collision: { kicker: 'A CLEARER WAY FORWARD', title: 'Let’s put the damage\nbehind you.', description: 'Body damage can be more than a cosmetic problem. Start with an estimate, then understand the repair your vehicle needs.', points: ['Collision and dent repair', 'Body straightening', 'A clear repair estimate'], cta: 'Ask about collision repair', form: 'Collision repair' },
    paint: { kicker: 'THE FINISH MATTERS', title: 'Care you can see.\nA finish that fits.', description: 'From a scuffed panel to a new coat, careful paintwork helps your vehicle look its best. Talk to Expo about matching the color and repairing the surface.', points: ['Paint matching', 'Dent removal and bodywork', 'Top-quality paint products'], cta: 'Ask about paint & bodywork', form: 'Paint & bodywork' },
    frame: { kicker: 'LOOK BEYOND THE SURFACE', title: 'A closer look\nat the structure.', description: 'An impact may affect more than the panels you can see. Expo’s services include frame and unibody repair, straightening and alignment.', points: ['Frame straightening', 'Unibody repair', 'Alignment'], cta: 'Ask about frame repairs', form: 'Frame & alignment' },
    support: { kicker: 'YOU DON’T HAVE TO FIGURE IT OUT ALONE', title: 'Less back and forth.\nA clearer next step.', description: 'Expo helps with insurance communication and lists towing among its services. Call the team to discuss your claim, your vehicle and what happens next.', points: ['Insurance company communication', 'Towing arrangements', 'A conversation about your options'], cta: 'Ask about your next step', form: 'Not sure yet' }
  };
  const tabs = Array.from(document.querySelectorAll('.service-tab'));
  const panel = document.getElementById('service-panel');
  let selectedService = 'collision';
  const activateService = tab => {
    selectedService = tab.dataset.service;
    const service = serviceData[selectedService];
    tabs.forEach(item => {
      const active = item === tab;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-selected', String(active));
      item.tabIndex = active ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', tab.id);
    document.getElementById('service-kicker').textContent = service.kicker;
    const title = document.getElementById('service-title');
    title.replaceChildren();
    service.title.split('\n').forEach((line, index) => {
      if (index) title.append(document.createElement('br'));
      title.append(document.createTextNode(line));
    });
    document.getElementById('service-description').textContent = service.description;
    const list = document.getElementById('service-points');
    list.replaceChildren(...service.points.map(text => {
      const li = document.createElement('li'); li.textContent = text; return li;
    }));
    document.getElementById('service-cta').textContent = service.cta;
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateService(tab));
    tab.addEventListener('keydown', event => {
      let next = index;
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault(); activateService(tabs[next]); tabs[next].focus();
    });
  });
  document.getElementById('service-cta').addEventListener('click', () => {
    const selection = serviceData[selectedService].form;
    document.querySelectorAll('input[name="repair"]').forEach(input => input.checked = input.value === selection);
  });

  const form = document.getElementById('estimate-form');
  const photos = document.getElementById('photos');
  const photoError = document.getElementById('photo-error');
  const previewList = document.getElementById('photo-previews');
  const success = document.getElementById('form-success');
  let selectedPhotos = [];
  const releasePhotos = () => {
    selectedPhotos.forEach(photo => URL.revokeObjectURL(photo.url));
    selectedPhotos = [];
    photos.value = '';
    previewList.replaceChildren();
    photoError.textContent = '';
  };
  const renderPhotos = () => {
    previewList.replaceChildren(...selectedPhotos.map((photo, index) => {
      const box = document.createElement('div'); box.className = 'photo-preview';
      const image = document.createElement('img'); image.src = photo.url; image.alt = 'Sample damage photo: ' + photo.name;
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', 'Remove ' + photo.name);
      remove.addEventListener('click', () => {
        URL.revokeObjectURL(photo.url); selectedPhotos.splice(index, 1); photos.value = ''; renderPhotos();
      });
      box.append(image, remove); return box;
    }));
  };
  photos.addEventListener('change', () => {
    const files = Array.from(photos.files || []);
    releasePhotos();
    if (files.length > 4) { photoError.textContent = 'Please choose up to four sample photos.'; return; }
    if (files.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) { photoError.textContent = 'Please use JPG, PNG or WebP images.'; return; }
    if (files.some(file => file.size > 10 * 1024 * 1024)) { photoError.textContent = 'Please use images smaller than 10 MB each.'; return; }
    selectedPhotos = files.map(file => ({ name: file.name, url: URL.createObjectURL(file) }));
    renderPhotos();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    releasePhotos(); form.reset(); form.hidden = true; success.hidden = false;
    success.setAttribute('tabindex', '-1'); success.focus({ preventScroll: true });
    success.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
  });
  document.getElementById('try-again').addEventListener('click', () => {
    success.hidden = true; form.hidden = false;
    form.querySelector('input').focus({ preventScroll: true });
  });
  window.addEventListener('pagehide', releasePhotos);
})();
