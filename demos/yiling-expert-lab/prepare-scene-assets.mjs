// Encode the approved originals for delivery, without changing their composition or size.
import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const art=new URL('../../source-art/maps/yiling-camp-v3-20261106/',import.meta.url);
const target=new URL('public/art/scenes/',import.meta.url);
const keys=['camp','river','east','south','imperial','overview'];
await mkdir(target,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const entries=[];
try{
 const page=await browser.newPage();
 for(const key of keys){
  const input=await readFile(new URL(`art/${key}.png`,art));
  const encoded=await page.evaluate(async data=>{
   const image=new Image();image.src=data;await image.decode();
   const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
   canvas.getContext('2d').drawImage(image,0,0);
   const full=canvas.toDataURL('image/webp',0.96).split(',')[1];
   const thumb=document.createElement('canvas');thumb.width=320;thumb.height=Math.round(320*image.naturalHeight/image.naturalWidth);
   thumb.getContext('2d').drawImage(image,0,0,thumb.width,thumb.height);
   return {full,thumb:thumb.toDataURL('image/webp',0.9).split(',')[1],width:canvas.width,height:canvas.height};
  },'data:image/png;base64,'+input.toString('base64'));
  const output=Buffer.from(encoded.full,'base64');
  await writeFile(new URL(`${key}.webp`,target),output);
  await writeFile(new URL(`${key}-thumb.webp`,target),Buffer.from(encoded.thumb,'base64'));
  entries.push({view:key,source:`source-art/maps/yiling-camp-v3-20261106/art/${key}.png`,sourceSHA256:createHash('sha256').update(input).digest('hex'),file:`art/scenes/${key}.webp`,imageSize:[encoded.width,encoded.height],sourceBytes:input.length,bytes:output.length,encoding:'Chrome WebP quality 0.96; original dimensions; no crop or upscale'});
 }
}finally{await browser.close();}
const layout=JSON.parse(await readFile(new URL('art-layout.json',art),'utf8'));
for(const [key,camera]of Object.entries(layout.cameras))camera.image=`/art/scenes/${key}.webp`;
await writeFile(new URL('public/scene-view-layout.json',import.meta.url),JSON.stringify(layout,null,2)+'\n');
const map=JSON.parse(await readFile(new URL('legacy-map-layout.json',art),'utf8'));map.image='/art/scenes/overview.webp';
await writeFile(new URL('public/scene-map-layout.json',import.meta.url),JSON.stringify(map,null,2)+'\n');
await writeFile(new URL('provenance.json',target),JSON.stringify({date:'2026-11-06',approval:{scope:'Six v3 images: composition and visual texture. New gameplay UI remains to be played by user.',quote:'可以的，这个质感非常完美了。请你相应帮忙优化和完善，做完整。'},entries},null,2)+'\n');
console.log(JSON.stringify({images:entries.length,originalBytes:entries.reduce((n,e)=>n+e.sourceBytes,0),runtimeBytes:entries.reduce((n,e)=>n+e.bytes,0)}));
