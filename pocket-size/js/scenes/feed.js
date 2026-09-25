// The doom-scroll: a short-video feed on your phone at night. Five shorts, five seconds each,
// a different one every scroll. Videos come from js/videos.js (black screens until added).
import { VIDEOS, SECONDS_PER_SHORT, SHORTS_BEFORE_BED } from '../videos.js';
import { sfx } from '../core/audio.js';
import { unlock } from '../game/achievements.js';

const $ = (id) => document.getElementById(id);

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export class Feed {
  constructor() {
    this.el = $('feed');
    this.track = $('feed-track');
    this.index = 0;
    this.t = 0;
    this.watched = [];
    this.liked = [];
    this.active = false;
    this.onDone = null;
    this.lastLight = 0;
    this.bound = false;
  }

  start(onDone) {
    this.onDone = onDone;
    const pool = shuffle(VIDEOS.slice());
    this.shorts = [];
    for (let i = 0; i < SHORTS_BEFORE_BED; i++) this.shorts.push(pool[i % pool.length]);
    this.index = 0; this.t = 0;
    this.watched = this.shorts.map(() => false);
    this.liked = this.shorts.map(() => false);
    this.track.innerHTML = '';
    this.track.style.transform = 'translateY(0)';
    this.shorts.forEach((v, i) => this.track.appendChild(this.page(v, i)));
    $('phone').classList.remove('down');
    this.el.classList.remove('hidden');
    $('feed-help').style.opacity = 1;
    this.active = true;
    this.updateCount();
    this.playCurrent();
    if (!this.bound) this.bind();
  }

  page(v, i) {
    const d = document.createElement('div');
    d.className = 'short';
    d.style.top = `${i * 100}%`;
    let media = '<div class="blackscreen"></div>';
    if (v.src) {
      if (/\.(mp4|webm|mov|ogg)$/i.test(v.src)) media = `<video src="${v.src}" playsinline loop preload="auto"></video>`;
      else media = `<img src="${v.src}" alt="">`;
    }
    const tags = v.caption.replace(/(#\w+)/g, '<b>$1</b>');
    d.innerHTML = `${media}
      <div class="rail">
        <div class="av" style="background:hsl(${(i * 67) % 360},55%,45%)"></div>
        <div class="btn like"><span class="i">&#10084;</span><span class="n">${v.likes}</span></div>
        <div class="btn"><span class="i">&#128172;</span><span>${v.comments}</span></div>
        <div class="btn"><span class="i">&#128278;</span><span>Save</span></div>
        <div class="btn"><span class="i">&#10150;</span><span>Share</span></div>
        <div class="disc"></div>
      </div>
      <div class="meta"><div class="user">${v.user}</div><div class="cap">${tags}</div><div class="snd">&#9835; <span>${v.sound} &nbsp; &middot; &nbsp; ${v.sound}</span></div></div>
      <div class="prog"><i></i></div>`;
    d.querySelector('.like').addEventListener('click', (e) => { e.stopPropagation(); this.toggleLike(i); });
    d.addEventListener('dblclick', (e) => { this.like(i, e); });
    return d;
  }

  bind() {
    this.bound = true;
    window.addEventListener('wheel', (e) => { if (!this.active) return; if (e.deltaY > 12) this.next(); }, { passive: true });
    window.addEventListener('keydown', (e) => {
      if (!this.active) return;
      if (['ArrowDown', 'KeyS', 'PageDown', 'Space'].includes(e.code)) this.next();
      if (['ArrowUp', 'KeyW'].includes(e.code)) this.bounce(-1);
      if (e.code === 'KeyL') this.like(this.index);
    });
    let sy = null;
    const scr = $('phone-screen');
    scr.addEventListener('pointerdown', (e) => { sy = e.clientY; });
    window.addEventListener('pointerup', (e) => {
      if (!this.active || sy === null) return;
      const dy = sy - e.clientY;
      sy = null;
      if (dy > 40) this.next(); else if (dy < -40) this.bounce(-1);
    });
  }

  toggleLike(i) { if (this.liked[i]) { this.liked[i] = false; this.renderLike(i); } else this.like(i); }

  like(i, e) {
    const page = this.track.children[i];
    if (!page) return;
    if (e) {
      const r = page.getBoundingClientRect();
      const h = document.createElement('div');
      h.className = 'heart-pop'; h.innerHTML = '&#10084;';
      h.style.left = `${e.clientX - r.left}px`; h.style.top = `${e.clientY - r.top}px`;
      page.appendChild(h);
      setTimeout(() => h.remove(), 900);
    }
    if (!this.liked[i]) { this.liked[i] = true; sfx('like'); }
    this.renderLike(i);
    if (this.liked.every(Boolean)) unlock('liker');
  }

  renderLike(i) {
    const b = this.track.children[i].querySelector('.like');
    b.classList.toggle('liked', this.liked[i]);
  }

  bounce(dir) {
    this.track.style.transform = `translateY(calc(${-this.index * 100}% + ${dir * -28}px))`;
    setTimeout(() => { this.track.style.transform = `translateY(${-this.index * 100}%)`; }, 160);
  }

  next() {
    if (!this.active) return;
    if (!this.watched[this.index]) { this.bounce(1); return; }
    if (this.index >= this.shorts.length - 1) return;
    this.stopCurrent();
    this.index++;
    this.t = 0;
    sfx('scroll');
    this.track.style.transform = `translateY(${-this.index * 100}%)`;
    $('swipe-hint').classList.remove('on');
    this.updateCount();
    this.playCurrent();
  }

  playCurrent() {
    const v = this.track.children[this.index].querySelector('video');
    if (v) { v.currentTime = 0; v.muted = false; const p = v.play(); if (p && p.catch) p.catch(() => { v.muted = true; v.play().catch(() => {}); }); }
  }
  stopCurrent() {
    const v = this.track.children[this.index].querySelector('video');
    if (v) v.pause();
  }

  updateCount() { $('feed-count').textContent = `SHORT ${this.index + 1} / ${this.shorts.length}`; }

  // Returns a 0..1 "screen brightness" so the 3D room can be lit by the phone.
  update(dt) {
    if (!this.active) return 0;
    this.t += dt;
    const page = this.track.children[this.index];
    const bar = page.querySelector('.prog i');
    bar.style.width = `${Math.min(1, this.t / SECONDS_PER_SHORT) * 100}%`;
    const now = new Date();
    $('phone-time').textContent = `${((now.getHours() + 11) % 12) + 1}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (this.t >= SECONDS_PER_SHORT && !this.watched[this.index]) {
      this.watched[this.index] = true;
      if (this.index < this.shorts.length - 1) $('swipe-hint').classList.add('on');
      else this.finish();
    }
    return page.querySelector('video, img') ? 0.9 : 0.25;
  }

  finish() {
    this.active = false;
    this.stopCurrent();
    $('swipe-hint').classList.remove('on');
    $('feed-help').style.opacity = 0;
    unlock('doomscroll');
    setTimeout(() => { if (this.onDone) this.onDone(); }, 900);
  }

  putDown() {
    $('phone').classList.add('down');
    setTimeout(() => this.el.classList.add('hidden'), 1500);
  }

  hide() { this.active = false; this.stopCurrent(); this.el.classList.add('hidden'); }
}
