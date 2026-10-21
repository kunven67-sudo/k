import sys, json
sys.argv = [sys.argv[0]] + sys.argv[1:]
from sprite_cut import cut
who = sys.argv[1]
JOBS = {
 'opp': {'idle': (360, 30), 'left': (2384, 10), 'down': (2672, 17), 'up': (2744, 16), 'right': (3075, 17)},
 'plr': {'idle': (3702, 40), 'left': (3677, 13), 'down': (3666, 8), 'up': (901, 8), 'right': (3213, 8)},
}[who]
only = sys.argv[2].split(',') if len(sys.argv) > 2 else list(JOBS)
for anim in only:
    f0, n = JOBS[anim]
    for i in range(n):
        import os
        if os.path.exists(f'out/{who}/{anim}_{i:02d}.png') : continue
        cut(who, f0 + i, f'{anim}_{i:02d}')
        print(who, anim, i, flush=True)
