interface CanvasLike {
  getContext: (type: string) => CanvasRenderingContext2D;
  toBuffer: (type: string) => Buffer;
}

export type CreateCanvasFn = (width: number, height: number) => CanvasLike;

let cachedCreateCanvas: CreateCanvasFn | null | undefined;

export async function getCreateCanvas(): Promise<CreateCanvasFn | null> {
  if (cachedCreateCanvas !== undefined) {
    return cachedCreateCanvas;
  }

  try {
    const canvasModule = await (Function(
      'return import("canvas")'
    )() as Promise<{
      createCanvas: (width: number, height: number) => CanvasLike;
    }>);
    cachedCreateCanvas = canvasModule.createCanvas;
    return cachedCreateCanvas;
  } catch {
    // Fall through to optional pure npm fallback used by pdfjs-dist in some setups.
  }

  try {
    const napiCanvasModule = await (Function(
      'return import("@napi-rs/canvas")'
    )() as Promise<{
      createCanvas: (width: number, height: number) => CanvasLike;
    }>);
    cachedCreateCanvas = napiCanvasModule.createCanvas;
    return cachedCreateCanvas;
  } catch {
    cachedCreateCanvas = null;
    return null;
  }
}
