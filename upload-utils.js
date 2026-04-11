// upload-utils.js — dbarrio
// Compresión y validación de archivos antes de subir a Supabase Storage
// Usar en: socio.html (evidencias), tecnico.html (documentos)

const UPLOAD_CONFIG = {
  // Imágenes (fotos de evidencia, foto perfil, foto herramientas, carnet)
  image: {
    maxSizeMB: 1,          // Límite final tras comprimir
    maxOriginalMB: 10,     // Rechaza si el original supera esto
    quality: 0.75,         // Calidad JPEG (0-1)
    maxWidthPx: 1200,      // Redimensiona si supera este ancho
  },
  // Documentos (PDF: título, currículo)
  pdf: {
    maxSizeMB: 2,          // PDFs no se comprimen, solo se valida tamaño
  },
};

/**
 * Comprime una imagen antes de subirla.
 * Devuelve un Blob listo para Supabase Storage.
 * @param {File} file — archivo de imagen original
 * @returns {Promise<{blob: Blob, sizeMB: number, error: string|null}>}
 */
async function compressImage(file) {
  const cfg = UPLOAD_CONFIG.image;

  // Validar tipo
  if (!file.type.startsWith("image/")) {
    return { blob: null, sizeMB: 0, error: "El archivo debe ser una imagen (JPG, PNG, WEBP)." };
  }

  // Validar tamaño original
  const originalMB = file.size / (1024 * 1024);
  if (originalMB > cfg.maxOriginalMB) {
    return { blob: null, sizeMB: 0, error: `La imagen supera los ${cfg.maxOriginalMB} MB. Usa una foto más pequeña.` };
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Calcular dimensiones respetando proporción
      let { width, height } = img;
      if (width > cfg.maxWidthPx) {
        height = Math.round((height * cfg.maxWidthPx) / width);
        width = cfg.maxWidthPx;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve({ blob: null, sizeMB: 0, error: "No se pudo procesar la imagen." });
            return;
          }
          const sizeMB = blob.size / (1024 * 1024);
          if (sizeMB > cfg.maxSizeMB) {
            resolve({ blob: null, sizeMB, error: `La imagen sigue siendo demasiado grande (${sizeMB.toFixed(1)} MB). Usa una foto con menos resolución.` });
            return;
          }
          resolve({ blob, sizeMB, error: null });
        },
        "image/jpeg",
        cfg.quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ blob: null, sizeMB: 0, error: "No se pudo leer la imagen." });
    };

    img.src = url;
  });
}

/**
 * Valida un PDF (no se comprime, solo se verifica tamaño y tipo).
 * @param {File} file
 * @returns {{valid: boolean, error: string|null}}
 */
function validatePDF(file) {
  if (file.type !== "application/pdf") {
    return { valid: false, error: "El documento debe ser un archivo PDF." };
  }
  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > UPLOAD_CONFIG.pdf.maxSizeMB) {
    return { valid: false, error: `El PDF supera los ${UPLOAD_CONFIG.pdf.maxSizeMB} MB. Comprime el documento antes de subirlo.` };
  }
  return { valid: true, error: null };
}

/**
 * Sube un archivo (ya procesado) a Supabase Storage.
 * @param {SupabaseClient} supabase
 * @param {Blob|File} fileOrBlob
 * @param {string} bucket — nombre del bucket en Supabase
 * @param {string} path — ruta dentro del bucket, ej: "tecnicos/uuid/titulo.pdf"
 * @returns {Promise<{url: string|null, error: string|null}>}
 */
async function uploadToSupabase(supabase, fileOrBlob, bucket, path) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, fileOrBlob, {
      upsert: true,
      contentType: fileOrBlob.type || "application/octet-stream",
    });

  if (error) {
    console.error("Supabase upload error:", error);
    return { url: null, error: "Error al subir el archivo. Intenta de nuevo." };
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: urlData.publicUrl, error: null };
}

/**
 * Función principal — procesa y sube cualquier archivo.
 * Detecta automáticamente si es imagen o PDF.
 *
 * @param {SupabaseClient} supabase
 * @param {File} file — archivo del input
 * @param {string} bucket
 * @param {string} path
 * @param {function} onProgress — callback(mensaje) para mostrar estado al usuario
 * @returns {Promise<{url: string|null, error: string|null}>}
 *
 * EJEMPLO DE USO:
 *
 * const resultado = await processAndUpload(
 *   supabase,
 *   inputFoto.files[0],
 *   "evidencias",
 *   `ordenes/${ordenId}/foto_antes.jpg`,
 *   (msg) => statusDiv.textContent = msg
 * );
 * if (resultado.error) {
 *   mostrarError(resultado.error);
 * } else {
 *   guardarURL(resultado.url);
 * }
 */
async function processAndUpload(supabase, file, bucket, path, onProgress = () => {}) {
  if (!file) return { url: null, error: "No se seleccionó ningún archivo." };

  // --- IMAGEN ---
  if (file.type.startsWith("image/")) {
    onProgress("Procesando imagen...");
    const { blob, error } = await compressImage(file);
    if (error) return { url: null, error };

    onProgress("Subiendo imagen...");
    return await uploadToSupabase(supabase, blob, bucket, path);
  }

  // --- PDF ---
  if (file.type === "application/pdf") {
    const { valid, error } = validatePDF(file);
    if (!valid) return { url: null, error };

    onProgress("Subiendo documento...");
    return await uploadToSupabase(supabase, file, bucket, path);
  }

  return { url: null, error: "Tipo de archivo no permitido. Solo imágenes (JPG, PNG) o PDF." };
}

// Exportar para uso en módulos o acceso global
if (typeof module !== "undefined") {
  module.exports = { processAndUpload, compressImage, validatePDF, uploadToSupabase };
} else {
  window.dbUpload = { processAndUpload, compressImage, validatePDF, uploadToSupabase };
}
