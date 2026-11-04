import { XRDevice, metaQuest3 } from 'iwer';
const xr = new XRDevice(metaQuest3, { stereoEnabled: false, fovy: 1.4 });
xr.installRuntime({ forceInstall: true });
xr.position.set(0, 1.6, 0);
window.__xr = xr;
