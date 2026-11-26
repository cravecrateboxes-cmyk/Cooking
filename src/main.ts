import './styles.css';
import './ui.css';
import './menu.css';
import './oldtext.css';
import { App } from './app';
import { loadAssets } from './engine/assets';
import { renderIcons } from './ui/icons';

declare global {
  interface Window {
    ready?: boolean;
    app?: App;
  }
}


async function boot(): Promise<void> {
  const canvas = document.getElementById('gl') as HTMLCanvasElement;
  const ui = document.getElementById('ui') as HTMLElement;
  const fill = document.getElementById('load-fill');
  await document.fonts.ready;
  await loadAssets((f) => {
    if (fill) fill.style.width = `${Math.round(f * 100)}%`;
  });
  const app = new App(canvas, ui, (r) =>
    renderIcons(r, [
      'item_coin', 'item_gem', 'item_cash', 'st_grill',
      'cos_hat_cap', 'cos_hat_crown', 'cos_hat_cowboy', 'cos_hat_toque', 'cos_fit_apron', 'cos_fit_bowtie', 'cos_fit_scarf',
      'cos_shoe_sneaker_l', 'cos_shoe_boot_l', 'red_carpet',
    ]),
  );
  app.start(app.save.current);
  app.openMenu();
  document.getElementById('loader')?.classList.add('done');
  app.frame();
  window.app = app;
  window.ready = true;
}

boot().catch((e: unknown) => {
  console.error('Order Up failed to start', e);
  const l = document.getElementById('loader');
  if (l) l.dataset.error = 'Something went wrong while loading. Reload the page to try again.';
});
