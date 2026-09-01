from PIL import Image, ImageDraw

W, H = 1024, 500
img = Image.new('RGB', (W, H), color='#1A1612')

# Degradado radial sutil desde el centro para dar profundidad
draw = ImageDraw.Draw(img)
for r in range(min(W, H) // 2, 0, -1):
    t = r / (min(W, H) / 2)
    v = int(0x1A + 28 * (1 - t))
    draw.ellipse([W//2 - r, H//2 - r, W//2 + r, H//2 + r],
                 fill=(v, int(0x16 + 22*(1-t)), int(0x12 + 18*(1-t))))

# Líneas decorativas horizontales a los lados (burdeos suave)
line_layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
ld = ImageDraw.Draw(line_layer)
ld.line([(70, H//2), (260, H//2)],  fill=(110, 39, 51, 140), width=1)
ld.line([(W-260, H//2), (W-70, H//2)], fill=(110, 39, 51, 140), width=1)

base = img.convert('RGBA')
base = Image.alpha_composite(base, line_layer)

# Cargar logo
logo_path = r'c:/AreaDeTrabajo/PROYECTOS/tdd-app/tdd-app-movil/docs/logo/logo y nombre.png'
logo = Image.open(logo_path).convert('RGBA')

# Escalar
max_h, max_w = 430, 640
ratio = min(max_w / logo.width, max_h / logo.height)
new_w, new_h = int(logo.width * ratio), int(logo.height * ratio)
logo = logo.resize((new_w, new_h), Image.LANCZOS)

# Quitar fondo blanco del logo
data = logo.getdata()
new_data = []
for r, g, b, a in data:
    brightness = (r + g + b) / 3
    if brightness > 228 and a > 0:
        new_data.append((r, g, b, 0))
    else:
        new_data.append((r, g, b, a))
logo.putdata(new_data)

# Pegar centrado
x = (W - new_w) // 2
y = (H - new_h) // 2
base.paste(logo, (x, y), logo)

out = r'c:/AreaDeTrabajo/PROYECTOS/tdd-app/tdd-app-movil/docs/feature_graphic.png'
base.convert('RGB').save(out, 'PNG')
print(f'OK: {out}')
