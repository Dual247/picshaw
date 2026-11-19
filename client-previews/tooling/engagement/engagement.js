/* Transport-neutral pilot. No network is performed until an audited sink is supplied.
 * Intentional engagement is not proof of prospect identity or buying intent.
 */
export function installEngagementTracker({window: w, document: d, emit, slug,
  path, expiresAt, productionHost = 'www.picshaw.com', qa = false}) {
  const allowed = new Set(['cta', 'navigation', 'service_tab', 'demo_submit']);
  if (!/^[a-z0-9-]+$/.test(slug) || !new RegExp('^/previews/(?:[a-z0-9-]+/)?'+slug+'/$').test(path) || !Number.isFinite(expiresAt)) throw Error('Invalid tracker configuration');
  const seen = new Set();
  const off = [];
  const permitted = () => !w.navigator.globalPrivacyControl &&
    !['1','yes'].includes(w.navigator.doNotTrack) && w.doNotTrack !== '1' &&
    d.visibilityState === 'visible' && !d.prerendering && Date.now() < expiresAt &&
    w.location.hostname === productionHost && w.location.pathname === path &&
    !new URLSearchParams(w.location.search).has('picshaw_no_track') &&
    (qa ? new URLSearchParams(w.location.search).get('picshaw_qa') === '1' :
      (!w.navigator.webdriver && !new URLSearchParams(w.location.search).has('picshaw_qa')));
  const report = (event, action) => {
    if (event.isTrusted !== true || !allowed.has(action) || !permitted() || seen.has(action)) return;
    seen.add(action);
    // Never transmit text, href, target IDs, form values, query strings or identity.
    emit(qa ? 'picshaw_preview_qa' : 'picshaw_preview_engaged', {company:slug,path,action});
  };
  const on = (name, handler) => {d.addEventListener(name,handler);off.push(()=>d.removeEventListener(name,handler));};
  on('click', event => {
    const el = event.target?.closest?.('a,button');
    if (!el || el.closest('form')) return; // A form button is not a completed demo.
    if (el.getAttribute('role') === 'tab') return report(event,'service_tab');
    if (el.tagName !== 'A') return;
    const href=el.getAttribute('href') || '';
    if (el.matches?.('.skip') || ['#main','#home','#top','#',''].includes(href)) return;
    if (href.startsWith('#')) report(event,'navigation');
    else if (/^(https?:|tel:|sms:|mailto:)/.test(href)) report(event,'cta');
  });
  on('keydown', event => {
    if (event.target?.getAttribute?.('role') === 'tab' && ['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) report(event,'service_tab');
  });
  on('submit', event => {if(event.target?.matches?.('.demo-form, [data-demo-form], #demo-form, #appointment-form')) report(event,'demo_submit');});
  return () => off.forEach(fn=>fn());
}
