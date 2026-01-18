import { RunPromptParams, RunPromptResult, renderTemplate, imageUrlToBase64, getContentTypeFromUrl, uploadToStorage, UploadOptions } from '../index';

const VERTEX_AI_URL = 'https://us-central1-aiplatform.googleapis.com/v1';

interface VertexOperationResponse {
  name: string;
  done: boolean;
  response?: {
    predictions?: Array<{
      bytesBase64Encoded?: string;
      gcsUri?: string;
    }>;
    videos?: Array<{
      bytesBase64Encoded?: string;
      gcsUri?: string;
    }>;
  };
  error?: {
    message: string;
  };
}

export interface VideoGeminiOptions {
  sourceImageId?: string;
}

export async function runVideoGemini(params: RunPromptParams, options?: VideoGeminiOptions): Promise<RunPromptResult> {
  const { prompt, run, inputImageUrl, supabase } = params;

  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const accessToken = await getAccessToken();

  if (!projectId) {
    throw new Error('GOOGLE_CLOUD_PROJECT_ID environment variable is not set');
  }

  if (!accessToken) {
    throw new Error('Failed to get Google Cloud access token');
  }

  if (!inputImageUrl) {
    throw new Error('Input image URL is required for video generation');
  }

  const variables = (run.variables as Record<string, unknown>) || {};
  const videoPrompt = renderTemplate(
    prompt.system_prompt as string || 'Generate a video from this image',
    variables
  );

  const model = (prompt.selected_model as string) || 'veo-3.0-generate-001';
  const videoDuration = (prompt.video_duration as number) || 8; // Default to 8 seconds (valid options: 4, 6, 8)

  // Download and encode input image
  const imageBase64 = await imageUrlToBase64(inputImageUrl);
  const imageMimeType = getContentTypeFromUrl(inputImageUrl);

  // Build the request
  const url = `${VERTEX_AI_URL}/projects/${projectId}/locations/us-central1/publishers/google/models/${model}:predictLongRunning`;

  const requestBody = {
    instances: [
      {
        image: {
          bytesBase64Encoded: imageBase64,
          mimeType: imageMimeType,
        },
        prompt: videoPrompt,
      },
    ],
    parameters: {
      sampleCount: 1,
      durationSeconds: videoDuration,
      includeRaiReason: true,
    },
  };

  try {
    // Start the long-running operation
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Vertex AI error: ${response.status} - ${errorText}`);
    }

    const operationData = await response.json() as { name: string };
    const operationName = operationData.name;

    // Poll for completion
    const result = await pollForVideoResult(operationName, accessToken, supabase, options);
    return result;
  } catch (error) {
    console.error('Gemini video error:', error);
    throw error;
  }
}

async function pollForVideoResult(
  operationName: string,
  accessToken: string,
  supabase: Parameters<typeof uploadToStorage>[0],
  options?: VideoGeminiOptions,
  maxAttempts = 120, // 10 minutes with 5 second intervals
  intervalMs = 5000
): Promise<RunPromptResult> {
  // Extract model path from operation name for the fetchPredictOperation endpoint
  // operationName format: projects/PROJECT/locations/LOCATION/publishers/google/models/MODEL/operations/OP_ID
  const modelPathMatch = operationName.match(/^(.*?)\/operations\//);
  if (!modelPathMatch) {
    throw new Error(`Invalid operation name format: ${operationName}`);
  }
  const modelPath = modelPathMatch[1];
  const pollUrl = `https://us-central1-aiplatform.googleapis.com/v1/${modelPath}:fetchPredictOperation`;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Wait before polling
    await new Promise((resolve) => setTimeout(resolve, intervalMs));

    const response = await fetch(pollUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ operationName }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Polling error: ${response.status} - ${errorText}`);
      continue;
    }

    const data = await response.json() as VertexOperationResponse;

    if (data.done) {
      console.log('Veo operation completed. Full response:', JSON.stringify(data, null, 2));

      if (data.error) {
        throw new Error(`Video generation failed: ${data.error.message}`);
      }

      const videoItems = data.response?.videos || data.response?.predictions;
      if (videoItems && videoItems.length > 0) {
        const videoItem = videoItems[0];

        let videoData: string | undefined;

        if (videoItem.bytesBase64Encoded) {
          videoData = videoItem.bytesBase64Encoded;
        } else if (videoItem.gcsUri) {
          videoData = await downloadFromGCS(videoItem.gcsUri, accessToken);
        }

        if (!videoData) {
          throw new Error('No video data in response');
        }

        const buffer = Buffer.from(videoData, 'base64');
        const filename = `gemini_video_${Date.now()}.mp4`;
        const uploadOptions: UploadOptions = {};
        if (options?.sourceImageId) {
          uploadOptions.sourceImageId = options.sourceImageId;
        }
        const { url: outputUrl, mediaId } = await uploadToStorage(supabase, buffer, filename, 'video/mp4', uploadOptions);

        const sanitizedItems = videoItems.map((item) => ({
          ...item,
          bytesBase64Encoded: item.bytesBase64Encoded ? '[REDACTED]' : undefined,
        }));
        const sanitizedResponse = {
          operationName,
          status: 'complete',
          videos: data.response?.videos ? sanitizedItems : undefined,
          predictions: data.response?.predictions ? sanitizedItems : undefined,
        };

        return {
          response: sanitizedResponse,
          outputUrl,
          outputMediaId: mediaId,
          outputType: 'video',
          attachmentUrls: [outputUrl],
          outputMediaIds: [mediaId],
        };
      }

      console.error('No video data found. Response keys:', Object.keys(data.response || {}));
      throw new Error('No video data in response');
    }

    console.log(`Video generation in progress (attempt ${attempt + 1}/${maxAttempts})`);
  }

  throw new Error('Video generation timed out');
}

async function downloadFromGCS(gcsUri: string, accessToken: string): Promise<string> {
  // Parse gs:// URI
  const match = gcsUri.match(/^gs:\/\/([^/]+)\/(.+)$/);
  if (!match) {
    throw new Error(`Invalid GCS URI: ${gcsUri}`);
  }

  const [, bucket, object] = match;
  const url = `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(object)}?alt=media`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download from GCS: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer).toString('base64');
}

async function getAccessToken(): Promise<string> {
  // First, try environment variable
  if (process.env.GOOGLE_CLOUD_ACCESS_TOKEN) {
    return process.env.GOOGLE_CLOUD_ACCESS_TOKEN;
  }

  // Try to get token from service account credentials
  let credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (credentials) {
    try {
      // Fix newlines in private_key that became literal characters when stored in env var
      // Only escape newlines inside the private_key value, not structural JSON whitespace
      credentials = credentials.replace(
        /("private_key"\s*:\s*")([^"]*)/g,
        (_, prefix, keyContent) => prefix + keyContent.replace(/\n/g, '\\n')
      );

      const creds = JSON.parse(credentials);
      const token = await generateAccessToken(creds);
      return token;
    } catch (error) {
      console.error('Error generating access token:', error);
    }
  }

  throw new Error('No Google Cloud credentials available');
}

async function generateAccessToken(credentials: {
  client_email: string;
  private_key: string;
  token_uri: string;
}): Promise<string> {
  // This is a simplified implementation
  // In production, use the google-auth-library
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;

  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const payload = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: credentials.token_uri,
    iat: now,
    exp: exp,
  };

  // For proper JWT signing, you'd need a crypto library
  // This is a placeholder - in production use google-auth-library
  const crypto = await import('crypto');

  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signInput = `${headerB64}.${payloadB64}`;

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signInput);
  const signature = sign.sign(credentials.private_key, 'base64url');

  const jwt = `${signInput}.${signature}`;

  // Exchange JWT for access token
  const response = await fetch(credentials.token_uri, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status}`);
  }

  const data = await response.json() as { access_token: string };
  return data.access_token;
}
