"""Regenerate the original, self-hosted Community reaction GIFs (Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import math

out = Path(__file__).resolve().parents[1] / 'client/public/community-gifs'
out.mkdir(parents=True, exist_ok=True)
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 21)
small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 10)
for name, caption, accent in [('goal','GOOOAL!', '#22d3ee'), ('lol','TOO FUNNY!', '#c084fc'), ('var','VAR… SERIOUSLY?!', '#fb7185'), ('popcorn','HERE FOR THE DRAMA', '#fbbf24')]:
    frames = []
    for i in range(16):
        im = Image.new('RGB', (280,158), '#080e20')
        d = ImageDraw.Draw(im)
        d.rounded_rectangle((3,3,276,154), radius=17, outline=accent, width=2)
        for x in range(15,280,25):
            y = 20 + ((x*7+i*9)%95)
            if name in ('goal','lol'): d.rectangle((x,y,x+3,y+6), fill=accent)
        cx, cy = 140, 65 + int(math.sin(i*math.pi/8)*5)
        d.ellipse((cx-35,cy-35,cx+35,cy+35),fill='#facc15',outline='#f59e0b',width=2)
        if name == 'lol':
            d.arc((cx-23,cy-16,cx-5,cy+1),180,360,fill='#111827',width=3)
            d.arc((cx+5,cy-16,cx+23,cy+1),180,360,fill='#111827',width=3)
            d.ellipse((cx-18,cy+4,cx+18,cy+26),fill='#111827')
            for sign in [-1,1]:d.ellipse((cx+sign*27-4,cy+3,cx+sign*27+4,cy+15),fill='#38bdf8')
        elif name == 'var':
            offset = int(math.sin(i*math.pi/8)*5)
            for x in [cx-14,cx+14]:
                d.ellipse((x-8,cy-13,x+8,cy+4),fill='white')
                d.ellipse((x-3+offset,cy-7,x+2+offset,cy),fill='#111827')
            d.line((cx-13,cy+18,cx+13,cy+18),fill='#111827',width=3)
        else:
            for x in [cx-13,cx+13]:d.ellipse((x-4,cy-10,x+4,cy),fill='#111827')
            d.arc((cx-19,cy-1,cx+19,cy+22),0,180,fill='#111827',width=3)
        if name == 'goal':
            bx = 45 + int(i*12)%190
            d.ellipse((bx-11,88,bx+11,110),fill='white',outline='#64748b',width=2)
            d.regular_polygon((bx,99,5),5,fill='#111827')
        if name == 'popcorn':
            d.polygon([(116,77),(164,77),(157,109),(123,109)],fill='#ef4444')
            for x in range(120,164,9):d.ellipse((x-5,71+(i+x)%4,x+5,82),fill='#fef3c7')
        bbox=d.textbbox((0,0),caption,font=font)
        chosen = font if bbox[2]<258 else ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',16)
        d.text((140,121),caption,font=chosen,fill=accent,anchor='mm')
        d.text((140,143),'FANTASY ARENA',font=small,fill='#94a3b8',anchor='mm')
        frames.append(im)
    frames[0].save(out/f'{name}.png', optimize=True)
    frames[0].save(out/f'{name}.gif',save_all=True,append_images=frames[1:],duration=90,loop=0,optimize=True)
print('Created four original Community GIFs and static previews.')
