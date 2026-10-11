/**
 * Déclenche le téléchargement d'une archive, depuis sa forme base64 (mode
 * hébergé, Phase 12).
 *
 * Partagé entre l'écran Generation (premier téléchargement) et l'écran Report
 * (re-téléchargement depuis le rapport déjà en main) : le même geste, jamais
 * un aller-retour serveur de plus pour la même archive.
 */
export function downloadZip(zipBase64: string, projectName: string): void {
  const binary = atob(zipBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${projectName}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
