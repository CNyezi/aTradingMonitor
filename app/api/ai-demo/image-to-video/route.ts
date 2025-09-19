/**
 * ai sdk docs:
 * https://sdk.vercel.ai/docs/reference/ai-sdk-core/generate-image
 * https://sdk.vercel.ai/providers/ai-sdk-providers
 */

import { IMAGE_TO_VIDEO_MODELS } from "@/config/models";
import { apiResponse } from "@/lib/api-response";
// import { generateR2Key, getDataFromDataUrl, serverUploadFile } from "@/lib/cloudflare/r2";
import { ReplicatePredictionResponse } from "@/types/ai";
import Replicate from "replicate";
import { z } from 'zod';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const inputSchema = z.object({
  image: z.string().startsWith('data:image/', "Invalid image data URI format"),
  prompt: z.string().min(1, "Prompt cannot be empty"),
  duration: z.union([z.literal(5), z.literal(10)], {
    errorMap: () => ({ message: "Duration must be the number 5 or 10" })
  }),
  modelId: z.string(),
  provider: z.literal('replicate'),
});

export async function POST(req: Request) {
  try {
    if (!process.env.REPLICATE_API_TOKEN) {
      return apiResponse.serverError("Server configuration error: Missing Replicate API Token.");
    }

    const rawBody = await req.json();

    const validationResult = inputSchema.safeParse(rawBody);
    if (!validationResult.success) {
      console.error("Input validation failed:", validationResult.error.errors);
      return apiResponse.badRequest(`Invalid input: ${validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }

    const { image: imageBase64DataUri, prompt, duration, modelId: fullModelVersionId, provider } = validationResult.data;

    const modelDefinition = IMAGE_TO_VIDEO_MODELS.find(m => m.provider === provider && m.id === fullModelVersionId);
    if (!modelDefinition) {
      return apiResponse.badRequest(`Unsupported model: ${provider}/${fullModelVersionId}`);
    }

    const replicateInput = {
      start_image: imageBase64DataUri,
      prompt: prompt,
      duration: duration,
    };

    // console.log(`Starting Replicate prediction for model version: ${fullModelVersionId}`);

    // 1. Start the prediction using predictions.create
    const initialPrediction = await replicate.predictions.create({
      version: fullModelVersionId,
      input: replicateInput,
      // Optional: Use webhooks for true async operation if needed
      // webhook: "YOUR_WEBHOOK_URL",
      // webhook_events_filter: ["completed"]
    });

    // console.log("Initial prediction created:", initialPrediction.id, initialPrediction.status);

    if (initialPrediction.status === 'failed') {
      console.error("Prediction failed immediately on creation:", initialPrediction.error);
      const errorMessage = typeof initialPrediction.error === 'string'
        ? initialPrediction.error
        : JSON.stringify(initialPrediction.error);
      return apiResponse.serverError(`Prediction creation failed: ${errorMessage}`);
    }
    if (initialPrediction.error) {
      console.warn("Non-fatal error during prediction creation:", initialPrediction.error);
    }


    // 2. Wait for the prediction to complete
    // console.log(`Waiting for prediction ${initialPrediction.id} to complete...`);
    const finalPrediction = await replicate.wait(initialPrediction, {}) as ReplicatePredictionResponse;

    // console.log(`Prediction ${finalPrediction.id} finished with status: ${finalPrediction.status}`);

    // 3. Check the final status and process the result
    if (finalPrediction.status === 'succeeded') {
      const output = finalPrediction.output;
      const replicateVideoUrl = Array.isArray(output) ? output[0] : typeof output === 'string' ? output : null;

      if (!replicateVideoUrl || typeof replicateVideoUrl !== 'string' || !replicateVideoUrl.startsWith('http')) {
        console.error(`Replicate output did not contain a valid video URL. Status: ${finalPrediction.status}, Output:`, output);
        return apiResponse.serverError("Video generation succeeded, but no valid video URL was found in the output.");
      }

      let finalVideoUrl = replicateVideoUrl;

      // Optional: Upload to R2
      // ---- Start R2 Upload ----
      // try {
      //   const path = `image-to-videos/${provider}/${fullModelVersionId.replace(':', '/')}`;

      //   const videoResponse = await fetch(replicateVideoUrl);
      //   if (!videoResponse.ok) {
      //     throw new Error(`Failed to fetch video from Replicate: ${videoResponse.statusText}`);
      //   }
      //   const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
      //   const videoContentType = videoResponse.headers.get("content-type") || "video/mp4";
      //   const videoKey = generateR2Key({
      //     fileName: videoContentType.split('/')[1] || 'mp4',
      //     path: path,
      //   });

      //   const originalImageData = getDataFromDataUrl(imageBase64DataUri);

      //   if (!originalImageData) {
      //     throw new Error("Invalid source image data.");
      //   }
      //   const originalImageKey = generateR2Key({
      //     fileName: originalImageData.contentType.split('/')[1] || 'png',
      //     path: path,
      //   });

      //   const [uploadVideoResult] = await Promise.all([
      //     serverUploadFile({
      //       data: videoBuffer,
      //       contentType: videoContentType,
      //       key: videoKey,
      //     }),
      //   ]);

      //   finalVideoUrl = uploadVideoResult.url;
      //   console.log("Uploaded generated video to R2:", uploadVideoResult.url);
      // } catch (uploadError: any) {
      //   console.error("Failed to upload assets to R2:", uploadError);
      //   return apiResponse.serverError("Video generation succeeded, but failed to store the assets permanently.");
      // }
      // ---- End R2 Upload ----

      return apiResponse.success({ videoUrl: finalVideoUrl });

    } else {
      console.error(`Replicate job did not succeed. Status: ${finalPrediction.status}`, finalPrediction.error);
      let errorMessage = `Video generation ${finalPrediction.status}.`;
      if (finalPrediction.error) {
        errorMessage = `Video generation ${finalPrediction.status}: ${finalPrediction.error.message || JSON.stringify(finalPrediction.error)}`;
        if (finalPrediction.error.stack) console.error("Replicate Error Stack:", finalPrediction.error.stack);
      } else if (finalPrediction.logs) {
        errorMessage += ` Check logs: ${finalPrediction.logs.slice(-500)}`;
      }
      return apiResponse.serverError(errorMessage);
    }

  } catch (error: any) {
    console.error("Image-to-Video API endpoint error:", error);
    let errorMessage = error?.message || "An unexpected error occurred during video generation";
    let statusCode = 500;

    if (error.statusCode === 401 || error.statusCode === 403) {
      errorMessage = "Authentication error: Invalid Replicate API Token.";
      statusCode = 401;
    } else if (error.statusCode === 404 && error.message?.includes('version')) {
      errorMessage = "Model version not found. Ensure 'modelId' includes the correct version hash (owner/name:version_hash).";
      statusCode = 400;
    } else if (error.statusCode === 422) {
      errorMessage = `Invalid input for the Replicate model: ${error.message || 'Check model requirements.'}`;
      statusCode = 400;
    } else if (errorMessage.includes("Input validation failed")) {
      errorMessage = `API Input Error: ${error.message}`;
      statusCode = 400;
    } else if (error.name === 'AbortError') {
      errorMessage = "Request timed out or was aborted.";
      statusCode = 504;
    }

    switch (statusCode) {
      case 400: return apiResponse.badRequest(errorMessage);
      case 401: return apiResponse.unauthorized(errorMessage);
      case 404: return apiResponse.notFound(errorMessage);
      case 504: return apiResponse.serverError(errorMessage);
      default: return apiResponse.serverError(errorMessage);
    }
  }
} 