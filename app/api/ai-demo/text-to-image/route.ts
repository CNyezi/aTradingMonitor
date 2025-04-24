/**
 * ai sdk docs:
 * https://sdk.vercel.ai/docs/reference/ai-sdk-core/generate-image
 * https://sdk.vercel.ai/providers/ai-sdk-providers
 * 
 * vercel runtime:
 * https://vercel.com/docs/functions/runtimes/edge
 * https://vercel.com/docs/functions/runtimes/node-js
 * 
 * vercel maxDuration: 
 * https://vercel.com/docs/functions/configuring-functions/duration
 */

export const runtime = "nodejs";
export const maxDuration = 60;

import { apiResponse } from "@/lib/api-response";
import { uploadFile } from "@/lib/cloudflare/r2"; // Optional: Uncomment if you want to upload results to R2
import { openai } from "@ai-sdk/openai";
import { replicate } from "@ai-sdk/replicate";
import { xai } from "@ai-sdk/xai";
import { ImageModel, JSONValue, experimental_generateImage as generateImage } from 'ai';
import { z } from 'zod';

const inputSchema = z.object({
  prompt: z.string().min(1, "Prompt cannot be empty"),
  modelId: z.string().min(1, "Model ID cannot be empty"),
  provider: z.string().min(1, "Provider cannot be empty"),
});

export async function POST(req: Request) {
  try {
    const rawBody = await req.json();

    const validationResult = inputSchema.safeParse(rawBody);
    if (!validationResult.success) {
      return apiResponse.badRequest(`Invalid input: ${validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }

    const { prompt, modelId, provider } = validationResult.data;

    let imageModel: ImageModel;
    let providerOptions: Record<string, Record<string, JSONValue>> = {};
    let size = '1024x1024' as `${number}x${number}` | undefined;

    switch (provider) {
      case "replicate":
        if (!process.env.REPLICATE_API_TOKEN) {
          return apiResponse.serverError("Server configuration error: Missing Replicate API Token.");
        }
        imageModel = replicate.image(modelId);
        size = undefined;
        break;

      case "xai":
        if (!process.env.XAI_API_KEY) {
          return apiResponse.serverError("Server configuration error: Missing XAI API Key.");
        }
        imageModel = xai.image(modelId);
        size = undefined;
        break;

      case "openai":
        if (!process.env.OPENAI_API_KEY) {
          return apiResponse.serverError("Server configuration error: Missing OpenAI API Key.");
        }
        imageModel = openai.image(modelId);
        // providerOptions = {
        //   openai: { background: 'transparent', quality: 'high' },
        // };
        break;

      default:
        return apiResponse.badRequest(`Unsupported image generation provider: ${provider}`);
    }

    const { images, warnings } = await generateImage({
      model: imageModel,
      prompt: prompt,
      size: size as `${number}x${number}` | undefined,
      n: 1, // number of images to generate
      providerOptions: providerOptions,
    });

    if (warnings?.length) {
      return apiResponse.serverError(`Image generation warnings: ${warnings[0]}.`);
    }

    if (!images || images.length === 0) {
      return apiResponse.serverError("Image generation failed, no image returned.");
    }

    // Optional: Upload result image to R2
    try {
      const path = `text-to-images/${provider}/${modelId}/`;
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.png`;
      const { url: imageUrl, key } = await uploadFile({
        data: images[0].base64,
        fileName: fileName,
        contentType: 'image/png',
        path: path
      });
    } catch (uploadError) {
      console.error("Failed to upload to R2:", uploadError);
    }

    return apiResponse.success({ imageUrl: `data:image/png;base64,${images[0].base64}` });

  } catch (error: any) {
    console.error("Image generation failed:", error);
    const errorMessage = error?.message || "Failed to generate image";
    if (errorMessage.includes("API key") || errorMessage.includes("authentication")) {
      return apiResponse.serverError(`Server configuration error: ${errorMessage}`);
    }
    return apiResponse.serverError(errorMessage);
  }
}
