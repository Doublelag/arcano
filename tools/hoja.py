# Hoja de contactos: junta capturas en una cuadrícula con su nombre debajo (para revisarlas de un vistazo)
# Uso: python tools/hoja.py <carpeta> <patrón glob> <salida.png> [columnas] [ancho de celda]
import glob, os, sys
from PIL import Image, ImageDraw

d, pat, out = sys.argv[1], sys.argv[2], sys.argv[3]
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 5
cw = int(sys.argv[5]) if len(sys.argv) > 5 else 240
files = sorted(glob.glob(os.path.join(d, pat)))
ORDER = ['aprendiz', 'ignea', 'glacial', 'voltaica', 'toxica', 'plasma', 'aurora', 'mortaja', 'azufre', 'eclipse']
def key(f):
    n = os.path.basename(f)
    for i, o in enumerate(ORDER):
        if o in n: return (n.split('-')[0], i)
    return (n, 99)
files.sort(key=key)
ims = [Image.open(f).convert('RGB') for f in files]
if not ims: sys.exit('sin imágenes')
ch = int(ims[0].height * cw / ims[0].width)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * cw, rows * (ch + 16)), (20, 20, 20))
dr = ImageDraw.Draw(sheet)
for i, (f, im) in enumerate(zip(files, ims)):
    x, y = (i % cols) * cw, (i // cols) * (ch + 16)
    sheet.paste(im.resize((cw, ch), Image.LANCZOS), (x, y))
    dr.text((x + 4, y + ch + 2), os.path.basename(f)[:-4], fill=(255, 255, 255))
sheet.save(out)
print(out, sheet.size)
