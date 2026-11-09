// Cloudflare Workers: paste this script in a Worker, then add Secrets:
// OPENAI_API_KEY = your OpenAI API key
// APP_ACCESS_TOKEN = a UNIQUE random passphrase, 24+ characters (NOT the OpenAI API key)
// Optional: ALLOWED_ORIGIN = https://your-hosted-app.example (for hosted frontends)
// Testing a locally opened HTML file needs Origin: null, so CORS allows it.
const CHARACTERS = {
 '五十嵐浩二': '男性。ぶっきらぼうで面倒見がよい。「……チッ」など自然に使うが連発しない。佐藤萌香を「先輩」と呼ばない。',
 '高富誠司': '男性。厳格・真面目でやや不器用。甘いものが好きだが隠しがち。尊大な命令調「〜したまえ」は使わない。',
 '喜八智嗣': '男性。穏やかで文理に強い天才。一人称は「僕」。好奇心豊かで思いやり深い。',
 '古上創也': '男性。物静かで文学好き、親切。控えめで知的な言葉遣い。',
 '寅威陽斗': '男性。明るい関西弁。響矢とは幼馴染。元気で人懐こい。',
 '響矢一臣': '男性。理知的で率直、上品な標準語。関西弁は絶対に使わない。'
};
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8', 'Vary': 'Origin' };
function respond(data, code=200){return new Response(JSON.stringify(data),{status:code,headers});}
export default {
 async fetch(request,env){
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  const url=new URL(request.url);
  if(url.pathname!=='/api/ai'||request.method!=='POST')return respond({error:'POST /api/ai を利用してね'},404);
  if(!env.OPENAI_API_KEY || !env.APP_ACCESS_TOKEN)return respond({error:'WorkerのSecrets設定が未完了です'},503);
  if(!request.headers.get('Authorization') || request.headers.get('Authorization')!==`Bearer ${env.APP_ACCESS_TOKEN}`)return respond({error:'合言葉が違うよ。APP_ACCESS_TOKENを確認してね'},401);
  const len=Number(request.headers.get('Content-Length')||0);
  if(len>2_200_000)return respond({error:'画像が大きすぎるよ'},413);
  let input;try{input=await request.json()}catch{return respond({error:'JSON形式で送ってね'},400)}
  const character=typeof input.character==='string'&&CHARACTERS[input.character]?input.character:'五十嵐浩二';
  const mode=input.mode==='photo'?'photo':'chat';
  const message=String(input.message||'').slice(0,500).trim();
  if(!message)return respond({error:'メッセージを入力してね'},400);
  if(mode==='photo'&&(!input.image||typeof input.image!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(input.image)||input.image.length>2_000_000))return respond({error:'写真が不正か大きすぎます。画像を小さくしてね'},400);
  const system=`あなたは創作『叡才大学』の「${character}」として、ユーザーと散歩デートをする親しみやすい会話AI。${CHARACTERS[character]} 普段の自然な口調を保ち、過剰に甘すぎたり台詞が演劇的にならないように。会話は日本語で短め（通常2〜4文）。散歩中の安全に配慮。写真ではまず見えるものを客観的に説明し、名称は候補・根拠・不確実性を示すこと。植物やキノコの食用可否、危険性を画像だけで確定しない。史跡の歴史や固有名詞を根拠なく創作しない。知識解説のあと、${character}らしい一言を自然に添える。ユーザー個人情報を求めない。`; 
  const content = mode==='photo' ? [{type:'text',text:message},{type:'image_url',image_url:{url:input.image,detail:'low'}}] : message;
  try{
   const api=await fetch('https://api.openai.com/v1/chat/completions',{
    method:'POST',headers:{'Authorization':`Bearer ${env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
    body:JSON.stringify({model:'gpt-4.1-mini',messages:[{role:'system',content:system},{role:'user',content}],max_tokens:450,temperature:0.7})
   });
   const result=await api.json().catch(()=>({}));
   if(!api.ok){
    if(api.status===429)return respond({error:'利用上限・残高・リクエスト頻度を確認してね'},429);
    if(api.status===401)return respond({error:'OPENAI_API_KEYが正しいか確認してね'},502);
    return respond({error:'OpenAIとの通信に失敗したよ（'+api.status+'）'},502);
   }
   return respond({reply:result.choices?.[0]?.message?.content||'返事が取得できなかったよ'});
  }catch(e){return respond({error:'ネットワーク通信に失敗しました'},502)}
 }
};
