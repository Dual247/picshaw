"""Original 42-second silent Picshaw explainer. No customer data or live recording."""
from pathlib import Path
import math
import subprocess
from PIL import Image, ImageDraw, ImageFont
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/media'
OUT.mkdir(parents=True, exist_ok=True)
W,H,FPS,DURATION = 1280,720,24,42
BG,PAPER,ACCENT,QUIET,LINE = '#121511','#f0eee5','#ff795b','#afb8a5','#394232'
FONTS = {}
def font(size,bold=False):
    key=(size,bold)
    if key not in FONTS:
        path='/usr/share/fonts/truetype/dejavu/DejaVuSans'+('-Bold' if bold else '')+'.ttf'
        FONTS[key]=ImageFont.truetype(path,size)
    return FONTS[key]
def text(d,xy,message,size=28,fill=PAPER,bold=False):
    d.text(xy,message,font=font(size,bold),fill=fill,spacing=10)
def wrap(d,message,width,size):
    lines=[]; current=''
    for word in message.split():
        trial=(current+' '+word).strip()
        if d.textlength(trial,font=font(size))>width and current:
            lines.append(current); current=word
        else: current=trial
    return '\n'.join(lines+[current])
def rr(d,box,fill,radius=22,outline=None):
    d.rounded_rectangle(box,radius=radius,fill=fill,outline=outline,width=2)
def check(d,x,y,s=1,fill=ACCENT):
    d.line([(x,y+10*s),(x+8*s,y+18*s),(x+23*s,y)],fill=fill,width=max(2,int(3*s)))
def arrow(d,x,y,length=54,fill=ACCENT):
    d.line((x,y,x+length,y),fill=fill,width=4)
    d.line((x+length-12,y-12,x+length,y,x+length-12,y+12),fill=fill,width=4)
def phone(d,x,y):
    d.arc((x,y,x+60,y+60),45,220,fill=ACCENT,width=11)
    rr(d,(x-1,y+6,x+18,y+27),ACCENT,5)
    rr(d,(x+38,y+40,x+60,y+58),ACCENT,5)
