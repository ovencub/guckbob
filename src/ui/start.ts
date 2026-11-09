// 시작 화면: 이어하기 / 새로 시작 + 가게 이름 입력. 도전장 링크로 들어오면 도전장 카드를 먼저 보여준다.
import { esc } from './prep/cards';

export const NAME_MAX = 12;
export const DEFAULT_NAME = '고양이 국밥';

export interface StartOpts {
  saveDay: number | null;          // 이어할 저장이 있으면 일차
  challenge: { name: string; days: number; minutes: number; title: string } | null;
  onContinue(): void;
  onNew(name: string): void;
}

export function cleanName(v: string): string {
  const t = v.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, NAME_MAX);
  return t || DEFAULT_NAME;
}

export function askName(root: HTMLElement, cur: string, title: string, done: (name: string | null) => void): void {
  const el = document.createElement('div');
  el.className = 'overlay modal';
  el.innerHTML = `<div class="paper"><div class="ph">${esc(title)}</div>
    <input class="name-in" maxlength="${NAME_MAX}" value="${esc(cur)}" aria-label="가게 이름" />
    <div class="hint">최대 ${NAME_MAX}자 · 간판과 결과 카드에 나와요</div>
    <div class="btns"><button class="btn ghost tap" type="button" data-a="no">취소</button><button class="btn main tap" type="button" data-a="ok">정하기</button></div></div>`;
  root.appendChild(el);
  const inp = el.querySelector('input') as HTMLInputElement;
  inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { el.remove(); done(cleanName(inp.value)); } });
  el.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest('[data-a]')?.getAttribute('data-a');
    if (a === 'ok') { el.remove(); done(cleanName(inp.value)); }
    if (a === 'no') { el.remove(); done(null); }
  });
}

export function showStart(root: HTMLElement, o: StartOpts): () => void {
  const el = document.createElement('div');
  el.className = 'overlay start';
  const ch = o.challenge;
  el.innerHTML = `
    <div class="title-box">
      <div class="logo">고양이 국밥집</div>
      <div class="sub">탭 한 번에 국밥이 날아간다! 며칠 만에 미슐랭?</div>
    </div>
    ${ch ? `<div class="paper challenge"><div class="ph">도전장 도착!</div>
      <div class="ch-main"><b>${esc(ch.name)}</b>의 기록</div><div class="ch-big">${ch.days}일 만에 미슐랭</div>
      <div class="ch-sub">${esc(ch.title)} · ${ch.minutes}분</div></div>` : ''}
    <div class="start-btns">
      ${o.saveDay !== null && !ch ? `<button class="btn main big tap" type="button" data-a="cont">이어하기 <small>${o.saveDay}일차</small></button>` : ''}
      <button class="btn ${o.saveDay !== null && !ch ? 'ghost' : 'main'} big tap" type="button" data-a="new">${ch ? '나도 도전하기' : '새로 시작'}</button>
    </div>
    <div class="credit">고양이 손님을 받아 소상공인에서 미슐랭까지 · 소리는 첫 탭 이후</div>`;
  root.appendChild(el);
  const close = () => el.remove();
  el.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest('[data-a]')?.getAttribute('data-a');
    if (a === 'cont') { close(); o.onContinue(); }
    if (a === 'new') {
      askName(root, DEFAULT_NAME, '가게 이름을 정해 주세요', (name) => { if (name) { close(); o.onNew(name); } });
    }
  });
  return close;
}
