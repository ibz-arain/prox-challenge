import { createCanvas } from "@napi-rs/canvas";

interface CanvasLike {
  getContext: (type: string) => CanvasRenderingContext2D;
  toBuffer: (type: string) => Buffer;
}

export type CreateCanvasFn = (width: number, height: number) => CanvasLike;

let cachedCreateCanvas: CreateCanvasFn | null | undefined;

/**
 * Static import so Next.js file tracing ships @napi-rs/canvas native binaries
 * into the /api/pages serverless bundle. Dynamic Function(import(...)) is invisible to the tracer.
 */
export async function getCreateCanvas(): Promise<CreateCanvasFn | null> {
  if (cachedCreateCanvas !== undefined) {
    return cachedCreateCanvas;
  }
  cachedCreateCanvas = createCanvas as unknown as CreateCanvasFn;
  return cachedCreateCanvas;
}
