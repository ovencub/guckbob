# 밸런스 수치를 src/data/*.ts 와 tools/progression_model.py 에 한 번에 반영하는 도우미.
# 사용: python tools/set-balance.py  (아래 BAL 값을 고친 뒤)
import re, pathlib

BAL = dict(
    stage=[0, 200000, 400000, 700000],
    burner=[60000, 120000, 200000, 300000],
    sink=[0, 50000, 100000, 200000],
    taste=[50000, 100000, 200000, 350000],
    cost=[60000, 100000, 160000, 240000, 400000],
    promo=dict(flyer=15000, blog=50000, google=80000, youtube=150000, tv=900000, vip=600000),
    tier_rev=[0, 160000, 400000, 800000, 1250000, 1600000],
)

root = pathlib.Path(__file__).resolve().parent.parent
def sub(path, pattern, repl, count=1):
    p = root / path
    s = p.read_text(encoding='utf-8')
    s2, n = re.subn(pattern, repl, s, count=count, flags=re.M)
    if n == 0:
        raise SystemExit(f'pattern not found in {path}: {pattern}')
    p.write_text(s2, encoding='utf-8')

def num(n): return f'{n}'

# layouts.ts: 단계 비용
for i, c in enumerate(BAL['stage'][1:], start=1):
    pass
s = (root / 'src/data/layouts.ts').read_text(encoding='utf-8')
costs = iter(BAL['stage'])
s = re.sub(r'cost: \d+, rent:', lambda m: f'cost: {next(costs)}, rent:', s)
(root / 'src/data/layouts.ts').write_text(s, encoding='utf-8')
sub('src/data/facilities.ts', r'costs: \[[\d, ]+\],', f"costs: [{', '.join(map(num, BAL['burner']))}],")
s = (root / 'src/data/facilities.ts').read_text(encoding='utf-8')
sc = iter(BAL['sink'])
s = re.sub(r"(slots: \d+, cost: )\d+", lambda m: m.group(1) + str(next(sc)), s)
(root / 'src/data/facilities.ts').write_text(s, encoding='utf-8')
sub('src/data/research.ts', r'costs: \[[\d, ]+\],\n  // 레벨', f"costs: [{', '.join(map(num, BAL['taste']))}],\n  // 레벨")
sub('src/data/research.ts', r'(COST_RESEARCH = \{\n  costs: )\[[\d, ]+\]', r'\g<1>[' + ', '.join(map(num, BAL['cost'])) + ']')
for k, v in BAL['promo'].items():
    sub('src/data/promos.ts', rf"(id: '{k}', name: '[^']+', cost: )\d+", rf'\g<1>{v}')
s = (root / 'src/data/tiers.ts').read_text(encoding='utf-8')
tr = iter(BAL['tier_rev'])
s = re.sub(r'(revenue3: )\d+', lambda m: m.group(1) + str(next(tr)), s)
(root / 'src/data/tiers.ts').write_text(s, encoding='utf-8')

# progression_model.py: TIERS 매출, VIP_COST, PLAN 비용
pm = root / 'tools/progression_model.py'
s = pm.read_text(encoding='utf-8')
names = ['소상공인', '동네 맛집', '줄서는 맛집', '블루리본', '관광맛집', '미슐랭']
for n, r in zip(names, BAL['tier_rev']):
    s = re.sub(rf"\('{n}', ([\d.]+), \d+, ", rf"('{n}', \g<1>, {r}, ", s)
s = re.sub(r'VIP_COST = \d+', f"VIP_COST = {BAL['promo']['vip']}", s)
it = {k: iter(v) for k, v in dict(layout=BAL['stage'][1:], burner=BAL['burner'], sink=BAL['sink'][1:], recipe=BAL['taste'], cost=BAL['cost']).items()}
def plan_sub(m):
    k = m.group(1)
    if k in it:
        return f"('{k}', {next(it[k])}"
    if k == 'promo_google':
        return f"('{k}', {BAL['promo']['google']}"
    if k == 'promo_youtube':
        return f"('{k}', {BAL['promo']['youtube']}"
    return m.group(0)
head, plan_and_rest = s.split('PLAN = [', 1)
plan, rest = plan_and_rest.split(']   # TV', 1)
plan = re.sub(r"\('(\w+)', (\d+)(?=, \d\))", plan_sub, plan)
s = head + 'PLAN = [' + plan + ']   # TV' + rest
pm.write_text(s, encoding='utf-8')
print('applied', BAL)
