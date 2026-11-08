export const API=import.meta.env.VITE_API_URL || 'http://localhost:4000';
export async function request(path,{token,...options}={}) {
 const res=await fetch(`${API}${path}`,{...options,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{}) ,...(options.headers||{})}});
 const data=await res.json().catch(()=>({}));
 if(!res.ok)throw new Error(data.message||'Request failed');return data;
}
