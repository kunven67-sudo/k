import cv2, numpy as np
cap = cv2.VideoCapture('v.mp4')
LX = [636, 728, 821, 914]
HUE = [(145,165), (85,100), (50,72), None]
W=[]; N=[]
while True:
    ok, f = cap.read()
    if not ok: break
    h = cv2.cvtColor(f, cv2.COLOR_BGR2HSV)
    sat = (h[...,1] > 140) & (h[...,2] > 150); hu = h[...,0]
    ws=[]; ns=[]
    for i, x in enumerate(LX):
        if HUE[i]: m = sat & (hu >= HUE[i][0]) & (hu <= HUE[i][1])
        else: m = sat & ((hu <= 8) | (hu >= 172))
        ws.append(m[:, x-40:x+41].sum(1)); ns.append(m[:, x-8:x+9].sum(1))
    W.append(np.stack(ws)); N.append(np.stack(ns))
np.save('kW.npy', np.stack(W).astype(np.uint8)); np.save('kN.npy', np.stack(N).astype(np.uint8))