TITLES=[('You do the work.','A new caller needs help.'),('Let AI take the call.','A clear introduction. Your business rules.'),('Ask what matters.','An enquiry, not an interruption.'),('Capture the details.','A useful request for your team.'),('Make follow-up easy.','Your team stays in control.'),('A better next step.','See the pricing. Request your demo.')]
STEPS=['A call comes in','AI introduction','Understand the job','Create a summary','Request a callback','Made for your business']
DESCRIPTIONS=[
'A customer calls while your team is busy. Approved unanswered or after-hours routing passes the call to an AI receptionist.',
'The receptionist identifies itself as AI: Hi, I am the AI assistant for your plumbing team. How can I help?',
'In this fictional example, a caller asks about replacing a kitchen tap. The assistant asks for the service area and callback details.',
'A sample enquiry summary contains the caller name, the job, the service area and the requested next step.',
'The agreed workflow passes the request to your team. A callback request is not a confirmed appointment or guaranteed response time.',
'Picshaw scopes, configures and tests the workflow with your business. Explore pricing and request a tailored demo before activation.'
]
def scene(index,local,elapsed):
    im=Image.new('RGB',(W,H),BG); d=ImageDraw.Draw(im)
    text(d,(52,33),'picshaw',32,bold=True)
    text(d,(868,43),'AI RECEPTIONIST / WALKTHROUGH',16,QUIET)
    d.line((52,98,1228,98),fill=LINE,width=1)
    text(d,(52,130),f'0{index+1} / {STEPS[index].upper()}',17,ACCENT)
    text(d,(52,171),TITLES[index][0],58,bold=True)
    text(d,(55,251),TITLES[index][1],27,QUIET)
    top=324+int((1-min(1,local/.65))**3*26)
    if index==0:
        rr(d,(52,top,755,top+235),'#242b20',outline=LINE)
        text(d,(86,top+28),'BUSINESS PHONE',17,QUIET)
        text(d,(86,top+69),'Incoming enquiry',39,bold=True)
        text(d,(86,top+139),'Your team is on another job.',25,QUIET)
        d.ellipse((855,top+15,1035,top+195),fill='#303b27',outline=ACCENT,width=2)
        phone(d,914,top+75)
        pulse=9+int(7*(1+math.sin(local*2)))
        d.ellipse((855-pulse,top+15-pulse,1035+pulse,top+195+pulse),outline='#455238',width=2)
        arrow(d,779,top+106,46)
    elif index==1:
        rr(d,(52,top,1228,top+240),PAPER)
        text(d,(85,top+24),'AI ASSISTANT',17,'#6b432e',True)
        text(d,(85,top+70),'“Hi, I’m the AI assistant for your',37,'#1a2115',True)
        text(d,(85,top+119),'plumbing team. How can I help?”',37,'#1a2115',True)
        for i in range(34):
            height=4+abs(math.sin(local*3+i*.73))*16; x=86+i*10
            d.line((x,top+204-height/2,x,top+204+height/2),fill='#947354',width=4)
        text(d,(747,top+185),'AI is disclosed to the caller.',20,'#4e5844')
    elif index==2:
        rr(d,(52,top,625,top+240),'#242b20',outline=LINE)
        rr(d,(651,top,1228,top+240),PAPER)
        text(d,(80,top+25),'CALLER / EXAMPLE',17,QUIET)
        text(d,(80,top+73),wrap(d,'“I’d like a quote to replace a kitchen tap.”',515,33),33)
        text(d,(680,top+25),'AI ASSISTANT',17,'#6b432e',True)
        text(d,(680,top+73),wrap(d,'“Which area is the property in?”',510,33),33,'#1a2115',True)
        text(d,(680,top+185),'Then: name + callback details',22,'#4e5844')
    elif index==3:
        rr(d,(52,top,1228,top+246),PAPER)
        text(d,(83,top+23),'SAMPLE ENQUIRY SUMMARY',17,'#59634e',True)
        labels=[('CALLER','Alex / example'),('JOB','Tap replacement'),('AREA','Culver City'),('NEXT STEP','Callback requested')]
        for i,(label,value) in enumerate(labels):
            x=84+(i%2)*566; y=top+67+(i//2)*84
            text(d,(x,y),label,15,'#656e5d'); text(d,(x,y+25),value,28,'#1a2115',True)
        check(d,1155,top+26,1.25,'#4e6940')
    elif index==4:
        rr(d,(52,top,810,top+240),'#242b20',outline=LINE)
        text(d,(83,top+27),'FOR YOUR TEAM',17,QUIET)
        text(d,(83,top+72),'A clear callback request.',35,bold=True)
        text(d,(83,top+133),'Not a confirmed appointment.',25,ACCENT)
        text(d,(83,top+178),'Handover channel agreed at setup.',22,QUIET)
        rr(d,(864,top+12,1228,top+224),PAPER); check(d,1023,top+54,2,'#4e6940')
        text(d,(903,top+130),'Review. Follow up.',26,'#1a2115',True)
    else:
        for i,(word,note) in enumerate([('Scope','Your calls. Your rules.'),('Test','Realistic scenarios.'),('Launch','After approvals.')]):
            x=52+i*399; rr(d,(x,top,x+377,top+180),'#242b20',outline=LINE)
            text(d,(x+25,top+25),f'0{i+1}',17,ACCENT)
            text(d,(x+25,top+66),word,36,bold=True); text(d,(x+25,top+125),note,22,QUIET)
        rr(d,(52,top+202,679,top+261),ACCENT,12)
        text(d,(78,top+215),'Explore your AI receptionist',25,'#151b10',True)
        arrow(d,595,top+232,42,'#151b10'); text(d,(848,top+218),'picshaw.com',28,bold=True)
    d.line((52,624,1228,624),fill=LINE,width=1)
    text(d,(52,642),'ILLUSTRATIVE WORKFLOW / SILENT VIDEO / NOT A LIVE CALL',15,QUIET)
    text(d,(1114,642),f'{int(elapsed):02d} / 42',17,QUIET)
    d.rectangle((52,685,1228,688),fill=LINE)
    d.rectangle((52,685,52+int(1176*elapsed/DURATION),688),fill=ACCENT)
    return im

def main():
    scene(0,2,0).save(OUT/'receptionist-poster.jpg',quality=90,optimize=True)
    captions=['WEBVTT','']
    for i,description in enumerate(DESCRIPTIONS):
        captions += [str(i+1),f'00:{i*7:02d}.000 --> 00:{(i+1)*7:02d}.000',description,'']
    (OUT/'receptionist-walkthrough.vtt').write_text('\n'.join(captions),encoding='utf-8')
    cmd=['ffmpeg','-hide_banner','-loglevel','error','-y','-f','rawvideo','-vcodec','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-an','-c:v','libx264','-preset','fast','-crf','24','-pix_fmt','yuv420p','-movflags','+faststart',str(OUT/'receptionist-walkthrough.mp4')]
    process=subprocess.Popen(cmd,stdin=subprocess.PIPE)
    try:
        for frame in range(DURATION*FPS):
            elapsed=frame/FPS
            process.stdin.write(scene(min(5,int(elapsed//7)),elapsed%7,elapsed).tobytes())
    finally: process.stdin.close()
    if process.wait()!=0: raise SystemExit('Video render failed')
    print(f'Rendered {DURATION}s video to {OUT}')
if __name__=='__main__': main()
