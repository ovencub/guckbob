# GuckBob 진행 모델 — "평균 플레이어가 미슐랭까지 몇 일, 몇 분" 을 계산한다.
# 실행: python tools/progression_model.py
# ※ 모든 '가정' 값은 ASSUME 에 모았다. 실제 봇 시뮬레이션(npm run sim)으로 다시 검증해야 하는 추정치다.
import math

ASSUME = dict(
    actions_per_sec=1.3,     # 평균 플레이어 유효 탭 속도(실수·망설임 포함). 숙련자 2.0
    attention=0.85,          # 영업 시간 중 실제로 손이 움직이는 비율
    trip_tiles=8,            # 서버 왕복 평균 칸 수
    prep_base_sec=15,        # 정비 화면 기본 체류
    prep_per_buy_sec=4,      # 구매 1건당 추가 체류
    settle_sec=8, overtime_sec=8, countdown_sec=3,
)
DAY = 120
REVIEW_WINDOW = 50   # 가게 별점 = 최근 리뷰 50건 평균
LAM_BASE, LAM_PER_STAR = 7.0, 3.0   # 분당 손님 팀 = (기본 + 별점당) × 홍보 × 티어배수
MENU = {'s': (9000, 3600, 3.0), 'h': (10000, 4000, 3.5), 'y': (24000, 10000, 5.0)}
EAT, ORDER_DELAY, SERVE_DELAY, CLEAN_DELAY, WALK_IN = 5.0, 1.5, 1.2, 1.5, 1.5
CHEF = {1: (1.0, 2, 30000), 2: (1.25, 3, 50000), 3: (1.5, 5, 80000), 4: (1.8, 6, 120000)}   # 속도배수, 맛, 일당
SERVER = {1: (3.5, 1, 4, 25000), 2: (4.5, 2, 6, 40000), 3: (5.5, 2, 8, 65000), 4: (6.5, 3, 10, 100000)}  # 칸/초, 운반, 친절, 일당
DISH = {1: (0.9, 20000), 2: (0.6, 30000), 3: (0.4, 45000), 4: (0.25, 60000)}
LAYOUT = {1: ([2, 4, 4], 20000), 2: ([2, 4, 4, 4, 2], 35000), 3: ([2, 4, 4, 4, 2, 6, 4], 60000), 4: ([2, 4, 4, 4, 2, 6, 4, 8, 4, 4], 110000)}
TIERS = [('소상공인', 0, 0, 1.0), ('동네 맛집', 1.5, 160000, 1.1), ('줄서는 맛집', 2.4, 400000, 1.25),
         ('블루리본', 3.4, 900000, 1.4), ('관광맛집', 4.0, 1600000, 1.6), ('미슐랭', 4.5, 2300000, 1.8)]
GW = {1: 30, 2: 34, 3: 14, 4: 12, 5: 4, 6: 3, 7: 2, 8: 1}

VIP_COST = 1800000
# 구매 순서(봇의 단순 전략과 같게): (항목, 비용 또는 직원 등급, 필요 티어 index). 비용은 GDD 7~10장과 같다
B = 25000  # 그릇 +2개
PLAN = [('menu_h', 60000, 0), ('bowls', B, 0), ('server', 1, 0), ('chef', 1, 0), ('burner', 60000, 0),
        ('recipe', 50000, 0), ('sink', 50000, 0), ('bowls', B, 0), ('kiosk', 150000, 0),
        ('layout', 375000, 0), ('chef_up', 2, 0), ('server_up', 2, 0), ('recipe', 180000, 0), ('menu_y', 270000, 1),
        ('dish', 1, 0), ('burner', 225000, 0), ('bowls', B, 0), ('bowls', B, 0), ('cost', 90000, 0),
        ('chef', 2, 0), ('promo_google', 135000, 1),
        ('layout', 900000, 1), ('chef_up', 3, 1), ('server_up', 3, 1), ('server', 3, 1), ('recipe', 420000, 2), ('sink', 225000, 0),
        ('burner', 450000, 0), ('bowls', B, 0), ('bowls', B, 0), ('bowls', B, 0), ('cost', 180000, 0), ('dish_up', 3, 1),
        ('promo_youtube', 300000, 2),
        ('layout', 1950000, 2), ('chef_up', 4, 2), ('server_up', 4, 2), ('chef', 4, 2), ('recipe', 900000, 3), ('burner', 750000, 0),
        ('sink', 525000, 0), ('bowls', B, 0), ('bowls', B, 0), ('bowls', B, 0), ('bowls', B, 0),
        ('dish_up', 4, 2), ('cost', 360000, 0), ('vip', VIP_COST, 4)]   # TV 출연은 봇이 사지 않는다(과부하 위험)
PROMO = {'promo_google': (0.45, 3), 'promo_youtube': (0.7, 3), 'promo_tv': (1.1, 4), 'vip': (0.0, 1)}   # 귀빈 방문은 손님을 늘리지 않는다
WAGE_OF = lambda kind, t: {'chef': CHEF, 'server': SERVER, 'dish': DISH}[kind][t][-1]

