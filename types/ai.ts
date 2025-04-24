interface ReplicatePredictionInput {
  prompt: string;
  duration: number;
  cfg_scale?: number;
  start_image?: string;
  aspect_ratio?: string;
  negative_prompt?: string;
  [key: string]: any;
}

interface ReplicatePredictionMetrics {
  predict_time?: number;
  total_time?: number;
  [key: string]: any;
}

interface ReplicatePredictionUrls {
  stream?: string;
  get: string;
  cancel: string;
}

export interface ReplicatePredictionResponse {
  id: string;
  version?: string;
  urls: ReplicatePredictionUrls;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  source?: 'api' | 'web' | string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  input: ReplicatePredictionInput;
  output: string | string[] | Record<string, any> | null;
  error: {
    message: string;
    cause: string | null;
    stack: string | null;
  } | null;
  logs: string | null;
  metrics?: ReplicatePredictionMetrics;
  data_removed?: boolean;
}
