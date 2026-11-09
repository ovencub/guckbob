# public/og.png (1200x630): Playwright 게임 장면 스크린샷 + 제목. 실행: python tools/make-og.py
from PIL import Image, ImageDraw, ImageFont
W, H = 1200, 630
bg = Image.new('RGB', (W, H), '#F4E3C6')
d = ImageDraw.Draw(bg)
for i in range(0, W, 60):
    for j in range(0, H, 60):
        if (i // 60 + j // 60) % 2: d.rectangle([i, j, i + 59, j + 59], fill='#EBD5AE')
shot = Image.open('docs/shots/05-staff-full.png').convert('RGB')
shot = shot.crop((0, 380, shot.width, 380 + int(shot.width * 1.05)))
shot = shot.resize((560, int(560 * shot.height / shot.width)))
mask = Image.new('L', shot.size, 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, shot.width, shot.height], 36, fill=255)
bg.paste(shot, (600, (H - shot.height) // 2), mask)
d.rounded_rectangle([600, (H - shot.height) // 2, 1160, (H - shot.height) // 2 + shot.height], 36, outline='#2B2A33', width=8)
f = lambda s: ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', s)
def outlined(xy, t, size, fill):
    d.text(xy, t, font=f(size), fill=fill, stroke_width=max(4, size // 9), stroke_fill='#2B2A33')
outlined((60, 120), '고양이', 104, '#FFFDF8')
outlined((60, 240), '국밥집', 104, '#FFFDF8')
d.rounded_rectangle([60, 400, 540, 470], 35, fill='#2B2A33')
d.text((300, 435), '며칠 만에 미슐랭?', font=f(40), fill='#FFF6E0', anchor='mm')
d.text((60, 520), '탭 한 번에 국밥이 날아간다!', font=f(32), fill='#2B2A33')
bg.save('public/og.png')
print('saved public/og.png')
