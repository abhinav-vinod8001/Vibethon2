import { body, checkOrigin, database, HttpError, identity, json, route } from '../../lib/server';
import { profileSchema } from '../../lib/validation';
export async function PUT(request: Request) { return route(async () => {
  checkOrigin(request); const user = await identity(); const input = await body(request);
  if (input.confirmed !== true) throw new HttpError(400, 'Please review and confirm your profile before saving.');
  const p = profileSchema.parse(input.profile);
  await database().prepare(`INSERT INTO profiles (user_id,name,location,target_role,language,experience,skills,availability,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET name=excluded.name,location=excluded.location,
    target_role=excluded.target_role,language=excluded.language,experience=excluded.experience,skills=excluded.skills,
    availability=excluded.availability,updated_at=excluded.updated_at`)
    .bind(user.userId,p.name,p.location,p.targetRole,p.language,p.experience,p.skills,p.availability,new Date().toISOString()).run();
  return json({ profile: p });
}); }