def group_dist(maxcap):
    w = {k: v for k, v in GW.items() if k <= maxcap}; s = sum(w.values()); return {k: v / s for k, v in w.items()}

def C(T, K): return 0.5 + 4.5 * (0.6 * (T - 1) / 9 + 0.4 * K / 10)

def day_result(st, R, A):
    tabs, rent = LAYOUT[st['layout']]
    gd = group_dist(max(tabs)); avg = sum(k * v for k, v in gd.items())
    menus = [m for m in 'shy' if st['menus'][m]]
    mix = {'s': .5, 'h': .35, 'y': .15}; mix = {m: mix[m] for m in menus}; t = sum(mix.values()); mix = {m: v / t for m, v in mix.items()}
    if 'y' in mix and avg < 2: mix['y'] *= 0.5
    promo = min(2.0, sum(v for v, d in st['promos'].values()))
    lam = (LAM_BASE + LAM_PER_STAR * R) * (1 + promo) * TIERS[st['tier']][3]
    demand = lam * DAY / 60 * avg
    chefs = sorted(st['chefs'], reverse=True)
    chef_burners = min(st['burners'], 2 * len(chefs))
    cm = (sum(CHEF[c][0] for c in chefs) / len(chefs)) if chefs else 1.0
    base_cook = sum(mix[m] * MENU[m][2] for m in mix)
    cook = (base_cook / cm * chef_burners + base_cook * (st['burners'] - chef_burners)) / st['burners']
    cycle = WALK_IN + ORDER_DELAY * (0.4 if st['kiosk'] else 1) + cook + SERVE_DELAY + EAT + CLEAN_DELAY
    seat = sum(DAY / cycle * sum(min(k, c) * v for k, v in gd.items()) for c in tabs)
    kitchen = st['burners'] * DAY / (cook + 0.4)
    bowlcap = st['bowls'] * DAY / (cook + 2 + EAT + 2 + 2)
    # 노동: 플레이어 시간 예산으로 몇 그릇까지 감당되는지 이분 탐색
    budget = DAY * ASSUME['attention'] * A
    srv_cap_trips = sum(DAY / (ASSUME['trip_tiles'] / SERVER[s][0] + 0.4) for s in st['servers'])
    srv_carry = (sum(min(SERVER[s][1], 1.6) for s in st['servers']) / len(st['servers'])) if st['servers'] else 1
    dish_cap = DAY / DISH[st['dish']][0] if st['dish'] else 0
    def player_actions(n):
        g = n / avg
        order = 0 if st['kiosk'] else g
        cookA = (1 if len(menus) == 1 else 2) + 1
        kitchen_player = n * (1 - chef_burners / st['burners']) * cookA
        trips_need = n / srv_carry + order + g
        srv_share = min(1, srv_cap_trips / trips_need) if trips_need else 1
        floor = (n + order + g) * (1 - srv_share)
        wash = max(0, n - dish_cap)
        return kitchen_player + floor + wash, srv_share
    lo, hi = 0, max(1, demand)
    for _ in range(40):
        mid = (lo + hi) / 2
        if player_actions(mid)[0] <= budget: lo = mid
        else: hi = mid
    labor = lo
    sold = min(demand, seat, kitchen, bowlcap, labor)
    srv_share = player_actions(sold)[1]
    # 손이 모자라 못 받은 손님 일부는 이미 앉아 있다가 화나서 나간다(리뷰 0점). 좌석·수요 병목이면 줄에서만 떠나 리뷰 없음
    walk = min(0.25, 0.5 * (demand - sold) / demand) if (labor <= min(seat, kitchen, bowlcap) and demand > sold + 0.5) else 0.0
    # 맛·친절·속도
    if chefs:
        chefT = min(10, CHEF[chefs[0]][1] + st['recipe'])
        share = chef_burners / st['burners']
        T = share * chefT + (1 - share) * max(1, chefT - 1)
    else:
        T = 1 + st['recipe'] // 2
    K = srv_share * ((sum(SERVER[s][2] for s in st['servers']) / len(st['servers'])) if st['servers'] else 2) + (1 - srv_share) * 2
    # 좌석이 꽉 찬 건 느린 서비스가 아니다. 손님을 다 받으려면 필요한 손의 양이 예산을 넘을수록 속도 계수가 떨어진다
    util = player_actions(min(demand, seat, kitchen, bowlcap))[0] / budget if budget else 0
    F = 0.97 - 0.30 * max(0, min(1, (util - 0.75) / 0.6))
    Q = C(T, K) * F * (1 - walk)
    price = sum(mix[m] * MENU[m][0] for m in mix) * (1 + 0.04 * (T - 1))
    cost = sum(mix[m] * MENU[m][1] for m in mix) * (1 - 0.07 * st['cost'])
    rev = sold * price
    wages = sum(WAGE_OF('chef', c) for c in st['chefs']) + sum(WAGE_OF('server', s) for s in st['servers']) + (WAGE_OF('dish', st['dish']) if st['dish'] else 0)
    util_cost = 2000 + 2000 * st['burners']
    net = rev - sold * cost - wages - rent - util_cost
    return dict(sold=sold, demand=demand, groups=sold / avg, rev=rev, net=net, Q=Q, T=T, K=K, F=F, wages=wages + rent + util_cost,
                walk=walk, bott=('수요' if demand <= min(seat, kitchen, bowlcap, labor) + 0.5 else min([('좌석', seat), ('주방', kitchen), ('그릇', bowlcap), ('손', labor)], key=lambda x: x[1])[0]))

