// Dev page for the DMV photo booth creator.
// URL params: ?section=face (open a form section), ?lang=es, ?photo=1 (run the photo routine
// right away), ?nosave=1 (don't start a life; stop after the license card).
import { runState } from './harness.js';
import { CreatorState } from '../src/states/creator.js';
import { settings } from '../src/core/settings.js';

const q = new URLSearchParams(location.search);
if (q.get('lang')) settings.set('language', q.get('lang'));

class DevCreator extends CreatorState {
  async enter(params) {
    await super.enter(params);
    if (q.get('nosave') === '1') this.noSave = true;
    if (q.get('photo') === '1') setTimeout(() => this._takePhoto(), 800);
  }
}

runState(DevCreator, {}).then((engine) => {
  window.__creator = engine.state;
});
