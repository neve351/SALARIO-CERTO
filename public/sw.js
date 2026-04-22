self.addEventListener("install", e => {
  console.log("App instalado");
});

self.addEventListener("fetch", e => {
  // Necessário para ser considerado um PWA instalável
  e.respondWith(fetch(e.request));
});
