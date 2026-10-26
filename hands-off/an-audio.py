import subprocess, numpy as np, sys
def load(p):
    raw = subprocess.run(['ffmpeg','-v','error','-i',p,'-f','f32le','-ac','1','-ar','48000','-'],capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)
def band(x, lo, hi, sr=48000):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1/sr)
    return float(np.sqrt(np.mean(np.abs(X[(f>=lo)&(f<hi)])**2))) if len(x) else 0
for name in ['start','ten-min','two-hours','reset']:
    x = load('shots/audio-%s.webm' % name)
    if not len(x): print(name, 'EMPTY'); continue
    sr = 48000; w = sr//4
    rms = [float(np.sqrt(np.mean(x[i:i+w]**2))) for i in range(0, len(x)-w, w)]
    db = lambda v: 20*np.log10(max(v,1e-9))
    # onsets: 10ms energy jumps
    e = np.array([np.sum(x[i:i+480]**2) for i in range(0, len(x)-480, 480)])
    on = np.sum((e[1:] > 4*e[:-1]+1e-6) & (e[1:] > 0.02*e.max()))
    X = np.abs(np.fft.rfft(x))**2; f = np.fft.rfftfreq(len(x), 1/sr)
    octs = [(31,63),(63,125),(125,250),(250,500),(500,1000),(1000,2000),(2000,4000),(4000,8000),(8000,16000)]
    prof = [10*np.log10(X[(f>=a)&(f<b)].sum()+1e-12) for a,b in octs]
    ref = max(prof)
    def hits(sig_lo, sig_hi):
        Y = np.fft.rfft(x); Y[(f<sig_lo)|(f>sig_hi)] = 0; y = np.fft.irfft(Y, len(x))
        e = np.array([np.sum(y[i:i+480]**2) for i in range(0, len(y)-480, 480)])
        sm = np.convolve(e, np.ones(8)/8, 'same')
        return int(np.sum((e[1:] > 2.5*sm[:-1]+1e-9) & (e[1:] > 0.05*e.max()) & (np.diff(np.r_[0, (e > 2.5*sm+1e-9)]) [1:] > 0)))
    dur = len(x)/sr
    print(f"{name:10s} {dur:4.1f}s  rms {db(np.sqrt(np.mean(x**2))):6.1f} dB  kicks/s {hits(30,150)/dur:4.1f}  hats/s {hits(6000,16000)/dur:4.1f}")
    print('   octaves 31..16k (dB vs loudest):', ' '.join('%+d' % (v-ref) for v in prof))
    print('   loudness per 0.25s:', ' '.join('%d' % db(v) for v in rms))
