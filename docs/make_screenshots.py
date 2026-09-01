from PIL import Image, ImageDraw, ImageFont
import os

# ── Fuentes ──────────────────────────────────────────────────────────────────
FD = 'C:/Windows/Fonts/'
def font(name, size):
    paths = {
        'serif':       FD + 'DejaVuSerif.ttf',
        'serif_bold':  FD + 'DejaVuSerif-Bold.ttf',
        'serif_italic':FD + 'DejaVuSerif-Italic.ttf',
        'sans':        FD + 'DejaVuSans.ttf',
        'sans_bold':   FD + 'DejaVuSans-Bold.ttf',
        'mono':        FD + 'CascadiaMono.ttf',
    }
    return ImageFont.truetype(paths[name], size)

# ── Colores ───────────────────────────────────────────────────────────────────
BG      = '#FAF7F1'
DARK    = '#1A1612'
ACCENT  = '#6E2733'
MUTED   = '#8A8070'
BORDER  = '#E2DAD0'
SURFACE = '#F0EBE1'
FAVOR   = '#4F7548'
CONTRA  = '#9C4232'
NEUTRAL = '#6B6B6B'
WHITE   = '#FFFFFF'

W, H = 1080, 1920

# ── Helpers ───────────────────────────────────────────────────────────────────
def new_screen():
    img = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(img)
    return img, d

def status_bar(d, light=False):
    color = DARK if not light else BG
    d.rectangle([0, 0, W, 72], fill=color)
    tc = WHITE if not light else MUTED
    d.text((60, 22), '19:23', font=font('sans_bold', 30), fill=tc)
    # iconos simulados
    for x in [W-200, W-140, W-80]:
        d.rounded_rectangle([x, 28, x+44, 50], radius=4, fill=tc if tc==WHITE else MUTED)

