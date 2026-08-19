export async function api(url, options={}){const res=await fetch(url,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(options.headers||{})},...options});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.message||'Request failed');return data}
export const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
export const roleLabel=r=>({student:'Student',professor:'Faculty / Professor',hod:'Head of Department',exam_cell:'Exam Cell',admin:'Administration'}[r]||r);
export const initials=n=>String(n||'U').split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();
export const slug=s=>String(s||'').toLowerCase().replace(/\s+/g,'-');
