import { invoke } from '@tauri-apps/api/core';

/**
 * Interface : demande un message au cœur Rust (commande `greet`, déclarée
 * dans src-tauri/src/lib.rs) et l'affiche. Hors de Tauri page ouverte dans
 * un simple navigateur —, l'appel échoue et le message d'origine reste.
 */
async function main(): Promise<void> {
  const target = document.querySelector('#message');
  try {
    const message = await invoke<string>('greet', { name: '{{projectName}}' });
    if (target !== null) {
      target.textContent = message;
    }
  } catch {
    // Pas dans Tauri : rien à faire.
  }
}

void main();
