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
const apiKey = recuperar(apiKeyReal);
const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey;
