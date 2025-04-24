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

import { IMAGE_TO_IMAGE_MODELS } from "@/lib/ai/models";
import { apiResponse } from "@/lib/api-response";
// import { uploadFile } from "@/lib/cloudflare/r2"; // Optional: Uncomment if you want to upload results to R2
import { replicate } from "@ai-sdk/replicate";
import { ImageModel, JSONValue, experimental_generateImage as generateImage } from 'ai';
import { z } from 'zod';

const inputSchema = z.object({
  image: z.string().startsWith('data:image/'),
  prompt: z.string().min(1, "Prompt cannot be empty"),
  seed: z.number().int().optional(),
  modelId: z.string(),
  provider: z.string(),
});

export async function POST(req: Request) {
  try {
    const rawBody = await req.json();

    const validationResult = inputSchema.safeParse(rawBody);
    if (!validationResult.success) {
      return apiResponse.badRequest(`Invalid input: ${validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }

    const { image: imageBase64DataUri, prompt, seed, modelId, provider } = validationResult.data;

    const modelDefinition = IMAGE_TO_IMAGE_MODELS.find(m => m.provider === provider && m.id === modelId);
    if (!modelDefinition) {
      return apiResponse.badRequest(`Unsupported model: ${provider}/${modelId}`);
    }

    let imageModel: ImageModel;
    let providerOptions: Record<string, Record<string, JSONValue>> = {};

    switch (provider) {
      case "replicate":
        if (!process.env.REPLICATE_API_TOKEN) {
          return apiResponse.serverError("Server configuration error: Missing Replicate API Token.");
        }
        imageModel = replicate.image(modelId);
        providerOptions = {
          replicate: {
            image_prompt: imageBase64DataUri,
          }
        };
        break;

      default:
        return apiResponse.badRequest(`Unsupported image generation provider for image-to-image: ${provider}`);
    }

    const { images, warnings } = await generateImage({
      model: imageModel,
      prompt: prompt,
      seed: seed,
      n: 1,
      providerOptions,
    });

    if (warnings?.length) {
      return apiResponse.serverError(`Image generation warnings: ${warnings[0]}.`);
    }

    if (!images || images.length === 0) {
      return apiResponse.serverError("Image generation failed, no image returned.");
    }

    // Optional: Upload result image to R2
    // try {
    //   const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    //   const path = `image-to-images/${provider}/${modelId}/`;

    //   const originalImageParts = imageBase64DataUri.split(';');
    //   const originalImageType = originalImageParts[0].split(':')[1];
    //   const originalImageBase64 = originalImageParts[1].split(',')[1];
    //   const originalFileExtension = originalImageType.split('/')[1] || 'png';
    //   const originalFileName = `${uniqueId}_original.${originalFileExtension}`;

    //   const generatedFileName = `${uniqueId}_generated.png`;
    //   const generatedContentType = 'image/png'; // Assuming generated image is always PNG

    //   // Upload both images concurrently
    //   const [uploadOriginalResult, uploadGeneratedResult] = await Promise.all([
    //     uploadFile({
    //       data: originalImageBase64,
    //       fileName: originalFileName,
    //       contentType: originalImageType,
    //       path: path
    //     }),
    //     uploadFile({
    //       data: images[0].base64,
    //       fileName: generatedFileName,
    //       contentType: generatedContentType,
    //       path: path
    //     })
    //   ]);

    //   console.log("Uploaded original image to R2:", uploadOriginalResult.url);
    //   console.log("Uploaded generated image to R2:", uploadGeneratedResult.url);
    // } catch (uploadError) {
    //   console.error("Failed to upload to R2:", uploadError);
    // }

    const resultImageUrl = `data:image/png;base64,${images[0].base64}`;
    return apiResponse.success({ imageUrl: resultImageUrl });

  } catch (error: any) {
    console.error("Image-to-Image generation failed:", error);
    const errorMessage = error?.message || "Failed to generate image";
    if (errorMessage.includes("API key") || errorMessage.includes("authentication")) {
      return apiResponse.serverError(`Server configuration error: ${errorMessage}`);
    }
    if (errorMessage.includes("Invalid Base64 Data URI")) {
      return apiResponse.badRequest(errorMessage);
    }
    return apiResponse.serverError(errorMessage);
  }
} 