function ofuscar(texto) {
  return texto
    .split("")
    .reverse()
    .map(c => String.fromCharCode(c.charCodeAt(0) + 1))
    .join("");
}

function recuperar(ofuscado) {
  return ofuscado
    .split("")
    .reverse()
    .map(c => String.fromCharCode(c.charCodeAt(0) - 1))
    .join("");
}

// Ejemplo de uso
const apiKeyReal = "1sXGS3BKZJMXb[KTMJZmOuIvWXVDebTZBzTb{JB";

// Configuración de la API de Gemini
//const apiKey = "AIzaSyDP2Hav5sNMGqqQqBnM49mzCTI2nptxec8"  //
const apiKey =   "AIzaSyDExodbczLPp8GSV8OjGvzWd4pQW3I7e9g";
//const apiKey = recuperar(apiKeyReal);
//const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey;

// Alternativa si 2.5 Flash no está disponible
const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=" + apiKey;
const API_KEY = "8ba5395226c049bb8ff816496c16859c.8tGkqfsvheCvYom5";
const API_URL = "https://api.z.ai/api/paas/v4/chat/completions";

