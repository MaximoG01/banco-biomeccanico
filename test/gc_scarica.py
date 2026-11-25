"""Legge solo il riepilogo JSON dentro gli zip degli atleti GoldenCheetah OpenData (OSF 6hfpz) con richieste HTTP Range.
Uso: python -I test/gc_scarica.py <cartella dati> <pagina iniziale> <pagine> [--prova]"""
import sys, io, json, os, zipfile, urllib.request, time
sys.stdout.reconfigure(encoding="utf-8")
out, p0, np_ = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]); prova = "--prova" in sys.argv
UA = {"User-Agent": "research-client/1.0"}
def get(url, rng=None):
    h = dict(UA);
    if rng: h["Range"] = rng
    for k in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=60) as r: return r.read(), r.geturl()
        except Exception as e:
            if k == 3: raise
            time.sleep(2 + 3 * k)
class HttpFile(io.RawIOBase):  # file a sola lettura con seek, servito a pezzi via Range
    def __init__(s, url, size): s.url, s.size, s.pos = url, size, 0
    def seekable(s): return True
    def readable(s): return True
    def tell(s): return s.pos
    def seek(s, o, w=0): s.pos = o if w == 0 else s.pos + o if w == 1 else s.size + o; return s.pos
    def readinto(s, b):
        n = min(len(b), s.size - s.pos)
        if n <= 0: return 0
        d, _ = get(s.url, f"bytes={s.pos}-{s.pos + n - 1}"); b[:len(d)] = d; s.pos += len(d); return len(d)
for page in range(p0, p0 + np_):
    lst = json.loads(get(f"https://api.osf.io/v2/nodes/6hfpz/files/osfstorage/?page%5Bsize%5D=100&page={page}")[0])
    for x in lst["data"]:
        name, size, dl = x["attributes"]["name"], x["attributes"]["size"], x["links"]["download"]
        dst = os.path.join(out, name.replace(".zip", ".json"))
        if os.path.exists(dst) or not name.endswith(".zip") or not size: continue
        try:
            _, real = get(dl, "bytes=0-0")          # segue il redirect verso lo storage (URL firmato, valido 60 s)
            z = zipfile.ZipFile(io.BufferedReader(HttpFile(real, size), 1 << 16))
            js = [i for i in z.infolist() if i.filename.endswith(".json")]
            if prova: print(name, size, [(i.filename, i.file_size) for i in z.infolist()[:5]], len(z.infolist()), "voci; json:", [(i.filename, i.file_size) for i in js])
            if js and js[0].file_size < 30_000_000:
                with open(dst, "wb") as f: f.write(z.read(js[0]))
        except Exception as e: print("errore", name, e)
        if prova: break
    print("pagina", page, "fatta", flush=True)