def buy(st, item, cost):
    k = item
    if k == 'menu_h': st['menus']['h'] = True
    elif k == 'menu_y': st['menus']['y'] = True
    elif k == 'bowls': st['bowls'] = min(30, st['bowls'] + 2)
    elif k == 'burner': st['burners'] += 1
    elif k == 'sink': st['sink'] += 1
    elif k == 'kiosk': st['kiosk'] = True
    elif k == 'layout': st['layout'] += 1
    elif k == 'recipe': st['recipe'] += 1
    elif k == 'cost': st['cost'] += 1
    elif k == 'chef': st['chefs'].append(cost)
    elif k == 'server': st['servers'].append(cost)
    elif k == 'dish': st['dish'] = cost
    elif k == 'chef_up': st['chefs'] = [max(c, cost) for c in st['chefs']]
    elif k == 'server_up': st['servers'] = [max(s, cost) for s in st['servers']]
    elif k == 'dish_up': st['dish'] = max(st['dish'] or 0, cost)
    elif k in PROMO:
        st['promos'][k] = PROMO[k]
        if k == 'vip': st['vip_today'] = True

def item_price(item, val):
    return 0 if item in ('chef', 'server', 'dish', 'chef_up', 'server_up', 'dish_up') else val

def run(A, verbose=False):
    st = dict(layout=1, burners=2, bowls=6, sink=0, kiosk=False, menus={'s': True, 'h': False, 'y': False}, chefs=[], servers=[], dish=None,
              recipe=0, cost=0, promos={}, tier=0)
    money, R, revs, plan_i, minutes, reached = 0, 0.0, [], 0, 0.0, {}
    rows = []
    for day in range(1, 61):
        r = day_result(st, R, A)
        groups = r['groups']; w = min(REVIEW_WINDOW, groups)
        R = (R * (REVIEW_WINDOW - w) + r['Q'] * w) / REVIEW_WINDOW
        money += r['net']; revs.append(r['rev'])
        avg3 = sum(revs[-3:]) / len(revs[-3:])
        # 귀빈 팀은 플레이어가 우선 처리한다고 보고 속도계수 0.97로 따로 평가
        if st.pop('vip_today', False) and C(r['T'], r['K']) * 0.97 >= 4.5: st['vip_ok'] = True
        while st['tier'] < 5:
            n, rr, rv, _ = TIERS[st['tier'] + 1]
            if n == '미슐랭' and not st.get('vip_ok'): break
            if R >= rr and avg3 >= rv: st['tier'] += 1; reached[n] = day
            else: break
        st['promos'] = {k: (v, d - 1) for k, (v, d) in st['promos'].items() if d - 1 > 0}
        buys = 0
        while plan_i < len(PLAN):
            item, val, need = PLAN[plan_i]
            price = item_price(item, val)
            if st['tier'] < need: break
            if item == 'vip' and R < 4.5: break   # 귀빈은 별점 4.5가 넘을 때만 부른다
            reserve = r['wages'] * 0.5
            if money - price < reserve: break
            money -= price; buy(st, item, val); plan_i += 1; buys += 1
        if plan_i >= len(PLAN) and not st.get('vip_ok') and st['tier'] >= 4 and R >= 4.5 and money >= VIP_COST:
            money -= VIP_COST; buy(st, 'vip', VIP_COST); buys += 1          # 귀빈 실패 시 재도전
        day_min = (DAY + ASSUME['overtime_sec'] + ASSUME['settle_sec'] + ASSUME['countdown_sec'] + ASSUME['prep_base_sec'] + ASSUME['prep_per_buy_sec'] * buys) / 60
        minutes += day_min
        rows.append((day, r['sold'], r['bott'], r['rev'], r['net'], R, TIERS[st['tier']][0], money, minutes))
        if st['tier'] == 5: break
    if verbose:
        print(f"{'일':>3}{'판매':>6} {'병목':4}{'매출':>11}{'순익':>11}{'별점':>6} {'티어':8}{'보유금':>12}{'누적분':>7}")
        for d, s, b, rv, n, rt, tn, m, mn in rows:
            print(f"{d:3}{s:6.0f} {b:4}{rv:11,.0f}{n:11,.0f}{rt:6.2f} {tn:8}{m:12,.0f}{mn:7.1f}")
    return reached, minutes, len(rows)

if __name__ == '__main__':
    for A, label in [(ASSUME['actions_per_sec'], '평균 플레이어'), (2.0, '숙련 플레이어'), (1.0, '느린 플레이어'), (0.9, '아주 느린 플레이어')]:
        reached, mins, days = run(A, verbose=(label == '평균 플레이어'))
        print(f"\n[{label} 탭 {A}/초] 티어 도달일: {reached}  → 미슐랭 {days}일차, 누적 {mins:.0f}분\n")
