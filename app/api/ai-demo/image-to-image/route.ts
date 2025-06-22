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
// import { generateR2Key, getDataFromDataUrl, serverUploadFile } from "@/lib/cloudflare/r2"; // Optional: Uncomment if you want to upload results to R2
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
    // ---- Start R2 Upload ----
    // try {
    //   const path = `image-to-images/${provider}/${modelId}`;

    //   const originalImageData = getDataFromDataUrl(imageBase64DataUri);
    //   if (!originalImageData) {
    //     console.error("Failed to process original image data URI.");
    //     throw new Error("Invalid original image data.");
    //   }
    //   const originalImageExt = originalImageData.contentType.split('/')[1] || 'png';
    //   const originalImageKey = generateR2Key({
    //     fileName: `original.${originalImageExt}`,
    //     path: path,
    //     prefix: 'original'
    //   });

    //   const generatedImageDataUri = `data:image/png;base64,${images[0].base64}`;
    //   const generatedImageData = getDataFromDataUrl(generatedImageDataUri);
    //   if (!generatedImageData) {
    //     console.error("Failed to process generated image data URI.");
    //     throw new Error("Invalid generated image data.");
    //   }
    //   const generatedImageKey = generateR2Key({
    //     fileName: generatedImageData.contentType.split("/")[1],
    //     path: path,
    //   });

    //   const [uploadOriginalResult, uploadGeneratedResult] = await Promise.all([
    //     serverUploadFile({
    //       data: originalImageData.buffer,
    //       contentType: originalImageData.contentType,
    //       key: originalImageKey,
    //     }),
    //     serverUploadFile({
    //       data: generatedImageData.buffer,
    //       contentType: generatedImageData.contentType,
    //       key: generatedImageKey,
    //     })
    //   ]);

    //   console.log("Uploaded original image to R2:", uploadOriginalResult.url);
    //   console.log("Uploaded generated image to R2:", uploadGeneratedResult.url);
    // } catch (uploadError) {
    //   console.error("Failed to upload to R2:", uploadError);
    // }
    // ---- End R2 Upload ----

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