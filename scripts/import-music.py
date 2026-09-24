"""Download the explicitly curated licensed recordings and prepare local MP3 assets.
Requires ffmpeg/ffprobe. Run from any directory. No generated melodies or samples.
The source catalogue contains author, license and original download for each track.
"""
from pathlib import Path
import concurrent.futures, hashlib, json, subprocess, urllib.request
ROOT = Path(__file__).resolve().parents[1]
CATALOG = json.loads((ROOT / 'src/data/musicCatalog.json').read_text())
CACHE = ROOT / 'output/music-curation/originals'
CACHE.mkdir(parents=True, exist_ok=True)

def prepare(track):
    key = Path(track['url']).stem
    original = CACHE / (key + Path(track['download']).suffix)
    if not original.exists():
        request = urllib.request.Request(track['download'], headers={'User-Agent': 'LaTaverna asset import'})
        with urllib.request.urlopen(request, timeout=90) as response: original.write_bytes(response.read())
    scan = subprocess.run(['ffmpeg','-hide_banner','-i',str(original),'-af','loudnorm=I=-21:TP=-2:LRA=11:print_format=json','-f','null','-'],capture_output=True,text=True,check=True)
    stats = json.JSONDecoder().raw_decode(scan.stderr[scan.stderr.rfind('{'):])[0]
    settings = 'loudnorm=I=-21:TP=-2:LRA=11:linear=true:' + ':'.join(f'{target}={stats[source]}' for target,source in [('measured_I','input_i'),('measured_TP','input_tp'),('measured_LRA','input_lra'),('measured_thresh','input_thresh'),('offset','target_offset')])
    destination = ROOT / 'public' / track['url'].lstrip('/')
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(original),'-map','0:a:0','-af',settings,'-ar','44100','-ac','2','-c:a','libmp3lame','-b:a','160k','-map_metadata','-1','-metadata','title='+track['title'],'-metadata','artist='+track['artist'],str(destination)],check=True)
    duration = float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(destination)],text=True))
    print(key, round(duration,1), 'seconds', flush=True)
    return dict(file=track['url'],source=track['download'],originalSha256=hashlib.sha256(original.read_bytes()).hexdigest(),sha256=hashlib.sha256(destination.read_bytes()).hexdigest(),durationSeconds=round(duration,2),processing='Full recording; two-pass loudness normalization to -21 LUFS / -2 dBTP, MP3 160 kbps stereo 44.1 kHz; no change of melody, pitch or tempo.')

if __name__ == '__main__':
    tracks = [t for playlist in CATALOG.values() for t in playlist['tracks']]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool: manifest = list(pool.map(prepare, tracks))
    (ROOT/'public/audio/provenance.json').write_text(json.dumps(manifest,indent=2)+'\n')
