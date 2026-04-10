/**
 * Strips an incomplete <artifact ...> tail so streaming UI does not go blank
 * while the model is still inside the tag. Matches AssistantMessage behavior.
 */
export function stripTrailingIncompleteArtifact(text: string): string {
  return text
    .replace(/<artifact[\s\S]*$/i, "")
    .replace(/<\/artifact>/gi, "")
    .trimEnd();
}
