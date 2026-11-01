import * as THREE from 'three';

export const COL = { shell: '#f2f2f0', frame: '#2b2d31', accent: '#e8461e', lens: '#16181b', mid: '#8b8f95' };

export const M = {
  shell: new THREE.MeshStandardMaterial({ color: COL.shell, roughness: 0.82, metalness: 0 }),
  frame: new THREE.MeshStandardMaterial({ color: COL.frame, roughness: 0.7, metalness: 0.1 }),
  accent: new THREE.MeshStandardMaterial({ color: COL.accent, roughness: 0.6, metalness: 0 }),
  lens: new THREE.MeshStandardMaterial({ color: COL.lens, roughness: 0.35, metalness: 0.2 }),
  mid: new THREE.MeshStandardMaterial({ color: '#5d6168', roughness: 0.7, metalness: 0.1 }),
  stump: new THREE.MeshStandardMaterial({ color: COL.accent, emissive: COL.accent, emissiveIntensity: 0.9, roughness: 0.5 }),
  // invisible but raycastable: enlarged tap targets for small parts
  hit: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
};
