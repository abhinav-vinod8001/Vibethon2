import { z } from 'zod';
export const profileSchema = z.object({
  name: z.string().trim().min(2).max(100), location: z.string().trim().min(2).max(100),
  targetRole: z.string().trim().min(2).max(120), language: z.string().max(50),
  experience: z.string().trim().min(10).max(6000), skills: z.string().trim().max(2000),
  availability: z.string().trim().max(500),
});
export const jobSchema = z.object({
  title: z.string().trim().min(3).max(120), company: z.string().trim().min(2).max(120),
  location: z.string().trim().min(2).max(100), category: z.string().max(50),
  type: z.enum(['Full-time', 'Part-time', 'Contract']),
  salaryMin: z.number().int().min(0).max(10000000).nullable(), salaryMax: z.number().int().min(0).max(10000000).nullable(),
  description: z.string().trim().min(20).max(6000), requirements: z.string().trim().min(10).max(3000),
  shift: z.string().trim().min(2).max(100), deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')),
}).refine(v => v.salaryMin === null || v.salaryMax === null || v.salaryMax >= v.salaryMin, 'Maximum pay must be at least minimum pay.');
