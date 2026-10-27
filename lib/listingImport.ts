export type ListingImport = {url: string; title: string; company: string};

const cleanText = (value: string) => value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 200);

export function readListingImport(fragment: string): ListingImport | null {
  if (!fragment.startsWith("#job=") || fragment.length > 16000) return null;
  const params = new URLSearchParams(fragment.slice(1));
  const raw = params.get("job") ?? "";
  if (!raw || raw.length > 2048) return null;
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    url.hash = "";
    return {url: url.href, title: cleanText(params.get("title") ?? ""), company: cleanText(params.get("company") ?? "")};
  } catch {
    return null;
  }
}

// Return destinations stay on /check, regardless of data from an external listing.
export function listingCheckPath(listing: ListingImport | null): string {
  if (!listing) return "/check";
  const fragment = `#${new URLSearchParams({job: listing.url, title: listing.title, company: listing.company})}`;
  return readListingImport(fragment) ? `/check${fragment}` : "/check";
}

export function buildJobBookmarklet(appOrigin: string): string {
  const app = new URL(appOrigin);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(app.hostname);
  if (app.protocol !== "https:" && !(app.protocol === "http:" && local)) throw new Error("Use the secure app origin");
  const target = new URL("/check", app.origin).href;
  // This runs on the listing page. Everything captured is encoded as data, never as executable code.
  const script = `void(function(){
    if(!/^https?:$/.test(location.protocol))return;
    var source=new URL(location.href);source.hash='';source.username='';source.password='';
    if(source.href.length>2048){window.alert('Copy the job link and paste it into Interview Tools.');return;}
    var queue=[],jobs=[];
    Array.from(document.querySelectorAll('script[type="application/ld+json"]')).slice(0,20).forEach(function(el){
      try{if(el.textContent.length<=100000)queue.push(JSON.parse(el.textContent));}catch{}
    });
    for(var i=0;queue.length&&i<100;i++){
      var item=queue.shift();
      if(Array.isArray(item)){queue.push.apply(queue,item.slice(0,100));continue;}
      if(!item||typeof item!=='object')continue;
      var types=Array.isArray(item['@type'])?item['@type']:[item['@type']];
      if(types.includes('JobPosting'))jobs.push(item);
      if(Array.isArray(item['@graph']))queue.push.apply(queue,item['@graph'].slice(0,100));
    }
    var job=jobs.length===1?jobs[0]:jobs.find(function(candidate){
      try{if(typeof candidate.url!=='string')return false;var u=new URL(candidate.url,source);u.hash='';return u.href===source.href;}catch{return false;}
    });
    var heading=document.querySelector('h1');
    var title=job&&typeof job.title==='string'?job.title:(heading&&heading.textContent.trim()?heading.textContent:document.title);
    var org=job&&job.hiringOrganization;
    var company=typeof org==='string'?org:(org&&typeof org.name==='string'?org.name:'');
    function clean(s){return s.replace(/[\\u0000-\\u001f\\u007f]/g,' ').trim().slice(0,200);}
    var destination=new URL(${JSON.stringify(target)});
    destination.hash=new URLSearchParams({job:source.href,title:clean(title),company:clean(company)}).toString();
    window.open(destination.href,'_blank','noopener,noreferrer');
  })()`;
  return `javascript:${encodeURIComponent(script)}`;
}
