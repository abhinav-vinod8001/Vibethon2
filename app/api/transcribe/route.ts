import { secrets } from '../../lib/ai';
import { checkOrigin, HttpError, identity, json, route } from '../../lib/server';
export async function POST(request: Request) { return route(async () => {
  checkOrigin(request); await identity();
  const { SARVAM_API_KEY:key, SARVAM_MODEL:model } = secrets();
  if (!key) throw new HttpError(503,'Voice transcription is not connected yet. Please type your answer; your progress is preserved.');
  if (Number(request.headers.get('content-length')) > 4500000) throw new HttpError(413,'Please record a shorter answer.');
  const input=await request.formData(); const file=input.get('audio');
  if (!(file instanceof File) || file.size>4000000 || file.size<100) throw new HttpError(400,'Please send an audio recording under 4 MB.');
  const language=input.get('language')==='English'?'en-IN':'ml-IN';
  const data=new FormData(); data.set('file',file,file.type.includes('mp4') ? 'answer.m4a' : 'answer.webm'); data.set('language_code',language); data.set('model',model || 'saaras:v3');
  const response=await fetch('https://api.sarvam.ai/speech-to-text',{method:'POST',headers:{'api-subscription-key':key},body:data,signal:AbortSignal.timeout(25000)});
  if(!response.ok) throw new HttpError(502,'Transcription is temporarily unavailable. Please type or try another recording.');
  const result=await response.json() as {transcript?:string};
  if(!result.transcript?.trim()) throw new HttpError(422,'No speech was detected. Please try again or type your answer.');
  return json({transcript:result.transcript});
}); }
