export const prerender = false;
import type { APIRoute } from 'astro';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { put } from '@vercel/blob';

const ADMIN_KEY = import.meta.env.ADMIN_KEY ?? '';

export const POST: APIRoute = async ({ request }) => {
  const body = (await request.clone().json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const key = request.headers.get('x-admin-key');
        if (!ADMIN_KEY || key !== ADMIN_KEY) {
          throw new Error('Unauthorized');
        }
        return {
          allowedContentTypes: [
            'video/mp4', 'video/quicktime', 'video/webm',
            'video/x-matroska', 'video/x-msvideo', 'video/avi',
          ],
          addRandomSuffix: false,
          tokenPayload: clientPayload,
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const payload = tokenPayload ? JSON.parse(tokenPayload) : {};
        const id = `rec_${Date.now()}`;
        const meta = {
          id,
          title: payload.title || 'Recording',
          description: '',
          date: payload.date || new Date().toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' }),
          videoUrl: blob.url,
          uploadedAt: new Date().toISOString(),
        };
        await put(`recordings/meta/${id}.json`, JSON.stringify(meta), {
          access: 'public',
          addRandomSuffix: false,
          contentType: 'application/json',
        });
      },
    });

    return new Response(JSON.stringify(jsonResponse), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
