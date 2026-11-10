# 밸런스 매트릭스를 병렬로: python tools/run-matrix.py [--seeds 10] [--human] [--days 45] [--taps 0.9,1.3,2.0]
# 탭마다 시드를 5개씩 나눠 동시에 돌리고 중앙값을 출력한다.
import argparse, os, re, statistics, subprocess, sys, tempfile

ap = argparse.ArgumentParser()
ap.add_argument('--seeds', type=int, default=10)
ap.add_argument('--days', type=int, default=45)
ap.add_argument('--taps', default='0.9,1.3,2.0')
ap.add_argument('--human', action='store_true')
a = ap.parse_args()

jobs = []
tmp = tempfile.mkdtemp()
npx = 'npx.cmd' if os.name == 'nt' else 'npx'
for tap in a.taps.split(','):
    for g in range(0, a.seeds, 5):
        n = min(5, a.seeds - g)
        out = os.path.join(tmp, f'{tap}_{g}.txt')
        cmd = [npx, 'tsx', 'tools/sim.ts', '--days', str(a.days), '--seeds', str(n), '--seed0', str(1000 + g), '--tap', tap] + (['--human'] if a.human else [])
        jobs.append((tap, out, subprocess.Popen(cmd, stdout=open(out, 'w', encoding='utf-8'), stderr=subprocess.STDOUT)))
for _, _, p in jobs:
    p.wait()
for tap in a.taps.split(','):
    days, mins, tiers = [], [], {}
    for t, out, _ in jobs:
        if t != tap:
            continue
        for line in open(out, encoding='utf-8'):
            m = re.search(r'seed (\d+): (미슐랭 (\d+)일|미달\((\d+)일\)) ([\d.]+)분 tiers (\{.*\})', line)
            if not m:
                continue
            days.append(int(m.group(3)) if m.group(3) else 99)
            mins.append(float(m.group(5)))
            for k, v in eval(m.group(6)).items():
                tiers.setdefault(k, []).append(v)
    tm = ' '.join(f'{k}{statistics.median(v):.0f}' for k, v in tiers.items())
    print(f"{'사람흉내' if a.human else '완벽봇'} 탭{tap}: 미슐랭 중앙값 {statistics.median(days)}일 {statistics.median(mins):.1f}분 | {sorted(days)} | 티어중앙값 {tm}")
sys.stdout.flush()
