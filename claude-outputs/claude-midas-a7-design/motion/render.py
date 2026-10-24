import sys, subprocess, asyncio
from playwright.async_api import async_playwright
mode=sys.argv[1]  # 'stills' or 'video'
FPS=30
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        pg=await b.new_page(viewport={'width':1920,'height':1080})
        errs=[]; pg.on('pageerror',lambda e: errs.append(str(e))); pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
        import os; await pg.goto('file:///home/claude/a7motion/'+os.environ.get('SCENE','scene.html'))
        await pg.evaluate('window.ready')
        total=await pg.evaluate('window.TOTAL')
        print('TOTAL',total, 'errors',errs, flush=True)
        if mode=='stills':
            for t in [float(x) for x in sys.argv[2].split(',')]:
                await pg.evaluate(f'window.render({t})')
                await pg.screenshot(path=os.environ.get('OUT','stills')+f'/t_{t:05.1f}.png')
        else:
            n=int(total*FPS)
            ff=subprocess.Popen(['ffmpeg','-v','error','-y','-f','image2pipe','-framerate',str(FPS),'-c:v','mjpeg','-i','-',
                '-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-preset','medium','-movflags','+faststart',sys.argv[2]],stdin=subprocess.PIPE)
            for i in range(n):
                await pg.evaluate(f'window.render({i/FPS})')
                ff.stdin.write(await pg.screenshot(type='jpeg',quality=95))
                if i%150==0: print('frame',i,'/',n,flush=True)
            ff.stdin.close(); ff.wait()
        await b.close()
asyncio.run(main())
