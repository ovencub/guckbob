import { describe, expect, it } from 'vitest';
import { hire } from '../src/sim/catalog';
import { chefStations } from '../src/sim/geometry';
import { geoOf } from '../src/sim/state';
import * as cmd from '../src/sim/commands';
import { openDay, putOnPass, run, seatNow } from './helpers';

describe('직원 AI (GDD 6장)', () => {
  it('주방장 한 명은 화구 최대 2개', () => {
    const st = chefStations(geoOf(3), 6, 1);
    expect(st[0].burners.length).toBe(2);
    const st3 = chefStations(geoOf(3), 6, 3);
    expect(st3.map((x) => x.burners.length)).toEqual([2, 2, 2]);
  });

  it('주방장 1명 + 화구 3개: 동시에 조리하는 건 2개까지', () => {
    const { s, ev } = openDay(1, (g) => { hire(g, 'chef', 0); g.burners = 3; });
    seatNow(s, 4, 1, ['sundae', 'sundae', 'sundae', 'sundae']);
    run(s, 0.2, ev);
    expect(s.dayState!.burners.filter((b) => b.phase === 'cooking').length).toBe(2);
  });

  it('주방장 조리 속도 배수와 맛', () => {
    const { s, ev } = openDay(1, (g) => { hire(g, 'chef', 3); g.taste = 1; });
    seatNow(s, 1, 0, ['sundae']);
    run(s, 0.1, ev);
    const b = s.dayState!.burners.find((x) => x.phase === 'cooking')!;
    expect(b.dur).toBeCloseTo(3 / 1.8);
    expect(b.taste).toBe(7);
  });

  it('서버 우선순위: 배식대 서빙이 주문 받기보다 먼저', () => {
    const { s, ev } = openDay(1, (g) => hire(g, 'server', 3));
    seatNow(s, 1, 0, ['sundae'], false);
    seatNow(s, 1, 1, ['sundae'], true);
    putOnPass(s, 'sundae');
    run(s, 0.1, ev);
    const srv = s.dayState!.cats.find((c) => c.kind === 'server')!;
    expect(srv.task?.k).toBe('pick');
  });

  it('서버가 주문을 받고 국밥을 날라 준다 (친절도 = 서버 등급)', () => {
    const { s, ev } = openDay(1, (g) => hire(g, 'server', 3));
    const t = seatNow(s, 1, 1, ['sundae'], false);
    run(s, 4, ev);
    expect(t.orderTaken).toBe(true);
    putOnPass(s, 'sundae');
    run(s, 6, ev);
    expect(t.orders[0].served).toBe(true);
    expect(t.orders[0].kind).toBe(10);
  });

  it('개수대가 꽉 차면 서버는 치우지 않는다', () => {
    const { s, ev } = openDay(1, (g) => hire(g, 'server', 3));
    const ds = s.dayState!;
    ds.tables[1].dirty = true; ds.tables[1].coins = 9000; ds.tables[1].bowls = 2;
    ds.sink = 7;
    run(s, 5, ev);
    expect(ds.tables[1].dirty).toBe(true);
    const srv = ds.cats.find((c) => c.kind === 'server')!;
    expect(srv.task?.k ?? 'none').not.toBe('clean');
    ds.sink = 0;
    run(s, 6, ev);
    expect(ds.tables[1].dirty).toBe(false);
  });

  it('설거지 알바: 등급별 세척 시간', () => {
    const { s, ev } = openDay(1, (g) => hire(g, 'dish', 3));
    s.dayState!.sink = 4;
    s.dayState!.clean = 0;
    run(s, 1.05, ev);
    expect(s.dayState!.clean).toBe(4);
  });

  it('플레이어가 먼저 처리하면 서버는 그 일을 내려놓는다', () => {
    const { s, ev } = openDay(1, (g) => hire(g, 'server', 0));
    const t = seatNow(s, 1, 2, ['sundae'], false);
    run(s, 0.2, ev);
    cmd.takeOrder(s, 2, ev);
    run(s, 0.5, ev);
    expect(t.orderTaken).toBe(true);
    const srv = s.dayState!.cats.find((c) => c.kind === 'server')!;
    expect(srv.task?.k === 'order').toBe(false);
  });
});
