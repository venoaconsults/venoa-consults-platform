import { readFile, writeFile } from 'node:fs/promises';

const path = 'dist/index.html';
let html = await readFile(path, 'utf8');

// Safari/HTML5 URL validation can block submit before the app receives the form
// when a user pastes a domain or Instagram URL without https://.
html = html.replaceAll('input name="url" type="url"', 'input name="url" type="text" inputmode="url"');
html = html.replace('<button class="btn btn-dark">Save brand</button>', '<button class="btn btn-dark" type="submit">Save brand</button>');

const brandFn = String.raw`  async function saveBrand(fd) {
    const name=String(fd.get('name')||'').trim();
    if(!name) throw new Error('Brand name is required.');
    const existing=db.brands.find(x=>x.id===String(fd.get('id')||''));
    let url=String(fd.get('url')||'').trim();
    if(url && !/^https?:\/\//i.test(url)) url='https://'+url.replace(/^\/+/, '');
    if(url){ try { new URL(url); } catch { throw new Error('Enter a valid website or Instagram URL.'); } }
    const logo=await readImage(fd.get('logoFile'));
    const r=existing||{id:id('VCS-BR-','brand')};
    Object.assign(r,{name,relationship:String(fd.get('relationship')||'OTHER').trim()||'OTHER',url,public:fd.get('public')==='on',updatedAt:now()});
    if(!existing) r.createdAt=now();
    if(logo) r.logo=logo;
    if(!existing) db.brands.unshift(r);
    audit(existing?'Brand updated':'Brand added',r.id+' · '+r.name);
    try { save(); } catch(err) {
      if(err && (err.name==='QuotaExceededError' || /quota|storage/i.test(String(err.message||'')))) throw new Error('Browser storage is full. Remove old preview uploads or connect Firebase Storage for permanent brand logos.');
      throw err;
    }
    state.adminTab='brands';
    closeModal();
    renderAdmin();
    toast('Brand saved: '+r.name);
  }`;

const before = html;
html = html.replace(/  async function saveBrand\(fd\) \{[^\n]*\}/, brandFn);
if (html === before || !html.includes("toast('Brand saved: '+r.name)")) {
  throw new Error('Brand-save hotfix failed to apply to dist/index.html');
}
if (!html.includes('id="brand-form"') || !html.includes('type="submit">Save brand')) {
  throw new Error('Brand form integrity check failed after hotfix');
}

await writeFile(path, html, 'utf8');
console.log('VCS brand-save hotfix applied and verified.');
