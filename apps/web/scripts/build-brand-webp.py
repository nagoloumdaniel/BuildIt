"""Prepare les deux logos pour le web : WebP, alpha conserve.

Pourquoi pas `next/image` : le moteur d'images de Next exige `sharp`, qui n'est
pas installe ici toute requete `/_next/image` repond 400 (« The requested
resource isn't a valid image ») et le logo s'affichait casse. Les deux fichiers
sont des assets fixes, deja a leur taille d'affichage : les preparer une fois
au build est plus sur, plus rapide (18 ko au lieu de 170 ko), et supprime la
dependance native.

La source est le PNG de `assets/brand/` (la reference de marque). La sortie est
doublee : le WebP reste a cote de sa source, et la copie servie est ecrite dans
`apps/web/public/brand/`. `apps/web/src/app/globals.css` ne reference que le
WebP les PNG ne sont donc plus servis du tout.
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
SOURCE_DIR = ROOT / "assets" / "brand"
PUBLIC_DIR = ROOT / "apps" / "web" / "public" / "brand"

for name in ("logo-on-light", "logo-on-dark"):
    source = SOURCE_DIR / f"{name}.png"
    if not source.exists():
        print(f"absent, ignore : {source}")
        continue

    before = source.stat().st_size
    for target in (SOURCE_DIR / f"{name}.webp", PUBLIC_DIR / f"{name}.webp"):
        with Image.open(source) as image:
            # `method=6` est le plus lent et le meilleur : deux fichiers, une fois.
            image.convert("RGBA").save(target, format="WEBP", quality=92, method=6)
        print(f"{source.name} -> {target.parent.name}/{target.name} : {target.stat().st_size} octets")
    print(f"  (source {before} octets)")
