export async function loadJson(path) {
  const response = await fetch(new URL(path, import.meta.url));
  return response.json();
}

export const [scene, texts] = await Promise.all([
  loadJson("../data/objects.json"),
  loadJson("../data/text.json")
]);
