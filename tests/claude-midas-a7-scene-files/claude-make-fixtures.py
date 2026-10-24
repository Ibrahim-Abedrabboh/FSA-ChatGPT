# Makes the image fixtures for the scene-files tests (16 Oct 2026). Plain code-made pictures, no product, no AI.
# Masters stand for approved scenes of each shape; the out_* files stand for what n8n Edit Image makes from them.
# Run: python3 tests/claude-midas-a7-scene-files/claude-make-fixtures.py
import os
from PIL import Image, ImageDraw
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures')
os.makedirs(D, exist_ok=True)
def pic(w, h):
    im = Image.new('RGB', (w, h), (232, 226, 214))
    d = ImageDraw.Draw(im)
    d.rectangle([w // 4, h // 2, 3 * w // 4, 3 * h // 4], fill=(120, 120, 128))  # a grey block standing on the floor line
    d.line([0, h // 2 + h // 4, w, h // 2 + h // 4], fill=(90, 80, 70), width=max(2, w // 300))
    return im
for w, h in [(2048, 2048), (1638, 2048), (2048, 1152), (1152, 2048), (1536, 2048), (1100, 1956)]:
    pic(w, h).save(os.path.join(D, 'scene_%dx%d.png' % (w, h)))
for w, h in [(2000, 1125), (1125, 1407), (1125, 1406)]:
    im = pic(w, h)
    im.save(os.path.join(D, 'out_%dx%d.jpg' % (w, h)), quality=92)
    im.save(os.path.join(D, 'out_%dx%d.webp' % (w, h)))
print('fixtures in', D)