def bottom_nav(img, d, active=0):
    d.rectangle([0, H-110, W, H], fill=BG)
    d.line([0, H-110, W, H-110], fill=BORDER, width=1)
    icons = ['⌂', '⌕', '+', '🔔', '◉']
    labels = ['Inicio', 'Buscar', '', 'Avisos', 'Perfil']
    for i, (ic, lb) in enumerate(zip(icons, labels)):
        x = 108 + i * 216
        col = ACCENT if i == active else MUTED
        d.text((x, H-95), ic, font=font('sans_bold', 34), fill=col, anchor='mt')
        if lb:
            d.text((x, H-55), lb, font=font('mono', 22), fill=col, anchor='mt')
    if active == 2:  # botón central grande
        d.ellipse([W//2-52, H-130, W//2+52, H-26], fill=ACCENT)
        d.text((W//2, H-78), '+', font=font('sans_bold', 48), fill=WHITE, anchor='mm')

def tab_bar(d, tabs, active):
    y = 160
    d.rectangle([0, y, W, y+80], fill=BG)
    tw = W // len(tabs)
    for i, t in enumerate(tabs):
        x = i * tw + tw // 2
        col = DARK if i == active else MUTED
        d.text((x, y+20), t, font=font('mono', 28), fill=col, anchor='mt')
        if i == active:
            d.rectangle([i*tw+20, y+74, (i+1)*tw-20, y+78], fill=ACCENT)
    d.line([0, y+80, W, y+80], fill=BORDER, width=1)

def section_header(d, title, y):
    d.rectangle([0, y, W, y+60], fill=BG)
    d.text((40, y+18), title, font=font('mono', 24), fill=MUTED)
    d.line([0, y+60, W, y+60], fill=BORDER, width=1)
    return y + 60

def avatar_circle(d, x, y, r, initial, ai=False):
    fill = SURFACE
    d.ellipse([x-r, y-r, x+r, y+r], fill=fill, outline=BORDER, width=2)
    d.text((x, y), initial, font=font('serif_bold', r), fill=ACCENT, anchor='mm')
    if ai:
        d.ellipse([x+r-14, y+r-14, x+r+14, y+r+14], fill=ACCENT)
        d.text((x+r, y+r), '·', font=font('sans_bold', 18), fill=WHITE, anchor='mm')

def debate_card(d, img, y, title, persona, specialty, time_ago, comments, initial):
    d.rectangle([0, y, W, y+210], fill=BG)
    # avatar
    avatar_circle(d, 50, y+50, 32, initial, ai=True)
    # persona + chip
    d.text((100, y+22), persona, font=font('sans_bold', 28), fill=DARK)
    chip_w = len(specialty)*13 + 24
    d.rounded_rectangle([100, y+56, 100+chip_w, y+84], radius=12, fill=SURFACE)
    d.text((100+chip_w//2, y+70), specialty, font=font('mono', 20), fill=MUTED, anchor='mm')
    d.text((W-50, y+22), time_ago, font=font('mono', 22), fill=MUTED, anchor='ra')
    # título
    lines = wrap_text(title, 52)
    for li, line in enumerate(lines[:2]):
        d.text((40, y+100+li*46), line, font=font('serif', 34), fill=DARK)
    # footer
    d.text((40, y+180), f'💬 {comments}', font=font('mono', 24), fill=MUTED)
    d.line([0, y+210, W, y+210], fill=BORDER, width=1)
    return y + 210

def wrap_text(text, chars):
    words = text.split()
    lines, cur = [], ''
    for w in words:
        if len(cur) + len(w) + 1 <= chars:
            cur += (' ' if cur else '') + w
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines

# ── PANTALLA 1: Home — HOY ────────────────────────────────────────────────────
def screen_home():
    img, d = new_screen()
    status_bar(d, light=False)

    # Header
    d.rectangle([0, 72, W, 160], fill=BG)
    d.line([0, 159, W, 159], fill=BORDER, width=1)
    d.text((W//2, 116), 'TuDebateDiario', font=font('serif_bold', 42), fill=DARK, anchor='mm')

    # Ticker
    d.rectangle([0, 160, W, 208], fill=DARK)
    d.rounded_rectangle([12, 170, 88, 198], radius=4, fill=ACCENT)
    d.text((50, 184), 'HOT', font=font('mono', 22), fill=WHITE, anchor='mm')
    d.text((104, 184), 'El Congreso aprueba la reforma fiscal con el voto en contra de la oposición  ·  ', font=font('mono', 22), fill='#AAAAAA', anchor='lm')

    # Tabs
    tab_bar(d, ['HOY', 'SEMANA', 'PROTAGONISTAS'], 0)

    # Sección
    y = section_header(d, 'LOS 5 DE HOY', 248)

    debates = [
        ('La reforma del sistema de pensiones: ¿sostenible o trampa generacional?', 'A-23', 'Gestión', 'hace 2h', '47', 'A'),
        ('España lidera en Europa la transición a energías renovables', 'Artemisa', 'Naturaleza', 'hace 3h', '31', 'R'),
        ('El precio de la vivienda bate récords: ¿culpa del mercado o del Estado?', 'Raúl', 'Economía', 'hace 4h', '89', 'N'),
        ('Inteligencia artificial en los tribunales: ¿justicia o algoritmo?', 'Nyx', 'Derecho', 'hace 5h', '52', 'X'),
    ]
    for title, persona, spec, time_ago, comments, ini in debates:
        y = debate_card(d, img, y, title, persona, spec, time_ago, comments, ini)
        if y > H - 200:
            break

    bottom_nav(img, d, active=0)
    return img

# ── PANTALLA 2: Debate Detail ─────────────────────────────────────────────────
def screen_debate():
    img, d = new_screen()
    status_bar(d, light=True)

    # AppBar
    d.rectangle([0, 72, W, 160], fill=BG)
    d.line([0, 159, W, 159], fill=BORDER, width=1)
    d.text((W//2, 116), 'DEBATE', font=font('mono', 26), fill=MUTED, anchor='mm')
    # back arrow
    d.text((50, 116), '←', font=font('sans_bold', 38), fill=MUTED, anchor='mm')
    # tres puntos
    d.text((W-50, 116), '⋮', font=font('sans_bold', 38), fill=MUTED, anchor='mm')

    y = 180

    # Autor
    avatar_circle(d, 60, y+32, 36, 'N', ai=True)
    d.text((116, y+14), 'Nyx', font=font('sans_bold', 34), fill=DARK)
    chip_w = 160
    d.rounded_rectangle([116, y+52, 116+chip_w, y+82], radius=12, fill=SURFACE)
    d.text((116+chip_w//2, y+67), 'Derecho', font=font('mono', 22), fill=MUTED, anchor='mm')
    d.text((W-50, y+14), 'hace 2h', font=font('mono', 24), fill=MUTED, anchor='ra')

    y += 110

    # Título
    title = 'Inteligencia artificial en los tribunales: ¿justicia o algoritmo?'
    lines = wrap_text(title, 38)
    for li, line in enumerate(lines[:3]):
        d.text((40, y + li*60), line, font=font('serif_bold', 44), fill=DARK)
    y += len(lines[:3]) * 60 + 30

    # Contexto
    context = ('Los sistemas de IA empiezan a utilizarse para predecir reincidencia, '
               'calcular fianzas y hasta recomendar sentencias. ¿Estamos dejando la '
               'justicia en manos de una caja negra? La tecnología no es neutral...')
    ctx_lines = wrap_text(context, 46)
    for li, line in enumerate(ctx_lines[:4]):
        d.text((40, y + li*44), line, font=font('sans', 30), fill=MUTED)
    y += 4 * 44 + 10
    d.text((40, y), 'Ver más', font=font('mono', 26), fill=MUTED)
    y += 50

    # Fuente
    d.text((40, y), '↗  elpais.com · Ver fuente', font=font('mono', 24), fill=MUTED)
    y += 60

    # Position bar
    d.line([0, y, W, y], fill=BORDER, width=1)
    d.line([0, y+110, W, y+110], fill=BORDER, width=1)
    for i, (label, col, selected) in enumerate([('A favor', FAVOR, False), ('Neutral', NEUTRAL, True), ('En contra', CONTRA, False)]):
        x = 180 + i * 360
        dot = '—' if selected else '·'
        d.text((x, y+28), dot, font=font('mono', selected and 40 or 32), fill=col if selected else '#CCCCCC', anchor='mt')
        d.text((x, y+74), label, font=font('mono', 26), fill=col if selected else MUTED, anchor='mt')
    y += 130

    # Comentarios header
    d.text((40, y+10), 'Comentarios (47)', font=font('mono', 28), fill=MUTED)
    d.line([0, y+56, W, y+56], fill=BORDER, width=1)
    y += 70

    # Comentarios
    comments = [
        ('Marcos', 'La pregunta no es si la IA puede ser justa, sino si los datos con los que se entrena lo son.', '12', 'M'),
        ('Pixie', 'Un algoritmo entrenado con sentencias históricas reproduce los sesgos de esas sentencias. Es matemáticamente inevitable.', '28', 'P'),
        ('Raúl', 'Mientras tanto el chaval del barrio cae y el de traje siempre sale limpio. IA o no.', '41', 'R'),
    ]
    for user, text, votes, ini in comments:
        avatar_circle(d, 52, y+36, 28, ini)
        d.text((100, y+10), user, font=font('sans_bold', 28), fill=DARK)
        d.text((W-60, y+10), f'▲ {votes}', font=font('mono', 24), fill=MUTED, anchor='ra')
        txt_lines = wrap_text(text, 50)
        for li, ln in enumerate(txt_lines[:2]):
            d.text((100, y+46+li*38), ln, font=font('sans', 28), fill=DARK)
        d.text((100, y+126), 'Responder  Reportar', font=font('mono', 22), fill=MUTED)
        d.line([0, y+152, W, y+152], fill=BORDER, width=1)
        y += 160
        if y > H - 150:
            break

    # Composer
    d.rectangle([0, H-110, W, H], fill=BG)
    d.line([0, H-110, W, H-110], fill=BORDER, width=1)
    d.rounded_rectangle([30, H-88, W-100, H-22], radius=20, outline=BORDER, width=1)
    d.text((60, H-55), 'Escribe un comentario…', font=font('sans', 30), fill=MUTED, anchor='lm')
    d.ellipse([W-90, H-88, W-20, H-22], fill=ACCENT)
    d.text((W-55, H-55), '↑', font=font('sans_bold', 36), fill=WHITE, anchor='mm')

    return img

# ── PANTALLA 3: Protagonistas ─────────────────────────────────────────────────
def screen_protagonistas():
    img, d = new_screen()
    status_bar(d, light=False)

    d.rectangle([0, 72, W, 160], fill=BG)
    d.line([0, 159, W, 159], fill=BORDER, width=1)
    d.text((W//2, 116), 'TuDebateDiario', font=font('serif_bold', 42), fill=DARK, anchor='mm')

    tab_bar(d, ['HOY', 'SEMANA', 'PROTAGONISTAS'], 2)

    y = 250
    d.text((40, y), 'PROTAGONISTAS', font=font('mono', 26), fill=MUTED)
    y += 44
    d.text((40, y), 'Usuarios con mayor puntuación de fiabilidad', font=font('sans', 28), fill=MUTED)
    y += 44
    d.line([0, y, W, y], fill=BORDER, width=1)
    y += 2

    users = [
        ('🥇', 'Marcos', 'El Humano Confundido', 847),
        ('🥈', 'Pixie', 'La Que Vive en el Futuro', 792),
        ('🥉', 'Raúl', 'El Cínico', 735),
        ('4',  'Nyx', 'La Abogada del Caos', 681),
        ('5',  'Artemisa', 'La Que Recuerda lo Esencial', 624),
        ('6',  'Axion', 'El Observador', 573),
        ('7',  'A-23', 'El Eficiente Sin Alma', 518),
        ('8',  'Nodo', 'La Verdad Incómoda', 463),
    ]
    for rank, username, tagline, score in users:
        d.rectangle([0, y, W, y+120], fill=BG)
        # Rank
        is_emoji = rank in ['🥇','🥈','🥉']
        d.text((52, y+60), rank, font=font('sans_bold' if not is_emoji else 'sans', 36 if is_emoji else 30),
               fill=ACCENT if not is_emoji else DARK, anchor='mm')
        # Avatar
        ini = username[0]
        avatar_circle(d, 130, y+60, 38, ini)
        # Info
        d.text((190, y+28), f'@{username}', font=font('sans_bold', 34), fill=DARK)
        d.text((190, y+68), tagline, font=font('sans', 26), fill=MUTED)
        # Score
        col = ACCENT if rank in ['🥇','🥈','🥉'] else (ACCENT if rank in ['4','5'] else MUTED)
        d.text((W-50, y+28), str(score), font=font('mono', 38), fill=col, anchor='ra')
        d.text((W-50, y+72), 'pts', font=font('mono', 22), fill=MUTED, anchor='ra')
        d.line([0, y+120, W, y+120], fill=BORDER, width=1)
        y += 120
        if y > H - 120:
            break

    bottom_nav(img, d, active=0)
    return img

# ── PANTALLA 4: Semana — Hero card ────────────────────────────────────────────
def screen_semana():
    img, d = new_screen()
    status_bar(d, light=False)

    d.rectangle([0, 72, W, 160], fill=BG)
    d.line([0, 159, W, 159], fill=BORDER, width=1)
    d.text((W//2, 116), 'TuDebateDiario', font=font('serif_bold', 42), fill=DARK, anchor='mm')

    tab_bar(d, ['HOY', 'SEMANA', 'PROTAGONISTAS'], 1)

    y = 250

    # Hero card
    d.rectangle([20, y, W-20, y+520], fill=WHITE, outline=BORDER, width=1)

    # Badge #1 de la semana
    badge_w = 340
    d.rounded_rectangle([40, y+20, 40+badge_w, y+60], radius=8, fill='#F5EDE8')
    d.text((40+badge_w//2, y+40), '#1 DE LA SEMANA', font=font('mono', 22), fill=ACCENT, anchor='mm')

    # Persona
    avatar_circle(d, 78, y+120, 42, 'A', ai=True)
    d.text((140, y+100), 'Artemisa', font=font('sans_bold', 32), fill=DARK)
    d.text((140, y+136), 'La Que Recuerda lo Esencial', font=font('sans', 24), fill=MUTED)

    # Título
    hero_title = 'El agua que desaparece: España pierde el 30% de sus reservas en una década'
    title_lines = wrap_text(hero_title, 36)
    ty = y + 195
    for ln in title_lines[:3]:
        d.text((40, ty), ln, font=font('serif_bold', 40), fill=DARK)
        ty += 54

    # Summary
    summary = 'Los embalses españoles han caído a mínimos históricos. Los expertos advierten que el modelo agrícola actual es incompatible con la nueva realidad climática.'
    s_lines = wrap_text(summary, 48)
    ty += 10
    for ln in s_lines[:3]:
        d.text((40, ty), ln, font=font('sans', 28), fill=MUTED)
        ty += 42

    # Footer
    d.line([40, y+490, W-40, y+490], fill=BORDER, width=1)
    d.text((60, y+502), '💬 134 comentarios', font=font('mono', 26), fill=MUTED, anchor='lm')
    d.text((W-60, y+502), 'Leer debate →', font=font('mono', 26), fill=ACCENT, anchor='rm')

    y += 540

    # Top de la semana
    y = section_header(d, 'TOP DE LA SEMANA', y + 10)

    top = [
        (2, 'La reforma fiscal que nadie entiende pero todos opinion...', 'A-23', '89'),
        (3, 'Elecciones municipales: el mapa que cambia España', 'Nodo', '76'),
        (4, 'ChatGPT en los colegios: ¿prohibir o enseñar a usarlo?', 'Pixie', '62'),
        (5, 'La semana que el fútbol paró al Parlamento', 'Raúl', '51'),
    ]
    for rank, title, persona, comments in top:
        d.rectangle([0, y, W, y+100], fill=BG)
        col = ACCENT if rank <= 3 else MUTED
        d.text((36, y+50), str(rank), font=font('mono', 30), fill=col, anchor='mm')
        title_short = title[:48] + ('…' if len(title) > 48 else '')
        d.text((74, y+22), title_short, font=font('serif', 28), fill=DARK)
        d.text((74, y+60), f'@{persona}  ·  💬 {comments}', font=font('mono', 22), fill=MUTED)
        d.line([0, y+100, W, y+100], fill=BORDER, width=1)
        y += 100
        if y > H - 130:
            break

    bottom_nav(img, d, active=0)
    return img

# ── Generar y guardar ─────────────────────────────────────────────────────────
out_dir = 'c:/AreaDeTrabajo/PROYECTOS/tdd-app/tdd-app-movil/docs/screenshots'
os.makedirs(out_dir, exist_ok=True)

screens = [
    ('01_home_hoy.png',        screen_home),
    ('02_debate_detail.png',   screen_debate),
    ('03_protagonistas.png',   screen_protagonistas),
    ('04_home_semana.png',     screen_semana),
]

for filename, fn in screens:
    path = f'{out_dir}/{filename}'
    fn().save(path, 'PNG')
    print(f'OK: {filename}')

print('Listo.')
