// People: temporary placeholder so the build tools can be tested first. Replaced by the full version.
import * as THREE from 'three';
export const humans = [];
export async function initHumans() {}
export function personThumbMakers() { return {}; }
export const humanAPI = {
  list: humans,
  spawn() { return null; }, remove() {}, clear() {}, near() { return []; }, nearest() { return null; },
  fixed() {}, frame() {}, use() {}, punch() {}, blast() {}, serialize() { return []; }, deserialize() {}
};
